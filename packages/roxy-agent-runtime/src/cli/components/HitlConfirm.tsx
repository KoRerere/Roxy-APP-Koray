import React, { useState } from "react";
import { Box, Text, useInput, useStdin } from "ink";
import type { PendingApproval } from "../../core/interfaces.ts";

interface HitlConfirmProps {
  pending: PendingApproval;
  onDone: () => void;
}

/** Derive a sensible default pattern to pre-fill the "always" input box. */
function suggestPattern(toolName: string, input: unknown): { toolPattern: string; commandPattern?: string } {
  if (toolName === "execute") {
    const cmd = (input as { command?: unknown } | undefined)?.command;
    if (typeof cmd === "string" && cmd.trim()) {
      const firstWord = cmd.trim().split(/\s+/)[0] ?? cmd.trim();
      return { toolPattern: "execute", commandPattern: `${firstWord} *` };
    }
    return { toolPattern: "execute" };
  }
  return { toolPattern: toolName };
}

type Phase = "confirm" | "always";
type AlwaysField = "tool" | "command";

/** Minimal inline text editor using raw key input. */
function useTextEditor(initial: string): [string, (key: string, isDelete: boolean) => void] {
  const [value, setValue] = useState(initial);
  const handleKey = (ch: string, isDelete: boolean) => {
    if (isDelete) {
      setValue((v) => v.slice(0, -1));
    } else if (ch) {
      setValue((v) => v + ch);
    }
  };
  return [value, handleKey];
}

export function HitlConfirm({ pending, onDone }: HitlConfirmProps): React.ReactElement {
  const { request, resume } = pending;
  const { isRawModeSupported } = useStdin();

  const [phase, setPhase] = useState<Phase>("confirm");
  const suggested = suggestPattern(request.toolName, request.input);
  const [activeField, setActiveField] = useState<AlwaysField>(suggested.commandPattern ? "command" : "tool");
  const [toolPattern, toolKey] = useTextEditor(suggested.toolPattern);
  const [commandPattern, commandKey] = useTextEditor(suggested.commandPattern ?? "");

  useInput(
    (input, key) => {
      // ── confirm phase ───────────────────────────────────────────────────
      if (phase === "confirm") {
        if (key.escape || input === "n" || input === "N") {
          resume({ decision: "reject", feedback: "User rejected via CLI" });
          onDone();
        } else if (input === "y" || input === "Y") {
          resume({ decision: "approve" });
          onDone();
        } else if (input === "a" || input === "A") {
          setPhase("always");
        }
        return;
      }

      // ── always phase ────────────────────────────────────────────────────
      if (key.escape) {
        setPhase("confirm");
        return;
      }
      if (key.tab) {
        setActiveField((f) => (f === "tool" ? "command" : "tool"));
        return;
      }
      if (key.return) {
        const remember = {
          toolPattern,
          ...(commandPattern.trim() ? { commandPattern: commandPattern.trim() } : {}),
        };
        resume({ decision: "approve", remember });
        onDone();
        return;
      }
      // Route printable characters + backspace to the active field
      const isDelete = key.delete || key.backspace;
      const ch = !key.ctrl && !key.meta && input.length === 1 ? input : "";
      if (activeField === "tool") {
        toolKey(ch, isDelete);
      } else {
        commandKey(ch, isDelete);
      }
    },
    { isActive: isRawModeSupported },
  );

  const inputStr = request.input != null ? JSON.stringify(request.input).slice(0, 120) : "";
  const diffLines = request.diff ? request.diff.split("\n") : [];

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} marginY={1}>
      <Text bold color="yellow">
        ⚠ HITL: {request.toolName}
      </Text>
      {inputStr && <Text dimColor> {inputStr}</Text>}

      {diffLines.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>{"   "}── diff ──────────────────────────────────────</Text>
          {diffLines.map((line, i) => {
            const color =
              line.startsWith("+") && !line.startsWith("+++")
                ? "green"
                : line.startsWith("-") && !line.startsWith("---")
                  ? "red"
                  : line.startsWith("@@")
                    ? "cyan"
                    : undefined;
            return (
              <Text key={i} color={color} dimColor={!color}>
                {"   "}
                {line}
              </Text>
            );
          })}
        </Box>
      )}

      {phase === "confirm" && (
        <Box marginTop={1}>
          <Text>
            {"   "}Allow this tool call?{"  "}
            <Text bold color="green">
              [y]
            </Text>
            es{"  "}
            <Text bold color="red">
              [n]
            </Text>
            o{"  "}
            <Text bold color="cyan">
              [a]
            </Text>
            lways
          </Text>
        </Box>
      )}

      {phase === "always" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">{"   "}── Don't ask again ─────────────────────────</Text>
          <Box marginTop={1}>
            <Text dimColor>{"   "}Tool pattern : </Text>
            <Text color={activeField === "tool" ? "white" : "gray"}>{toolPattern}</Text>
            {activeField === "tool" && <Text color="cyan">█</Text>}
          </Box>
          {request.toolName === "execute" && (
            <Box>
              <Text dimColor>{"   "}Cmd pattern : </Text>
              <Text color={activeField === "command" ? "white" : "gray"}>{commandPattern}</Text>
              {activeField === "command" && <Text color="cyan">█</Text>}
            </Box>
          )}
          <Box marginTop={1}>
            <Text dimColor>
              {"   "}
              <Text bold>[Tab]</Text> switch <Text bold>[Enter]</Text> confirm <Text bold>[Esc]</Text> back
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
