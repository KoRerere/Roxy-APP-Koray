<script lang="ts" setup>
function parseIPv6(input) {
  const regex = /^(https?|socks5):\/\/\((.*?)\):([^:\[\]\{\}]+)(:([^:\[\]\{\}]+))?(:([^:\[\]\{\}]+))?(?:\[[^\]]*\])?(?:\{[^\}]*\})?$/

  const match = input.match(regex)

  if (!match) {
    return {
      error: 'Invalid format',
    }
  }

  const protocol = match[1]
  const ipv6 = match[2]
  const port = match[3]
  const username = match[5] || null
  const password = match[7] || null

  return {
    protocol,
    ipv6,
    port,
    username,
    password,
  }
}

function test() {
  // 测试用例
  const testCases = [
    '*http://(2001:db8:2de:0:0:0:0:e13):port:scvr:777[refreshUrl]{备注}',
    'https://(2001:db8:2de:0:0:0:0:e13):port:mmmm:123',
    '*http://(2001:db8:2de:0:0:0:0:e13):port:ddd:111[refreshUrl]',
    'socks5://(2001:db8:2de:0:0:0:0:e13):port:rrr:222{备注}',
    '*https://(2001:db8:2de:0:0:0:0:e13):port[refreshUrl]{备注}',
  ]

  testCases.forEach((testCase, index) => {
    console.log(`Test Case ${index + 1}:`, parseIPv6(testCase))
  })
}
</script>

<template>
  <div class="w-50">
    <RxButton label="测试" @click="test" />
  </div>
</template>
