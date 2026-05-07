 你遇到的这个错误是因为在 todoListMiddleware 的 wrapModelCall hook 中修改了已经注册的工具实例。

  核心代码逻辑（AgentNode.ts:541-587）

  const modifiedTools = req.tools ?? [];
  const registeredToolsByName = new Map(
    this.#options.toolClasses
      .filter(isClientTool)
      .map((t) => [t.name, t] as const)
  );

  const replacedClientTools = modifiedTools.filter((tool) => {
    if (!isClientTool(tool)) return false;
    const original = registeredToolsByName.get(tool.name);
    // 关键检查：如果工具名称相同但实例不同，就认为是"替换"
    return original != null && original !== tool;
  });

  if (replacedClientTools.length > 0) {
    throw new Error(
      `You have modified a tool in "wrapModelCall" hook of middleware "${
        currentMiddleware.name
      }": ${replacedClientTools.map((tool) => tool.name).join(", ")}. This is not supported.`
    );
  }

  问题原因

  代码使用 严格相等比较 (original !== tool)
  来检测工具是否被修改。即使工具的内容完全相同，只要是不同的对象实例，就会触发这个错误。

  常见导致这个错误的场景：
  1. 重新创建工具数组：tools: [...request.tools] 或 tools: request.tools.map(t => t)
  2. 工具被序列化/反序列化
  3. 使用扩展运算符或对象解构后重新组合工具列表
  4. 多次传递导致引用丢失

  解决方案

  在你的 todoListMiddleware 中，当你需要传递 request.tools 时，必须直接传递原始引用，不要创建新的数组或修改工具实例：

  // ❌ 错误 - 会创建新数组
  wrapModelCall: async (request, handler) => {
    return handler({
      ...request,
      tools: [...request.tools], // 这会失败！
    });
  }

  // ✅ 正确 - 直接传递原始引用
  wrapModelCall: async (request, handler) => {
    return handler({
      ...request,
      tools: request.tools, // 或者干脆不传，让它使用默认值
    });
  }

  // ✅ 正确 - 不修改 tools
  wrapModelCall: async (request, handler) => {
    return handler(request); // 完全不修改请求
  }

  建议

  请检查 todoListMiddleware 的代码，特别是 wrapModelCall 方法，确保没有对 request.tools
  进行任何会改变对象引用的操作。如果你想看具体代码，可以分享一下 middleware 的实现，我可以帮你定位具体问题。