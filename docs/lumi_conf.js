let fs = require('fs');
function encryptFingerprintConfig(data) {
  let crypto = require("crypto");

  let key = "402ead7d23b43b6d1e0528d4f99c59bd"

  let nonce = "3a105229aa31"

  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);

  const encryptedValue = Buffer.concat([

    cipher.update(data),

    cipher.final(),

    cipher.getAuthTag(),]);

  //console.log("tag:",encryptedValue.length)

  return encryptedValue.toString('base64');
}

function decryptFingerprintConfig(enData) {
  let bufferObj = Buffer.from(enData, "base64");
  let crypto = require("crypto");
  let key = "402ead7d23b43b6d1e0528d4f99c59bd"
  let nonce = "3a105229aa31"
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  const tag = bufferObj.subarray(bufferObj.length - 16, bufferObj.length)
  decipher.setAuthTag(tag)
  let str = decipher.update(bufferObj.subarray(0, bufferObj.length - 16));
  str += decipher.final('utf8');
  return str;
}

content = fs.readFileSync("C:\\Users\\Administrator\\AppData\\Roaming\\RoxyBrowserDev\\browser-cache\\698c007825eba9c9049501bdefc6b72e\\lumi.conf")
const rst = decryptFingerprintConfig(content.toString())
console.log(rst)
const { spawn } = require('child_process');
const child = spawn('clip');
child.stdin.write(Buffer.from(rst, 'utf16le'));
child.stdin.end();
