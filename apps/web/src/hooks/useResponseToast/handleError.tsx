import { I18nT } from "vue-i18n"
import { $t } from "/@/locales"
import { showToast } from './handleBusinessCode'

export const useHandleError = () => {

  function handleError(type: 'network' | 'other') {
    switch (type) {
      case 'network':
        showToast({
          severity: 'error',
          summary: '网络错误',
          detail: '请检查您的网络连接，或稍后再试。',
          life: 3000,
        })
        break
      case 'other':
        showToast({
          severity: 'error',
          summary: '出现错误',
          detail: <I18nT keypath={$t('出现错误，请点击此链接获取{link}。', { link: '{link}' })} >
            {{ link: () => <a href="https://faq.roxybrowser.org/zh/guide/1-1Quickly-Create-Profile" target="_blank">解决方案</a> }}
          </I18nT>,
          life: 3000,
        })
        break
    }
  }

  return handleError
}
