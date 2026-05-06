import type { Configuration } from '~/config/configuration'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import dgram from 'node:dgram'
import net from 'node:net'
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
    return this.allocateFromRange(HTTP_PORTS_KEY, this.httpStart, this.httpEnd, 'tcp')
  }

  /** 从 UDP 端口池分配一个可用端口（用于 WebRTC UDPMUX） */
  async allocateUdpPort(): Promise<number> {
    return this.allocateFromRange(UDP_PORTS_KEY, this.udpStart, this.udpEnd, 'udp')
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
   * 直接利用 Redis SADD 的原子性，避免"先查再锁再写"带来的重复分配竞态。
   * 在 host 网络模式下，Redis 记录释放后 OS 端口立即归还；但若容器异常退出导致 Redis
   * 记录残留，OS 实际已释放该端口，下次分配时 Redis 会正常跳过（已记录为占用）。
   * 若 Redis 认为端口空闲而 OS 层面仍被占用（如外部进程碰撞），则额外做一次 OS 探测。
   */
  private async allocateFromRange(
    key: string,
    start: number,
    end: number,
    protocol: 'tcp' | 'udp' = 'tcp',
  ): Promise<number> {
    for (let port = start; port <= end; port++) {
      const allocated = await this.redisService.saddNew(key, port)
      if (!allocated) {
        continue
      }
      // Redis 原子分配成功；在 host 网络模式下额外探测 OS 是否真实空闲
      const free = await this.isHostPortFree(port, protocol)
      if (free) {
        this.logger.log(`已从 ${key} 分配端口 ${port}`)
        return port
      }
      // OS 端口被外部占用，回滚 Redis 记录并继续扫描
      this.logger.warn(`端口 ${port} Redis 分配成功但 OS 层面已被占用（${protocol}），跳过`)
      await this.redisService.srem(key, port)
    }

    throw new Error(`端口范围 ${start}-${end} 内没有可用端口`)
  }

  /**
   * 探测宿主机 OS 层面端口是否真实空闲。
   * 尝试临时绑定该端口：能绑定说明空闲，绑定失败说明已被占用。
   */
  private isHostPortFree(port: number, protocol: 'tcp' | 'udp'): Promise<boolean> {
    return new Promise((resolve) => {
      if (protocol === 'tcp') {
        const server = net.createServer()
        server.once('error', () => resolve(false))
        server.listen(port, '0.0.0.0', () => server.close(() => resolve(true)))
      }
      else {
        const socket = dgram.createSocket('udp4')
        socket.once('error', () => resolve(false))
        socket.bind(port, '0.0.0.0', () => socket.close(() => resolve(true)))
      }
    })
  }
}
