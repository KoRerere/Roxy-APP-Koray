import { Module } from '@nestjs/common';
import { ContainerService } from './container.service';
import { PortAllocatorService } from './port-allocator.service';
import { BrowserModule } from '../browser/browser.module';

@Module({
  imports: [BrowserModule],
  providers: [ContainerService, PortAllocatorService],
  exports: [ContainerService, PortAllocatorService],
})
export class ContainerModule {}
