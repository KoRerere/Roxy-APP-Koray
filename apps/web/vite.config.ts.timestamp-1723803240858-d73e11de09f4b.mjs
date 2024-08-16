// apps/web/vite.config.ts
import { join } from "node:path";
import vue from "file:///D:/Project/roxy-browser/node_modules/.pnpm/@vitejs+plugin-vue@5.1.2_vite@5.4.0_@types+node@20.14.15_sass@1.77.8_sugarss@2.0.0__vue@3.4.37_typescript@5.4.5_/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import vueDevTools from "file:///D:/Project/roxy-browser/node_modules/.pnpm/vite-plugin-vue-devtools@7.3.7_rollup@4.20.0_vite@5.4.0_@types+node@20.14.15_sass@1.77.8_suga_6ie7khg7y63i7eaxq3hpumylde/node_modules/vite-plugin-vue-devtools/dist/vite.mjs";
import UnoCSS from "file:///D:/Project/roxy-browser/node_modules/.pnpm/unocss@0.61.9_postcss@8.4.41_rollup@4.20.0_vite@5.4.0_@types+node@20.14.15_sass@1.77.8_sugarss@2.0.0_/node_modules/unocss/dist/vite.mjs";
import AutoImport from "file:///D:/Project/roxy-browser/node_modules/.pnpm/unplugin-auto-import@0.18.2_@vueuse+core@10.11.1_vue@3.4.37_typescript@5.4.5___rollup@4.20.0/node_modules/unplugin-auto-import/dist/vite.js";
import Components from "file:///D:/Project/roxy-browser/node_modules/.pnpm/unplugin-vue-components@0.27.3_@babel+parser@7.25.3_rollup@4.20.0_vue@3.4.37_typescript@5.4.5_/node_modules/unplugin-vue-components/dist/vite.js";
import { AntDesignVueResolver } from "file:///D:/Project/roxy-browser/node_modules/.pnpm/unplugin-vue-components@0.27.3_@babel+parser@7.25.3_rollup@4.20.0_vue@3.4.37_typescript@5.4.5_/node_modules/unplugin-vue-components/dist/resolvers.js";
import { PrimeVueResolver } from "file:///D:/Project/roxy-browser/node_modules/.pnpm/@primevue+auto-import-resolver@4.0.4/node_modules/@primevue/auto-import-resolver/index.mjs";

// apps/electron/.electron-vendors.cache.json
var chrome = "108";

// apps/web/vite.config.ts
var __vite_injected_original_dirname = "D:\\Project\\roxy-browser\\apps\\web";
var PACKAGE_ROOT = __vite_injected_original_dirname;
var PROJECT_ROOT = join(PACKAGE_ROOT, "../..");
var config = {
  mode: process.env.MODE,
  root: PACKAGE_ROOT,
  envDir: PROJECT_ROOT,
  resolve: {
    alias: {
      "/@/": `${join(PACKAGE_ROOT, "src")}/`
    }
  },
  base: "",
  server: {
    fs: {
      strict: true
    }
  },
  build: {
    sourcemap: true,
    target: `chrome${chrome}`,
    outDir: "dist",
    assetsDir: ".",
    rollupOptions: {
      input: join(PACKAGE_ROOT, "index.html")
    },
    emptyOutDir: true,
    reportCompressedSize: false
  },
  plugins: [
    vue(),
    vueDevTools(),
    UnoCSS(),
    AutoImport({
      imports: ["vue", "vue-router", "pinia"],
      dts: "./auto-imports.d.ts"
    }),
    Components({
      resolvers: [
        PrimeVueResolver(),
        AntDesignVueResolver({
          importStyle: false
          // css in js
        })
      ]
    })
  ]
};
var vite_config_default = config;
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiYXBwcy93ZWIvdml0ZS5jb25maWcudHMiLCAiYXBwcy9lbGVjdHJvbi8uZWxlY3Ryb24tdmVuZG9ycy5jYWNoZS5qc29uIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRDpcXFxcUHJvamVjdFxcXFxyb3h5LWJyb3dzZXJcXFxcYXBwc1xcXFx3ZWJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXFByb2plY3RcXFxccm94eS1icm93c2VyXFxcXGFwcHNcXFxcd2ViXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9Qcm9qZWN0L3JveHktYnJvd3Nlci9hcHBzL3dlYi92aXRlLmNvbmZpZy50c1wiOy8qIGVzbGludC1lbnYgbm9kZSAqL1xuXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAnbm9kZTpwYXRoJ1xuaW1wb3J0IHZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnXG5pbXBvcnQgdHlwZSB7IFVzZXJDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHZ1ZURldlRvb2xzIGZyb20gJ3ZpdGUtcGx1Z2luLXZ1ZS1kZXZ0b29scydcbmltcG9ydCBVbm9DU1MgZnJvbSAndW5vY3NzL3ZpdGUnXG5pbXBvcnQgQXV0b0ltcG9ydCBmcm9tICd1bnBsdWdpbi1hdXRvLWltcG9ydC92aXRlJ1xuXG5pbXBvcnQgQ29tcG9uZW50cyBmcm9tICd1bnBsdWdpbi12dWUtY29tcG9uZW50cy92aXRlJ1xuaW1wb3J0IHsgQW50RGVzaWduVnVlUmVzb2x2ZXIgfSBmcm9tICd1bnBsdWdpbi12dWUtY29tcG9uZW50cy9yZXNvbHZlcnMnXG5pbXBvcnQgeyBQcmltZVZ1ZVJlc29sdmVyIH0gZnJvbSAnQHByaW1ldnVlL2F1dG8taW1wb3J0LXJlc29sdmVyJ1xuXG5pbXBvcnQgeyBjaHJvbWUgfSBmcm9tICcuLi9lbGVjdHJvbi8uZWxlY3Ryb24tdmVuZG9ycy5jYWNoZS5qc29uJ1xuXG5jb25zdCBQQUNLQUdFX1JPT1QgPSBfX2Rpcm5hbWVcbmNvbnN0IFBST0pFQ1RfUk9PVCA9IGpvaW4oUEFDS0FHRV9ST09ULCAnLi4vLi4nKVxuXG5jb25zdCBjb25maWc6IFVzZXJDb25maWcgPSB7XG4gIG1vZGU6IHByb2Nlc3MuZW52Lk1PREUsXG4gIHJvb3Q6IFBBQ0tBR0VfUk9PVCxcbiAgZW52RGlyOiBQUk9KRUNUX1JPT1QsXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJy9ALyc6IGAke2pvaW4oUEFDS0FHRV9ST09ULCAnc3JjJyl9L2AsXG4gICAgfSxcbiAgfSxcbiAgYmFzZTogJycsXG4gIHNlcnZlcjoge1xuICAgIGZzOiB7XG4gICAgICBzdHJpY3Q6IHRydWUsXG4gICAgfSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgdGFyZ2V0OiBgY2hyb21lJHtjaHJvbWV9YCxcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgICBhc3NldHNEaXI6ICcuJyxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBpbnB1dDogam9pbihQQUNLQUdFX1JPT1QsICdpbmRleC5odG1sJyksXG4gICAgfSxcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgICByZXBvcnRDb21wcmVzc2VkU2l6ZTogZmFsc2UsXG4gIH0sXG4gIHBsdWdpbnM6IFtcbiAgICB2dWUoKSxcbiAgICB2dWVEZXZUb29scygpLFxuICAgIFVub0NTUygpLFxuICAgIEF1dG9JbXBvcnQoe1xuICAgICAgaW1wb3J0czogWyd2dWUnLCAndnVlLXJvdXRlcicsICdwaW5pYSddLFxuICAgICAgZHRzOiAnLi9hdXRvLWltcG9ydHMuZC50cycsXG4gICAgfSksXG4gICAgQ29tcG9uZW50cyh7XG4gICAgICByZXNvbHZlcnM6IFtcbiAgICAgICAgUHJpbWVWdWVSZXNvbHZlcigpLFxuICAgICAgICBBbnREZXNpZ25WdWVSZXNvbHZlcih7XG4gICAgICAgICAgaW1wb3J0U3R5bGU6IGZhbHNlLCAvLyBjc3MgaW4ganNcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0pLFxuICBdLFxufVxuXG5leHBvcnQgZGVmYXVsdCBjb25maWdcbiIsICJ7XCJjaHJvbWVcIjpcIjEwOFwiLFwibm9kZVwiOlwiMTZcIn0iXSwKICAibWFwcGluZ3MiOiAiO0FBRUEsU0FBUyxZQUFZO0FBQ3JCLE9BQU8sU0FBUztBQUVoQixPQUFPLGlCQUFpQjtBQUN4QixPQUFPLFlBQVk7QUFDbkIsT0FBTyxnQkFBZ0I7QUFFdkIsT0FBTyxnQkFBZ0I7QUFDdkIsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyx3QkFBd0I7OztBQ1hoQyxhQUFTOzs7QURBVixJQUFNLG1DQUFtQztBQWV6QyxJQUFNLGVBQWU7QUFDckIsSUFBTSxlQUFlLEtBQUssY0FBYyxPQUFPO0FBRS9DLElBQU0sU0FBcUI7QUFBQSxFQUN6QixNQUFNLFFBQVEsSUFBSTtBQUFBLEVBQ2xCLE1BQU07QUFBQSxFQUNOLFFBQVE7QUFBQSxFQUNSLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLE9BQU8sR0FBRyxLQUFLLGNBQWMsS0FBSyxDQUFDO0FBQUEsSUFDckM7QUFBQSxFQUNGO0FBQUEsRUFDQSxNQUFNO0FBQUEsRUFDTixRQUFRO0FBQUEsSUFDTixJQUFJO0FBQUEsTUFDRixRQUFRO0FBQUEsSUFDVjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFdBQVc7QUFBQSxJQUNYLFFBQVEsU0FBUyxNQUFNO0FBQUEsSUFDdkIsUUFBUTtBQUFBLElBQ1IsV0FBVztBQUFBLElBQ1gsZUFBZTtBQUFBLE1BQ2IsT0FBTyxLQUFLLGNBQWMsWUFBWTtBQUFBLElBQ3hDO0FBQUEsSUFDQSxhQUFhO0FBQUEsSUFDYixzQkFBc0I7QUFBQSxFQUN4QjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsSUFBSTtBQUFBLElBQ0osWUFBWTtBQUFBLElBQ1osT0FBTztBQUFBLElBQ1AsV0FBVztBQUFBLE1BQ1QsU0FBUyxDQUFDLE9BQU8sY0FBYyxPQUFPO0FBQUEsTUFDdEMsS0FBSztBQUFBLElBQ1AsQ0FBQztBQUFBLElBQ0QsV0FBVztBQUFBLE1BQ1QsV0FBVztBQUFBLFFBQ1QsaUJBQWlCO0FBQUEsUUFDakIscUJBQXFCO0FBQUEsVUFDbkIsYUFBYTtBQUFBO0FBQUEsUUFDZixDQUFDO0FBQUEsTUFDSDtBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFDRjtBQUVBLElBQU8sc0JBQVE7IiwKICAibmFtZXMiOiBbXQp9Cg==
