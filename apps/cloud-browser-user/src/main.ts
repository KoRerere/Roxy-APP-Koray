import '@fortawesome/fontawesome-free/css/fontawesome.min.css'
import '@fortawesome/fontawesome-free/css/solid.min.css'
import './assets/styles/main.scss'
import { createApp } from 'vue'
import App from './app.vue'
import Axios from './plugins/axios'
import { i18n } from './plugins/i18n'
import LoggerPlugin from './plugins/log'
import ClientPlugin, { client } from './plugins/neko'
import { initializeStores, pinia } from './store'

async function bootstrap() {
  const app = createApp(App)

  app.use(pinia)
  app.use(i18n)
  app.use(LoggerPlugin)
  app.use(Axios)
  app.use(ClientPlugin)

  client.init()
  app.mount('#app')
  await initializeStores()
}

void bootstrap()
