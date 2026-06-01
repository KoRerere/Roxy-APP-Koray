/**
 * Chrome 浏览器通过 speechSynthesis API 暴露的语音列表。
 * Chrome 内置 Google TTS 远程语音（isLocalService: false），
 * 另外会附加少量操作系统本地语音（由 getSpeechSynthesis 逻辑随机注入）。
 */
export const chromeVoices = [
  {
    name: 'Google Bahasa Indonesia',
    lang: 'id-ID',
    isLocalService: false,
  },
  {
    name: 'Google Deutsch',
    lang: 'de-DE',
    isLocalService: false,
  },
  {
    name: 'Google español',
    lang: 'es-ES',
    isLocalService: false,
  },
  {
    name: 'Google español de Estados Unidos',
    lang: 'es-US',
    isLocalService: false,
  },
  {
    name: 'Google français',
    lang: 'fr-FR',
    isLocalService: false,
  },
  {
    name: 'Google italiano',
    lang: 'it-IT',
    isLocalService: false,
  },
  {
    name: 'Google Nederlands',
    lang: 'nl-NL',
    isLocalService: false,
  },
  {
    name: 'Google polski',
    lang: 'pl-PL',
    isLocalService: false,
  },
  {
    name: 'Google português do Brasil',
    lang: 'pt-BR',
    isLocalService: false,
  },
  {
    name: 'Google UK English Female',
    lang: 'en-GB',
    isLocalService: false,
  },
  {
    name: 'Google UK English Male',
    lang: 'en-GB',
    isLocalService: false,
  },
  {
    name: 'Google US English',
    lang: 'en-US',
    isLocalService: false,
  },
  {
    name: 'Google русский',
    lang: 'ru-RU',
    isLocalService: false,
  },
  {
    name: 'Google हिन्दी',
    lang: 'hi-IN',
    isLocalService: false,
  },
  {
    name: 'Google 國語（臺灣）',
    lang: 'zh-TW',
    isLocalService: false,
  },
  {
    name: 'Google 日本語',
    lang: 'ja-JP',
    isLocalService: false,
  },
  {
    name: 'Google 한국의',
    lang: 'ko-KR',
    isLocalService: false,
  },
  {
    name: 'Google 普通话（中国大陆）',
    lang: 'zh-CN',
    isLocalService: false,
  },
  {
    name: 'Google 粤語（香港）',
    lang: 'zh-HK',
    isLocalService: false,
  },
] as const
