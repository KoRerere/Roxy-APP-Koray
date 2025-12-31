// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
pub mod default_browser;

mod args;
mod config;
mod logging;
mod open_targets;
mod paths;
mod ws_forwarder;

use std::time::Duration;
use tauri::Manager;
#[cfg(any(target_os = "macos", target_os = "ios"))]
use tauri::RunEvent;
#[cfg(target_os = "macos")]
use tauri::ActivationPolicy;

#[cfg(target_os = "macos")]
fn macos_keep_only_close_button(window: &tauri::WebviewWindow) {
    // 使用系统自带交通灯，但隐藏“最小化/缩放”两个按钮，只保留关闭按钮
    // 依赖 tauri 的 macos-private-api 特性，拿到原生 NSWindow 指针
    use objc2_app_kit::{NSWindow, NSWindowButton};

    let ns_window = match window.ns_window() {
        Ok(p) => p,
        Err(_) => return,
    };

    // SAFETY: Tauri 在 macOS 下返回的是 NSWindow 指针
    let ns_window: &NSWindow = unsafe { &*ns_window.cast::<NSWindow>() };

    if let Some(btn) = ns_window.standardWindowButton(NSWindowButton::MiniaturizeButton) {
        btn.setHidden(true);
        btn.setEnabled(false);
    }
    if let Some(btn) = ns_window.standardWindowButton(NSWindowButton::ZoomButton) {
        btn.setHidden(true);
        btn.setEnabled(false);
    }
}

#[tauri::command]
fn set_close_button_visible(app: tauri::AppHandle, visible: bool) {
    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::{NSWindow, NSWindowButton};
        if let Some(w) = app.get_webview_window("main") {
            if let Ok(p) = w.ns_window() {
                let ns_window: &NSWindow = unsafe { &*p.cast::<NSWindow>() };
                if let Some(btn) = ns_window.standardWindowButton(NSWindowButton::CloseButton) {
                    btn.setHidden(!visible);
                    btn.setEnabled(visible);
                }
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        let _ = visible;
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn is_default_browser(app: tauri::AppHandle) -> Result<bool, String> {
    default_browser::is_default_browser(&app.config().identifier)
}

#[tauri::command]
fn set_default_browser(app: tauri::AppHandle) -> Result<(), String> {
    default_browser::set_default_browser(&app.config().identifier)
}

#[tauri::command]
fn read_roxy_default_browser_config(
) -> Result<serde_json::Value, String> {
    // command 只返回磁盘内容；本项目已改为“后台服务 + single-instance overrides”，
    // CLI overrides 不应污染长驻进程的后续行为。
    config::read_roxy_default_browser_config_value_raw()
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    // 先请求 Tauri 正常退出（关闭窗口、停止 runtime）
    app.exit(0);
    // 再兜底强制退出进程，避免 macOS 后台残留
    std::thread::spawn(|| {
        std::thread::sleep(Duration::from_millis(80));
        std::process::exit(0);
    });
}

#[tauri::command]
fn show_main_window(app: tauri::AppHandle, show_in_taskbar: Option<bool>) -> Result<(), String> {
    let w = app
        .get_webview_window("main")
        .ok_or_else(|| "未找到 main 窗口".to_string())?;

    // 每次显示前先尝试居中窗口
    let _ = w.center();

    let show_in_taskbar = show_in_taskbar.unwrap_or(true);

    // 根据参数决定是否把 Dock/任务栏图标恢复出来
    #[cfg(target_os = "macos")]
    {
        if show_in_taskbar {
        let _ = app.set_activation_policy(ActivationPolicy::Regular);
        let _ = app.set_dock_visibility(true);
        } else {
            let _ = app.set_activation_policy(ActivationPolicy::Accessory);
            let _ = app.set_dock_visibility(false);
        }
    }

    // Windows/Linux: 决定是否显示在任务栏
    #[cfg(not(target_os = "macos"))]
    {
        let _ = w.set_skip_taskbar(!show_in_taskbar);
    }

    w.show().map_err(|e| format!("show failed: {e}"))?;
    // macOS 上 show 后再 focus 体验更像原生
    let _ = w.set_focus();
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    logging::info("service: starting roxy launcher (tauri)");
    let builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());

    // 默认浏览器中转关键：确保单实例，并把后续启动实例收到的 argv 转发给已运行实例
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
        logging::info(&format!("single-instance: argv_len={}", argv.len()));
        logging::info(&format!("single-instance: argv={:?}", argv));

        // 提取这次启动携带的 URL/文件（如果有）
        let targets = args::collect_open_targets_from_args(argv.clone());

        // 临时覆盖：本次启动如果携带 dir/workspace，则仅对这次转发生效（不锁死主进程）
        let dir_id = args::argv_get_value(&argv, "--dir-id");
        let workspace_id = args::argv_get_i64(&argv, "--workspace-id");
        open_targets::set_overrides(app, dir_id, workspace_id);

        // 需求：每次启动都只依据磁盘 config.json（不再使用/存储任何 CLI 覆盖），并且如果没有 URL/文件参数则拉起默认窗口
        if targets.is_empty() {
            open_targets::mark_ensure_window(app);
        }

        open_targets::push_open_targets(app, targets);
    }));

    #[cfg(not(desktop))]
    let builder = builder;

    builder
        .manage(open_targets::OpenTargetsState::new())
        .invoke_handler(tauri::generate_handler![
            greet,
            is_default_browser,
            set_default_browser,
            read_roxy_default_browser_config,
            set_close_button_visible,
            exit_app,
            open_targets::take_open_targets,
            open_targets::get_open_targets,
            show_main_window
        ])
        .setup(|app| -> Result<(), Box<dyn std::error::Error>> {
            // 默认：常驻后台服务（持续接收并转发）
            logging::info("mode=service: keep running");

            // 无 UI 模式：不创建任何 Webview 窗口；作为默认浏览器中转器运行并尽快退出。

            // CLI: --set-default-browser（由 Electron 安装器触发）
            if args::has_arg("--set-default-browser") {
                logging::info("cli: --set-default-browser");
                let _ = default_browser::set_default_browser(&app.config().identifier);
                if !cfg!(debug_assertions) {
                    exit_app(app.handle().clone());
                }
                return Ok(());
            }

            // Windows / Linux（以及部分 macOS 场景）会把 URL/文件路径放在 argv 里；
            // 这里把“非 flag 参数”收集起来交给后端转发。
            let argv_all: Vec<String> = std::env::args().collect();
            logging::info(&format!("startup argv={:?}", argv_all));

            // 临时覆盖：本次启动如果携带 dir/workspace，则仅对这次转发生效（不锁死主进程）
            let dir_id = args::argv_get_value(&argv_all, "--dir-id");
            let workspace_id = args::argv_get_i64(&argv_all, "--workspace-id");
            open_targets::set_overrides(&app.handle(), dir_id, workspace_id);

            let argv_targets = args::collect_open_targets_from_args(argv_all.into_iter().skip(1));
            open_targets::push_open_targets(&app.handle(), argv_targets);

            // 需求：如果启动时没有 URL/文件参数，则按 config.json 的默认值拉起窗口
            // （即使传入了其他 flag，也视为“无 open target”，应该拉起默认窗口）
            if args::collect_open_targets_from_args(std::env::args().skip(1)).is_empty() {
                open_targets::mark_ensure_window(&app.handle());
            }

            ws_forwarder::start_forwarder(app.handle().clone());

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // macOS/iOS: 系统层“打开 URL/文件”会走 Opened 事件
            // 注意：RunEvent::Opened 仅在 macOS/iOS 下存在，Windows/Linux 编译时需要条件分支
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            {
                if let RunEvent::Opened { urls } = event {
                    let targets = urls.into_iter().map(|u| u.to_string()).collect::<Vec<String>>();
                    open_targets::push_open_targets(app, targets);
                }
            }

            #[cfg(not(any(target_os = "macos", target_os = "ios")))]
            {
                let _ = (app, event);
            }
        });
}
