import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Text, useInput, useStdin } from "ink";
import type {
  Agent,
  ILogger,
  PendingApproval,
  PendingClarification,
  ToolDescriptor,
  ToolHandler,
} from "../core/interfaces.ts";
import { SuspendingClarificationHandler } from "../index.ts";
import { McpServerRegistry } from "../mcp/index.ts";
import { metricsPlugin } from "../plugins/metrics_plugin.ts";
import type { CliConfig } from "./config.ts";
import { createCliAgent } from "./create_agent.ts";
import { Header } from "./components/Header.tsx";
import { MessageList } from "./components/MessageList.tsx";
import { HitlConfirm } from "./components/HitlConfirm.tsx";
import { ClarifyPrompt } from "./components/ClarifyPrompt.tsx";
import { UserInput } from "./components/UserInput.tsx";
import type { FinishedMessage } from "./components/MessageList.tsx";
import { type ToolEventData, summarizeInput, summarizeResult } from "./components/ToolEvent.tsx";

interface AppProps {
  config: CliConfig;
  workdir: string;
  sessionId: string;
  logger: ILogger;
}

export function App({ config, workdir, sessionId, logger }: AppProps): React.ReactElement {
  const { isRawModeSupported } = useStdin();

  // Agent lifecycle
  const agentRef = useRef<Agent | null>(null);
  const mcpRef = useRef<McpServerRegistry | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Conversation state
  const [messages, setMessages] = useState<FinishedMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingThinking, setStreamingThinking] = useState("");
  const [streamingTools, setStreamingTools] = useState<ToolEventData[]>([]);
  const [pendingHitl, setPendingHitl] = useState<PendingApproval | null>(null);
  const [pendingClarify, setPendingClarify] = useState<PendingClarification | null>(null);

  // Refs to avoid stale closures in async loops
  const streamingToolsRef = useRef<ToolEventData[]>([]);
  const streamingTextRef = useRef<string>("");
  const streamingThinkingRef = useRef<string>("");

  const handleExit = useCallback(() => {
    const cleanup = async () => {
      try {
        await agentRef.current?.dispose();
      } catch {
        /* ignore */
      }
      try {
        await mcpRef.current?.disconnectAll();
      } catch {
        /* ignore */
      }
    };
    void cleanup().finally(() => process.exit(0));
  }, []);

  // Ctrl+C to quit
  useInput(
    (_input, key) => {
      if (key.ctrl && _input === "c") handleExit();
    },
    { isActive: isRawModeSupported },
  );

  // -------------------------------------------------------------------------
  // Agent initialisation
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const extraTools: Array<{ descriptor: ToolDescriptor; handler: ToolHandler }> = [];

        // MCP
        if (config.mcp.servers.length > 0) {
          const mcpRegistry = new McpServerRegistry();
          mcpRef.current = mcpRegistry;
          try {
            await mcpRegistry.load(config.mcp.servers);
            for (const desc of mcpRegistry.tools()) {
              extraTools.push({
                descriptor: desc,
                handler: (input, ctx, toolUseId = "") => mcpRegistry.callTool(desc.name, input, ctx, toolUseId),
              });
            }
            logger.info("MCP servers loaded", { count: mcpRegistry.tools().length });
          } catch (err) {
            logger.warn("MCP server load failed — continuing without MCP", {
              error: String(err),
            });
          }
        }

        // Skills are scanned by the CLI adapter; their paths are advertised in
        // the system prompt's skill-index block and read on demand via
        // read_file (skill dirs are path-permission allow roots).

        // The CLI owns its application plugins; serialized config cannot carry
        // runtime objects or setup callbacks.
        const plugins = [metricsPlugin({ outputDir: "./.roxy-agent-runtime/metrics" })];
        const agent = await createCliAgent(config, {
          sessionId,
          tools: extraTools,
          workdir,
          plugins,
          logger,
          // Interactive ask_user channel: parked questions surface as
          // clarification_pending stream events, rendered by ClarifyPrompt.
          ...(config.clarification.enabled
            ? {
                clarification: new SuspendingClarificationHandler(
                  config.clarification.timeoutMs ? { timeoutMs: config.clarification.timeoutMs } : {},
                ),
              }
            : {}),
        });
        if (cancelled) {
          await agent.dispose();
          return;
        }

        agentRef.current = agent;
        setIsReady(true);
        logger.info("Agent ready", { agentId: agent.id, sessionId, plugins: plugins.length });
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setInitError(msg);
          logger.error("Agent init failed", { error: msg });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Submit handler
  // -------------------------------------------------------------------------
  const handleSubmit = useCallback(
    async (text: string) => {
      if (text === "/exit") {
        handleExit();
        return;
      }

      const agent = agentRef.current;
      if (!agent || isThinking) return;

      logger.debug("User input", { text });

      // Add user message to history
      setMessages((prev) => [...prev, { kind: "user", text, tools: [] }]);
      setIsThinking(true);
      streamingTextRef.current = "";
      streamingThinkingRef.current = "";
      streamingToolsRef.current = [];
      setStreamingText("");
      setStreamingThinking("");
      setStreamingTools([]);

      const toolStartTimes = new Map<string, number>();

      try {
        for await (const event of agent.stream(text)) {
          if (event.type === "text") {
            streamingTextRef.current += event.delta;
            setStreamingText(streamingTextRef.current);
          } else if (event.type === "thinking") {
            streamingThinkingRef.current += event.delta;
            setStreamingThinking(streamingThinkingRef.current);
          } else if (event.type === "tool_call") {
            const td: ToolEventData = {
              toolName: event.block.name,
              inputSummary: summarizeInput(event.block.input),
              status: "pending",
            };
            toolStartTimes.set(event.block.id, Date.now());
            streamingToolsRef.current = [...streamingToolsRef.current, td];
            setStreamingTools([...streamingToolsRef.current]);
            logger.debug("Tool call started", { toolName: event.block.name });
          } else if (event.type === "tool_result") {
            const r = event.result;
            const durationMs = toolStartTimes.has(r.toolUseId)
              ? Date.now() - toolStartTimes.get(r.toolUseId)!
              : undefined;
            streamingToolsRef.current = streamingToolsRef.current.map((t, idx) => {
              // match by position if toolUseId doesn't map to name
              const isPending = t.status === "pending";
              const isLast = idx === streamingToolsRef.current.findLastIndex((x) => x.status === "pending");
              if (!isPending || !isLast) return t;
              return {
                ...t,
                status: r.isError ? "error" : "resolved",
                resultSummary: summarizeResult(r.content),
                durationMs,
              } as ToolEventData;
            });
            setStreamingTools([...streamingToolsRef.current]);
          } else if (event.type === "hitl_pending") {
            setPendingHitl(event.pending);
          } else if (event.type === "clarification_pending") {
            setPendingClarify(event.pending);
          } else if (event.type === "done") {
            // Capture before clearing — React 18 batching runs updater functions
            // during reconciliation, AFTER synchronous ref mutations below.
            const finalText = streamingTextRef.current;
            const finalThinking = streamingThinkingRef.current;
            const finalTools = [...streamingToolsRef.current];
            streamingTextRef.current = "";
            streamingThinkingRef.current = "";
            streamingToolsRef.current = [];
            setMessages((prev) => [
              ...prev,
              {
                kind: "assistant",
                text: finalText,
                tools: finalTools,
                ...(finalThinking ? { thinking: finalThinking } : {}),
              },
            ]);
            setIsThinking(false);
            setStreamingText("");
            setStreamingThinking("");
            setStreamingTools([]);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("Stream error", { error: msg });
        setMessages((prev) => [...prev, { kind: "assistant", text: `Error: ${msg}`, tools: [] }]);
        setIsThinking(false);
        setStreamingText("");
        setStreamingThinking("");
        setStreamingTools([]);
      }
    },
    [isThinking, logger, handleExit],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (initError) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red" bold>
          Initialisation failed
        </Text>
        <Text>{initError}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      <Header model={config.provider.model} sessionId={sessionId} workdir={workdir} isReady={isReady} />

      <MessageList
        messages={messages}
        streamingText={streamingText}
        streamingThinking={streamingThinking}
        streamingTools={streamingTools}
        isThinking={isThinking}
      />

      {pendingHitl && <HitlConfirm pending={pendingHitl} onDone={() => setPendingHitl(null)} />}

      {pendingClarify && !pendingHitl && (
        <ClarifyPrompt pending={pendingClarify} onDone={() => setPendingClarify(null)} />
      )}

      <UserInput
        value={inputText}
        onChange={setInputText}
        onSubmit={handleSubmit}
        disabled={!isReady || isThinking || pendingHitl != null || pendingClarify != null}
      />
    </Box>
  );
}
