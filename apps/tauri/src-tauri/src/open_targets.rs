use std::sync::Mutex;

use tauri::{Emitter, Manager};

use crate::logging;

#[derive(Default, Clone)]
struct OpenQueue {
    /// 需要转发给 Electron 的 URL/文件路径（来自 argv/Opened）
    targets: Vec<String>,
    /// 即使没有 targets，也需要确保 Electron 侧窗口被拉起（比如用户点击了“默认浏览器快捷方式”）
    ensure_window: bool,
    /// 本次启动携带的临时覆盖参数（只用于下一次 drain_batch，不会“锁死”主进程）
    override_dir_id: Option<String>,
    /// 本次启动覆盖的 workspaceId（字符串长 ID）
    override_workspace_id: Option<String>,
}

/// macOS 作为默认浏览器 / Finder “打开方式” 启动时，系统会把 URL / 文件作为“打开资源”事件传入；
/// 同时 Windows / Linux 往往会把它们放在命令行参数里。
/// 这里统一收集后交给后端转发（也兼容未来可能恢复 Webview UI）。
pub struct OpenTargetsState(Mutex<OpenQueue>);

impl OpenTargetsState {
    pub fn new() -> Self {
        Self(Mutex::new(OpenQueue::default()))
    }
}

pub fn push_open_targets(app: &tauri::AppHandle, targets: Vec<String>) {
    if targets.is_empty() {
        return;
    }

    logging::info(&format!(
        "push_open_targets: count={} sample={:?}",
        targets.len(),
        targets.get(0).cloned().unwrap_or_default()
    ));

    // 先入队，确保后续消费方尚未就绪时不丢
    if let Ok(mut g) = app.state::<OpenTargetsState>().0.lock() {
        g.targets.extend(targets.iter().cloned());
    }

    // 再尽力实时通知前端（如果未来仍有 Webview UI）
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.emit("roxy://open", targets);
    }
}

pub fn mark_ensure_window(app: &tauri::AppHandle) {
    if let Ok(mut g) = app.state::<OpenTargetsState>().0.lock() {
        g.ensure_window = true;
    }
    logging::info("mark_ensure_window: true");
}

/// 写入本次启动的 dir/workspace 覆盖值，只对下一次转发批次生效。
pub fn set_overrides(app: &tauri::AppHandle, dir_id: Option<String>, workspace_id: Option<String>) {
    if dir_id.is_none() && workspace_id.is_none() {
        return;
    }
    let dir_log = dir_id.clone().unwrap_or_else(|| "<none>".to_string());
    let ws_log = workspace_id
        .clone()
        .unwrap_or_else(|| "<none>".to_string());
    if let Ok(mut g) = app.state::<OpenTargetsState>().0.lock() {
        if dir_id.is_some() {
            g.override_dir_id = dir_id;
        }
        if workspace_id.is_some() {
            g.override_workspace_id = workspace_id;
        }
    }
    logging::info(&format!(
        "set_overrides: dir_id={} workspace_id={}",
        dir_log, ws_log
    ));
}

pub fn drain_batch(app: &tauri::AppHandle) -> (bool, Vec<String>, Option<String>, Option<String>) {
    app.state::<OpenTargetsState>()
        .0
        .lock()
        .map(|mut g| {
            let ensure = g.ensure_window;
            g.ensure_window = false;
            let out = g.targets.clone();
            g.targets.clear();
            let dir = g.override_dir_id.take();
            let workspace = g.override_workspace_id.take();
            (ensure, out, dir, workspace)
        })
        .unwrap_or((false, Vec::new(), None, None))
}

pub fn requeue_batch(
    app: &tauri::AppHandle,
    ensure_window: bool,
    targets: Vec<String>,
) {
    if !ensure_window && targets.is_empty() {
        return;
    }
    let _ = app.state::<OpenTargetsState>().0.lock().map(|mut g| {
        g.ensure_window = g.ensure_window || ensure_window;
        g.targets.extend(targets);
    });
}

pub fn has_pending(app: &tauri::AppHandle) -> bool {
    app.state::<OpenTargetsState>()
        .0
        .lock()
        .map(|g| g.ensure_window || !g.targets.is_empty())
        .unwrap_or(false)
}

#[tauri::command]
pub fn take_open_targets(state: tauri::State<'_, OpenTargetsState>) -> Vec<String> {
    state
        .0
        .lock()
        .map(|mut g| {
            let out = g.targets.clone();
            g.targets.clear();
            out
        })
        .unwrap_or_default()
}

#[tauri::command]
pub fn get_open_targets(state: tauri::State<'_, OpenTargetsState>) -> Vec<String> {
    state
        .0
        .lock()
        .map(|g| g.targets.clone())
        .unwrap_or_default()
}


