import { spawn } from 'node:child_process'

async function runGitCommand(command, args) {
  return new Promise((resolve, reject) => {
    /**
     * 捕获 stderr 输出
     */
    let stderrOutput = ''
    const process = spawn(command, args, { shell: true, cwd: process.cwd() })

    process.stdout.on('data', (data) => {
      console.log(`stdout: ${data.toString()}`)
    })

    process.stderr.on('data', (data) => {
      stderrOutput += data.toString() // 捕获 stderr 输出
      console.error(`stderr: ${data.toString()}`)
    })

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}: ${stderrOutput}`))
      }
      else {
        resolve()
      }
    })
  })
}

export async function runGitCommands() {
  try {
    console.log('Stashing changes...')
    await runGitCommand('git', ['stash', 'save', '"update language files"']) // 修正 stash 命令

    console.log('Resetting to latest commit...')
    await runGitCommand('git', ['reset', '--hard'])

    console.log('Pulling latest changes...')
    await runGitCommand('git', ['pull', '--no-verify'])

    console.log('Applying stashed changes...')
    await runGitCommand('git', ['stash', 'pop'])

    console.log('Checking for merge conflicts...')
    await runGitCommand('git', ['diff', '--name-only', '--diff-filter=U']) // 检查冲突

    console.log('Adding all changes...')
    await runGitCommand('git', ['add', '-A'])

    console.log('Committing changes...')
    await runGitCommand('git', ['commit', '-m', '"update language files"', '--no-verify'])

    console.log('Pushing changes...')
    await runGitCommand('git', ['push', '--no-verify']) // 解开注释以推送更改

    console.log('All commands executed successfully.')
    return Promise.resolve('提交成功')
  }
  catch (error) {
    console.error(`Error executing command: ${error.message}`)
    return Promise.reject(error.message)
  }
}
