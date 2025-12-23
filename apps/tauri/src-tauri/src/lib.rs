// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
pub mod default_browser;

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Emitter, Manager};
#[cfg(any(target_os = "macos", target_os = "ios"))]
use tauri::RunEvent;
#[cfg(desktop)]
use tauri::menu::{Menu, MenuItem, MenuEvent, PredefinedMenuItem, Submenu};
#[cfg(target_os = "macos")]
use tauri::ActivationPolicy;

pub const ROXY_CONFIG_ARG_KEY: &str = "--roxy-default-browser-config-path";
pub const ROXY_CONFIG_PATH_FILE: &str = "roxy-default-browser-config-path.txt";

fn get_arg_value(key: &str) -> Option<String> {
    let mut it = std::env::args();
    while let Some(a) = it.next() {
        if a == key {
            return it.next();
        }
        if let Some(v) = a.strip_prefix(&(key.to_string() + "=")) {
            return Some(v.to_string());
        }
    }
    None
}

fn app_support_dir(identifier: &str) -> PathBuf {
    // macOS: ~/Library/Application Support/<identifier>
    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join(identifier);
        }
    }

    // Windows: %LOCALAPPDATA%\<identifier> (fallback: %APPDATA%\..\Local\<identifier> or %APPDATA%\<identifier>)
    #[cfg(target_os = "windows")]
    {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            return PathBuf::from(local).join(identifier);
        }
        if let Ok(appdata) = std::env::var("APPDATA") {
            // Common pattern: C:\Users\xx\AppData\Roaming -> Local
            let maybe_local = appdata.replace("\\Roaming", "\\Local");
            if maybe_local != appdata {
                return PathBuf::from(maybe_local).join(identifier);
            }
            return PathBuf::from(appdata).join(identifier);
        }
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            return PathBuf::from(userprofile)
                .join("AppData")
                .join("Local")
                .join(identifier);
        }
    }

    // Linux: $XDG_DATA_HOME/<identifier> (fallback: ~/.local/share/<identifier>)
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        if let Ok(xdg) = std::env::var("XDG_DATA_HOME") {
            if !xdg.trim().is_empty() {
                return PathBuf::from(xdg).join(identifier);
            }
        }
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home).join(".local").join("share").join(identifier);
        }
    }

    // fallback
    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join(identifier)
}

pub fn persist_config_path(identifier: &str, path: &str) -> Result<(), String> {
    let dir = app_support_dir(identifier);
    fs::create_dir_all(&dir).map_err(|e| format!("create_dir_all failed: {e}"))?;
    fs::write(dir.join(ROXY_CONFIG_PATH_FILE), path).map_err(|e| format!("write failed: {e}"))?;
    Ok(())
}

fn read_persisted_config_path(identifier: &str) -> Option<String> {
    let p = app_support_dir(identifier).join(ROXY_CONFIG_PATH_FILE);
    fs::read_to_string(p).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

struct RoxyConfigPathState(Mutex<Option<String>>);

/// macOS 作为默认浏览器 / Finder “打开方式” 启动时，系统会把 URL / 文件作为“打开资源”事件传入；
/// 同时 Windows / Linux 往往会把它们放在命令行参数里。
/// 这里统一收集后推给前端消费（事件 + 可拉取兜底）。
struct OpenTargetsState(Mutex<Vec<String>>);

fn push_open_targets(app: &tauri::AppHandle, targets: Vec<String>) {
    if targets.is_empty() {
        return;
    }

    // 先入队，确保前端监听器尚未挂载时不丢
    if let Ok(mut g) = app.state::<OpenTargetsState>().0.lock() {
        g.extend(targets.iter().cloned());
    }

    // 再尽力实时通知前端
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.emit("roxy://open", targets);
    }
}

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
fn get_roxy_default_browser_config_path(state: tauri::State<'_, RoxyConfigPathState>) -> Option<String> {
    state.0.lock().ok().and_then(|g| g.clone())
}

#[tauri::command]
fn read_roxy_default_browser_config(
    state: tauri::State<'_, RoxyConfigPathState>,
) -> Result<serde_json::Value, String> {
    let path = state
        .0
        .lock()
        .map_err(|_| "lock failed".to_string())?
        .clone()
        .ok_or_else(|| "未找到 roxy-default-browser-config-path".to_string())?;

    let raw = fs::read_to_string(&path).map_err(|e| format!("读取配置文件失败({path}): {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("解析 JSON 失败({path}): {e}"))
}

#[tauri::command]
fn take_open_targets(state: tauri::State<'_, OpenTargetsState>) -> Vec<String> {
    state
        .0
        .lock()
        .map(|mut g| {
            let out = g.clone();
            g.clear();
            out
        })
        .unwrap_or_default()
}

#[tauri::command]
fn get_open_targets(state: tauri::State<'_, OpenTargetsState>) -> Vec<String> {
    state.0.lock().map(|g| g.clone()).unwrap_or_default()
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
    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder
        .menu(|app| {
            // 先使用 Tauri 的默认菜单（包含系统菜单栏结构）
            let menu = Menu::default(app)?;

            // 只自定义 View 子菜单：在 View 里增加 “Toggle Developer Tools”
            let view_menu = Submenu::with_id_and_items(
                app,
                "view",
                "View",
                true,
                &[
                    &MenuItem::with_id(
                        app,
                        "toggle_devtools",
                        "Toggle Developer Tools",
                        true,
                        Some("CmdOrCtrl+Alt+I"),
                    )?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::fullscreen(app, None)?,
                ],
            )?;

            // 在默认菜单中查找 “View/视图” 子菜单并替换；如果找不到则追加
            let items = menu.items().unwrap_or_default();
            let mut view_index: Option<usize> = None;
            for (idx, item) in items.iter().enumerate() {
                if let Some(submenu) = item.as_submenu() {
                    if let Ok(text) = submenu.text() {
                        if text == "View" || text == "视图" {
                            view_index = Some(idx);
                            break;
                        }
                    }
                }
            }

            if let Some(idx) = view_index {
                let _ = menu.remove_at(idx)?;
                menu.insert(&view_menu, idx)?;
            } else {
                let _ = menu.append(&view_menu);
            }

            Ok(menu)
        })
        .on_menu_event(|app, event: MenuEvent| {
            if event.id() == "toggle_devtools" {
                if let Some(w) = app.get_webview_window("main") {
                    if w.is_devtools_open() {
                        w.close_devtools();
                    } else {
                        w.open_devtools();
                    }
                }
            }
        });

    #[cfg(not(desktop))]
    let builder = builder;

    builder
        .plugin(tauri_plugin_opener::init())
        .manage(RoxyConfigPathState(Mutex::new(None)))
        .manage(OpenTargetsState(Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![
            greet,
            is_default_browser,
            set_default_browser,
            get_roxy_default_browser_config_path,
            read_roxy_default_browser_config,
            set_close_button_visible,
            exit_app,
            take_open_targets,
            get_open_targets,
            show_main_window
        ])
        .setup(|app| -> Result<(), Box<dyn std::error::Error>> {
            // 读取并保存 `--roxy-default-browser-config-path`
            let identifier = &app.config().identifier;
            let arg_path = get_arg_value(ROXY_CONFIG_ARG_KEY);
            let final_path = arg_path.clone().or_else(|| read_persisted_config_path(identifier));
            if let Some(p) = arg_path.as_deref() {
                let _ = persist_config_path(identifier, p);
            }
            if let Some(p) = final_path.clone() {
                let state: tauri::State<'_, RoxyConfigPathState> = app.state();
                // 单独作用域，避免临时借用导致生命周期报错
                {
                    if let Ok(mut guard) = state.0.lock() {
                        *guard = Some(p);
                    }
                };
            }

            // 启动时隐藏 Dock/任务栏图标（尽可能早，避免启动瞬间 Dock 闪现）
            // 等前端调用 show_main_window 再恢复
            #[cfg(target_os = "macos")]
            {
                let _ = app.handle().set_activation_policy(ActivationPolicy::Accessory);
                let _ = app.handle().set_dock_visibility(false);
            }

            // 只要不是通过 --set-default-browser 启动（该参数已在 main.rs 早期处理并退出），默认都显示 UI
            if let Some(cfg) = app.config().app.windows.first() {
                let builder = tauri::WebviewWindowBuilder::from_config(app, cfg)?;
                // macOS: 需要保留系统标题栏(交通灯)但保持“无边框/沉浸式”视觉效果
                // - config 里 decorations=false 会导致交通灯完全消失
                // - 这里仅对 macOS 覆盖窗口参数，其他平台保持原逻辑
                #[cfg(target_os = "macos")]
                let builder = builder
                    .decorations(true)
                    .hidden_title(true)
                    .title_bar_style(tauri::TitleBarStyle::Overlay);
                let w = builder.build()?;
                #[cfg(target_os = "macos")]
                {
                    macos_keep_only_close_button(&w);
                    // macOS：保持原生交通灯“关闭按钮”始终可见（仅隐藏最小化/缩放已在上面处理）
                    set_close_button_visible(w.app_handle().clone(), true);
                }

                #[cfg(not(target_os = "macos"))]
                {
                    // Windows/Linux：隐藏任务栏图标，等 show_main_window 再恢复
                    let _ = w.set_skip_taskbar(true);
                }
            } else {
                tauri::WebviewWindowBuilder::new(
                    app,
                    "main",
                    tauri::WebviewUrl::App("index.html".into()),
                )
                .title("roxybrowser")
                .build()?;
            }

            // Windows / Linux（以及部分 macOS 场景）会把 URL/文件路径放在 argv 里；
            // 这里把“非 --xxx 参数”收集起来交给前端。
            let mut argv_targets: Vec<String> = Vec::new();
            for a in std::env::args().skip(1) {
                if a.starts_with("--") {
                    continue;
                }
                if a.starts_with("http://") || a.starts_with("https://") || a.starts_with("file://") {
                    argv_targets.push(a);
                    continue;
                }
                // Finder “打开方式” 常见是直接传文件路径
                if std::path::Path::new(&a).exists() {
                    argv_targets.push(a);
                }
            }
            push_open_targets(&app.handle(), argv_targets);

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
                    push_open_targets(app, targets);
                }
            }

            #[cfg(not(any(target_os = "macos", target_os = "ios")))]
            {
                let _ = (app, event);
            }
        });
}
