// 页面导航技能
export const playwrightNavigateSkill = {
  name: 'playwright_navigate_skill',
  description: 'Playwright 页面导航技能',
  content: `
# Playwright 页面导航技能

本技能包含页面导航相关功能，用于在浏览器中打开网页、前进和后退操作。

## 可用工具

### browser_navigate
导航到指定的 URL。用于打开网页或跳转到新的页面。支持 HTTP/HTTPS 协议的任何有效 URL。

### browser_navigate_back
返回到上一页。用于浏览器历史记录的后退操作。如果没有上一页，操作将被忽略。

### browser_navigate_forward
前进到下一页。用于浏览器历史记录的前进操作。如果没有下一页，操作将被忽略。

## 使用流程示例

### 打开网页
1. 调用 \`browser_navigate\` 打开目标网页
   - 参数：\`url="https://example.com"\`
   - 说明：等待页面加载完成后返回

### 浏览历史导航
1. 调用 \`browser_navigate\` 打开第一个页面
   - 参数：\`url="https://example.com/page1"\`
2. 调用 \`browser_navigate\` 打开第二个页面
   - 参数：\`url="https://example.com/page2"\`
3. 调用 \`browser_navigate_back\` 返回第一个页面
4. 调用 \`browser_navigate_forward\` 前进到第二个页面

## 注意事项

- \`browser_navigate\` 会等待页面加载完成（\`load\` 事件）
- 如果页面加载超时，可能需要使用 \`browser_wait_for\` 等待特定元素
- 导航后建议调用 \`browser_snapshot\` 获取页面结构
`,

  allowTools: [
    'browser_navigate',
    'browser_navigate_back',
    'browser_navigate_forward',
  ],
}

// 页面快照和截图技能
export const playwrightSnapshotSkill = {
  name: 'playwright_snapshot_skill',
  description: 'Playwright 页面快照和截图技能',
  content: `
# Playwright 页面快照和截图技能

本技能包含页面快照和截图功能，用于获取页面结构和保存页面截图。

## 核心概念

### Snapshot 的两种模式

**ARIA 模式**（使用 \`ref\` 参数）：
- 返回 YAML 格式的可访问性树
- 元素引用格式：\`[ref=e1]\`、\`[ref=e2]\` 等
- 适用于需要完整语义信息的场景

**优化模式**（使用 \`mcpId\` 参数）：
- 返回带 \`data-mcp-id\` 属性的简化 HTML
- 元素引用格式：\`data-mcp-id="42"\`
- 节省 99% token，推荐优先使用

### 工作流程

所有元素交互操作都必须遵循以下流程：
1. 调用 \`browser_snapshot\` 获取页面快照
2. 从快照中找到目标元素的引用（\`ref\` 或 \`mcpId\`）
3. 使用交互工具（如 \`browser_click\`）并传入元素引用

## 可用工具

### browser_snapshot
捕获当前页面结构并返回元素引用。这是执行交互操作的前提，必须先调用此工具获取元素的 \`ref\` 或 \`mcpId\`，才能进行点击、输入等操作。

### browser_take_screenshot
对当前页面进行截图并返回图像。可以截取整个视口、完整页面或特定元素。注意：截图仅用于查看，不能从截图中获取元素引用。如需交互，请使用 \`browser_snapshot\`。

## 使用流程示例

### 获取页面快照（优化模式）
1. 调用 \`browser_snapshot\`
2. 返回示例：
   \`\`\`html
   <button data-mcp-id="42">提交</button>
   <input data-mcp-id="43" placeholder="用户名">
   \`\`\`
3. 使用 \`mcpId="42"\` 或 \`mcpId="43"\` 进行后续交互

### 获取页面快照（ARIA 模式）
1. 调用 \`browser_snapshot\`
2. 返回示例：
   \`\`\`yaml
   - button "提交" [ref=e1]
   - textbox "用户名" [ref=e2]
   \`\`\`
3. 使用 \`ref="e1"\` 或 \`ref="e2"\` 进行后续交互
`,

  allowTools: [
    'browser_snapshot',
    'browser_take_screenshot',
  ],
}

// 元素交互技能
export const playwrightInteractionSkill = {
  name: 'playwright_interaction_skill',
  description: 'Playwright 元素交互技能',
  content: `
# Playwright 元素交互技能

本技能包含基于页面快照的元素交互功能，用于点击、拖放、悬停和选择等操作。

## 可用工具

### browser_click
在网页上执行点击操作。支持单击、双击，可以指定鼠标按钮（左键、右键、中键）。必须提供 \`ref\`（ARIA 模式）或 \`mcpId\`（优化模式）之一，这些引用从 \`browser_snapshot\` 获取。

### browser_drag
在两个元素之间执行拖放操作。需要提供源元素和目标元素的引用（\`startRef\` + \`endRef\` 或 \`startMcpId\` + \`endMcpId\`）。

### browser_hover
将鼠标悬停在元素上。用于触发悬停效果或显示工具提示。需要提供元素引用（\`ref\` 或 \`mcpId\`）。

### browser_select_option
在下拉框中选择选项。支持单选或多选。需要提供下拉框元素的引用（\`ref\` 或 \`mcpId\`）和要选择的值数组。

## 使用流程示例

### 点击按钮（优化模式）
1. 调用 \`browser_snapshot\` 获取页面快照
   - 返回：\`<button data-mcp-id="42">提交</button>\`
2. 调用 \`browser_click\` 点击按钮
   - 参数：\`element="提交按钮", mcpId=42\`

### 填写表单（ARIA 模式）
1. 调用 \`browser_snapshot\` 获取页面快照
   - 返回：\`- textbox "用户名" [ref=e5]\`
2. 调用 \`browser_type\` 输入文本（需要加载 keyboard 技能）
   - 参数：\`element="用户名输入框", ref="e5", text="admin", submit=false\`

### 拖放元素（优化模式）
1. 调用 \`browser_snapshot\` 获取页面快照
   - 返回：\`<div data-mcp-id="10" draggable="true">拖动我</div>\`
   - 返回：\`<div data-mcp-id="20" class="drop-zone">放置区</div>\`
2. 调用 \`browser_drag\` 执行拖放
   - 参数：\`startElement="可拖动元素", startMcpId=10, endElement="放置区", endMcpId=20\`

### 选择下拉选项
1. 调用 \`browser_snapshot\` 获取页面快照
   - 返回：\`<select data-mcp-id="30"><option value="1">选项1</option></select>\`
2. 调用 \`browser_select_option\` 选择选项
   - 参数：\`element="下拉框", mcpId=30, values=["1"]\`

## 注意事项

- 所有交互工具都必须先调用 \`browser_snapshot\` 获取元素引用
- 优化模式（\`mcpId\`）比 ARIA 模式（\`ref\`）节省 99% token，推荐优先使用
- 如果元素不在视口内，Playwright 会自动滚动到元素位置
`,

  allowTools: [
    'browser_click',
    'browser_drag',
    'browser_hover',
    'browser_select_option',
  ],
}

// 键盘操作技能
export const playwrightKeyboardSkill = {
  name: 'playwright_keyboard_skill',
  description: 'Playwright 键盘操作技能',
  content: `
# Playwright 键盘操作技能

本技能包含键盘输入和按键操作功能。

## 可用工具

### browser_press_key
按下键盘上的按键。可以按下单个键或组合键（如 \`ArrowLeft\`、\`Enter\`、\`Control+A\` 等）。

### browser_type
在可编辑元素中输入文本。默认使用快速填充（\`fill\`），设置 \`slowly=true\` 可逐字符输入以触发键盘事件（如自动完成）。可以选择是否在输入后按 Enter 提交。必须提供元素引用（\`ref\` 或 \`mcpId\`）。

## 使用流程示例

### 在输入框中输入文本（快速模式）
1. 调用 \`browser_snapshot\` 获取页面快照
   - 返回：\`<input data-mcp-id="43" placeholder="搜索">\`
2. 调用 \`browser_type\` 快速填充文本
   - 参数：\`element="搜索框", mcpId=43, text="Playwright", submit=false\`
   - 说明：使用 \`fill\` 方法，不触发键盘事件

### 触发自动完成（慢速模式）
1. 调用 \`browser_snapshot\` 获取页面快照
   - 返回：\`<input data-mcp-id="50" class="autocomplete">\`
2. 调用 \`browser_type\` 逐字符输入
   - 参数：\`element="自动完成输入框", mcpId=50, text="北京", slowly=true, submit=false\`
   - 说明：使用 \`pressSequentially\` 方法，每个字符都触发键盘事件

### 输入并提交表单
1. 调用 \`browser_snapshot\` 获取页面快照
   - 返回：\`- textbox "用户名" [ref=e5]\`
2. 调用 \`browser_type\` 输入并提交
   - 参数：\`element="用户名输入框", ref="e5", text="admin", submit=true\`
   - 说明：输入完成后自动按下 Enter 键

### 按下特殊按键
1. 调用 \`browser_press_key\` 按下按键
   - 参数：\`key="ArrowDown"\` - 按下向下箭头
   - 参数：\`key="Enter"\` - 按下回车键
   - 参数：\`key="Control+A"\` - 按下 Ctrl+A 组合键

## 注意事项

- \`browser_type\` 默认使用快速填充（\`fill\`），不触发键盘事件
- 如需触发自动完成、输入验证等键盘事件，设置 \`slowly=true\`
- \`browser_press_key\` 不需要元素引用，直接在页面上按键
- \`browser_type\` 需要元素引用（\`ref\` 或 \`mcpId\`），必须先调用 \`browser_snapshot\`
`,

  allowTools: [
    'browser_press_key',
    'browser_type',
  ],
}

// 鼠标操作技能
export const playwrightMouseSkill = {
  name: 'playwright_mouse_skill',
  description: 'Playwright 鼠标操作技能（基于坐标）',
  content: `
# Playwright 鼠标操作技能

本技能包含基于坐标的鼠标操作功能，用于精确控制鼠标位置和操作。

## 可用工具

### browser_mouse_move_xy
将鼠标移动到指定坐标位置。坐标相对于视口左上角，单位为像素。

### browser_mouse_click_xy
在指定坐标位置点击鼠标左键。坐标相对于视口左上角，单位为像素。

### browser_mouse_drag_xy
在指定坐标之间拖拽鼠标。从起始坐标拖动到目标坐标。

## 使用流程示例

### 移动鼠标到指定位置
1. 调用 \`browser_mouse_move_xy\` 移动鼠标
   - 参数：\`x=100, y=200\`
   - 说明：将鼠标移动到坐标 (100, 200)

### 点击指定坐标
1. 调用 \`browser_mouse_click_xy\` 点击
   - 参数：\`x=300, y=400\`
   - 说明：在坐标 (300, 400) 处点击鼠标左键

### 拖拽操作
1. 调用 \`browser_mouse_drag_xy\` 拖拽
   - 参数：\`startX=100, startY=100, endX=300, endY=300\`
   - 说明：从 (100, 100) 拖动到 (300, 300)

## 注意事项

- 这些工具基于坐标操作，适用于需要精确控制鼠标位置的场景
- 坐标相对于视口左上角，不是整个页面
- 如果元素不在视口内，需要先滚动页面
- **优先使用基于元素的交互工具**（如 \`browser_click\`），它们更稳定可靠
- 基于坐标的操作在页面布局变化时可能失效
- 仅在无法使用元素引用时才使用坐标操作
`,

  allowTools: [
    'browser_mouse_move_xy',
    'browser_mouse_click_xy',
    'browser_mouse_drag_xy',
  ],
}

// 标签管理技能
export const playwrightTabsSkill = {
  name: 'playwright_tabs_skill',
  description: 'Playwright 标签管理技能',
  content: `
# Playwright 标签管理技能

本技能包含浏览器标签页的管理功能，用于列出、创建、选择和关闭标签页。

## 可用工具

### browser_tab_list
列出所有浏览器标签页。返回每个标签页的索引、URL 和标题，用于查看当前打开的标签页列表。

### browser_tab_new
打开新标签页。可以选择是否在新标签页中导航到指定 URL。如果不提供 URL，则打开空白标签页。

### browser_tab_select
通过索引选择标签页。切换到指定的标签页，使其成为当前活动标签页。索引从 0 开始。

### browser_tab_close
关闭标签页。可以关闭指定索引的标签页，如果不指定则关闭当前标签页。

## 使用流程示例

### 查看所有标签页
1. 调用 \`browser_tab_list\` 列出标签页
   - 返回示例：
     \`\`\`
     [
       { index: 0, url: "https://example.com", title: "Example" },
       { index: 1, url: "https://google.com", title: "Google" }
     ]
     \`\`\`

### 打开新标签页并导航
1. 调用 \`browser_tab_new\` 创建新标签页
   - 参数：\`url="https://github.com"\`
   - 说明：打开新标签页并导航到 GitHub

### 打开空白标签页
1. 调用 \`browser_tab_new\` 创建空白标签页
   - 参数：不提供 \`url\` 参数
   - 说明：打开空白标签页，后续可以使用 \`browser_navigate\` 导航

### 切换标签页
1. 调用 \`browser_tab_list\` 查看标签页列表
2. 调用 \`browser_tab_select\` 切换到指定标签页
   - 参数：\`index=1\`
   - 说明：切换到索引为 1 的标签页

### 关闭标签页
1. 调用 \`browser_tab_close\` 关闭当前标签页
   - 参数：不提供 \`index\` 参数
2. 或关闭指定标签页
   - 参数：\`index=2\`
   - 说明：关闭索引为 2 的标签页

### 多标签页工作流
1. \`browser_tab_new\` → 打开标签页 A
2. \`browser_navigate\` → 在标签页 A 中导航
3. \`browser_tab_new\` → 打开标签页 B
4. \`browser_navigate\` → 在标签页 B 中导航
5. \`browser_tab_select\` → 切换回标签页 A
6. \`browser_snapshot\` → 获取标签页 A 的内容

## 注意事项

- 标签页索引从 0 开始
- 切换标签页后，所有操作都在新的活动标签页上执行
- 关闭标签页后，如果还有其他标签页，会自动切换到另一个标签页
- 不能关闭最后一个标签页，否则浏览器会关闭
`,

  allowTools: [
    'browser_tab_list',
    'browser_tab_new',
    'browser_tab_select',
    'browser_tab_close',
  ],
}

// 等待操作技能
export const playwrightWaitSkill = {
  name: 'playwright_wait_skill',
  description: 'Playwright 等待操作技能',
  content: `
# Playwright 等待操作技能

本技能包含等待功能，用于等待页面加载、元素出现或消失等场景。

## 可用工具

### browser_wait_for
等待文本出现或消失，或等待指定时间。用于等待页面加载、元素出现或消失等场景。支持三种等待模式：等待文本出现、等待文本消失、等待指定秒数。

## 使用流程示例

### 等待文本出现
1. 执行触发内容加载的操作（如点击按钮）
2. 调用 \`browser_wait_for\` 等待文本出现
   - 参数：\`text="加载完成", state="visible"\`
   - 说明：等待包含"加载完成"的元素出现在页面上

### 等待文本消失
1. 执行触发内容移除的操作
2. 调用 \`browser_wait_for\` 等待文本消失
   - 参数：\`text="加载中...", state="hidden"\`
   - 说明：等待包含"加载中..."的元素从页面消失

### 等待固定时间
1. 调用 \`browser_wait_for\` 等待指定秒数
   - 参数：\`timeout=3\`
   - 说明：等待 3 秒后继续执行

### 等待页面加载完成
1. 调用 \`browser_navigate\` 导航到新页面
2. 调用 \`browser_wait_for\` 等待关键元素出现
   - 参数：\`text="欢迎", state="visible"\`
   - 说明：确保页面完全加载后再进行后续操作

## 注意事项

- 默认超时时间为 30 秒，超时后会抛出错误
- \`state="visible"\` 表示等待元素出现并可见
- \`state="hidden"\` 表示等待元素消失或隐藏
- 如果只提供 \`timeout\` 参数，则等待固定时间
- 等待文本时会匹配页面上所有包含该文本的元素
`,

  allowTools: [
    'browser_wait_for',
  ],
}

// JavaScript 执行技能
export const playwrightEvaluateSkill = {
  name: 'playwright_evaluate_skill',
  description: 'Playwright JavaScript 执行技能',
  content: `
# Playwright JavaScript 执行技能

本技能包含在页面中执行 JavaScript 代码的功能。

## 可用工具

### browser_evaluate
在页面或元素上执行 JavaScript 表达式。可以执行任意 JavaScript 代码并获取返回值。支持在整个页面上下文或特定元素上执行。

## 使用流程示例

### 在页面上执行 JavaScript
1. 调用 \`browser_evaluate\` 执行代码
   - 参数：\`script="document.title"\`
   - 返回：页面标题

### 获取页面信息
1. 调用 \`browser_evaluate\` 获取页面数据
   - 参数：\`script="JSON.stringify({ url: location.href, title: document.title })"\`
   - 返回：包含 URL 和标题的 JSON 字符串

### 修改页面元素
1. 调用 \`browser_evaluate\` 修改 DOM
   - 参数：\`script="document.querySelector('h1').textContent = '新标题'"\`
   - 说明：修改页面上第一个 h1 元素的文本

### 在特定元素上执行
1. 调用 \`browser_snapshot\` 获取元素引用
   - 返回：\`<div data-mcp-id="70" class="container">...</div>\`
2. 调用 \`browser_evaluate\` 在元素上执行
   - 参数：\`script="element.children.length", mcpId=70\`
   - 返回：该元素的子元素数量

### 执行复杂脚本
1. 调用 \`browser_evaluate\` 执行多行代码
   - 参数：\`script="(() => { const items = document.querySelectorAll('.item'); return Array.from(items).map(i => i.textContent); })()"\`
   - 返回：所有 .item 元素的文本数组

## 注意事项

- 执行的 JavaScript 代码在页面上下文中运行，可以访问 DOM 和全局变量
- 返回值必须是可序列化的（字符串、数字、布尔值、对象、数组等）
- 不能返回 DOM 元素或函数等不可序列化的对象
- 如果在元素上执行，需要先调用 \`browser_snapshot\` 获取元素引用
- 脚本中可以使用 \`element\` 变量引用目标元素（当提供 \`ref\` 或 \`mcpId\` 时）
`,

  allowTools: [
    'browser_evaluate',
  ],
}

// 对话框和文件操作技能
export const playwrightDialogsSkill = {
  name: 'playwright_dialogs_skill',
  description: 'Playwright 对话框和文件操作技能',
  content: `
# Playwright 对话框和文件操作技能

本技能包含处理浏览器对话框和文件上传的功能。

## 可用工具

### browser_handle_dialog
处理浏览器对话框（如 \`alert\`、\`confirm\`、\`prompt\`）。可以选择接受或拒绝对话框，对于 \`prompt\` 对话框可以输入文本。

### browser_file_upload
上传一个或多个文件。用于处理文件选择对话框，上传本地文件到网页。需要提供文件的绝对路径。

## 使用流程示例

### 处理 Alert 对话框
1. 触发对话框的操作（如点击按钮）
2. 调用 \`browser_handle_dialog\` 处理对话框
   - 参数：\`accept=true\` - 点击"确定"
   - 参数：\`accept=false\` - 点击"取消"

### 处理 Prompt 对话框
1. 触发 prompt 对话框
2. 调用 \`browser_handle_dialog\` 输入文本并确认
   - 参数：\`accept=true, promptText="用户输入的文本"\`

### 上传单个文件
1. 调用 \`browser_snapshot\` 获取文件输入框引用
   - 返回：\`<input type="file" data-mcp-id="60">\`
2. 调用 \`browser_file_upload\` 上传文件
   - 参数：\`element="文件输入框", mcpId=60, files=["/absolute/path/to/file.pdf"]\`

### 上传多个文件
1. 调用 \`browser_snapshot\` 获取文件输入框引用
   - 返回：\`<input type="file" multiple data-mcp-id="61">\`
2. 调用 \`browser_file_upload\` 上传多个文件
   - 参数：\`element="文件输入框", mcpId=61, files=["/path/file1.jpg", "/path/file2.jpg"]\`

## 注意事项

- 对话框处理需要在对话框出现后立即调用
- 文件上传必须提供文件的绝对路径，不支持相对路径
- 文件上传需要先调用 \`browser_snapshot\` 获取文件输入框的引用
- 多文件上传需要 \`<input type="file" multiple>\` 元素
`,

  allowTools: [
    'browser_handle_dialog',
    'browser_file_upload',
  ],
}

// 网络和PDF技能
export const playwrightNetworkSkill = {
  name: 'playwright_network_skill',
  description: 'Playwright 网络监控和PDF导出技能',
  content: `
# Playwright 网络监控和PDF导出技能

本技能包含网络请求监控和PDF导出功能。

## 可用工具

### browser_network_requests
返回自页面加载以来的所有网络请求。用于监控和分析页面的网络活动，包括 API 调用、资源加载等。

### browser_pdf_save
将页面保存为 PDF 文件。用于导出页面内容为 PDF 格式，支持自定义页面大小、边距等选项。

## 使用流程示例

### 监控网络请求
1. 调用 \`browser_navigate\` 导航到页面
2. 调用 \`browser_network_requests\` 获取网络请求
   - 返回示例：
     \`\`\`json
     [
       {
         "url": "https://api.example.com/data",
         "method": "GET",
         "status": 200,
         "resourceType": "xhr"
       },
       {
         "url": "https://example.com/style.css",
         "method": "GET",
         "status": 200,
         "resourceType": "stylesheet"
       }
     ]
     \`\`\`

### 分析 API 调用
1. 执行触发 API 调用的操作（如点击按钮）
2. 调用 \`browser_network_requests\` 查看请求
   - 说明：可以查看请求 URL、方法、状态码、资源类型等

### 导出页面为 PDF
1. 调用 \`browser_navigate\` 打开目标页面
2. 调用 \`browser_pdf_save\` 保存为 PDF
   - 参数：\`path="/absolute/path/to/output.pdf"\`
   - 说明：将当前页面保存为 PDF 文件

### 导出特定内容为 PDF
1. 调用 \`browser_navigate\` 打开页面
2. 调用 \`browser_evaluate\` 隐藏不需要的元素（可选）
3. 调用 \`browser_pdf_save\` 保存
   - 参数：\`path="/path/output.pdf", format="A4", printBackground=true\`

## 注意事项

- \`browser_network_requests\` 返回自页面加载以来的所有请求
- 网络请求包括 XHR、Fetch、图片、CSS、JS 等所有资源
- PDF 导出需要提供文件的绝对路径
- PDF 导出支持自定义页面大小（A4、Letter 等）和边距
- PDF 导出默认不包含背景色，设置 \`printBackground=true\` 可包含背景
`,

  allowTools: [
    'browser_network_requests',
    'browser_pdf_save',
  ],
}

// 浏览器窗口操作技能
export const playwrightWindowSkill = {
  name: 'playwright_window_skill',
  description: 'Playwright 浏览器窗口操作技能',
  content: `
# Playwright 浏览器窗口操作技能

本技能包含浏览器窗口的关闭和调整大小功能。

## 可用工具

### browser_close
关闭浏览器页面。关闭当前浏览器上下文，结束浏览器会话。

### browser_resize
调整浏览器窗口大小。设置视口宽度和高度，用于测试响应式布局或适应不同屏幕尺寸。

## 使用流程示例

### 调整窗口大小
1. 调用 \`browser_resize\` 设置视口大小
   - 参数：\`width=1920, height=1080\`
   - 说明：设置为桌面分辨率

### 测试移动端布局
1. 调用 \`browser_resize\` 设置移动端尺寸
   - 参数：\`width=375, height=667\`
   - 说明：模拟 iPhone 8 屏幕尺寸
2. 调用 \`browser_snapshot\` 查看移动端布局

### 测试响应式设计
1. 调用 \`browser_resize\` 设置桌面尺寸
   - 参数：\`width=1920, height=1080\`
2. 调用 \`browser_take_screenshot\` 截图
3. 调用 \`browser_resize\` 设置平板尺寸
   - 参数：\`width=768, height=1024\`
4. 调用 \`browser_take_screenshot\` 截图
5. 调用 \`browser_resize\` 设置手机尺寸
   - 参数：\`width=375, height=667\`
6. 调用 \`browser_take_screenshot\` 截图

### 关闭浏览器
1. 完成所有操作后
2. 调用 \`browser_close\` 关闭浏览器
   - 说明：释放浏览器资源，结束会话

## 常用屏幕尺寸参考

- **桌面**：1920x1080、1366x768、1440x900
- **平板**：768x1024（iPad）、1024x768（iPad 横屏）
- **手机**：375x667（iPhone 8）、414x896（iPhone 11）、360x640（Android）

## 注意事项

- \`browser_resize\` 只改变视口大小，不影响浏览器窗口本身
- 调整大小后，页面可能需要重新渲染，建议等待片刻
- \`browser_close\` 会关闭整个浏览器上下文，无法恢复
- 关闭浏览器后，需要重新连接才能继续操作
`,

  allowTools: [
    'browser_close',
    'browser_resize',
  ],
}

// RoxyBrowser 连接技能
export const playwrightRoxySkill = {
  name: 'playwright_roxy_skill',
  description: 'Playwright RoxyBrowser 连接技能',
  content: `
# Playwright RoxyBrowser 连接技能

本技能包含连接到 RoxyBrowser 浏览器实例的功能。

## 可用工具

### browser_connect_roxy
使用 CDP WebSocket 端点连接到 RoxyBrowser。CDP 端点从 \`roxy_open_browsers\` 工具的返回结果中获取，格式为 \`ws://127.0.0.1:PORT/devtools/browser/UUID\`。

## 完整集成流程

### 连接并操作 RoxyBrowser
1. 使用 \`roxy_open_browsers\` 打开浏览器（OpenAPI MCP 工具）
   - 参数：\`dirId="浏览器配置ID"\`
   - 返回：\`{ "ws": "ws://127.0.0.1:59305/devtools/browser/xxx" }\`

2. 调用 \`browser_connect_roxy\` 连接到浏览器
   - 参数：\`cdpEndpoint="ws://127.0.0.1:59305/devtools/browser/xxx"\`
   - 说明：使用上一步返回的 WebSocket 端点

3. 调用 \`browser_navigate\` 导航到目标网页
   - 参数：\`url="https://example.com"\`

4. 调用 \`browser_snapshot\` 获取页面结构
   - 返回：页面元素的引用（\`ref\` 或 \`mcpId\`）

5. 使用其他工具进行交互操作
   - 例如：\`browser_click\`、\`browser_type\` 等

### 完整示例：自动化登录流程
1. \`roxy_open_browsers\` → 获取 CDP 端点
2. \`browser_connect_roxy\` → 连接浏览器
3. \`browser_navigate\` → 打开登录页面
4. \`browser_snapshot\` → 获取表单元素引用
5. \`browser_type\` → 输入用户名
6. \`browser_type\` → 输入密码
7. \`browser_click\` → 点击登录按钮
8. \`browser_wait_for\` → 等待登录完成
9. \`browser_take_screenshot\` → 截图验证

## 注意事项

- CDP 端点必须从 \`roxy_open_browsers\` 的返回结果中获取
- CDP 端点格式：\`ws://127.0.0.1:PORT/devtools/browser/UUID\`
- 连接成功后，可以使用所有 Playwright 工具进行浏览器自动化操作
- 如果连接失败，检查浏览器是否已成功打开，CDP 端点是否正确
`,

  allowTools: [
    'browser_connect_roxy',
  ],
}

export const playwrightMcpSkills = [
  playwrightNavigateSkill,
  playwrightSnapshotSkill,
  playwrightInteractionSkill,
  playwrightKeyboardSkill,
  playwrightMouseSkill,
  playwrightTabsSkill,
  playwrightWaitSkill,
  playwrightEvaluateSkill,
  playwrightDialogsSkill,
  playwrightNetworkSkill,
  playwrightWindowSkill,
  playwrightRoxySkill,
]
