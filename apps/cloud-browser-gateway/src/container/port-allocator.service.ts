import type { Configuration } from '~/config/configuration'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '../redis/redis.service'

/** Redis 中存储已分配 HTTP 端口的集合 key */
const HTTP_PORTS_KEY = 'allocated_ports:http'
/** Redis 中存储已分配 UDP 端口的集合 key */
const UDP_PORTS_KEY = 'allocated_ports:udp'

/**
 * 端口分配器
 * 从配置的端口范围中分配可用端口，使用 Redis SET 记录占用状态。
 * 依赖 SADD 的原子返回值保证并发下同一端口只会被分配一次。
 */
@Injectable()
export class PortAllocatorService {
  private readonly logger = new Logger(PortAllocatorService.name)

  private httpStart: number
  private httpEnd: number
  private udpStart: number
  private udpEnd: number

  constructor(
    private readonly configService: ConfigService<Configuration>,
    private readonly redisService: RedisService,
  ) {
    const ports = this.configService.get('ports', { infer: true })!
    this.httpStart = ports.httpStart
    this.httpEnd = ports.httpEnd
    this.udpStart = ports.udpStart
    this.udpEnd = ports.udpEnd
  }

  /** 从 HTTP 端口池分配一个可用端口 */
  async allocateHttpPort(): Promise<number> {
    return this.allocateFromRange(HTTP_PORTS_KEY, this.httpStart, this.httpEnd)
  }

  /** 从 UDP 端口池分配一个可用端口（用于 WebRTC UDPMUX） */
  async allocateUdpPort(): Promise<number> {
    return this.allocateFromRange(UDP_PORTS_KEY, this.udpStart, this.udpEnd)
  }

  /** 释放 HTTP 端口，归还到端口池 */
  async releaseHttpPort(port: number): Promise<void> {
    await this.redisService.srem(HTTP_PORTS_KEY, port)
    this.logger.log(`已释放 HTTP 端口 ${port}`)
  }

  /** 释放 UDP 端口，归还到端口池 */
  async releaseUdpPort(port: number): Promise<void> {
    await this.redisService.srem(UDP_PORTS_KEY, port)
    this.logger.log(`已释放 UDP 端口 ${port}`)
  }

  /** 获取当前所有已分配的 HTTP 端口列表 */
  async getAllocatedHttpPorts(): Promise<number[]> {
    const members = await this.redisService.smembers(HTTP_PORTS_KEY)
    return members.map(Number)
  }

  /** 获取当前所有已分配的 UDP 端口列表 */
  async getAllocatedUdpPorts(): Promise<number[]> {
    const members = await this.redisService.smembers(UDP_PORTS_KEY)
    return members.map(Number)
  }

  /**
   * 从指定范围中分配最小可用端口
   * 直接利用 Redis SADD 的原子性，避免“先查再锁再写”带来的重复分配竞态
   */
  private async allocateFromRange(
    key: string,
    start: number,
    end: number,
  ): Promise<number> {
    for (let port = start; port <= end; port++) {
      const allocated = await this.redisService.saddNew(key, port)
      if (allocated) {
        this.logger.log(`已从 ${key} 分配端口 ${port}`)
        return port
      }
    }

    throw new Error(`端口范围 ${start}-${end} 内没有可用端口`)
  }
}
