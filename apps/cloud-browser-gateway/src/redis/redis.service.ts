import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { Configuration } from '~/config/configuration'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

/**
 * Redis 服务封装
 * 提供常用操作的类型安全方法，生命周期自动管理连接和断开
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis

  constructor(private readonly configService: ConfigService<Configuration>) {}

  /** 模块初始化时建立 Redis 连接 */
  onModuleInit() {
    this.ensureClient()
  }

  /** 确保 Redis client 已初始化（用于早于 onModuleInit 的调用场景） */
  private ensureClient(): Redis {
    if (this.client) {
      return this.client
    }

    const redisConfig = this.configService.get('redis', { infer: true })!
    this.client = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      retryStrategy: (times: number) => Math.min(times * 200, 5000),
    })

    return this.client
  }

  /** 模块销毁时断开 Redis 连接 */
  onModuleDestroy() {
    this.client?.disconnect()
  }

  /** 获取原始 ioredis 客户端实例 */
  getClient(): Redis {
    return this.ensureClient()
  }

  /** 获取字符串值 */
  async get(key: string): Promise<string | null> {
    return this.ensureClient().get(key)
  }

  /** 设置字符串值，可选 TTL（秒） */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const client = this.ensureClient()
    if (ttlSeconds) {
      await client.set(key, value, 'EX', ttlSeconds)
    }
    else {
      await client.set(key, value)
    }
  }

  /** 仅当键不存在时设置值，可选 TTL（秒） */
  async setIfAbsent(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    const client = this.ensureClient()
    const result = ttlSeconds
      ? await client.set(key, value, 'EX', ttlSeconds, 'NX')
      : await client.set(key, value, 'NX')
    return result === 'OK'
  }

  /** 删除键 */
  async del(key: string): Promise<void> {
    await this.ensureClient().del(key)
  }

  /** 向集合添加成员 */
  async sadd(key: string, ...members: (string | number)[]): Promise<void> {
    await this.ensureClient().sadd(key, ...members.map(String))
  }

  /** 向集合添加成员，仅在成员原本不存在时返回 true */
  async saddNew(key: string, member: string | number): Promise<boolean> {
    const result = await this.ensureClient().sadd(key, String(member))
    return result === 1
  }

  /** 从集合移除成员 */
  async srem(key: string, ...members: (string | number)[]): Promise<void> {
    await this.ensureClient().srem(key, ...members.map(String))
  }

  /** 获取集合所有成员 */
  async smembers(key: string): Promise<string[]> {
    return this.ensureClient().smembers(key)
  }

  /** 仅当键不存在时设置值（分布式锁），返回是否设置成功 */
  async setnx(key: string, value: string): Promise<boolean> {
    const result = await this.ensureClient().setnx(key, value)
    return result === 1
  }

  /** 检查键是否存在 */
  async exists(key: string): Promise<boolean> {
    const result = await this.ensureClient().exists(key)
    return result === 1
  }
}
