export const fileSystemSkill = {
  name: 'roxy_file_system_skill',
  description: 'RoxyBrowser 文件系统操作技能（包含 读/写 文件，下载文件，列出目录，检查目录等操作）',
  content: `
# RoxyBrowser 文件系统操作技能

本技能包含本地文件系统的完整操作功能，包括文件下载、读取、写入、目录列表和目录检查等操作。

## 可用工具

### roxy_download
从网页下载任何静态资源（如图片、视频、字体、JS/CSS、ZIP 文件等）。只需要提供资源的直接链接即可下载。下载的文件会保存到指定的目录中。

### roxy_read_file
从本地文件系统读取文件内容。支持读取文本文件，文件大小限制为 128KB。如果文件超过限制或不存在，会返回相应的错误信息。

### roxy_ls
列出目录中的所有文件和子目录，类似 \`ls\` 命令。显示文件类型、大小和修改时间。当用户只提供了目录路径时，可以使用此工具列出目录内容，然后将目录路径与文件名拼接成完整路径。

**重要提示**：使用此工具列出目录后，需要将目录路径与文件名拼接成完整路径。例如，如果目录是 \`C:/downloads\`，文件名是 \`image.jpg\`，完整路径应该是 \`C:/downloads/image.jpg\`。

### roxy_check_directory
检查目录是否正常，包括：
- 目录是否存在
- 是否为有效目录
- 是否可读
- 是否可写
- 如果不存在，会自动创建目录

### roxy_write_file
将内容写入指定文件。如果文件的父目录不存在，会自动创建。写入前会检查目录是否可写，写入后会返回文件大小等信息。

## 使用流程建议

1. **检查目录**: 使用 \`roxy_check_directory\` 检查目录是否存在和可访问
2. **列出文件**: 使用 \`roxy_ls\` 列出目录中的文件（当用户只提供目录路径时）
3. **读取文件**: 使用 \`roxy_read_file\` 读取文件内容（需要完整路径）
4. **写入文件**: 使用 \`roxy_write_file\` 将内容写入文件
5. **下载文件**: 使用 \`roxy_download\` 从网络下载文件到本地

## 注意事项

- \`roxy_read_file\` 有 128KB 的文件大小限制
- \`roxy_ls\` 只输出文件名，需要手动将目录路径与文件名拼接成完整路径
- \`roxy_check_directory\` 如果目录不存在会自动创建
- \`roxy_write_file\` 如果父目录不存在会自动创建
- 路径可以使用绝对路径或相对路径
- Windows 系统路径可以使用 \`/\` 或 \`\\\\\` 作为分隔符
`,
  allowTools: [
    'roxy_download',
    'roxy_read_file',
    'roxy_ls',
    'roxy_check_directory',
    'roxy_write_file',
  ],
}

export const fileSystemSkills = [
  fileSystemSkill,
]
