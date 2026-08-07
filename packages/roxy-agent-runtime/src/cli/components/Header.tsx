import React from "react";
import { Box, Text } from "ink";

interface HeaderProps {
  model: string;
  sessionId: string;
  workdir: string;
  isReady: boolean;
}

export function Header({ model, sessionId, workdir, isReady }: HeaderProps): React.ReactElement {
  const shortId = sessionId.slice(0, 8);
  return (
    <Box borderStyle="single" paddingX={1} flexShrink={0}>
      <Text bold color="cyan">
        roxy
      </Text>
      <Text>{"  "}</Text>
      <Text dimColor>{model}</Text>
      <Text>{"  "}</Text>
      <Text dimColor>sess:{shortId}</Text>
      <Text>{"  "}</Text>
      <Text dimColor>{workdir}</Text>
      {!isReady && (
        <>
          <Text>{"  "}</Text>
          <Text color="yellow">initializing…</Text>
        </>
      )}
    </Box>
  );
}
