import React from "react";
import { Box, Text, useInput, useStdin } from "ink";

interface UserInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  disabled: boolean;
}

export function UserInput({ value, onChange, onSubmit, disabled }: UserInputProps): React.ReactElement {
  const { isRawModeSupported } = useStdin();
  useInput(
    (input, key) => {
      if (disabled) return;
      if (key.return) {
        const trimmed = value.trim();
        if (trimmed) {
          onSubmit(trimmed);
          onChange("");
        }
        return;
      }
      if (key.backspace || key.delete) {
        onChange(value.slice(0, -1));
        return;
      }
      if (key.ctrl || key.meta) return;
      if (input) onChange(value + input);
    },
    { isActive: isRawModeSupported },
  );

  return (
    <Box borderStyle="single" paddingX={1} flexShrink={0}>
      {disabled ? (
        <Text dimColor>● thinking…</Text>
      ) : (
        <Text>
          <Text dimColor>{"> "}</Text>
          {value}
          <Text color="cyan">▌</Text>
        </Text>
      )}
    </Box>
  );
}
