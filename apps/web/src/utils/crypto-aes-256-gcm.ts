/** AES-GCM 加密函数 */
export function encryptAESGCM(msg: string) {
  return electronAPI.send('util:encryptAESGCM', msg)
}

/** AES-GCM 解密函数 */
export function decryptAESGCM(str: string) {
  return electronAPI.send('util:decryptAESGCM', str)
}

// const str = encryptAESGCM(JSON.stringify({ key: 'value' })) ;
// console.log("Encrypted message:", str);
// const decryptedMsg = decryptAESGCM(str);
// const decryptedMsgJson = decryptedMsg.toString('utf-8');
// const decodedDict = JSON.parse(decryptedMsgJson);
// console.log("Decrypted message:", decodedDict);

// const str = `pdkRpjXekXy3kEqyaBddcI9gLmaWMM1Ny/X0aSIE5Ch76VQcI5eRZiTA0roN0lS3/484pqe+R+eY30oFvixEy+96ohRyn4Yh4jImNGTK/Kmm6Cxdhl3PvNclddd/d8HCZNbsi6gO/R3Dw5jzbJk9FS1QNPfDB+/smOB3OastlFiGtyl+egQA8HOg1OKzlj9xhS9JU2GGbYPf:t1Z8d+aMZK4q8Qyo:/RgRONczJnZrrvTStJlMNw==`

//   // 解密消息
//   const decryptedMsg = decryptAESGCM(str);
//   const decryptedMsgJson = decryptedMsg.toString('utf-8');
//   const decodedDict = JSON.parse(decryptedMsgJson);
//   console.log("Decrypted message:", decodedDict);
