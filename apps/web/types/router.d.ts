// 这段可以直接添加到你的任何 `.ts` 文件中，例如 `router.ts`
// 也可以添加到一个 `.d.ts` 文件中。确保这个文件包含在
import type { SvgNames } from "/@/components/rx-icon/src/svg-icon-types";
// 项目的 `tsconfig.json` 中的 "file" 字段内。
import "vue-router";
import type { Role } from "/@/enums/role";

declare module "vue-router" {
	interface RouteMeta {
		/** 菜单名称 */
		title?: string;
		/**  图标名称  */
		icon?: SvgNames;
		/** 不需要在菜单中显示的路由 */
		hideInMenu?: boolean;
		/** 菜单类型 */
		type?: "group" | "menu" | "button";
		/** 路由参数 */
		params?: Record<string, any>;
		/** 哪些角色可以查看此页面，不传则所有人可以查看，传则只有传入的角色才能查看 */
		roles?: Role[];
		/** 当 type 为 button 时的点击事件函数 */
		onClick?: (event: Event) => void;
	}
}
