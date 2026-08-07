import React from "react";
import { Box, Text, Static } from "ink";
import { ToolEvent } from "./ToolEvent.tsx";
import type { ToolEventData } from "./ToolEvent.tsx";

export interface FinishedMessage {
  kind: "user" | "assistant";
  text: string;
  tools: ToolEventData[];
  /** Extended-thinking content (rendered dimmed, above the answer). */
  thinking?: string;
}

interface MessageListProps {
  messages: FinishedMessage[];
  streamingText: string;
  streamingThinking: string;
  streamingTools: ToolEventData[];
  isThinking: boolean;
}

function MessageItem({ msg }: { msg: FinishedMessage }): React.ReactElement {
  if (msg.kind === "user") {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="cyan">
          You
        </Text>
        <Text>{msg.text}</Text>
      </Box>
    );
  }
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="green">
        Agent
      </Text>
      {msg.thinking && <Text dimColor>{"💭 " + msg.thinking}</Text>}
      {msg.tools.map((t, i) => (
        <ToolEvent key={i} event={t} />
      ))}
      {msg.text && <Text>{msg.text}</Text>}
    </Box>
  );
}

export function MessageList({
  messages,
  streamingText,
  streamingThinking,
  streamingTools,
  isThinking,
}: MessageListProps): React.ReactElement {
  const hasStreaming =
    isThinking || streamingText.length > 0 || streamingThinking.length > 0 || streamingTools.length > 0;

  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden">
      {/* Static renders finished messages without re-drawing them each tick */}
      <Static items={messages}>{(msg, i) => <MessageItem key={i} msg={msg} />}</Static>

      {/* Live streaming turn */}
      {hasStreaming && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="green">
            Agent
          </Text>
          {streamingThinking && <Text dimColor>{"💭 " + streamingThinking}</Text>}
          {streamingTools.map((t, i) => (
            <ToolEvent key={i} event={t} />
          ))}
          {streamingText && <Text>{streamingText}</Text>}
          {isThinking &&
            streamingText.length === 0 &&
            streamingThinking.length === 0 &&
            streamingTools.length === 0 && <Text dimColor>…</Text>}
        </Box>
      )}
    </Box>
  );
}
