import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ContainerModule } from '../container/container.module';
import { BrowserModule } from '../browser/browser.module';

@Module({
  imports: [ContainerModule, BrowserModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
