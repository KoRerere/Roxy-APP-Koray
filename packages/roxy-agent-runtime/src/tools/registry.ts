import type { AnthropicTool, IToolRegistry, ToolDescriptor, ToolHandler } from "../core/interfaces.ts";

type Entry = { descriptor: ToolDescriptor; handler: ToolHandler };

export class ToolRegistry implements IToolRegistry {
  private readonly tools = new Map<string, Entry>();
  private readonly onWarn: (msg: string) => void;

  constructor(opts: { onWarn?: (msg: string) => void } = {}) {
    this.onWarn = opts.onWarn ?? ((msg) => console.warn(`[ToolRegistry] ${msg}`));
  }

  add(descriptor: ToolDescriptor, handler: ToolHandler): void {
    if (this.tools.has(descriptor.name)) {
      this.onWarn(`tool name collision: ${descriptor.name} (overwriting)`);
    }
    this.tools.set(descriptor.name, { descriptor, handler });
  }

  remove(name: string): void {
    this.tools.delete(name);
  }

  resolve(name: string): Entry | undefined {
    return this.tools.get(name);
  }

  all(): ToolDescriptor[] {
    return [...this.tools.values()].map((e) => e.descriptor);
  }

  toAnthropicTools(): AnthropicTool[] {
    return this.all().map((d) => ({
      name: d.name,
      description: d.description,
      input_schema: d.inputSchema,
    }));
  }
}
