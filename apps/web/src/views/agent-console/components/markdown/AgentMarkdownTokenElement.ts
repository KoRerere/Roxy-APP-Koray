import { defineCustomElement, h } from 'vue'

const styles = `
:host {
  display: inline-flex;
  max-width: 100%;
  vertical-align: middle;
}

:host([kind="profile"]) {
  width: max-content;
  max-width: none;
  white-space: nowrap;
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

.agent-token__profile-prefix,
.agent-token__profile-detail {
  display: inline-flex;
  width: max-content;
  min-height: 24px;
  flex: none;
  align-items: center;
  box-sizing: border-box;
  gap: 4px;
  padding: 2px 6px;
}

.agent-token__profile-prefix {
  border-radius: 8px 0 0 8px;
  background: var(--color-bg-tag-purple, #ebe9fe);
}

.agent-token__profile-detail {
  min-width: 0;
  border-radius: 0 8px 8px 0;
  background: var(--color-bg-tag-purple-hover, #d9d6fe);
}

.agent-token__profile-names {
  flex: none;
  white-space: nowrap;
}

.agent-token__remove {
  display: inline-flex;
  width: 16px;
  height: 16px;
  flex: 0 0 12px;
  align-items: center;
  justify-content: center;
  color: currentColor;
}

.agent-token--profile {
  width: max-content;
  max-width: none;
  flex: none;
  color: var(--color-text-tag-purple, #5925dc);
  background: transparent;
  font-size: 14px;
  font-weight: 400;
}

.agent-token--profile .agent-token__label {
  overflow: visible;
  flex: none;
  text-overflow: clip;
  white-space: nowrap;
}

.agent-token--profile:not(.agent-token--profile-empty) {
  gap: 0;
  padding: 0;
}

.agent-token--profile-empty {
  gap: 4px;
  padding: 2px 6px;
  border: 1px dashed #7a5af8;
  background: var(--color-bg-tag-purple, #ebe9fe);
}

.agent-token--skill {
  color: var(--color-text-tag-pink, #c11574);
  background: var(--color-bg-tag-pink, #fce7f6);
}

.agent-token--script {
  color: var(--color-text-tag-blue, #175cd3);
  background: var(--color-bg-tag-blue, #d1e9ff);
}

.agent-token--input,
.agent-token--textarea,
.agent-token--url {
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
}

/*
 * Keep the host attribute as a styling source as well as the inner kind
 * class. This is important for tokens inserted through v-html: the host
 * attribute is the serialized source of truth, while the shadow component
 * may still be upgraded after the HTML has been inserted.
 */
:host([kind="input"]) .agent-token,
:host([kind="textarea"]) .agent-token {
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
}


.agent-token--input-empty {
  border: 1px dashed currentColor;
  color: #c2410c;
  background: rgba(251, 146, 60, 0.12);
}

:host([kind="input"][target=""]) .agent-token,
:host([kind="input"]:not([target])) .agent-token,
:host([kind="textarea"][target=""]) .agent-token,
:host([kind="textarea"]:not([target])) .agent-token {
  border: 1px dashed currentColor;
  color: #c2410c;
  background: rgba(251, 146, 60, 0.12);
}
`

export type AgentMarkdownTokenKind = 'profile' | 'skill' | 'script' | 'input' | 'textarea' | 'url'

export function normalizeAgentMarkdownTokenKind(kind: unknown): AgentMarkdownTokenKind {
  return kind === 'profile' || kind === 'skill' || kind === 'script' || kind === 'input' || kind === 'textarea' || kind === 'url'
    ? kind
    : 'skill'
}

export function getAgentMarkdownTokenLabel(
  kind: AgentMarkdownTokenKind,
  title: string,
  target: string,
) {
  return kind === 'input' || kind === 'textarea' || kind === 'url' ? target.trim() || title : title
}

const AgentMarkdownTokenElement = defineCustomElement({
  props: {
    kind: { type: String, default: 'skill' },
    title: { type: String, default: '' },
    target: { type: String, default: '' },
    count: { type: String, default: '' },
    details: { type: String, default: '' },
  },
  styles: [styles],
  render() {
    const kind = normalizeAgentMarkdownTokenKind(this.kind)
    const iconName = getAgentTokenIconName(kind)
    const count = kind === 'profile' ? this.count.trim() : ''
    const isEmptyProfile = kind === 'profile' && !this.target.trim()
    const isEmptyInput = (kind === 'input' || kind === 'textarea' || kind === 'url') && !this.target.trim()
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
      'data-details': this.details,
    }, [
      ...(count
        ? [
            h('span', { class: 'agent-token__profile-prefix' }, [
              h('span', { class: 'agent-token__icon' }, [
                h('roxy-svg-icon', { name: iconName, fallback: iconName, size: 16 }),
              ]),
              h('span', { class: 'agent-token__label' }, label),
            ]),
            h('span', { class: 'agent-token__profile-detail' }, [
              h('span', { class: 'agent-token__profile-names' }, this.details),
            ]),
          ]
        : [
            h('span', { class: 'agent-token__icon' }, [
              h('roxy-svg-icon', {
                name: iconName,
                fallback: iconName,
                size: 16,
              }),
            ]),
            h('span', { class: 'agent-token__label' }, label),
          ]),
    ])
  },
})

function getAgentTokenIconName(kind: string) {
  if (kind === 'profile')
    return 'roxy-agent/rx-ic-token-profile'

  if (kind === 'input' || kind === 'textarea')
    return 'roxy-agent/rx-ic-prompts'

  if (kind === 'url')
    return 'roxy-agent/rx-ic-url'

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
