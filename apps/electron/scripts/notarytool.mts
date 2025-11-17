import { execSync } from 'node:child_process'
import path from 'node:path'
import { existsSync, statSync, readFileSync } from 'node:fs'

const workDir = path.join(import.meta.dirname, '../')

const config = {
  folderPath: path.join(workDir, '../../out'),
  ymlFilePath: path.join(workDir, '../../out/latest-mac.yml'),
  keychainProfile: 'RoxyBrowser',
  pollInterval: 30000, // 查询间隔：30秒
  maxPollCount: 20,    // 最大查询次数：20次（10分钟）
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

// 验证 YAML 文件是否存在
if (!existsSync(config.ymlFilePath)) {
  console.error(`错误: latest-mac.yml 文件不存在: ${config.ymlFilePath}`);
  process.exit(1);
}

// 解析 YAML 文件获取版本号并构建 PKG 文件列表
function getPkgFilesFromYaml(ymlPath: string, folderPath: string): string[] {
  try {
    const ymlContent = readFileSync(ymlPath, 'utf-8');
    const pkgFiles: string[] = [];

    // 解析 version 字段
    const versionMatch = ymlContent.match(/^version:\s*(.+)$/m);
    if (!versionMatch) {
      console.error('错误: 无法从 YAML 文件中找到 version 字段');
      return [];
    }

    const version = versionMatch[1].trim();
    console.log(`版本号: ${version}`);

    // 从第一个 ZIP/DMG 文件名中提取产品名称
    // 格式：RoxyBrowserDev_x64_6.6.0.zip
    const fileMatch = ymlContent.match(/url:\s*(\w+)_(?:x64|arm64)_[\d.]+\./);
    if (!fileMatch) {
      console.error('错误: 无法从 YAML 文件中提取产品名称');
      return [];
    }

    const productName = fileMatch[1]; // RoxyBrowserDev 或 RoxyBrowser
    console.log(`产品名称: ${productName}`);

    // 构建 PKG 文件名：{productName}_{arch}_{version}.pkg
    const architectures = ['x64', 'arm64'];

    for (const arch of architectures) {
      const fileName = `${productName}_${arch}_${version}.pkg`;
      const fullPath = path.join(folderPath, fileName);

      // 检查文件是否存在
      if (existsSync(fullPath)) {
        pkgFiles.push(fullPath);
        console.log(`✓ 找到 PKG 文件: ${fileName}`);
      } else {
        console.warn(`⚠️  PKG 文件不存在: ${fileName}`);
      }
    }

    return pkgFiles;
  } catch (error) {
    console.error(`解析 YAML 文件失败: ${(error as Error).message}`);
    return [];
  }
}

console.log(`读取配置文件: ${path.basename(config.ymlFilePath)}\n`);
const pkgFiles = getPkgFilesFromYaml(config.ymlFilePath, config.folderPath);

if (pkgFiles.length === 0) {
  console.error(`\n错误: 在 ${config.ymlFilePath} 中没有找到有效的 .pkg 文件`);
  process.exit(1);
}

console.log(`\n将公证 ${pkgFiles.length} 个 PKG 文件:\n`);
pkgFiles.forEach((file, index) => {
  console.log(`  ${index + 1}. ${path.basename(file)}`);
});

console.log(`\n开始公证流程...`);

// 处理每个 .pkg 文件的函数
async function processPkgFile(pkgPath: string, index: number): Promise<boolean> {
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
        console.error(`${fileName} 第 ${pollCount} 次查询公证状态失败:`, (infoError as Error).message);

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
    console.error(`${fileName} 处理失败:`, (error as Error).message);
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
