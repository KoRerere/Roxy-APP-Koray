import React from "react";
import { Box, Text } from "ink";

export type ToolEventStatus = "pending" | "resolved" | "error";

export interface ToolEventData {
  toolName: string;
  inputSummary: string;
  status: ToolEventStatus;
  resultSummary?: string;
  durationMs?: number;
}

function summarizeInput(input: unknown): string {
  if (input === null || input === undefined) return "";
  if (typeof input === "string") return input.slice(0, 60);
  const str = JSON.stringify(input);
  return str.length > 60 ? str.slice(0, 57) + "…" : str;
}

function summarizeResult(content: string | unknown): string {
  const str = typeof content === "string" ? content : JSON.stringify(content);
  if (str.length <= 80) return str;
  // show first line only
  const firstLine = str.split("\n")[0] ?? str;
  return firstLine.slice(0, 77) + "…";
}

export { summarizeInput, summarizeResult };

interface ToolEventProps {
  event: ToolEventData;
}

export function ToolEvent({ event }: ToolEventProps): React.ReactElement {
  const { toolName, inputSummary, status, resultSummary, durationMs } = event;

  if (status === "pending") {
    return (
      <Box marginLeft={2}>
        <Text color="yellow">⚙ </Text>
        <Text bold>{toolName}</Text>
        {inputSummary && <Text dimColor> {inputSummary}</Text>}
      </Box>
    );
  }

  if (status === "error") {
    return (
      <Box marginLeft={2}>
        <Text color="red">✗ </Text>
        <Text bold>{toolName}</Text>
        {resultSummary && <Text color="red"> {resultSummary}</Text>}
      </Box>
    );
  }

  return (
    <Box marginLeft={2}>
      <Text color="green">✓ </Text>
      <Text bold>{toolName}</Text>
      {resultSummary && <Text dimColor> {resultSummary}</Text>}
      {durationMs != null && <Text dimColor> ({durationMs}ms)</Text>}
    </Box>
  );
}
