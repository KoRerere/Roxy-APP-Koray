/**
 * Firefox 浏览器通过 speechSynthesis API 暴露的语音列表。
 *
 * 与 Chrome 不同，Firefox 不内置 Google TTS 远程语音，
 * 而是直接枚举操作系统安装的 TTS 引擎：
 *   - Windows：Microsoft SAPI（Speech API）桌面语音，isLocalService 均为 true
 *   - macOS：Apple 系统语音
 *   - Linux：eSpeak / espeak-ng 等系统语音
 *
 * 以下列表基于 Windows 10/11 典型 Microsoft SAPI 桌面语音集合，
 * 覆盖与 Chrome 语音列表相同的语言区域，用于指纹随机化。
 */
export const firefoxVoices = [
  // ── 英语（美国）──────────────────────────────────────────
  {
    name: 'Microsoft David - English (United States)',
    lang: 'en-US',
    isLocalService: true,
  },
  {
    name: 'Microsoft Mark - English (United States)',
    lang: 'en-US',
    isLocalService: true,
  },
  {
    name: 'Microsoft Zira - English (United States)',
    lang: 'en-US',
    isLocalService: true,
  },

  // ── 英语（英国）──────────────────────────────────────────
  {
    name: 'Microsoft Hazel - English (Great Britain)',
    lang: 'en-GB',
    isLocalService: true,
  },
  {
    name: 'Microsoft George - English (Great Britain)',
    lang: 'en-GB',
    isLocalService: true,
  },
  {
    name: 'Microsoft Susan - English (Great Britain)',
    lang: 'en-GB',
    isLocalService: true,
  },

  // ── 德语（德国）──────────────────────────────────────────
  {
    name: 'Microsoft Hedda - German (Germany)',
    lang: 'de-DE',
    isLocalService: true,
  },
  {
    name: 'Microsoft Stefan - German (Germany)',
    lang: 'de-DE',
    isLocalService: true,
  },

  // ── 西班牙语（西班牙）────────────────────────────────────
  {
    name: 'Microsoft Helena - Spanish (Spain)',
    lang: 'es-ES',
    isLocalService: true,
  },
  {
    name: 'Microsoft Pablo - Spanish (Spain)',
    lang: 'es-ES',
    isLocalService: true,
  },

  // ── 西班牙语（墨西哥）────────────────────────────────────
  {
    name: 'Microsoft Laura - Spanish (Mexico)',
    lang: 'es-MX',
    isLocalService: true,
  },
  {
    name: 'Microsoft Raul - Spanish (Mexico)',
    lang: 'es-MX',
    isLocalService: true,
  },

  // ── 法语（法国）──────────────────────────────────────────
  {
    name: 'Microsoft Hortense - French (France)',
    lang: 'fr-FR',
    isLocalService: true,
  },
  {
    name: 'Microsoft Julie - French (France)',
    lang: 'fr-FR',
    isLocalService: true,
  },

  // ── 意大利语（意大利）────────────────────────────────────
  {
    name: 'Microsoft Cosimo - Italian (Italy)',
    lang: 'it-IT',
    isLocalService: true,
  },
  {
    name: 'Microsoft Elsa - Italian (Italy)',
    lang: 'it-IT',
    isLocalService: true,
  },

  // ── 荷兰语（荷兰）────────────────────────────────────────
  {
    name: 'Microsoft Frank - Dutch (Netherlands)',
    lang: 'nl-NL',
    isLocalService: true,
  },
  {
    name: 'Microsoft Lili - Dutch (Netherlands)',
    lang: 'nl-NL',
    isLocalService: true,
  },

  // ── 波兰语（波兰）────────────────────────────────────────
  {
    name: 'Microsoft Adam - Polish (Poland)',
    lang: 'pl-PL',
    isLocalService: true,
  },
  {
    name: 'Microsoft Paulina - Polish (Poland)',
    lang: 'pl-PL',
    isLocalService: true,
  },

  // ── 葡萄牙语（巴西）──────────────────────────────────────
  {
    name: 'Microsoft Maria - Portuguese (Brazil)',
    lang: 'pt-BR',
    isLocalService: true,
  },
  {
    name: 'Microsoft Daniel - Portuguese (Brazil)',
    lang: 'pt-BR',
    isLocalService: true,
  },

  // ── 俄语（俄罗斯）────────────────────────────────────────
  {
    name: 'Microsoft Irina - Russian (Russia)',
    lang: 'ru-RU',
    isLocalService: true,
  },
  {
    name: 'Microsoft Pavel - Russian (Russia)',
    lang: 'ru-RU',
    isLocalService: true,
  },

  // ── 印地语（印度）────────────────────────────────────────
  {
    name: 'Microsoft Hemant - Hindi (India)',
    lang: 'hi-IN',
    isLocalService: true,
  },
  {
    name: 'Microsoft Kalpana - Hindi (India)',
    lang: 'hi-IN',
    isLocalService: true,
  },

  // ── 印度尼西亚语（印度尼西亚）────────────────────────────
  {
    name: 'Microsoft Andika - Indonesian (Indonesia)',
    lang: 'id-ID',
    isLocalService: true,
  },

  // ── 中文（台湾）──────────────────────────────────────────
  {
    name: 'Microsoft Tracy - Chinese (Traditional, Taiwan)',
    lang: 'zh-TW',
    isLocalService: true,
  },
  {
    name: 'Microsoft Danny - Chinese (Traditional, Taiwan)',
    lang: 'zh-TW',
    isLocalService: true,
  },

  // ── 日语（日本）──────────────────────────────────────────
  {
    name: 'Microsoft Ayumi - Japanese (Japan)',
    lang: 'ja-JP',
    isLocalService: true,
  },
  {
    name: 'Microsoft Haruka - Japanese (Japan)',
    lang: 'ja-JP',
    isLocalService: true,
  },
  {
    name: 'Microsoft Ichiro - Japanese (Japan)',
    lang: 'ja-JP',
    isLocalService: true,
  },

  // ── 韩语（韩国）──────────────────────────────────────────
  {
    name: 'Microsoft Heami - Korean (Korea)',
    lang: 'ko-KR',
    isLocalService: true,
  },

  // ── 中文（中国大陆）──────────────────────────────────────
  {
    name: 'Microsoft Huihui - Chinese (Simplified, PRC)',
    lang: 'zh-CN',
    isLocalService: true,
  },
  {
    name: 'Microsoft Kangkang - Chinese (Simplified, PRC)',
    lang: 'zh-CN',
    isLocalService: true,
  },
  {
    name: 'Microsoft Yaoyao - Chinese (Simplified, PRC)',
    lang: 'zh-CN',
    isLocalService: true,
  },

  // ── 中文（香港）──────────────────────────────────────────
  {
    name: 'Microsoft Tracy - Chinese (Traditional, Hong Kong S.A.R.)',
    lang: 'zh-HK',
    isLocalService: true,
  },
] as const
