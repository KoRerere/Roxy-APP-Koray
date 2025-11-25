<script setup lang="ts">
import { EditorState } from "@codemirror/state"
import { EditorView, keymap, lineNumbers } from "@codemirror/view"
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { lintGutter, linter, type Diagnostic } from "@codemirror/lint"
import { json } from "@codemirror/lang-json"
import { tags } from "@lezer/highlight"
import { merge } from "es-toolkit"

defineOptions({ inheritAttrs: false })

interface Props {
  editable?: boolean
  showLineNumbers?: boolean
  theme?: object
}

const {
  editable = true,
  showLineNumbers = false,
  theme = {},
} = defineProps<Props>()

const modelValue = defineModel<string>()

const editorRef = useTemplateRef("editor")
const editorInstance = ref<EditorView | null>(null)

const jsonLinter = linter((view) => {
  const diagnostics: Diagnostic[] = []
  const doc = view.state.doc.toString()

  try {
    JSON.parse(doc)
  } catch (e: any) {
    if (e instanceof SyntaxError) {
      const message = e.message
      const matchPos = /at position (\d+)/.exec(message)
      const pos = matchPos ? parseInt(matchPos[1]!, 10) : 0

      diagnostics.push({
        from: pos,
        to: pos,
        severity: "error",
        message: `JSON语法错误: ${message}`
      })
    }
  }

  return diagnostics
})

const jsonHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: "#6EC3FF" },
  { tag: tags.string, color: "#F57FFD" },
  { tag: tags.number, color: "#9543de" },
  { tag: tags.bool, color: "#D73A49" },
  { tag: tags.null, color: "#D73A49" },
  { tag: tags.punctuation, color: "rgba(255, 255, 255,0.4)" }
])

const defaultTheme = {
  "&": {
    height: "100%",
    border: "1px solid var(--colors-border-border-subtle, #C7D1D6)",
    borderRadius: "6px",
    overflow: "hidden"
  },
  ".cm-scroller": {
    overflow: "auto",
  },
  ".cm-gutters": {
    backgroundColor: "var(--pattern-editor-bg, #2C2E30)",
    borderRight: "1px solid var(--colors-border-border-subtle, #C7D1D6)"
  },
  ".cm-gutter-lint": { width: "16px" },
  ".cm-gutter-lint .cm-gutterElement": { padding: "1px 2px" },
  ".cm-lint-marker": { fontSize: "12px" },
  ".cm-lineNumbers .cm-gutterElement": {
    paddingLeft: "12px",
    color: "var(--colors-text-text-inactive, #7D8387)",
    fontFamily: "JetBrains Mono",
    fontSize: "12px",
    lineHeight: "normal"
  },
  ".cm-content": {
    backgroundColor: "var(--pattern-editor-bg, #2C2E30)",
    padding: "12px",
    color: "#24292E",
    fontFamily: "JetBrains Mono",
    fontSize: "12px",
    fontWeight: "500",
    lineHeight: "normal"
  },
  ".cm-line": {
    padding: "0px",
  }
}

watch(() => modelValue.value, (newValue) => {
  if (editorInstance.value && newValue !== undefined && !editable) {
    editorInstance.value.dispatch({
      changes: {
        from: 0,
        to: editorInstance.value.state.doc.length,
        insert: newValue
      }
    })
  }
})

onMounted(() => {
  initEditor()
})

onBeforeUnmount(() => {
  editorInstance.value?.destroy()
})

function initEditor() {
  if (!editorRef.value) return

  const state = EditorState.create({
    doc: modelValue.value,
    extensions: [
      showLineNumbers ? lineNumbers() : [],
      showLineNumbers ? lintGutter() : [],
      history({ minDepth: 20 }),
      keymap.of([...historyKeymap, ...defaultKeymap, indentWithTab]),
      EditorView.editable.of(editable),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          modelValue.value = update.state.doc.toString()
        }
      }),
      EditorView.lineWrapping,
      EditorView.theme(merge(defaultTheme, theme)),
      jsonLinter,
      syntaxHighlighting(jsonHighlightStyle),
      json(),
    ]
  })

  editorInstance.value = new EditorView({
    state,
    parent: editorRef.value
  })
}
</script>

<template>
  <div ref="editor" class="w-full h-full" :class="$attrs.class"></div>
</template>

<style scoped></style>
