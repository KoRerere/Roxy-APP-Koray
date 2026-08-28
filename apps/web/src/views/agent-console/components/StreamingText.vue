<script setup lang="ts">
import type { AgentThinkingProcessEvent } from '../types'

const props = defineProps<{
  event: AgentThinkingProcessEvent
}>()

const textElement = ref<HTMLParagraphElement | null>(null)
let renderedEvent: AgentThinkingProcessEvent | undefined
let renderedLength = 0

function syncTextContent() {
  const element = textElement.value
  if (!element) {
    return
  }

  const content = props.event.content
  if (props.event !== renderedEvent || content.length < renderedLength) {
    element.textContent = content
    renderedEvent = props.event
    renderedLength = content.length
    return
  }

  const delta = content.slice(renderedLength)
  if (!delta) {
    return
  }

  const lastNode = element.lastChild
  if (lastNode?.nodeType === 3) {
    const textNode = lastNode as Text
    textNode.appendData(delta)
  }
  else {
    element.append(document.createTextNode(delta))
  }
  renderedLength = content.length
}

watch(() => [props.event, props.event.content] as const, syncTextContent, { flush: 'post' })
onMounted(syncTextContent)
</script>

<template>
  <p ref="textElement" />
</template>
