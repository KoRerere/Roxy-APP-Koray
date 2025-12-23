// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // 仅用于“注册默认浏览器”的场景：不要启动 Tauri runtime / UI，
    // 直接调用 LaunchServices 设置完成后退出，避免 macOS 弹出崩溃报告。
    if std::env::args().any(|a| a == "--set-default-browser") {
        // `generate_context!` 在同一个 crate 里只能展开一次（否则会重复定义 _EMBED_INFO_PLIST）
        let ctx: tauri::Context<tauri::Wry> = tauri::generate_context!();
        let bundle_id = &ctx.config().identifier;

        // 如果传入了 --roxy-default-browser-config-path，把它持久化下来供后续真正启动时读取
        if let Some(p) = {
            let mut it = std::env::args();
            let key = tauri_lib::ROXY_CONFIG_ARG_KEY;
            let mut found: Option<String> = None;
            while let Some(a) = it.next() {
                if a == key {
                    found = it.next();
                    break;
                }
                if let Some(v) = a.strip_prefix(&(key.to_string() + "=")) {
                    found = Some(v.to_string());
                    break;
                }
            }
            found
        } {
            let _ = tauri_lib::persist_config_path(bundle_id, &p);
        }

        if let Err(e) = tauri_lib::default_browser::set_default_browser(bundle_id) {
            eprintln!("set default browser failed: {e}");
            std::process::exit(1);
        }
        std::process::exit(0);
    }

    tauri_lib::run()
}
