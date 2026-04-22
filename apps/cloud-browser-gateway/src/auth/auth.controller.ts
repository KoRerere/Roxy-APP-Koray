import { Body, Controller, Post } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import {
  ConnectDto,
  ConnectResponseDto,
  HeartbeatDto,
  HeartbeatResponseDto,
} from './dto/connect.dto'

/** 鉴权控制器，提供云浏览器连接入口 */
@ApiTags('鉴权')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 连接云浏览器
   * 前端传入 token + dirId + workspaceId + remainingUsageMs，验证通过后返回 sessionId 和直连地址
   */
  @Post('connect')
  @ApiOperation({
    summary: '连接云浏览器',
    description: '验证用户身份并分配云浏览器容器，按 remainingUsageMs 限制会话总使用时长，返回 sessionId 和直连地址',
  })
  @ApiBody({ type: ConnectDto, description: '连接参数' })
  @ApiResponse({ status: 200, description: '连接成功', type: ConnectResponseDto })
  @ApiResponse({ status: 401, description: '鉴权失败' })
  @ApiResponse({ status: 503, description: '宿主机 CPU 使用率过高，暂不可启动新容器' })
  async connect(@Body() dto: ConnectDto): Promise<ConnectResponseDto> {
    return this.authService.connect(dto)
  }

  /**
   * 前端在发送 Neko 心跳时同步调用，刷新后端会话活跃时间
   */
  @Post('heartbeat')
  @ApiOperation({
    summary: '刷新云浏览器会话心跳',
    description: '前端在发送 Neko client/heartbeat 时同步调用，用于刷新 Redis 会话活跃时间',
  })
  @ApiBody({ type: HeartbeatDto, description: '心跳参数' })
  @ApiResponse({ status: 200, description: '心跳成功', type: HeartbeatResponseDto })
  @ApiResponse({ status: 401, description: '会话无效或已过期' })
  async heartbeat(@Body() dto: HeartbeatDto): Promise<HeartbeatResponseDto> {
    return this.authService.heartbeat(dto.sessionId)
  }
}
