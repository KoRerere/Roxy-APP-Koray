import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import Zip from "adm-zip";
import AliOss from "ali-oss";

// 忽略 SSL/TLS 证书验证
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const zip = new Zip();

const isProd = process.env.NODE_ENV === 'production'
const token = isProd ? 'mjloBiRGORuGJikc1744800946396' : 'UJ4UKYUU3UKGfAmo1743595549211'

const webPath = path.join(__dirname, "../apps/web/dist");

const platformList = process.env.PLATFORM
  ? [process.env.PLATFORM === "mac" ? "macOS" : "Windows"]
  : ["Windows", "macOS"];
console.log("平台：", process.env.PLATFORM, platformList);
const version = fs.readFileSync(path.join(webPath, "version"), "utf-8");
const minimumAppVersion = fs.readFileSync(
  path.join(webPath, "minimum_app_version"),
  "utf-8",
);
const currentAppVersion = fs.readFileSync(
  path.join(webPath, "current_app_version"),
  "utf-8",
);
console.log("web 版本号：", version);
console.log("最低支持 APP 版本：", minimumAppVersion);
console.log("当前 APP 版本：", currentAppVersion);
if (version === undefined) {
  throw new Error("请在package.json中配置版本号");
}

const baseUrl = isProd
  ? "https://admin.lumibrowser.com"
  : "https://admintest.roxybrowser.co";

const baseOssConfig = {
  region: "oss-cn-shenzhen",
  accessKeyId: "",
  accessKeySecret: "",
  bucket: isProd ? "lumibrowser" : "lumibrowser-test",
};

// 将 web 资源包添加到 zip 中, 排除 .map 文件
zip.addLocalFolder(webPath, "", (filename) => {
  return !filename.endsWith(".map");
});

async function getOssToken() {
  const response = await fetch(
    `${baseUrl}/fb-admin-api/admin_get_oss_credential`,
    {
      headers: {
        token,
      },
    },
  );
  const result = await response.json();
  const { code, data, msg } = result;
  if (code !== 0) {
    throw new Error(`获取 oss token 失败: ${msg}`);
  }
  return data;
}

async function startUpload() {
  const ossConfig = await getOssToken();
  // console.log('ossConfig',ossConfig)
  const ossClient = new AliOss({
    ...baseOssConfig,
    ...ossConfig,
    stsToken: ossConfig.securityToken,
  });
  console.log("上传 web 资源包中...");
  const versions = [currentAppVersion, minimumAppVersion]
  for (const appVersion of versions) {
    for (const platform of platformList) {
      const uploadZip = await ossClient.put(
        `/public/package/web/${appVersion}/${platform}/dist.zip`,
        zip.toBuffer(),
      );
      console.log("上传 web 资源包成功：", uploadZip.url);
      const data = Buffer.from(
        JSON.stringify({
          version,
          minimum_app_version: minimumAppVersion,
          releaseTime: getCurrentFormattedTime(),
        }),
      );
      const uploadVersionRes = await ossClient.put(
        `/public/package/web/${appVersion}/${platform}/version.json`,
        data,
      );
      console.log("上传版本号成功：", uploadVersionRes.url);
    }
  }
}

function getCurrentFormattedTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

startUpload()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
// if (isProd) {
//   rl.question('最低支持的 APP 版本： ', (version) => {
//     if (version) {
//       console.log(`最低支持的 APP 版本：${version}`)
//     }
//     else {
//       console.log('未输入最低支持的 APP 版本，将默认为 0.0.0')
//     }
//     startUpload(version || '0.0.0')
//     rl.close()
//   })
// } else {
//   startUpload('0.0.0').finally(() => {
//     process.exit(0)
//   })
// }
