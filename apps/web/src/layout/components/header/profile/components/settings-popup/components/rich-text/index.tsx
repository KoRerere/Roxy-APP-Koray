import { defineCustomElement } from "vue";
import styles from "./style.css?raw";

const MyVueElement = defineCustomElement({
  // 这里是同平常一样的 Vue 组件选项
  props: {
    html: String,
  },
  emits: {},
  // defineCustomElement 特有的：注入进 shadow root 的 CSS
  styles: [styles],
  render() {
    return h("div", { innerHTML: this.html, class: "editor-content-view" });
  },
});

// 注册自定义元素
// 注册之后，所有此页面中的 `<my-vue-element>` 标签
// 都会被升级
customElements.define("roxy-rich-text", MyVueElement);
