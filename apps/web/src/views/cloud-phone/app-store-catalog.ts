import tiktok from '/@/assets/images/cloud-phone/apps/tiktok.png'
import wechat from '/@/assets/images/cloud-phone/apps/wechat.png'
import alipay from '/@/assets/images/cloud-phone/apps/alipay.png'
import whatsapp from '/@/assets/images/cloud-phone/apps/whatsapp.png'
import qq from '/@/assets/images/cloud-phone/apps/qq.png'
import instagram from '/@/assets/images/cloud-phone/apps/instagram.png'
import twitch from '/@/assets/images/cloud-phone/apps/twitch.png'
import telegram from '/@/assets/images/cloud-phone/apps/telegram.png'
import claude from '/@/assets/images/cloud-phone/apps/claude.png'
import facebook from '/@/assets/images/cloud-phone/apps/facebook.png'
import spotify from '/@/assets/images/cloud-phone/apps/spotify.png'
import primevideo from '/@/assets/images/cloud-phone/apps/primevideo.png'
import netflix from '/@/assets/images/cloud-phone/apps/netflix.png'
import hulu from '/@/assets/images/cloud-phone/apps/hulu.png'
import disney from '/@/assets/images/cloud-phone/apps/disney.png'

export type AppCategory = 'social' | 'communication' | 'entertainment' | 'productivity' | 'payment'

export interface StoreApp {
  id: string
  name: string
  keywords: string
  description: string
  category: AppCategory
  icon: string
  versions: string[]
  sourceUrl: string
}

// 版本号核对自 APKPure 应用详情及历史版本；Claude 核对自 Google Play 应用详情。
// 公开版本号不代表安装包已入库，亦不代表已验证云手机兼容性。
export const APP_VERSIONS_VERIFIED_AT = '2026-11-12'

export const storeApps: StoreApp[] = [
  {
    id: 'tiktok',
    name: 'TikTok',
    category: 'social',
    icon: tiktok,
    keywords: '短视频',
    description: '发现热门短视频，记录生活，与全球创作者互动。',
    versions: ['47.7.3', '47.7.2', '47.7.1'],
    sourceUrl: 'https://apkpure.net/tiktok/com.zhiliaoapp.musically',
  },
  {
    id: 'wechat',
    name: 'WeChat',
    category: 'communication',
    icon: wechat,
    keywords: '微信 weixin',
    description: '通过即时消息、语音和视频通话，与亲友保持联系。',
    versions: ['8.0.79', '8.0.72', '8.0.68'],
    sourceUrl: 'https://apkpure.net/wechat/com.tencent.mm',
  },
  {
    id: 'alipay',
    name: 'Alipay',
    category: 'payment',
    icon: alipay,
    keywords: '支付宝',
    description: '便捷的移动支付工具，连接日常消费与生活服务。',
    versions: ['12.12.36.7600', '12.12.16.7200', '12.12.16.7000'],
    sourceUrl: 'https://apkpure.net/alipay/com.eg.android.AlipayGphone',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    category: 'communication',
    icon: whatsapp,
    keywords: '消息 聊天',
    description: '使用端到端加密的消息和通话，随时随地轻松沟通。',
    versions: ['2.26.44.75', '2.26.43.76', '2.26.43.74'],
    sourceUrl: 'https://apkpure.net/whatsapp-messenger/com.whatsapp',
  },
  {
    id: 'qq',
    name: 'QQ',
    category: 'communication',
    icon: qq,
    keywords: '腾讯 聊天',
    description: '畅享即时聊天、群组交流、语音通话与文件分享。',
    versions: ['9.1.33', '9.1.30', '9.1.25'],
    sourceUrl: 'https://apkpure.net/qq/com.tencent.mobileqq',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    category: 'social',
    icon: instagram,
    keywords: '照片 社交',
    description: '分享照片、动态和 Reels，发现你感兴趣的精彩内容。',
    versions: ['455.0.0.51.72', '454.0.0.54.77', '453.0.0.57.79'],
    sourceUrl: 'https://apkpure.net/instagram/com.instagram.android',
  },
  {
    id: 'twitch',
    name: 'Twitch',
    category: 'entertainment',
    icon: twitch,
    keywords: '直播 游戏',
    description: '观看游戏与创意直播，和主播及社区实时互动。',
    versions: ['13.0.0.3', '13.0.0.2', '13.0.0.0000'],
    sourceUrl: 'https://apkpure.net/twitch/tv.twitch.android.app',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    category: 'communication',
    icon: telegram,
    keywords: '电报 聊天',
    description: '快速的云端即时通讯，支持群组、频道与大文件分享。',
    versions: ['13.2.1', '13.2.0', '13.1.1'],
    sourceUrl: 'https://apkpure.net/telegram/org.telegram.messenger',
  },
  {
    id: 'claude',
    name: 'Claude',
    category: 'productivity',
    icon: claude,
    keywords: 'anthropic AI 人工智能',
    description: '与 Claude AI 对话，协助写作、分析和日常工作。',
    versions: ['1.261110.19'],
    sourceUrl: 'https://play.google.com/store/apps/details?id=com.anthropic.claude',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    category: 'social',
    icon: facebook,
    keywords: '脸书 社交',
    description: '与朋友分享生活，加入社群，发现身边的新鲜事。',
    versions: ['586.0.0.52.53', '585.0.0.47.54', '584.0.0.51.56'],
    sourceUrl: 'https://apkpure.net/facebook/com.facebook.katana',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    category: 'entertainment',
    icon: spotify,
    keywords: '音乐 播客',
    description: '聆听喜爱的音乐与播客，发现为你推荐的个性歌单。',
    versions: ['9.2.0.2053', '9.1.98.621', '9.1.94.1929'],
    sourceUrl: 'https://apkpure.net/spotify-music-and-podcasts/com.spotify.music',
  },
  {
    id: 'primevideo',
    name: 'Prime Video',
    category: 'entertainment',
    icon: primevideo,
    keywords: 'amazon 亚马逊 电影',
    description: '探索电影、热门剧集与 Amazon Original 原创内容。',
    versions: ['3.0.480.847'],
    sourceUrl: 'https://apkpure.net/amazon-prime-video/com.amazon.avod.thirdpartyclient',
  },
  {
    id: 'netflix',
    name: 'Netflix',
    category: 'entertainment',
    icon: netflix,
    keywords: '奈飞 网飞 电影',
    description: '观看热门剧集、电影和纪录片，随时发现新的精彩。',
    versions: ['9.92.0 build 9 74772', '9.91.0 build 10 74752', '9.90.1 build 12 74736'],
    sourceUrl: 'https://apkpure.net/netflix/com.netflix.mediaclient',
  },
  {
    id: 'hulu',
    name: 'Hulu',
    category: 'entertainment',
    icon: hulu,
    keywords: '剧集 电影',
    description: '发现热门电视节目、电影与 Hulu 原创剧集。',
    versions: ['6.34.0+18552420-google', '6.33.0+18150744-google', '6.32.0+17694659-google'],
    sourceUrl: 'https://apkpure.net/hulu-stream-tv-shows-movies/com.hulu.plus',
  },
  {
    id: 'disney',
    name: 'Disney+',
    category: 'entertainment',
    icon: disney,
    keywords: '迪士尼 漫威 星球大战',
    description: '畅享迪士尼、皮克斯、漫威和星球大战的精彩故事。',
    versions: ['26.20.0+rc3-2026.11.02', '26.19.0+rc3-2026.10.20', '26.18.0+rc5-2026.10.05'],
    sourceUrl: 'https://apkpure.net/disney/com.disney.disneyplus',
  },
]
