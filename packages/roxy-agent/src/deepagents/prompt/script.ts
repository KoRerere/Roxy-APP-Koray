import { env } from '@/config'

const isZh = env.SYSTEM_LANGUAGE === 'zh-CN'

export const SCRIPT_PROMPT = {
  runScript: {
    description: isZh
      ? '运行一个或多个自动化脚本。每个脚本会通过 fork roxy-agent sandbox 子进程执行，并通过 CDP 连接浏览器。脚本入口签名为 `export async function main(options)`，可选传入 options（object 或 JSON string）作为脚本入参，运行时按 typeof 动态解析。每个脚本对应的入参 JSON Schema 可通过 list_scripts 查看。'
      : 'Run one or more automation scripts. Each script runs in a forked roxy-agent sandbox child process with browser access over CDP. The script entry signature is `export async function main(options)`; pass options (object or JSON string) as script input, parsed at runtime by typeof. The options JSON Schema for each script is available via list_scripts.',
    scriptsDescription: isZh
      ? '要运行的脚本数组；多项会并行执行'
      : 'Array of scripts to run. Multiple entries run in parallel.',
    scriptNameDescription: isZh
      ? '脚本名称或脚本 ID（scr_xxx）；ID 优先匹配，其次按名称匹配；enhancement 工作区中也可以是 enhanced_script.ts 这类相对路径；也可以是 skills 目录内脚本的绝对路径（如 .../skills/<skill>/scripts/upload.ts）以运行来自 skill 的脚本（仅限 skills 目录内，与 load_skill_file 同源守卫；必须遵守脚本规范否则运行时报错）'
      : 'Script name or script ID (scr_xxx). ID match takes priority, then name match. In enhancement workspaces, this may also be a relative path such as enhanced_script.ts. It may also be an absolute path to a script inside the skills directory (e.g. .../skills/<skill>/scripts/upload.ts) to run a script authored in a skill (restricted to the skills directory, same guard as load_skill_file; it MUST follow the script contract or the sandbox will error at runtime).',
    outsideSkillsRoot: (rawPath: string) => isZh
      ? `脚本路径 "${rawPath}" 不在已安装 skills 目录内。run_script 仅允许运行 skills 目录内的本地脚本（与 load_skill_file 同源），请确认路径指向某个 skill 内的脚本文件。`
      : `Script path "${rawPath}" is outside the installed skills directory. run_script only allows running local scripts inside the skills directory (same guard as load_skill_file); make sure the path points to a script file within a skill.`,
    localPathNotFile: (rawPath: string) => isZh
      ? `本地脚本路径 "${rawPath}" 不存在或不是文件。`
      : `Local script path "${rawPath}" does not exist or is not a file.`,
    dirIdDescription: isZh
      ? '浏览器分身 ID；工具会自动打开该分身并取得 CDP URL'
      : 'Browser profile id. The tool opens this profile and uses its CDP URL.',
    profileDescription: isZh
      ? 'sandbox profile：普通运行用 release，enhancement 测试用 debug'
      : 'Sandbox profile: use release for normal runs and debug for enhancement tests.',
    optionsDescription: isZh
      ? '脚本入参 options：可为 object 或 JSON string。运行时判断类型并动态解析 JSON，注入子进程供脚本的 main(options) 使用。无需入参时可省略；传入时需符合该脚本的入参 JSON Schema（用 list_scripts 查看）'
      : 'Script input options: an object or a JSON string. Parsed at runtime and injected into the child process for main(options) to consume. Omit when the script takes no input; when provided, it must conform to the script\'s options JSON Schema (see list_scripts).',
    optionsParseFailed: (message: string) => isZh
      ? `options 参数 JSON 解析失败：${message}。请传入合法的 JSON 字符串或 object。`
      : `Failed to parse options as JSON: ${message}. Pass a valid JSON string or an object.`,
    minScriptsMessage: isZh ? '至少需要一个脚本' : 'At least one script is required',
    aborted: isZh ? '任务已被中断' : 'Task was interrupted.',
    paramIsEmpty: (name: string) => isZh
      ? `传入的参数 ${name} 为空，请检查工具调用参数`
      : `Parameter ${name} is empty, please check the parameters`,
    missingTarget: (scriptName: string) => isZh
      ? `脚本 "${scriptName}" 缺少运行目标：请提供 dirId 让工具自动打开浏览器。`
      : `Script "${scriptName}" has no target. Provide dirId so the tool can open the browser profile.`,
    notFound: (scriptName: string) => isZh
      ? `脚本 "${scriptName}" 未找到，请确认脚本名称是否正确。`
      : `Script "${scriptName}" was not found. Check the script name and try again.`,
    pathOutOfWorkspace: (scriptName: string) => isZh
      ? `脚本路径 "${scriptName}" 超出 enhancement 工作区。`
      : `Script path "${scriptName}" is outside the enhancement workspace.`,
    pathTraversal: (scriptName: string) => isZh
      ? `脚本路径 "${scriptName}" 包含路径穿越片段。`
      : `Script path "${scriptName}" contains path traversal segments.`,
    resolveFailed: (scriptName: string, message: string) => isZh
      ? `脚本 "${scriptName}" 解析失败：${message}`
      : `Failed to resolve script "${scriptName}": ${message}`,
    startFailed: (scriptName: string, message: string) => isZh
      ? `脚本 "${scriptName}" 启动失败：${message}`
      : `Script "${scriptName}" failed to start: ${message}`,
    interrupted: (scriptName: string) => isZh
      ? `脚本 "${scriptName}" 执行被中断。`
      : `Script "${scriptName}" was interrupted.`,
    logFileTitle: isZh ? '日志文件' : 'Log file',
    logFile: (path: string, absolutePath?: string) => [
      `## ${isZh ? '日志文件' : 'Log file'}`,
      '',
      `- path: \`${path}\``,
      absolutePath ? `- absolutePath: \`${absolutePath}\`` : '',
    ].filter(Boolean).join('\n'),
    success: (scriptName: string) => isZh
      ? `脚本 "${scriptName}" 执行成功`
      : `Script "${scriptName}" completed successfully`,
    killed: (scriptName: string) => isZh
      ? `脚本 "${scriptName}" 执行失败：被强制终止。`
      : `Script "${scriptName}" failed: force terminated.`,
    timeout: (scriptName: string) => isZh
      ? `脚本 "${scriptName}" 执行失败：超时。`
      : `Script "${scriptName}" failed: timed out.`,
    exitCode: (scriptName: string, code: number | null) => isZh
      ? `脚本 "${scriptName}" 执行失败：退出码 ${code}。`
      : `Script "${scriptName}" failed with exit code ${code}.`,
  },
  listScripts: {
    description: isZh
      ? '列出当前工作区内所有已注册脚本，供 agent 查看可用脚本名称或 ID 后再调用 run_script。每个脚本的入参 JSON Schema 会随表格返回：表格「入参」列给出参数名摘要，表格下方附每个脚本的完整 JSON Schema，agent 据此为 run_script 构造 options 参数。'
      : 'List all registered scripts in the current workspace, so the agent can discover available script names or IDs before calling run_script. Each script\'s options JSON Schema is returned alongside the table: the "Options" column shows a summary of parameter names, and the full JSON Schema for each script is appended below the table so the agent can build the options argument for run_script.',
    headerTitle: (count: number) => isZh
      ? `当前工作区共有 **${count}** 个脚本。调用 \`run_script\` 时传入 **脚本名称**或**脚本 ID（scr_xxx）**；需要入参的脚本请按下方 JSON Schema 构造 \`options\` 传入。`
      : `Found **${count}** script(s) in the current workspace. Pass the **script name** or **script ID (scr_xxx)** to \`run_script\`. For scripts that take input, build the \`options\` argument according to the JSON Schema below.`,
    empty: isZh
      ? '当前工作区暂无已注册脚本，可通过录制流程生成脚本。'
      : 'No scripts registered in the current workspace. You can generate scripts via the recording workflow.',
    schemaTitle: isZh ? '## 参数 Schema' : '## Options Schemas',
    columnHeaders: isZh
      ? ['名称', 'ID', '描述', '来源', '可运行', '关联分身', '创建时间', '入参']
      : ['Name', 'ID', 'Description', 'Source', 'Runnable', 'DirId', 'Created', 'Options'],
  },
}
