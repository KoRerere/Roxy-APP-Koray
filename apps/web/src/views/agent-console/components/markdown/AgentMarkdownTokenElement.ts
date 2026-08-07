import { defineCustomElement, h } from 'vue'

const styles = `
:host {
  display: inline-flex;
  max-width: 100%;
  vertical-align: middle;
}

.agent-token {
  display: inline-flex;
  max-width: 280px;
  min-height: 24px;
  align-items: center;
  box-sizing: border-box;
  gap: 4px;
  margin: 0 2px;
  padding: 2px 6px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  line-height: 18px;
  vertical-align: middle;
  white-space: nowrap;
}

.agent-token__icon {
  display: inline-flex;
  width: 16px;
  height: 16px;
  flex: none;
  align-items: center;
  justify-content: center;
}

.agent-token__icon roxy-svg-icon {
  display: inline-flex;
  width: 16px;
  height: 16px;
}

.agent-token__label {
  min-width: 0;
  overflow: hidden;
  pointer-events: none;
  text-overflow: ellipsis;
}

.agent-token__count {
  display: inline-flex;
  min-width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 30px;
  color: var(--color-text-tag-purple, #5925dc);
  background: var(--color-bg-tag-purple-hover, #d9d6fe);
  box-sizing: border-box;
  font-size: 12px;
  line-height: 12px;
}

.agent-token--profile {
  color: var(--color-text-tag-purple, #5925dc);
  background: var(--color-bg-tag-purple, #ebe9fe);
}

.agent-token--profile-empty {
  border: 1px dashed #7a5af8;
}

.agent-token--skill {
  color: var(--color-text-tag-pink, #c11574);
  background: var(--color-bg-tag-pink, #fce7f6);
}

.agent-token--script {
  color: var(--color-text-tag-blue, #175cd3);
  background: var(--color-bg-tag-blue, #d1e9ff);
}

.agent-token--input {
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
}

/*
 * Keep the host attribute as a styling source as well as the inner kind
 * class. This is important for tokens inserted through v-html: the host
 * attribute is the serialized source of truth, while the shadow component
 * may still be upgraded after the HTML has been inserted.
 */
:host([kind="input"]) .agent-token {
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
}


.agent-token--input-empty {
  border: 1px dashed currentColor;
  color: #c2410c;
  background: rgba(251, 146, 60, 0.12);
}

:host([kind="input"][target=""]) .agent-token,
:host([kind="input"]:not([target])) .agent-token {
  border: 1px dashed currentColor;
  color: #c2410c;
  background: rgba(251, 146, 60, 0.12);
}
`


export type AgentMarkdownTokenKind = 'profile' | 'skill' | 'script' | 'input'

export function normalizeAgentMarkdownTokenKind(kind: unknown): AgentMarkdownTokenKind {
  return kind === 'profile' || kind === 'skill' || kind === 'script' || kind === 'input'
    ? kind
    : 'skill'
}

export function getAgentMarkdownTokenLabel(
  kind: AgentMarkdownTokenKind,
  title: string,
  target: string,
) {
  return kind === 'input' ? target.trim() || title : title
}

const AgentMarkdownTokenElement = defineCustomElement({
  props: {
    kind: { type: String, default: 'skill' },
    title: { type: String, default: '' },
    target: { type: String, default: '' },
    count: { type: String, default: '' },
  },
  styles: [styles],
  render() {
    const kind = normalizeAgentMarkdownTokenKind(this.kind)
    const iconName = getAgentTokenIconName(kind)
    const count = kind === 'profile' ? this.count.trim() : ''
    const isEmptyProfile = kind === 'profile' && !this.target.trim()
    const isEmptyInput = kind === 'input' && !this.target.trim()
    const label = getAgentMarkdownTokenLabel(kind, this.title, this.target)

    return h('span', {
      'class': [
        'agent-token',
        `agent-token--${kind}`,
        isEmptyProfile ? 'agent-token--profile-empty' : '',
        isEmptyInput ? 'agent-token--input-empty' : '',
      ].filter(Boolean).join(' '),
      'data-agent-token': kind,
      'data-kind': kind,
      'data-title': this.title,
      'data-target': this.target,
      'data-count': count,
    }, [
      h('span', { class: 'agent-token__icon' }, [
        h('roxy-svg-icon', {
          name: iconName,
          fallback: iconName,
          size: 16,
        }),
      ]),
      h('span', { class: 'agent-token__label' }, label),
      ...(count
        ? [h('span', { class: 'agent-token__count' }, count)]
        : []),
    ])
  },
})

function getAgentTokenIconName(kind: string) {
  if (kind === 'profile')
    return 'roxy-agent/rx-ic-token-profile'

  if (kind === 'input')
    return 'roxy-agent/rx-ic-prompts'

  if (kind === 'script')
    return 'roxy-agent/rx-ic-scripts'

  return 'roxy-agent/rx-ic-skills'
}

export function registerAgentMarkdownTokenElement() {
  if (typeof customElements === 'undefined')
    return

  if (!customElements.get('roxy-agent-token'))
    customElements.define('roxy-agent-token', AgentMarkdownTokenElement)
}
