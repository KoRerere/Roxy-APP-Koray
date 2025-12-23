import { execSync } from 'node:child_process'
import readline from 'node:readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

console.log('⚠️ 这将执行以下命令：')
console.log('git fetch -p && git reset --hard origin/main && git clean -d -f\n')

rl.question('确认继续？[Y/n] ', (answer) => {
  if (answer === '' || /^y$/i.test(answer)) {
    execSync(
      'git fetch -p && git reset --hard origin/main && git clean -d -f',
      { stdio: 'inherit' },
    )
  }
  else {
    console.log('已取消')
  }
  rl.close()
})
