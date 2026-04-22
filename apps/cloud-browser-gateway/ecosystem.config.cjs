const path = require('node:path')

/**
 * PM2 进程配置
 * 运行前请先执行构建，产物入口为 dist/main.js。
 * 业务环境变量由 Nest ConfigModule 从 .env.development / .env.production 读取，
 * 这里仅补充 PM2 进程级参数与最基础的运行环境标识。
 */
module.exports = {
  apps: [
    {
      name: 'cloud-browser-gateway',
      cwd: __dirname,
      script: path.join(__dirname, 'dist', 'main.js'),
      interpreter: 'node',
      node_args: '--enable-source-maps --max-old-space-size=8192',
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      autorestart: true,
      min_uptime: '10s',
      restart_delay: 5000,
      // max_memory_restart: '8G',
      kill_timeout: 10000,
      listen_timeout: 10000,
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'development',
        PORT: 3100,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3100,
      },
    },
  ],
}
