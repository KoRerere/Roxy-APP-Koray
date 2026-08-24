import { defineCustomElement, h } from 'vue'
import {
  AGENT_COPY_ICON,
  AGENT_COPY_SUCCESS_DURATION,
  AGENT_COPY_SUCCESS_ICON,
  copyAgentText,
} from '../AgentCopyControl.shared'

const styles = `
:host {
  display: inline-flex;
  width: 24px;
  height: 24px;
  color: var(--color-text-tertiary);
  opacity: 0.78;
  transition: opacity 0.16s ease;
}

:host(:hover),
:host(:focus-within) {
  opacity: 1;
}

.copy-control {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: currentColor;
  cursor: pointer;
  outline: none;
  transition: color 0.16s ease, transform 0.16s ease;
}

.copy-control:hover,
.copy-control:focus-visible {
  color: var(--color-text-secondary);
}

.copy-control:active {
  transform: scale(0.94);
}

.copy-control.copied {
  color: var(--color-text-success-primary);
}

roxy-svg-icon {
  display: inline-flex;
  width: 14px;
  height: 14px;
  pointer-events: none;
}
`

const AgentMarkdownTableCopyElement = defineCustomElement({
  props: {
    encodedMarkdown: { type: String, default: '' },
  },
  styles: [styles],
  data() {
    return {
      copied: false,
      copiedTimer: null as number | null,
    }
  },
  unmounted() {
    if (this.copiedTimer)
      window.clearTimeout(this.copiedTimer)
  },
  methods: {
    async copyTableMarkdown(event: Event) {
      event.preventDefault()
      event.stopPropagation()

      const markdown = decodeMarkdownData(this.encodedMarkdown)
      if (!markdown)
        return

      await copyAgentText(markdown)
      this.copied = true

      if (this.copiedTimer)
        window.clearTimeout(this.copiedTimer)

      this.copiedTimer = window.setTimeout(() => {
        this.copied = false
        this.copiedTimer = null
      }, AGENT_COPY_SUCCESS_DURATION)
    },
  },
  render() {
    const label = this.copied ? $t('已复制') : $t('复制')

    return h('span', {
      'role': 'button',
      'tabindex': 0,
      'class': ['copy-control', { copied: this.copied }],
      'title': label,
      'aria-label': label,
      'onClick': this.copyTableMarkdown,
      'onKeydown': (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ')
          return

        event.preventDefault()
        event.stopPropagation()
        this.copyTableMarkdown(event)
      },
    }, [
      h('roxy-svg-icon', {
        name: this.copied ? AGENT_COPY_SUCCESS_ICON : AGENT_COPY_ICON,
        size: 14,
        color: 'currentColor',
      }),
    ])
  },
})

function decodeMarkdownData(value: string | undefined) {
  if (!value)
    return ''

  try {
    return decodeURIComponent(value)
  }
  catch {
    return value
  }
}

export function registerAgentMarkdownTableCopyElement() {
  if (typeof customElements === 'undefined')
    return

  if (!customElements.get('roxy-agent-table-copy'))
    customElements.define('roxy-agent-table-copy', AgentMarkdownTableCopyElement)
}
