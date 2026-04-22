import { Module } from '@nestjs/common'
import { BrowserService } from './browser.service'
import { BrowserItemService } from './browser-item.service'
import { CookieService } from './cookie.service'

@Module({
  providers: [BrowserService, BrowserItemService, CookieService],
  exports: [BrowserService, BrowserItemService, CookieService],
})
export class BrowserModule {}
