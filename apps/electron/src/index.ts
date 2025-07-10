import './catchException'
import './polyfill'
import './locales/'
import { setupModules } from '/@/modules/'
import { initDebug } from '/@/debug'

setupModules().finally(initDebug)
