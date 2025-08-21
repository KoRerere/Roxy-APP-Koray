import { execSync } from 'node:child_process'
import path from 'node:path'
import { existsSync, statSync, readdirSync } from 'node:fs'

const workDir = path.join(import.meta.dirname, '../')

const config = {
  folderPath: path.join(workDir, '../../out'),
  keychainProfile: 'RoxyBrowser',
  pollInterval: 30000, // 查询间隔：10秒
  maxPollCount: 20,    // 最大查询次数：60次（10分钟）
  timeoutMinutes: 10   // 超时时间：10分钟
}

// 验证文件夹路径是否存在
if (!existsSync(config.folderPath)) {
  console.error(`错误: 文件夹路径不存在: ${config.folderPath}`);
  process.exit(1);
}

// 检查是否为文件夹
if (!statSync(config.folderPath).isDirectory()) {
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

    // 第二步: 定时查询公证状态直到完成
    console.log(`\n2. 开始定时查询 ${fileName} 公证状态...`);
    console.log(`查询间隔: ${config.pollInterval / 1000}秒, 最大查询次数: ${config.maxPollCount}次, 超时时间: ${config.timeoutMinutes}分钟`);

    const startTime = Date.now();
    let pollCount = 0;
    let isAccepted = false;

    while (pollCount < config.maxPollCount) {
      pollCount++;
      const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

      // 计算预计剩余时间
      const estimatedTotalTime = (config.maxPollCount * config.pollInterval) / 1000; // 秒
      const remainingSeconds = Math.max(0, estimatedTotalTime - elapsedSeconds);
      const remainingMinutes = Math.floor(remainingSeconds / 60);
      const remainingSecs = remainingSeconds % 60;

      console.log(`\n第 ${pollCount}/${config.maxPollCount} 次查询 (已用时: ${elapsedMinutes}分${elapsedSeconds % 60}秒, 预计剩余: ${remainingMinutes}分${remainingSecs}秒)...`);

      const infoCommand = `xcrun notarytool info ${notaryId} --keychain-profile "${config.keychainProfile}"`;

      try {
        const infoResult = execSync(infoCommand, {
          encoding: 'utf8',
          stdio: 'pipe'
        });

        // 检查公证状态
        if (infoResult.includes('status: Accepted')) {
          console.log(`✅ ${fileName} 公证已通过! (用时: ${elapsedMinutes}分${elapsedSeconds % 60}秒)`);
          isAccepted = true;
          break;
        } else if (infoResult.includes('status: In Progress')) {
          console.log(`⏳ ${fileName} 公证进行中...`);
        } else if (infoResult.includes('status: Invalid')) {
          console.error(`❌ ${fileName} 公证失败!`);
          console.log(`公证详情: ${infoResult}`);
          return false;
        } else {
          const statusMatch = infoResult.match(/status: ([^\n]+)/);
          const status = statusMatch ? statusMatch[1] : '未知';
          console.log(`ℹ️ ${fileName} 公证状态: ${status}`);
        }

        // 检查是否超时
        if (elapsedMinutes >= config.timeoutMinutes) {
          console.error(`⏰ ${fileName} 公证查询超时 (${config.timeoutMinutes}分钟)`);
          return false;
        }

        // 如果不是最后一次查询，则等待后继续
        if (pollCount < config.maxPollCount) {
          console.log(`等待 ${config.pollInterval / 1000} 秒后进行下次查询...`);
          await new Promise(resolve => setTimeout(resolve, config.pollInterval));
        }

      } catch (infoError) {
        console.error(`${fileName} 第 ${pollCount} 次查询公证状态失败:`, infoError.message);

        // 如果是网络错误，继续重试
        if (pollCount < config.maxPollCount) {
          console.log(`等待 ${config.pollInterval / 1000} 秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, config.pollInterval));
          continue;
        } else {
          console.error(`${fileName} 查询次数已达上限，停止查询`);
          return false;
        }
      }
    }

    if (!isAccepted) {
      const totalElapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
      console.error(`❌ ${fileName} 公证未在预期时间内完成 (总用时: ${totalElapsedMinutes}分钟)`);
      return false;
    }

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
