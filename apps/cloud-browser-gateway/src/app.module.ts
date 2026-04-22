import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from './auth/auth.module'
import { BrowserModule } from './browser/browser.module'
import configuration from './config/configuration'
import { ContainerModule } from './container/container.module'
import { RedisModule } from './redis/redis.module'

const envFilePath = process.env.NODE_ENV === 'production'
  ? '.env.production'
  : '.env.development'

@Module({
  imports: [
    ConfigModule.forRoot({
      // 根据运行环境只加载一个 env 文件，避免开发配置覆盖生产配置。
      envFilePath,
      isGlobal: true,
      load: [configuration],
    }),
    RedisModule,
    AuthModule,
    ContainerModule,
    BrowserModule,
  ],
})
export class AppModule {}
