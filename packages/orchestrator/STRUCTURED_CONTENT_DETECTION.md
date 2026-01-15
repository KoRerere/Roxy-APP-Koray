# 如何从文本流中识别结构化内容

## 🎯 核心问题

**问题**：AI 输出的是无规律的文本流，如何知道接下来要输出的是代码、文件树、表格等结构化内容？

**答案**：有四种主要方法，可以单独使用或组合使用。

---

## 方法 1：基于模式识别（Markdown 解析）

### 原理

AI 模型通常遵循 Markdown 规范输出代码块，我们可以检测这些模式。

### 实现

#### 1.1 检测代码块标记

````typescript
// 检测 Markdown 代码块开始标记
const CODE_BLOCK_START = /^```(\w+)?\s*(.*)$/m
const CODE_BLOCK_END = /^```\s*$/m

class ContentParser {
  private buffer: string = ''
  private currentState: 'text' | 'code' | 'table' = 'text'
  private currentCodeBlock: {
    language?: string
    filename?: string
    code: string
  } | null = null

  processChunk(chunk: string, onEvent: (event: StreamEvent) => void) {
    this.buffer += chunk

    // 检测代码块开始
    if (this.currentState === 'text') {
      const match = this.buffer.match(CODE_BLOCK_START)
      if (match) {
        // 发送之前的文本内容
        if (this.buffer.substring(0, match.index).trim()) {
          onEvent({
            type: 'content',
            data: { text: this.buffer.substring(0, match.index) }
          })
        }

        // 开始代码块
        this.currentState = 'code'
        this.currentCodeBlock = {
          language: match[1] || 'text',
          filename: this.extractFilename(match[2]),
          code: ''
        }

        // 移除已处理的部分
        this.buffer = this.buffer.substring(match.index + match[0].length)
      }
    }

    // 检测代码块结束
    if (this.currentState === 'code') {
      const match = this.buffer.match(CODE_BLOCK_END)
      if (match) {
        // 发送代码块事件
        if (this.currentCodeBlock) {
          this.currentCodeBlock.code = this.buffer.substring(0, match.index)
          onEvent({
            type: 'code',
            data: this.currentCodeBlock
          })
        }

        // 回到文本状态
        this.currentState = 'text'
        this.currentCodeBlock = null
        this.buffer = this.buffer.substring(match.index + match[0].length)
      }
    }

    // 流式输出代码内容
    if (this.currentState === 'code' && this.currentCodeBlock) {
      // 检查是否有换行符，如果有则更新代码块
      const newlineIndex = this.buffer.indexOf('\n')
      if (newlineIndex !== -1 && newlineIndex < this.buffer.length - 1) {
        const line = this.buffer.substring(0, newlineIndex)
        // 如果不是结束标记，则添加到代码块
        if (!line.match(CODE_BLOCK_END)) {
          this.currentCodeBlock.code += `${line}\n`
          this.buffer = this.buffer.substring(newlineIndex + 1)

          // 流式发送代码块更新
          onEvent({
            type: 'code_chunk',
            data: {
              language: this.currentCodeBlock.language,
              chunk: `${line}\n`
            }
          })
        }
      }
    }
  }

  private extractFilename(text: string): string | undefined {
    // 尝试从代码块标记中提取文件名
    // 例如：```python main.py
    const filenameMatch = text.match(/(\S+\.\w+)/)
    return filenameMatch ? filenameMatch[1] : undefined
  }
}
````

#### 1.2 在流式处理中使用

```typescript
// 在 ChatManager.sendMessage 中使用
const parser = new ContentParser()

for await (const chunk of stream) {
  if (chunk.content) {
    parser.processChunk(chunk.content.toString(), (event) => {
      // 根据事件类型发送不同的 SSE 事件
      streamCallback(event)
    })
  }
}
```

### 优点

- ✅ 不需要修改 AI 模型
- ✅ 利用 AI 已有的 Markdown 习惯
- ✅ 实时检测，流式处理

### 缺点

- ❌ 依赖 AI 遵循 Markdown 规范
- ❌ 可能误识别
- ❌ 无法提前知道类型（只能检测到标记才知道）

---

## 方法 2：基于 AI Function Calling（主动声明）

### 原理

让 AI 模型在输出前主动声明接下来要输出的内容类型。

### 实现

#### 2.1 定义 Function Calling Schema

```typescript
const contentTypeFunction = {
  name: 'declare_content_type',
  description: '声明接下来要输出的内容类型',
  parameters: {
    type: 'object',
    properties: {
      contentType: {
        type: 'string',
        enum: ['text', 'code', 'file_tree', 'table', 'chart'],
        description: '内容类型'
      },
      metadata: {
        type: 'object',
        properties: {
          language: { type: 'string' },
          filename: { type: 'string' },
          lineNumbers: { type: 'boolean' }
        }
      }
    },
    required: ['contentType']
  }
}
```

#### 2.2 在 Prompt 中引导 AI

```typescript
const systemPrompt = `
当你需要输出代码时，请先调用 declare_content_type 函数声明类型。
例如：
- 输出 Python 代码前：declare_content_type({ contentType: 'code', metadata: { language: 'python', filename: 'main.py' } })
- 输出文件树前：declare_content_type({ contentType: 'file_tree' })
`
```

#### 2.3 处理 Function Call

```typescript
for await (const chunk of stream) {
  // 检查是否有 function call
  if (chunk.tool_calls && chunk.tool_calls.length > 0) {
    for (const toolCall of chunk.tool_calls) {
      if (toolCall.name === 'declare_content_type') {
        const args = JSON.parse(toolCall.args)
        // 设置当前内容类型
        currentContentType = args.contentType
        currentMetadata = args.metadata || {}

        // 发送内容类型声明事件
        streamCallback({
          type: 'content_type_declared',
          data: {
            contentType: args.contentType,
            metadata: args.metadata
          }
        })
      }
    }
  }

  // 根据声明的类型处理内容
  if (chunk.content) {
    if (currentContentType === 'code') {
      streamCallback({
        type: 'code_chunk',
        data: {
          language: currentMetadata.language,
          filename: currentMetadata.filename,
          chunk: chunk.content.toString()
        }
      })
    }
    else {
      streamCallback({
        type: 'content',
        data: { text: chunk.content.toString() }
      })
    }
  }
}
```

### 优点

- ✅ 提前知道内容类型
- ✅ 可以传递元数据（语言、文件名等）
- ✅ 类型明确，不易出错

### 缺点

- ❌ 需要 AI 模型支持 Function Calling
- ❌ 需要修改 Prompt 引导 AI
- ❌ 不是所有模型都支持

---

## 方法 3：基于工具调用结果（结构化数据）

### 原理

当 AI 调用工具时，工具返回的数据本身就是结构化的，可以直接使用。

### 实现

#### 3.1 工具返回结构化数据

```typescript
// MCP 工具返回结构化数据
const toolResult = await mcpTool.call('browser_snapshot', {})

// 工具返回的数据结构
{
  type: 'browser_snapshot',
  data: {
    url: 'https://example.com',
    title: 'Example',
    elements: [...],
    consoleMessages: [...]
  }
}
```

#### 3.2 直接转换为事件

```typescript
// 在工具调用后
if (toolCalls && toolCalls.length > 0) {
  for (const toolCall of toolCalls) {
    const result = await executeTool(toolCall)

    // 根据工具类型发送不同的事件
    if (toolCall.name === 'browser_snapshot') {
      streamCallback({
        type: 'tool_result',
        data: {
          tool: 'browser_snapshot',
          result,
          metadata: {
            executionTime: result.executionTime,
            success: true
          }
        }
      })
    }
    else if (toolCall.name === 'read_file') {
      streamCallback({
        type: 'file_content',
        data: {
          filename: result.filename,
          content: result.content,
          language: detectLanguage(result.filename)
        }
      })
    }
  }
}
```

### 优点

- ✅ 数据本身就是结构化的
- ✅ 不需要解析文本
- ✅ 类型明确，信息完整

### 缺点

- ❌ 只适用于工具调用场景
- ❌ 不适用于 AI 直接输出的内容

---

## 方法 4：混合方案（推荐）

### 原理

结合多种方法，根据场景选择最合适的。

### 实现架构

```typescript
class HybridContentParser {
  /**
   * 方法1：模式识别
   */
  private parser: ContentParser
  /**
   * 方法2：Function Calling
   */
  private currentContentType?: string
  private currentMetadata?: any

  processChunk(
    chunk: any,
    toolCalls: any[],
    onEvent: (event: StreamEvent) => void
  ) {
    // 1. 优先处理 Function Calling（方法2）
    if (toolCalls && toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        if (toolCall.name === 'declare_content_type') {
          const args = JSON.parse(toolCall.args)
          this.currentContentType = args.contentType
          this.currentMetadata = args.metadata

          onEvent({
            type: 'content_type_declared',
            data: { contentType: args.contentType, metadata: args.metadata }
          })
          return // 处理完 function call，不处理内容
        }
      }
    }

    // 2. 如果有声明的类型，使用声明的类型（方法2）
    if (this.currentContentType && chunk.content) {
      if (this.currentContentType === 'code') {
        onEvent({
          type: 'code_chunk',
          data: {
            language: this.currentMetadata?.language || 'text',
            filename: this.currentMetadata?.filename,
            chunk: chunk.content.toString()
          }
        })
        return
      }
    }

    // 3. 否则使用模式识别（方法1）
    if (chunk.content) {
      this.parser.processChunk(chunk.content.toString(), onEvent)
    }
  }

  /**
   * 4. 处理工具调用结果（方法3）
   */
  handleToolResult(toolName: string, result: any, onEvent: (event: StreamEvent) => void) {
    if (toolName === 'browser_snapshot') {
      onEvent({
        type: 'tool_result',
        data: {
          tool: 'browser_snapshot',
          result
        }
      })
    }
    else if (toolName === 'read_file') {
      onEvent({
        type: 'file_content',
        data: {
          filename: result.filename,
          content: result.content,
          language: this.detectLanguage(result.filename)
        }
      })
    }
  }

  private detectLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase()
    const languageMap: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      go: 'go',
      rs: 'rust',
      php: 'php',
      rb: 'ruby',
      swift: 'swift',
      kt: 'kotlin',
      scala: 'scala',
      sh: 'bash',
      md: 'markdown',
      json: 'json',
      xml: 'xml',
      html: 'html',
      css: 'css',
      sql: 'sql',
    }
    return languageMap[ext || ''] || 'text'
  }
}
```

### 完整流程

```typescript
async function handleStream(
  stream: AsyncIterable<AIMessageChunk>,
  onEvent: (event: StreamEvent) => void
) {
  const parser = new HybridContentParser()

  for await (const chunk of stream) {
    // 检查工具调用
    const toolCalls = (chunk as any).tool_calls || []

    // 处理 chunk
    parser.processChunk(chunk, toolCalls, onEvent)

    // 如果有工具调用，执行工具
    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        if (toolCall.name !== 'declare_content_type') {
          const result = await executeTool(toolCall)
          parser.handleToolResult(toolCall.name, result, onEvent)
        }
      }
    }
  }
}
```

---

## 实际应用示例

### 示例 1：AI 输出代码（模式识别）

````
AI 输出流：
"让我写一个函数：\n```python\n"
→ 检测到代码块开始，发送 code_start 事件

"def hello():\n"
→ 发送 code_chunk 事件

"    print('Hello')\n"
→ 发送 code_chunk 事件

"```\n"
→ 检测到代码块结束，发送 code_end 事件
````

### 示例 2：AI 使用 Function Calling

```
AI 输出：
Function Call: declare_content_type({ contentType: 'code', metadata: { language: 'python', filename: 'main.py' } })
→ 发送 content_type_declared 事件

然后输出内容：
"def hello():\n    print('Hello')\n"
→ 根据声明的类型，发送 code_chunk 事件
```

### 示例 3：工具调用结果

```
AI 调用工具：
Tool Call: read_file({ path: 'src/main.py' })

工具返回：
{
  filename: 'src/main.py',
  content: 'def hello():\n    print("Hello")\n',
  language: 'python'
}

→ 直接发送 file_content 事件
```

---

## 推荐实现方案

### 阶段 1：基础模式识别（最简单）

先实现方法1（Markdown 模式识别），因为：

- 不需要修改 AI 模型
- 大多数 AI 已经遵循 Markdown 规范
- 实现简单，快速见效

### 阶段 2：工具调用结果（结构化数据）

实现方法3，因为：

- 工具返回的数据本身就是结构化的
- 不需要解析，直接使用
- 信息完整准确

### 阶段 3：Function Calling（高级功能）

如果 AI 模型支持，添加方法2：

- 提前知道内容类型
- 可以传递元数据
- 更精确的控制

### 阶段 4：混合方案（完整方案）

结合所有方法，根据场景自动选择最合适的。

---

## 总结

**核心思路**：

1. **模式识别**：检测 Markdown 标记（```）
2. **主动声明**：AI 通过 Function Calling 声明类型
3. **工具结果**：工具返回的结构化数据直接使用
4. **混合使用**：根据场景选择最合适的方法

**关键点**：

- 不需要 AI "知道"格式，只需要检测或声明
- 流式处理，实时识别
- 多种方法组合，提高准确率

---

## 下一步

1. 实现基础的 Markdown 代码块检测
2. 扩展支持更多 Markdown 元素（表格、列表等）
3. 集成工具调用结果的结构化处理
4. 如果模型支持，添加 Function Calling 支持
