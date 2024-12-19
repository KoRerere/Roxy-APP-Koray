const TwoFactor = require('node-2fa');

// 定义密钥
const secret = "K4VSLVJHUCM6RL6GGOQOLKOM5GTWQWH7";

// 生成当前动态码
const token = TwoFactor.generateToken(secret);
console.log("生成的动态码:", token.token);

// 验证动态码
const userInput = token.token; // 假设用户输入了正确的动态码
const verificationResult = TwoFactor.verifyToken(secret, userInput);

if (verificationResult) {
  console.log("动态码有效！");
  console.log("时间偏移量（秒）:", verificationResult.delta * 30);
} else {
  console.log("动态码无效或已过期！");
}

// 剩余有效时间
const calculateRemainingTime = (timeStep = 30) => {
  const currentTime = Math.floor(Date.now() / 1000);
  const remainingTime = timeStep - (currentTime % timeStep);
  return remainingTime;
};

console.log("当前动态码剩余有效时间:", calculateRemainingTime(), "秒");
