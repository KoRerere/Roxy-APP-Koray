import { execSync } from 'node:child_process'
import path from 'node:path'
import { existsSync, statSync, readdirSync } from 'node:fs'

const workDir = path.join(import.meta.dirname, '../')

// 配置参数
const config = {
  folderPath: process.argv[2] || path.join(workDir, '../../out'),
  keychainProfile: process.argv[3] || 'RoxyBrowser'
};

// 验证参数
if (!config.folderPath) {
  console.error('错误: 请提供文件夹路径');
  console.log('使用方法: node notarize.js <文件夹路径> [密钥链配置文件]');
  console.log('示例: node notarize.js ./dist MY_PASSWORD');
  process.exit(1);
}

// 验证文件夹路径是否存在
if (!existsSync(config.folderPath)) {
  console.error(`错误: 文件夹路径不存在: ${config.folderPath}`);
  process.exit(1);
}

// 检查是否为文件夹
const stats = statSync(config.folderPath);
if (!stats.isDirectory()) {
  console.error(`错误: 提供的路径不是文件夹: ${config.folderPath}`);
  process.exit(1);
}

// 获取文件夹下所有的 .pkg 文件
function getPkgFiles(folderPath) {
  try {
    const files = readdirSync(folderPath);
    return files
      .filter(file => file.endsWith('.pkg'))
      .map(file => path.join(folderPath, file));
  } catch (error) {
    console.error(`读取文件夹失败: ${error.message}`);
    return [];
  }
}

const pkgFiles = getPkgFiles(config.folderPath);

if (pkgFiles.length === 0) {
  console.error(`错误: 在文件夹 ${config.folderPath} 中没有找到 .pkg 文件`);
  process.exit(1);
}

console.log(`找到 ${pkgFiles.length} 个 .pkg 文件:`);
pkgFiles.forEach((file, index) => {
  console.log(`  ${index + 1}. ${path.basename(file)}`);
});

console.log(`\n开始公证 ${pkgFiles.length} 个 .pkg 文件...`);
console.log(`文件夹路径: ${config.folderPath}`);
console.log(`密钥链配置文件: ${config.keychainProfile}`);

// 处理每个 .pkg 文件的函数
async function processPkgFile(pkgPath, index) {
  const fileName = path.basename(pkgPath);
  console.log(`\n=== 处理文件 ${index + 1}/${pkgFiles.length}: ${fileName} ===`);

  try {
    // 第一步: 提交应用进行公证
    console.log(`\n1. 提交 ${fileName} 进行公证...`);
    const notaryCommand = `xcrun notarytool submit "${pkgPath}" --keychain-profile "${config.keychainProfile}"`;
    console.log(`执行命令: ${notaryCommand}`);

    const notaryResult = execSync(notaryCommand, {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    console.log(`${fileName} 公证提交成功!`);

    // 从输出中提取公证ID
    const notaryIdMatch = notaryResult.match(/id: ([a-zA-Z0-9-]+)/);
    if (!notaryIdMatch) {
      console.error(`${fileName} 无法获取公证ID`);
      console.log(`输出内容: ${notaryResult}`);
      return false;
    }

    const notaryId = notaryIdMatch[1];
    console.log(`公证ID: ${notaryId}`);

    // 第二步: 查询公证状态
    console.log(`\n2. 查询 ${fileName} 公证状态...`);
    const infoCommand = `xcrun notarytool info ${notaryId} --keychain-profile "${config.keychainProfile}"`;
    console.log(`执行命令: ${infoCommand}`);

    try {
      const infoResult = execSync(infoCommand, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      console.log(`${fileName} 公证状态查询成功!`);

      // 检查公证状态
      if (infoResult.includes('status: Accepted')) {
        console.log(`${fileName} 公证已通过!`);
      } else if (infoResult.includes('status: In Progress')) {
        console.log(`${fileName} 公证进行中...`);
      } else {
        console.log(`${fileName} 公证状态: ${infoResult.match(/status: ([^\n]+)/)?.[1] || '未知'}`);
      }

    } catch (infoError) {
      console.error(`${fileName} 查询公证状态失败:`, infoError.message);
      return false;
    }

    // 等待一段时间确保公证完成
    console.log(`\n等待 ${fileName} 公证完成...`);
    await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒

    // 第三步: 装订公证票证到应用
    console.log(`\n3. 装订公证票证到 ${fileName}...`);
    const stapleCommand = `xcrun stapler staple "${pkgPath}"`;
    console.log(`执行命令: ${stapleCommand}`);

    execSync(stapleCommand, {
      encoding: 'utf8',
      stdio: 'inherit'
    });

    console.log(`${fileName} 装订成功!`);
    console.log(`\n✅ ${fileName} 公证和装订完成!`);

    return true;
  } catch (error) {
    console.error(`${fileName} 处理失败:`, error.message);
    return false;
  }
}

// 主处理函数
async function processAllPkgFiles() {
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < pkgFiles.length; i++) {
    const success = await processPkgFile(pkgFiles[i], i);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log(`\n=== 处理完成 ===`);
  console.log(`成功: ${successCount} 个文件`);
  console.log(`失败: ${failCount} 个文件`);

  if (failCount > 0) {
    process.exit(1);
  } else {
    console.log(`\n🎉 所有 ${pkgFiles.length} 个 .pkg 文件公证和装订完成!`);
  }
}

// 开始处理
processAllPkgFiles().catch(error => {
  console.error('处理过程中发生错误:', error.message);
  process.exit(1);
});
