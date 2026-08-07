import { workerNames } from '../constants'

export const PARALLEL_DISPATCH_RULES_EN = `# Multi-Window Dispatch Rules

The main conversation agent always has the \`parallel_dispatch\` tool. It is not a separate "mode"; it is the required dispatch capability for tasks that operate on multiple browser windows/profiles.

Available workers: ${workerNames.join(', ')}

## When to use parallel_dispatch

- If the user task requires operating on **multiple browser windows/profiles**, you must call \`parallel_dispatch\` and split the work into one assignment per window/profile.
- If the user task involves **one browser window/profile**, do not call \`parallel_dispatch\`; complete it directly with normal tools.
- If no window is specified but the task clearly requires one, confirm the target window first, or list available windows with tools and ask the user to choose.
- If the user selects multiple windows while asking for sequential / one-by-one execution, explain that multi-window browser tasks are dispatched per window and confirm whether to continue; do not squeeze multiple windows into one worker.

## Usage rules

When dispatch is required, call \`parallel_dispatch\` once with all assignments:

\`\`\`json
{
  "assignments": [
    { "worker": "profile-worker-0", "task": "Use dirId: abc and complete the user's task inside that window only", "title": "Run task in window abc", "dirId": "abc" },
    { "worker": "profile-worker-1", "task": "Use dirId: def and complete the user's task inside that window only", "title": "Run task in window def", "dirId": "def" }
  ]
}
\`\`\`

## assignment.task payload contract

- Each worker task must be self-contained.
- Each worker may bind to exactly one window/profile.
- Always reuse the user-selected window; never create a new one.
- The assignment's \`dirId\` field is **required** and must be a real dirId. It hard-binds the worker to that window; touching any other window is rejected outright.
- When the user only gives a \`profile_name\`, \`profile_serialNo\`, or \`profile_id\`, **resolve it to a real dirId with \`roxy_list_browsers\` before dispatching**. Never put a profile_ref in the \`dirId\` field, and never leave the lookup to the worker.
- If a reference cannot be resolved to a window, do not guess and do not substitute a similar window; tell the user that reference could not be located.
- Every assignment's \`dirId\` must be distinct — one window cannot be dispatched to two workers.
- **Windows are not substitutable**: if a window fails to open or errors out, mark only that assignment as failed and report why. Never switch to a different \`dirId\`, never call \`roxy_list_browsers\` to pick the next window in order, and never create a replacement window.
- Write the resolved concrete \`dirId\` into the \`task\` text as well, matching the assignment's \`dirId\` field.
- Resource reference syntax in the user's input is an internal parsing rule; assignment.task must carry only the resolved concrete values, and must not repeat the \`[@profile]\`, \`[@script]\`, \`[@resource]\`, or \`[$skill]\` rules.
- Each task must explicitly include:
  - Use the specified \`dirId\`.
  - Execute all browser actions only inside that window/profile.
  - When running a user script template, include only the resolved numeric script template id.
  - When files or skills are needed, include only the resolved local paths.

## Synthesis responsibilities

- Wait for all workers to return before giving the merged result to the user.
- Deduplicate worker outputs and call out conflicts, failed windows, and retry suggestions.
- For complex tasks, you may use \`write_todos\` to show plan and progress; tool args must use only \`content\` and \`status\`.`
