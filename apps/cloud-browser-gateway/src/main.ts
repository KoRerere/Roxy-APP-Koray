import 'reflect-metadata'
import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { ContainerService } from './container/container.service'
import { initCrypto } from './utils/crypto-aes-256-gcm'

(globalThis as any).$t = (id: string, values?: Record<string, any>) => {
  if (!values)
    return id
  return id.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`))
}

/**
 * 应用启动入口
 * 初始化 NestJS 应用，配置全局管道、Swagger 文档，
 * 并在启动时同步 Docker 容器状态
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap')
  await initCrypto()
  const app = await NestFactory.create(AppModule)

  // 全局参数校验管道：自动过滤未声明字段、校验 DTO 类型
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.enableCors()

  // Swagger 接口文档配置
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Cloud Browser Gateway')
    .setDescription('云浏览器网关服务 API - 鉴权、容器管理、会话心跳续期')
    .setVersion('1.0')
    .build()
  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('docs', app, document)

  // 先完成 Nest 生命周期初始化，再执行依赖 provider 状态的启动同步逻辑
  await app.init()

  // 启动时同步：扫描 Docker 中的 neko 容器，清理无 Redis 记录的孤儿容器
  const containerService = app.get(ContainerService)
  try {
    await containerService.syncOnStartup()
  }
  catch (error: any) {
    logger.warn(`启动同步失败（Docker 可能不可用）：${error.message}`)
  }

  const configService = app.get(ConfigService)
  const port = configService.get<number>('port', 3100)

  await app.listen(port)
  logger.log(`云浏览器网关已启动，监听地址：http://localhost:${port}`)
  logger.log(`Swagger 文档地址：http://localhost:${port}/docs`)
}

bootstrap()
