import React, { useState } from "react";
import { Box, Text, useInput, useStdin } from "ink";
import type { PendingClarification } from "../../core/interfaces.ts";

interface ClarifyPromptProps {
  pending: PendingClarification;
  onDone: () => void;
}

/**
 * Interactive answer box for a parked `ask_user` call. Options present →
 * pick by number (1-9); otherwise free-text entry. Esc submits an empty
 * answer (the model is expected to fall back to a sensible default).
 */
export function ClarifyPrompt({ pending, onDone }: ClarifyPromptProps): React.ReactElement {
  const { request, resume } = pending;
  const { isRawModeSupported } = useStdin();
  const [text, setText] = useState("");
  const options = request.options ?? [];
  const hasOptions = options.length > 0;

  useInput(
    (input, key) => {
      if (key.escape) {
        resume({ answer: "" });
        onDone();
        return;
      }
      if (hasOptions) {
        const n = Number.parseInt(input, 10);
        if (n >= 1 && n <= options.length) {
          resume({ answer: options[n - 1]! });
          onDone();
        }
        return;
      }
      if (key.return) {
        resume({ answer: text.trim() });
        onDone();
        return;
      }
      if (key.backspace || key.delete) {
        setText((t) => t.slice(0, -1));
        return;
      }
      if (key.ctrl || key.meta) return;
      if (input) setText((t) => t + input);
    },
    { isActive: isRawModeSupported },
  );

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginY={1}>
      <Text bold color="cyan">
        ? {request.question}
      </Text>
      {hasOptions ? (
        <>
          {options.map((opt, i) => (
            <Text key={opt}>
              {"   "}
              <Text bold color="cyan">
                [{i + 1}]
              </Text>{" "}
              {opt}
            </Text>
          ))}
          <Text dimColor>{"   "}pick a number · Esc to skip</Text>
        </>
      ) : (
        <Text>
          {"   "}
          <Text dimColor>{"> "}</Text>
          {text}
          <Text color="cyan">▌</Text>
          <Text dimColor> (Enter to send · Esc to skip)</Text>
        </Text>
      )}
    </Box>
  );
}
