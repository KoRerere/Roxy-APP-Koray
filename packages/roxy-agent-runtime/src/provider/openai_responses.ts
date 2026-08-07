import OpenAI from "openai";
import type {
  Response,
  ResponseCreateParamsNonStreaming,
  ResponseCreateParamsStreaming,
  ResponseCustomToolCall,
  ResponseFunctionToolCall,
  ResponseInputItem,
  ResponseOutputItem,
  ResponseReasoningItem,
  Tool,
} from "openai/resources/responses/responses";
import type {
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  ContentBlock,
  IModelProvider,
  Message,
  ModelUsage,
  ProviderState,
  StopReason,
  StructuredOutputFn,
  StructuredOutputOptions,
  ToolDescriptor,
  ToolResultBlock,
  ToolUseBlock,
} from "../core/interfaces.ts";
import { zodToJsonSchema } from "../tools/schema.ts";
import { estimateTokens } from "./estimate.ts";
import type { ZodType } from "zod";

const PROVIDER_ID = "openai-responses";
const DEFAULT_CONTEXT_WINDOW_TOKENS = 262144;
const STRUCTURED_OUTPUT_MAX_TOKENS = 4096;

type ResponsesReasoning = NonNullable<ResponseCreateParamsNonStreaming["reasoning"]>;
type ToolKind = "function" | "custom";

/** State required to replay a stateless Responses turn without protocol loss. */
export interface OpenAIResponsesTurnState {
  items: ResponseOutputItem[];
  toolKinds: Record<string, ToolKind>;
}

export interface OpenAIResponsesProviderOptions {
  /** API key already resolved by the host application. */
  apiKey: string;
  model: string;
  /** Responses-compatible API root. Defaults to the OpenAI API root. */
  baseURL?: string;
  defaultHeaders?: Record<string, string>;
  contextWindowTokens?: number;
  reasoning?: ResponsesReasoning;
  topP?: number;
  topLogprobs?: number;
  user?: string;
  /** Provider-executed tools such as web_search. */
  additionalTools?: Tool[];
  /** Local tool names that use Responses custom-tool text input instead of JSON arguments. */
  customToolNames?: string[];
  /** Test seam matching the existing Anthropic provider pattern. */
  _client?: OpenAI;
}

function isFunctionCall(item: ResponseOutputItem): item is ResponseFunctionToolCall {
  return item.type === "function_call";
}

function isCustomCall(item: ResponseOutputItem): item is ResponseCustomToolCall {
  return item.type === "custom_tool_call";
}

function isReasoning(item: ResponseOutputItem): item is ResponseReasoningItem {
  return item.type === "reasoning";
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function toolResultText(content: ToolResultBlock["content"]): string {
  return typeof content === "string" ? content : content.map((block) => block.text).join("\n");
}

function readTurnState(message: Message): OpenAIResponsesTurnState | undefined {
  if (message.providerState?.provider !== PROVIDER_ID) return undefined;
  const data = message.providerState.data;
  if (!data || typeof data !== "object") return undefined;
  const candidate = data as Partial<OpenAIResponsesTurnState>;
  if (!Array.isArray(candidate.items) || !candidate.toolKinds || typeof candidate.toolKinds !== "object")
    return undefined;
  return candidate as OpenAIResponsesTurnState;
}

function buildTurnState(output: ResponseOutputItem[]): ProviderState {
  const toolKinds: Record<string, ToolKind> = {};
  for (const item of output) {
    if (isFunctionCall(item)) toolKinds[item.call_id] = "function";
    else if (isCustomCall(item)) toolKinds[item.call_id] = "custom";
  }
  return {
    provider: PROVIDER_ID,
    data: { items: output, toolKinds } satisfies OpenAIResponsesTurnState,
  };
}

function mapMessages(messages: Message[], customToolNames: ReadonlySet<string>): ResponseInputItem[] {
  const input: ResponseInputItem[] = [];
  const toolKinds = new Map<string, ToolKind>();

  for (const message of messages) {
    const state = readTurnState(message);
    if (state) {
      input.push(...(state.items as ResponseInputItem[]));
      for (const [id, kind] of Object.entries(state.toolKinds)) toolKinds.set(id, kind);
      continue;
    }

    const role = message.role === "tool" ? "user" : message.role;
    if (typeof message.content === "string") {
      input.push({ type: "message", role, content: message.content } as ResponseInputItem);
      continue;
    }

    let pendingText = "";
    const flushText = () => {
      if (!pendingText) return;
      input.push({ type: "message", role, content: pendingText } as ResponseInputItem);
      pendingText = "";
    };

    for (const block of message.content) {
      if (block.type === "text") {
        pendingText += block.text;
        continue;
      }
      flushText();
      if (block.type === "thinking") {
        input.push({
          type: "reasoning",
          id: block.signature,
          content: [{ type: "reasoning_text", text: block.thinking }],
          summary: [],
        } as ResponseInputItem);
      } else if (block.type === "tool_use") {
        const kind: ToolKind = customToolNames.has(block.name) ? "custom" : "function";
        toolKinds.set(block.id, kind);
        input.push(
          kind === "custom"
            ? ({
                type: "custom_tool_call",
                call_id: block.id,
                name: block.name,
                input: typeof block.input === "string" ? block.input : JSON.stringify(block.input),
              } as ResponseInputItem)
            : ({
                type: "function_call",
                call_id: block.id,
                name: block.name,
                arguments: JSON.stringify(block.input),
              } as ResponseInputItem),
        );
      } else if (block.type === "tool_result") {
        input.push(
          toolKinds.get(block.tool_use_id) === "custom"
            ? ({
                type: "custom_tool_call_output",
                call_id: block.tool_use_id,
                output: toolResultText(block.content),
              } as ResponseInputItem)
            : ({
                type: "function_call_output",
                call_id: block.tool_use_id,
                output: toolResultText(block.content),
              } as ResponseInputItem),
        );
      }
    }
    flushText();
  }
  return input;
}

function mapTools(
  descriptors: ToolDescriptor[] | undefined,
  customToolNames: ReadonlySet<string>,
  additionalTools: Tool[],
): Tool[] | undefined {
  const tools: Tool[] = (descriptors ?? []).map((descriptor) =>
    customToolNames.has(descriptor.name)
      ? ({
          type: "custom",
          name: descriptor.name,
          description: descriptor.description,
        } as Tool)
      : {
          type: "function",
          name: descriptor.name,
          description: descriptor.description,
          parameters: descriptor.inputSchema as Record<string, unknown>,
          strict: false,
        },
  );
  tools.push(...additionalTools);
  return tools.length > 0 ? tools : undefined;
}

function mapToolChoice(
  choice: ChatRequest["toolChoice"],
  customToolNames: ReadonlySet<string>,
): ResponseCreateParamsNonStreaming["tool_choice"] {
  if (!choice) return undefined;
  if (choice === "any") return "required";
  if (choice === "auto" || choice === "none") return choice;
  return customToolNames.has(choice.name)
    ? ({ type: "custom", name: choice.name } as ResponseCreateParamsNonStreaming["tool_choice"])
    : { type: "function", name: choice.name };
}

function mapOutput(output: ResponseOutputItem[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const item of output) {
    if (item.type === "message") {
      for (const part of item.content) {
        if (part.type === "output_text" && part.text) blocks.push({ type: "text", text: part.text });
        else if (part.type === "refusal" && part.refusal) blocks.push({ type: "text", text: part.refusal });
      }
    } else if (isReasoning(item)) {
      const thinking =
        item.content?.map((part) => part.text).join("") ?? item.summary.map((part) => part.text).join("");
      if (thinking) blocks.push({ type: "thinking", thinking, signature: item.id });
    } else if (isFunctionCall(item)) {
      blocks.push({ type: "tool_use", id: item.call_id, name: item.name, input: parseJson(item.arguments) });
    } else if (isCustomCall(item)) {
      blocks.push({ type: "tool_use", id: item.call_id, name: item.name, input: item.input });
    }
  }
  return blocks;
}

function mapUsage(response: Response): ModelUsage {
  return {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    ...(response.usage?.input_tokens_details.cached_tokens !== undefined
      ? { cachedInputTokens: response.usage.input_tokens_details.cached_tokens }
      : {}),
    ...(response.usage?.output_tokens_details.reasoning_tokens !== undefined
      ? { reasoningTokens: response.usage.output_tokens_details.reasoning_tokens }
      : {}),
  };
}

function responseError(response: Response): Error {
  const code = response.error?.code ? `${response.error.code}: ` : "";
  return new Error(`OpenAIResponsesProvider: ${code}${response.error?.message ?? "response failed"}`);
}

function mapStopReason(response: Response, blocks: ContentBlock[]): StopReason {
  if (response.status === "failed") throw responseError(response);
  if (response.status === "incomplete") return "max_tokens";
  return blocks.some((block) => block.type === "tool_use") ? "tool_use" : "end_turn";
}

function responseMessage(response: Response): Message {
  return {
    role: "assistant",
    content: mapOutput(response.output),
    providerState: buildTurnState(response.output),
  };
}

/** OpenAI Responses wire-protocol implementation of {@link IModelProvider}. */
export class OpenAIResponsesProvider implements IModelProvider {
  readonly id = PROVIDER_ID;
  readonly contextWindowTokens: number;
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly reasoning?: ResponsesReasoning;
  private readonly topP?: number;
  private readonly topLogprobs?: number;
  private readonly user?: string;
  private readonly additionalTools: Tool[];
  private readonly customToolNames: ReadonlySet<string>;

  constructor(opts: OpenAIResponsesProviderOptions) {
    this.model = opts.model;
    this.contextWindowTokens = opts.contextWindowTokens ?? DEFAULT_CONTEXT_WINDOW_TOKENS;
    this.reasoning = opts.reasoning;
    this.topP = opts.topP;
    this.topLogprobs = opts.topLogprobs;
    this.user = opts.user;
    this.additionalTools = [...(opts.additionalTools ?? [])];
    this.customToolNames = new Set(opts.customToolNames ?? []);
    this.client =
      opts._client ??
      new OpenAI({
        apiKey: opts.apiKey,
        ...(opts.baseURL ? { baseURL: opts.baseURL } : {}),
        ...(opts.defaultHeaders ? { defaultHeaders: opts.defaultHeaders } : {}),
      });
  }

  private buildRequest(req: ChatRequest): ResponseCreateParamsNonStreaming {
    const tools = mapTools(req.tools, this.customToolNames, this.additionalTools);
    const toolChoice = mapToolChoice(req.toolChoice, this.customToolNames);
    return {
      model: req.model || this.model,
      input: mapMessages(req.messages, this.customToolNames),
      max_output_tokens: req.maxTokens,
      store: false,
      stream: false,
      ...(req.system?.length ? { instructions: req.system.map((block) => block.text).join("\n\n") } : {}),
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      ...(this.reasoning ? { reasoning: this.reasoning } : {}),
      ...(this.topP !== undefined ? { top_p: this.topP } : {}),
      ...(this.topLogprobs !== undefined ? { top_logprobs: this.topLogprobs } : {}),
      ...(this.user ? { user: this.user } : {}),
      ...(tools ? { tools } : {}),
      ...(toolChoice ? { tool_choice: toolChoice } : {}),
    };
  }

  async chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    const response = await this.client.responses.create(this.buildRequest(req), signal ? { signal } : undefined);
    const message = responseMessage(response);
    return {
      message,
      stopReason: mapStopReason(response, message.content as ContentBlock[]),
      usage: mapUsage(response),
    };
  }

  async *chatStream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatStreamChunk> {
    const body: ResponseCreateParamsStreaming = { ...this.buildRequest(req), stream: true };
    const stream = await this.client.responses.create(body, signal ? { signal } : undefined);
    const items = new Map<string, ResponseOutputItem>();
    const emittedTools = new Set<string>();
    const emittedReasoning = new Set<string>();
    let terminal = false;

    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        yield { type: "text_delta", text: event.delta };
      } else if (event.type === "response.reasoning_text.delta") {
        yield { type: "thinking_delta", text: event.delta };
      } else if (event.type === "response.reasoning_text.done") {
        if (!emittedReasoning.has(event.item_id)) {
          emittedReasoning.add(event.item_id);
          yield {
            type: "thinking_block",
            block: { type: "thinking", thinking: event.text, signature: event.item_id },
          };
        }
      } else if (event.type === "response.output_item.added") {
        if ("id" in event.item && typeof event.item.id === "string") items.set(event.item.id, event.item);
      } else if (event.type === "response.function_call_arguments.done") {
        const item = items.get(event.item_id);
        if (item && isFunctionCall(item) && !emittedTools.has(item.call_id)) {
          emittedTools.add(item.call_id);
          yield {
            type: "tool_use",
            block: { type: "tool_use", id: item.call_id, name: item.name, input: parseJson(event.arguments) },
          };
        }
      } else if (event.type === "response.custom_tool_call_input.done") {
        const item = items.get(event.item_id);
        if (item && isCustomCall(item) && !emittedTools.has(item.call_id)) {
          emittedTools.add(item.call_id);
          yield {
            type: "tool_use",
            block: { type: "tool_use", id: item.call_id, name: item.name, input: event.input },
          };
        }
      } else if (event.type === "response.output_item.done") {
        const item = event.item;
        if (isFunctionCall(item) && !emittedTools.has(item.call_id)) {
          emittedTools.add(item.call_id);
          yield {
            type: "tool_use",
            block: { type: "tool_use", id: item.call_id, name: item.name, input: parseJson(item.arguments) },
          };
        } else if (isCustomCall(item) && !emittedTools.has(item.call_id)) {
          emittedTools.add(item.call_id);
          yield {
            type: "tool_use",
            block: { type: "tool_use", id: item.call_id, name: item.name, input: item.input },
          };
        }
      } else if (
        event.type === "response.completed" ||
        event.type === "response.incomplete" ||
        event.type === "response.failed"
      ) {
        terminal = true;
        if (event.response.status === "failed") throw responseError(event.response);
        const blocks = mapOutput(event.response.output);
        for (const block of blocks) {
          if (block.type === "tool_use" && !emittedTools.has(block.id)) {
            emittedTools.add(block.id);
            yield { type: "tool_use", block };
          } else if (block.type === "thinking" && !emittedReasoning.has(block.signature)) {
            emittedReasoning.add(block.signature);
            yield { type: "thinking_block", block };
          }
        }
        yield {
          type: "message_stop",
          stopReason: mapStopReason(event.response, blocks),
          usage: mapUsage(event.response),
          providerState: buildTurnState(event.response.output),
        };
      } else if (event.type === "error") {
        throw new Error(`OpenAIResponsesProvider: ${event.code}: ${event.message}`);
      }
    }

    if (!terminal) throw new Error("OpenAIResponsesProvider: stream ended without a terminal response event");
  }

  countTokens(messages: Message[]): Promise<number> {
    return Promise.resolve(estimateTokens(messages));
  }

  withStructuredOutput<T, IncludeRaw extends boolean = false>(
    schema: ZodType<T>,
    options: StructuredOutputOptions & { includeRaw?: IncludeRaw } = {},
  ): StructuredOutputFn<IncludeRaw extends true ? { raw: Message; parsed: T } : T> {
    const jsonSchema = zodToJsonSchema(schema);
    const name = options.name ?? "extract";
    const method = options.method ?? "jsonSchema";

    return (async (input: string | Message[], signal?: AbortSignal) => {
      const messages: Message[] = typeof input === "string" ? [{ role: "user", content: input }] : input;
      const request: ResponseCreateParamsNonStreaming = {
        model: this.model,
        input: mapMessages(messages, this.customToolNames),
        max_output_tokens: STRUCTURED_OUTPUT_MAX_TOKENS,
        store: false,
      };

      if (method === "functionCalling") {
        request.tools = [
          {
            type: "function",
            name,
            description: "Return the requested structured data.",
            parameters: jsonSchema as Record<string, unknown>,
            strict: true,
          },
        ];
        request.tool_choice = { type: "function", name };
      } else if (method === "jsonMode") {
        request.instructions = `Return one valid json object matching this JSON Schema:\n${JSON.stringify(jsonSchema)}`;
        request.text = { format: { type: "json_object" } };
      } else {
        request.text = {
          format: {
            type: "json_schema",
            name,
            schema: jsonSchema as Record<string, unknown>,
            strict: true,
          },
        };
      }

      const response = await this.client.responses.create(request, signal ? { signal } : undefined);
      if (response.status === "failed") throw responseError(response);
      const raw = responseMessage(response);
      let value: unknown;

      if (method === "functionCalling") {
        const call = (raw.content as ContentBlock[]).find(
          (block): block is ToolUseBlock => block.type === "tool_use" && block.name === name,
        );
        if (!call) throw new Error(`OpenAIResponsesProvider.withStructuredOutput: missing function call ${name}`);
        value = call.input;
      } else {
        const content = (raw.content as ContentBlock[])
          .filter((block): block is Extract<ContentBlock, { type: "text" }> => block.type === "text")
          .map((block) => block.text)
          .join("");
        if (!content) throw new Error("OpenAIResponsesProvider.withStructuredOutput: empty output text");
        try {
          value = JSON.parse(content) as unknown;
        } catch {
          throw new Error(`OpenAIResponsesProvider.withStructuredOutput: invalid JSON: ${content}`);
        }
      }

      const parsed = schema.parse(value);
      return (options.includeRaw ? { raw, parsed } : parsed) as IncludeRaw extends true
        ? { raw: Message; parsed: T }
        : T;
    }) as StructuredOutputFn<IncludeRaw extends true ? { raw: Message; parsed: T } : T>;
  }
}
