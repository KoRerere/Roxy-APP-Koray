const { generateKeyPairSync } = require('crypto');

/**
 * 生成 RSA 密钥对
 * @returns {Object} - 包含公钥和私钥的对象
 */
function generateRSAKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return { publicKey, privateKey };
}

/**
 * 提取公钥的 Base64 编码
 * @param {string} publicKey - PEM 格式的公钥
 * @returns {string} - 公钥的 Base64 编码
 */
function extractBase64PublicKey(publicKey) {
  const base64PublicKey = publicKey
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\n/g, '');
  return base64PublicKey;
}

// 生成 RSA 密钥对
const { publicKey, privateKey } = generateRSAKeyPair();

// 提取公钥的 Base64 编码
const base64PublicKey = extractBase64PublicKey(publicKey);

console.log('公钥的 Base64 编码:', base64PublicKey);
