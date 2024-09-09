<script setup lang="ts">
// import { format } from 'date-fns'
import parseTextarea from './components/parse-textarea.vue'
import parsedTable from './components/parsed-table.vue'
import { API } from '/@/api'

const router = useRouter()

const tabs = ref([
  { title: '单个代理', value: 'single' },
  { title: '批量代理', value: 'batch' },
])
const tabsValue = ref('batch')

// ===============================================

const proxiesText = ref('192.168.0.1:8000[ggband]{Remark}\n192.168.0.1:8000[ggband]{Remark}\n*socks5://www.baidu.com:90224:rola6ds90_1:457452[http://refresh.rola.info/refresh?user=rola690_66&country=us&state=&city=]{Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.}\nsocks5://gate8.rola.vip:2000:dfsdfsf:964616[http://refresh.rola.info/refresh?user=rola690_66&country=us&state=&city=]{Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.}\n*socks5://gate8.rola.vip:2000:rola690_1:457452\nsocks5://gate8.rola.vip:2000:rola690_2:457452\nsocks5://gate8.rola.vip:2000:rola690_3:457452\n192.168.0.1:8000[ggband]{Remark}\n192.168.0.1:8000[ggband]{Remark}\n*socks5://www.baidu.com:90224:rola6ds90_1:457452[http://refresh.rola.info/refresh?user=rola690_66&country=us&state=&city=]{Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.}\nsocks5://gate8.rola.vip:2000:dfsdfsf:964616[http://refresh.rola.info/refresh?user=rola690_66&country=us&state=&city=]{Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.}\n*socks5://gate8.rola.vip:2000:rola690_1:457452\nsocks5://gate8.rola.vip:2000:rola690_2:457452\nsocks5://gate8.rola.vip:2000:rola690_3:457452')

const dataList = ref()
const isDuplicate = ref(true)

function parseValue() {
  const list = proxiesText.value.split('\n').map(n => n.trim()).filter(Boolean)

  dataList.value = (isDuplicate.value ? [...new Set(list)] : list)
    .map((str) => {
      const ipType = str.startsWith('*') ? 'IPV6' : 'IPV4'
      const [_, protocol, host, port, proxyUserName, proxyPassword] = str.match(/^\*?(?:(?<protocol>\w+):\/\/)?(?<host>[^:]+):(?<port>\d+)(?::(?<proxyUserName>[^:]*)(?::(?<proxyPassword>[^[{]*))?)?/) || []

      const refreshUrl = str.match(/\[(.*?)\]/)?.[1] || null
      const remark = str.match(/\{(.*?)\}/)?.[1] || null
      return {
        // checkTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        ipType,
        protocol,
        host,
        port,
        proxyUserName,
        proxyPassword,
        refreshUrl,
        remark,
      }
    })
}

async function saveProxies() {
  const { data } = await API.proxy.userAddProxyModuleCreate(dataList.value)
  router.replace({ name: 'agent' })
}
</script>

<template>
  <div class="flex flex-col h-full w-full overflow-hidden">
    <div class="flex justify-end proxies-header">
      <div class="flex-1">
        Proxies
      </div>
    </div>
    <Tabs v-model:value="tabsValue">
      <TabList>
        <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
          {{ tab.title }}
        </Tab>
      </TabList>
    </Tabs>

    <div class="flex-ovh-1 flex-col proxies-content">
      <div class="parse-input">
        <div class="panel">
          <div class="panel-title">
            Proxies information
          </div>
          <div class="information">
            <parseTextarea v-model="proxiesText" />
            <div class="flex justify-between information-actions">
              <div class="flex items-center">
                <Checkbox v-model="isDuplicate" input-id="wrap" binary />
                <label for="wrap" class="select-none ml-2 cursor-pointer">Filter duplicates</label>
                <span class="mdi mdi-information-outline" />
              </div>
              <ryButton outlined severity="secondary" size="small" label="Parse proxies" icon="mdi mdi-play"
                @click="parseValue" />
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-title">
            Import rules
          </div>
          <div class="rules">
            Allowed formats (IPv4, IPv6 supported):<br><br>
            192.168.0.1:8000<span class="text-blue">{Remark}</span><br>
            192.168.0.1:8000:username:password<span class="text-blue">{Remark}</span><br>
            socks5://192.168.0.1:8000<span class="text-green">[Refresh IP URL]</span><span
              class="text-blue">{Remark}</span><br>
            http://[2001:db8:2de:0:0:0:0:e13]:8000<span class="text-green">[Refresh IP URL]</span><span
              class="text-blue">{Remark}</span><br><br>
            1. If you do not fill in the proxy type, it will default to HTTP<br>
            2. Only support HTTP, HTTPS, SOCKS5<br>
            3. One proxy per line, add up to 500 proxies at a time<br>
            4. Host support IPv4 and IPv6, if IPv6 host should be filled in []
          </div>
        </div>
      </div>

      <div class="flex flex-col flex-1 overflow-hidden">
        <div class="flex items-center justify-between">
          <div>Parsed proxies</div>
          <div class="flex gap-2">
            <ryButton severity="secondary" size="small" label="Delete fail" icon="mdi mdi-trash-can-outline" />
            <ryButton severity="secondary" size="small" label="Test all proxies" icon="mdi mdi-wifi" />
          </div>
        </div>
        <div class="flex-ovh-1 items-center justify-center">
          <parsedTable :data-list="dataList" />
        </div>
      </div>

      <div class="flex justify-between">
        <ryButton severity="secondary" text size="small" label="Cancel" />
        <ryButton severity="info" size="small" label="Save proxies" @click="saveProxies" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.proxies-content {
  padding: 24px 24px 16px;
}

.parse-input {
  display: flex;
  gap: 8px;

  .panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 4px);

    &-title {
      color: var(--Component-Colors-TextInput-label-label, #171c1f);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 500;
      line-height: var(--Line-Height-text-lg, 20px);
    }
  }

  .information {
    border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
    border: 1px solid var(--Colors-Border-border-inactive, #e4e8eb);
    box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
    overflow: hidden;

    &-actions {
      display: flex;
      padding: var(--spacing-lg, 8px) var(--spacing-xl, 12px);
      justify-content: space-between;
      align-items: center;
      align-self: stretch;
      border-top: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
    }
  }

  .rules {
    padding: var(--spacing-lg, 8px) var(--spacing-lg, 8px) var(--spacing-lg, 8px) 10px;
    gap: var(--spacing-md, 6px);
    height: 100%;
    border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
    border: 1px solid var(--Colors-Border-border-inactive, #e4e8eb);
    background: var(--Color-neutrals-50, #fafbfc);
    box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);

    color: var(--Component-Colors-TextInput-text-text-placeholder, #7c8387);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.empty {
  gap: var(--spacing-lg, 8px);
  width: var(--width-sm, 480px);
  height: 160px;
  flex-shrink: 0;
  border-radius: var(--radius-2xl, 12px);
  border: 0.5px solid var(--Colors-Border-border-subtle, #e4e8eb);

  color: #000;
  text-align: center;
  font-family: Inter;
  font-size: 13px;
  font-style: normal;
  font-weight: 600;
  line-height: 16px;

  span {
    color: var(--Colors-Text-text-secondary, #575d61);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;
  }
}
</style>
