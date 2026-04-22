import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator'

/** 连接云浏览器请求参数 */
export class ConnectDto {
  @ApiProperty({ description: '用户登录 token' })
  @IsString()
  @IsNotEmpty()
  token!: string

  @ApiProperty({ description: '目录 ID' })
  @IsString()
  @IsNotEmpty()
  dirId!: string

  @ApiProperty({ description: '工作区 ID' })
  @IsString()
  @IsNotEmpty()
  workspaceId!: string

  @ApiProperty({ description: '云浏览器剩余可用时长（毫秒，兼容保留字段，服务端会重新校验）' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  remainingUsageMs!: number
}

/** 连接云浏览器响应数据 */
export class ConnectResponseDto {
  @ApiProperty({ description: '会话 ID，同时作为 OpenResty 路由键' })
  sessionId!: string

  @ApiProperty({ description: '用户直连地址' })
  connectUrl!: string

  @ApiProperty({ description: 'WebRTC UDP 端口（媒体直连）' })
  webrtcUdpPort!: number
}

/** 前端心跳续期请求参数 */
export class HeartbeatDto {
  @ApiProperty({ description: '会话 ID' })
  @IsString()
  @IsNotEmpty()
  sessionId!: string
}

/** 心跳续期响应数据 */
export class HeartbeatResponseDto {
  @ApiProperty({ description: '是否续期成功' })
  success!: boolean

  @ApiProperty({ description: '最近活跃时间戳（毫秒）' })
  lastSeenAt!: number

  @ApiProperty({ description: '下次超时清理时间戳（毫秒）' })
  expiresAt!: number

  @ApiProperty({ description: '总使用时长截止时间戳（毫秒）' })
  usageExpiresAt!: number
}
