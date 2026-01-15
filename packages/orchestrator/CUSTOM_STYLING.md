# 自定义样式配置指南

本指南将帮助你自定义聊天界面的样式，包括 Markdown 渲染、代码高亮、消息气泡样式等。

## 📋 目录

1. [Markdown 渲染配置](#markdown-渲染配置)
2. [代码高亮配置](#代码高亮配置)
3. [消息气泡样式](#消息气泡样式)
4. [自定义主题](#自定义主题)
5. [高级自定义](#高级自定义)

## 🎨 Markdown 渲染配置

### 修改 Markdown 渲染选项

在 `chat-ui.html` 文件中，找到 `marked.setOptions()` 函数：

```javascript
marked.setOptions({
  breaks: true,        // 支持 GitHub 风格的换行（单个换行也会渲染为 <br>）
  gfm: true,           // 启用 GitHub 风格的 Markdown（任务列表、删除线等）
  highlight: function(code, lang) {
    // 代码高亮配置
    if (lang && typeof hljs !== 'undefined') {
      try {
        return hljs.highlight(code, { language: lang }).value
      } catch (err) {
        return hljs.highlightAuto(code).value
      }
    }
    return code
  },
})
```

### 可用的 Markdown 选项

- `breaks: true/false` - 是否将单个换行符转换为 `<br>`
- `gfm: true/false` - 是否启用 GitHub 风格的 Markdown
- `headerIds: true/false` - 是否为标题生成 ID
- `mangle: true/false` - 是否混淆邮箱地址
- `sanitize: true/false` - 是否清理 HTML（安全选项）
- `silent: true/false` - 是否静默处理错误

更多选项请参考 [Marked.js 文档](https://marked.js.org/using_advanced#options)

## 💻 代码高亮配置

### 更换代码高亮主题

在 `<head>` 部分，找到 highlight.js 的 CSS 链接：

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github-dark.min.css" />
```

你可以替换为其他主题，例如：

- `github.min.css` - GitHub 浅色主题
- `github-dark.min.css` - GitHub 深色主题（当前使用）
- `monokai.min.css` - Monokai 主题
- `vs2015.min.css` - Visual Studio 2015 主题
- `atom-one-dark.min.css` - Atom One Dark 主题
- `dracula.min.css` - Dracula 主题

所有可用主题：https://github.com/highlightjs/highlight.js/tree/main/src/styles

### 自定义代码块样式

在 `<style>` 部分，找到 `.message-bubble :deep(pre)` 样式：

```css
.message-bubble :deep(pre) {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #1e1e1e;
  border-radius: 6px;
  margin: 0.5em 0;
}
```

你可以修改：
- `padding` - 内边距
- `background-color` - 背景颜色
- `border-radius` - 圆角
- `font-size` - 字体大小
- `line-height` - 行高

## 💬 消息气泡样式

### 修改 AI 消息气泡样式

找到 `.message-ai .message-bubble` 样式：

```css
.message-ai .message-bubble {
  background: #f1f3f5;
  color: #212529;
}
```

你可以修改：
- `background` - 背景颜色或渐变
- `color` - 文字颜色
- `padding` - 内边距
- `border-radius` - 圆角大小
- `max-width` - 最大宽度（当前 70%）

### 修改用户消息气泡样式

找到 `.message-user .message-bubble` 样式：

```css
.message-user .message-bubble {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}
```

你可以：
- 使用纯色：`background: #667eea;`
- 使用渐变：`background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);`
- 使用图片：`background: url('your-image.jpg');`

### 修改消息间距

找到 `.message` 样式：

```css
.message {
  margin-bottom: 16px;
  animation: fadeIn 0.3s ease-in;
}
```

修改 `margin-bottom` 来调整消息之间的间距。

## 🎭 自定义主题

### 创建深色主题

在 `<style>` 部分添加：

```css
/* 深色主题 */
body.dark-theme {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

body.dark-theme .container {
  background: #2d2d44;
  color: #e0e0e0;
}

body.dark-theme .message-ai .message-bubble {
  background: #3d3d5c;
  color: #e0e0e0;
}

body.dark-theme .messages {
  background: #2d2d44;
}
```

然后在 JavaScript 中添加切换主题的功能：

```javascript
function toggleTheme() {
  document.body.classList.toggle('dark-theme')
  localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light')
}

// 加载保存的主题
if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark-theme')
}
```

### 创建自定义配色方案

你可以创建多个主题类：

```css
/* 蓝色主题 */
.theme-blue .message-user .message-bubble {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

/* 绿色主题 */
.theme-green .message-user .message-bubble {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

/* 橙色主题 */
.theme-orange .message-user .message-bubble {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}
```

## 🔧 高级自定义

### 自定义 Markdown 渲染器

你可以扩展 Marked.js 的渲染器来自定义特定元素的渲染：

```javascript
const renderer = new marked.Renderer()

// 自定义代码块渲染
renderer.code = function(code, lang, escaped) {
  const langClass = lang ? `language-${lang}` : ''
  return `<pre class="custom-code-block"><code class="${langClass}">${escaped ? code : escape(code)}</code></pre>`
}

// 自定义链接渲染
renderer.link = function(href, title, text) {
  return `<a href="${href}" title="${title}" target="_blank" rel="noopener noreferrer">${text}</a>`
}

marked.setOptions({ renderer })
```

### 添加自定义 CSS 类

你可以在消息气泡上添加自定义类：

```javascript
function addMessage(content, type = 'ai', eventType = null) {
  // ... 现有代码 ...
  const bubble = document.createElement('div')
  bubble.className = 'message-bubble custom-class' // 添加自定义类
  // ... 其余代码 ...
}
```

然后在 CSS 中定义：

```css
.message-bubble.custom-class {
  border: 2px solid #667eea;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

### 添加动画效果

```css
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.message {
  animation: slideIn 0.3s ease-out;
}
```

### 自定义字体

```css
.message-bubble {
  font-family: 'Inter', 'Segoe UI', sans-serif;
  font-size: 15px;
  line-height: 1.6;
}

/* 代码块字体 */
.message-bubble pre code {
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 14px;
}
```

### 响应式设计

```css
@media (max-width: 768px) {
  .message-bubble {
    max-width: 85%;
    font-size: 14px;
  }
  
  .container {
    height: 100vh;
    border-radius: 0;
  }
}
```

## 📝 示例：完整自定义配置

以下是一个完整的自定义配置示例：

```css
/* 自定义消息气泡 */
.message-ai .message-bubble {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  color: #2d3748;
  padding: 16px 20px;
  border-radius: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #667eea;
}

.message-user .message-bubble {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 20px;
  border-radius: 20px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

/* 自定义代码块 */
.message-bubble :deep(pre) {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 16px;
  margin: 12px 0;
}

/* 自定义表格 */
.message-bubble :deep(table) {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.message-bubble :deep(table th) {
  background: #f7fafc;
  font-weight: 600;
}
```

## 🎯 快速参考

### 常用颜色值

- 主色调：`#667eea` (紫色)
- 辅助色：`#764ba2` (深紫色)
- 背景色：`#f1f3f5` (浅灰)
- 文字色：`#212529` (深灰)
- 代码背景：`#1e1e1e` (深黑)

### 常用 CSS 属性

- `padding` - 内边距
- `margin` - 外边距
- `border-radius` - 圆角
- `box-shadow` - 阴影
- `background` - 背景
- `color` - 文字颜色
- `font-size` - 字体大小
- `line-height` - 行高

## 📚 相关资源

- [Marked.js 文档](https://marked.js.org/)
- [Highlight.js 文档](https://highlightjs.org/)
- [CSS 渐变生成器](https://cssgradient.io/)
- [Google Fonts](https://fonts.google.com/) - 自定义字体

## 💡 提示

1. **使用浏览器开发者工具**：按 F12 打开开发者工具，可以实时预览样式修改
2. **保存自定义样式**：建议将自定义样式保存到单独的 CSS 文件中，方便管理
3. **测试不同设备**：确保在不同屏幕尺寸下样式都正常显示
4. **性能考虑**：避免使用过于复杂的动画和效果，可能影响性能

---

如有问题或需要更多帮助，请查看项目文档或提交 Issue。

