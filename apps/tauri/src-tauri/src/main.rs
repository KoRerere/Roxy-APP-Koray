// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // 仅用于“注册默认浏览器”的场景：不要启动 Tauri runtime / UI，
    // 直接调用 LaunchServices 设置完成后退出，避免 macOS 弹出崩溃报告。
    if std::env::args().any(|a| a == "--set-default-browser") {
        // 注意：`tauri::generate_context!()` 只能在一个 crate 中展开一次；
        // 当前项目已在 `tauri_lib::run()` 内展开（lib crate），这里再展开会导致
        // release 链接报错：`_EMBED_INFO_PLIST` 符号重复定义。
        //
        // 同时，打包后的 App 运行时工作目录不保证包含 `tauri.conf.json`，
        // 因此这里使用 `include_str!` 在编译期内嵌配置并提取 identifier。
        let bundle_id = {
            let s = include_str!("../tauri.conf.json");
            let v: serde_json::Value = serde_json::from_str(s).unwrap_or_default();
            v.get("identifier")
                .and_then(|x| x.as_str())
                .unwrap_or_default()
                .to_string()
        };
        if bundle_id.trim().is_empty() {
            eprintln!("set default browser failed: empty bundle identifier");
            std::process::exit(1);
        }

        if let Err(e) = tauri_lib::default_browser::set_default_browser(&bundle_id) {
            eprintln!("set default browser failed: {e}");
            std::process::exit(1);
        }
        std::process::exit(0);
    }

    tauri_lib::run()
}
