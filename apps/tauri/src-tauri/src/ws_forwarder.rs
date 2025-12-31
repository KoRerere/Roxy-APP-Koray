use std::net::TcpStream;
use std::time::Duration;

use tungstenite::{client, Message, WebSocket};
use tungstenite::client::IntoClientRequest;

use crate::config::load_roxy_config_from_disk;
use crate::logging;
use crate::open_targets;
use crate::paths;

type Ws = WebSocket<TcpStream>;

fn app_protocol_candidates() -> [&'static str; 2] {
    // Electron 侧协议名：dev=roxybrowser-dev / prod=roxybrowser
    // 这里为了“最可靠”，两种都尝试；先尝试与当前数据目录匹配的那个。
    if paths::roxy_data_dir_name() == ".roxybrowser" {
        ["roxybrowser", "roxybrowser-dev"]
    } else {
        ["roxybrowser-dev", "roxybrowser"]
    }
}

#[cfg(target_os = "windows")]
fn os_open_url(url: &str) -> Result<(), String> {
    use windows_sys::Win32::UI::Shell::ShellExecuteW;

    fn to_wide_null(s: &str) -> Vec<u16> {
        let mut v: Vec<u16> = s.encode_utf16().collect();
        v.push(0);
        v
    }

    // 返回值 <= 32 表示失败
    let op = to_wide_null("open");
    let file = to_wide_null(url);
    let r = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            op.as_ptr(),
            file.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            1,
        )
    };
    if (r as isize) <= 32 {
        return Err(format!("ShellExecuteW failed (code={})", r as isize));
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn os_open_url(url: &str) -> Result<(), String> {
    let st = std::process::Command::new("open")
        .arg(url)
        .status()
        .map_err(|e| format!("open failed: {e}"))?;
    if !st.success() {
        return Err(format!("open exited with status={st}"));
    }
    Ok(())
}

#[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
fn os_open_url(url: &str) -> Result<(), String> {
    // Linux：优先 xdg-open，失败再尝试 gio open
    if let Ok(st) = std::process::Command::new("xdg-open").arg(url).status() {
        if st.success() {
            return Ok(());
        }
        logging::warn(&format!("xdg-open exited with status={st}, fallback to gio"));
    } else {
        logging::warn("xdg-open spawn failed, fallback to gio");
    }

    if let Ok(st) = std::process::Command::new("gio").args(["open", url]).status() {
        if st.success() {
            return Ok(());
        }
        logging::warn(&format!("gio open exited with status={st}, fallback to desktop Exec"));
    } else {
        logging::warn("gio open spawn failed, fallback to desktop Exec");
    }

    // 兜底：某些 Linux 环境 xdg-open/gio 对自定义 scheme 会转交给系统默认浏览器或直接失败。
    // 我们尝试通过 xdg-mime 找到 x-scheme-handler 对应的 .desktop，并执行 Exec 来拉起 Electron。
    linux_launch_via_desktop_exec(url)
}

#[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
fn linux_launch_via_desktop_exec(url: &str) -> Result<(), String> {
    fn read_cmd_output(cmd: &mut std::process::Command) -> Option<String> {
        cmd.output().ok().and_then(|o| String::from_utf8(o.stdout).ok())
    }

    fn home_dir() -> Option<std::path::PathBuf> {
        std::env::var("HOME").ok().map(std::path::PathBuf::from)
    }

    fn find_desktop_file(name: &str) -> Option<std::path::PathBuf> {
        let name = name.trim();
        if name.is_empty() {
            return None;
        }
        let mut candidates: Vec<std::path::PathBuf> = Vec::new();
        if let Some(home) = home_dir() {
            candidates.push(home.join(".local/share/applications").join(name));
        }
        candidates.push(std::path::PathBuf::from("/usr/local/share/applications").join(name));
        candidates.push(std::path::PathBuf::from("/usr/share/applications").join(name));
        candidates.into_iter().find(|p| p.exists())
    }

    fn parse_desktop_exec(path: &std::path::Path) -> Option<String> {
        let raw = std::fs::read_to_string(path).ok()?;
        for line in raw.lines() {
            let line = line.trim();
            if line.starts_with("Exec=") {
                return Some(line.trim_start_matches("Exec=").trim().to_string());
            }
        }
        None
    }

    fn split_exec(s: &str) -> Vec<String> {
        // 轻量级 parser：支持双引号包裹；足够应对大部分 .desktop 的 Exec
        let mut out: Vec<String> = Vec::new();
        let mut cur = String::new();
        let mut in_quotes = false;
        let mut chars = s.chars().peekable();
        while let Some(ch) = chars.next() {
            match ch {
                '"' => in_quotes = !in_quotes,
                ' ' | '\t' if !in_quotes => {
                    if !cur.is_empty() {
                        out.push(cur.clone());
                        cur.clear();
                    }
                    while matches!(chars.peek(), Some(' ' | '\t')) {
                        let _ = chars.next();
                    }
                }
                _ => cur.push(ch),
            }
        }
        if !cur.is_empty() {
            out.push(cur);
        }
        out
    }

    fn expand_exec_tokens(args: Vec<String>, url: &str) -> Vec<String> {
        let mut out: Vec<String> = Vec::new();
        let mut replaced = false;
        for a in args {
            let a = match a.as_str() {
                "%u" | "%U" | "%f" | "%F" => {
                    replaced = true;
                    url.to_string()
                }
                "%i" | "%c" | "%k" => {
                    // 这些 token 通常是图标/名称/desktop 文件路径，可忽略
                    continue;
                }
                other => other.to_string(),
            };
            out.push(a);
        }
        if !replaced {
            out.push(url.to_string());
        }
        out
    }

    // 从 URL scheme 推导 xdg-mime key：x-scheme-handler/<scheme>
    let scheme = url.split(':').next().unwrap_or("").trim();
    if scheme.is_empty() {
        return Err("desktop exec fallback: url scheme missing".to_string());
    }

    let mime = format!("x-scheme-handler/{scheme}");
    let desktop = read_cmd_output(std::process::Command::new("xdg-mime").args(["query", "default", &mime]))
        .unwrap_or_default()
        .trim()
        .to_string();
    logging::info(&format!("wake-electron: xdg-mime default {mime} => {}", desktop));

    let Some(desktop_path) = find_desktop_file(&desktop) else {
        return Err(format!("desktop exec fallback: desktop file not found ({desktop})"));
    };
    logging::info(&format!("wake-electron: desktop file path={}", desktop_path.display()));

    let Some(exec_line) = parse_desktop_exec(&desktop_path) else {
        return Err("desktop exec fallback: Exec= not found".to_string());
    };
    logging::info(&format!("wake-electron: desktop Exec={}", exec_line));

    let parts = split_exec(&exec_line);
    if parts.is_empty() {
        return Err("desktop exec fallback: Exec is empty".to_string());
    }
    let bin = parts[0].clone();
    let argv = expand_exec_tokens(parts[1..].to_vec(), url);
    logging::info(&format!("wake-electron: spawn desktop Exec bin={} argv={:?}", bin, argv));

    std::process::Command::new(bin)
        .args(argv)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("desktop exec fallback: spawn failed: {e}"))
}

fn wake_electron_via_protocol(dir_id: &str, workspace_id: i64) -> Result<(), String> {
    // dirId 为 hex，workspaceId 为数字，直接拼接足够可靠
    let mut last_err: Option<String> = None;
    for scheme in app_protocol_candidates() {
        let url = format!("{scheme}://open-browser-failed?dirId={dir_id}&workspaceId={workspace_id}");
        logging::info(&format!("wake-electron: try openUrl {}", url));
        match os_open_url(&url) {
            Ok(_) => {
                logging::info(&format!("wake-electron: openUrl ok scheme={scheme}"));
                return Ok(());
            }
            Err(e) => {
                logging::error(&format!("wake-electron: openUrl failed scheme={scheme}: {e}"));
                last_err = Some(e);
            }
        }
    }
    Err(last_err.unwrap_or_else(|| "wake-electron failed: unknown".to_string()))
}

fn url_encode_component(s: &str) -> String {
    // RFC 3986 unreserved: ALPHA / DIGIT / "-" / "." / "_" / "~"
    let mut out = String::new();
    for b in s.as_bytes() {
        match *b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => out.push(*b as char),
            _ => {
                out.push('%');
                out.push_str(&format!("{:02X}", b));
            }
        }
    }
    out
}

fn wake_electron_via_protocol_with_url(
    dir_id: &str,
    workspace_id: i64,
    target_url: &str,
) -> Result<(), String> {
    // 复用 open-browser-failed 路由，增加可选 url 参数，兼容旧 Electron
    let enc = url_encode_component(target_url);
    let mut last_err: Option<String> = None;
    for scheme in app_protocol_candidates() {
        let url = format!(
            "{scheme}://open-browser-failed?dirId={dir_id}&workspaceId={workspace_id}&url={enc}"
        );
        logging::info(&format!("wake-electron: try openUrl {}", url));
        match os_open_url(&url) {
            Ok(_) => {
                logging::info(&format!("wake-electron: openUrl ok scheme={scheme}"));
                return Ok(());
            }
            Err(e) => {
                logging::error(&format!("wake-electron: openUrl failed scheme={scheme}: {e}"));
                last_err = Some(e);
            }
        }
    }
    Err(last_err.unwrap_or_else(|| "wake-electron failed: unknown".to_string()))
}

fn connect_electron_ws(port: u16, token: &str) -> Result<Ws, String> {
    // 重要：Node(ws) 对 “GET ws://host:port/... HTTP/1.1” 这种 absolute-form 请求行可能返回 400。
    // 这里用 tungstenite 生成的标准握手（包含 Sec-WebSocket-Key 等），再额外加 token header。
    let host = format!("127.0.0.1:{port}");
    // 让 tungstenite 根据 ws:// URL 生成完整的握手 headers（包括 Sec-WebSocket-Key 等）。
    let full_url = format!("ws://{host}/?token={token}");

    let stream =
        TcpStream::connect(host.as_str()).map_err(|e| format!("TcpStream connect failed: {e}"))?;

    // 仅对 ws://（Plain TCP）设置超时
    let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));

    let mut req = full_url
        .into_client_request()
        .map_err(|e| format!("build ws request failed: {e}"))?;

    // Electron 端也支持 header token，这里双保险（即使 query 被某些环境改写也能过）
    req.headers_mut()
        .insert("token", token.parse().map_err(|e| format!("bad token header: {e}"))?);

    let (mut ws, _resp) = client(req, stream).map_err(|e| format!("连接 WebSocket 失败: {e}"))?;
    set_ws_timeouts(&mut ws);
    Ok(ws)
}

fn set_ws_timeouts(ws: &mut Ws) {
    let s = ws.get_mut();
    let _ = s.set_read_timeout(Some(Duration::from_millis(500)));
    let _ = s.set_write_timeout(Some(Duration::from_secs(5)));
}

fn ws_send_json(ws: &mut Ws, v: serde_json::Value) -> Result<(), String> {
    let pid = std::process::id();
    let v = match v {
        serde_json::Value::Object(mut obj) => {
            // 每次发送都带上当前中转程序 PID，便于 Electron 侧排查来源/去重/统计
            obj.insert("pid".to_string(), serde_json::Value::Number(pid.into()));
            serde_json::Value::Object(obj)
        }
        other => other,
    };

    ws.send(Message::Text(v.to_string().into()))
        .map_err(|e| format!("ws send failed: {e}"))
}

fn ws_read_json(ws: &mut Ws) -> Result<Option<serde_json::Value>, String> {
    match ws.read() {
        Ok(Message::Text(t)) => serde_json::from_str(&t)
            .map(Some)
            .map_err(|e| format!("ws json parse failed: {e}")),
        Ok(Message::Binary(_)) => Ok(None),
        Ok(Message::Ping(p)) => {
            // 保持兼容：自动 pong
            let _ = ws.send(Message::Pong(p));
            Ok(None)
        }
        Ok(Message::Pong(_)) => Ok(None),
        Ok(Message::Close(_)) => Err("ws closed".to_string()),
        Ok(_) => Ok(None),
        Err(tungstenite::Error::Io(e))
            if matches!(
                e.kind(),
                std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
            ) =>
        {
            Ok(None)
        }
        Err(e) => Err(format!("ws read failed: {e}")),
    }
}

fn ws_wait_for_type(ws: &mut Ws, ty: &str, max_wait: Duration) -> Result<serde_json::Value, String> {
    let start = std::time::Instant::now();
    loop {
        if start.elapsed() > max_wait {
            return Err(format!("ws wait timeout: {ty}"));
        }

        if let Some(v) = ws_read_json(ws)? {
            let t = v.get("type").and_then(|x| x.as_str()).unwrap_or_default();
            if t == "app:login-required" {
                return Err("Electron 未登录（app:login-required）".to_string());
            }
            if t == ty {
                return Ok(v);
            }
        }
    }
}

fn forward_open_targets_to_electron_ws(
    ws: &mut Ws,
    dir_id: &str,
    workspace_id: i64,
    ensure_window: bool,
    targets: Vec<String>,
) -> Result<(), String> {
    if !ensure_window && targets.is_empty() {
        return Ok(());
    }

    logging::info(&format!(
        "forward: begin ensure_window={} count={} sample={:?}",
        ensure_window,
        targets.len(),
        targets.get(0).cloned().unwrap_or_default()
    ));

    // 1) “只带 dir/workspace 启动”的场景：即使浏览器已打开，也希望激活/聚焦一次。
    // Electron 的 browserManager.launch 在已打开时会走“已打开则 launch()”分支，达到类似 Chrome 的效果。
    if ensure_window {
        ws_send_json(
            ws,
            serde_json::json!({
                "type": "browser:open-window",
                "dirId": dir_id,
                "workspaceId": workspace_id,
            }),
        )?;

        // 没有 URL 的话，这里就不需要再做 is-opened 轮询了（避免“看起来没反应”）。
        if targets.is_empty() {
            logging::info("forward: ensure_window only (no targets), open-window sent");
            logging::info("forward: done");
            return Ok(());
        }
    }

    // 2) 对于携带 URL 的场景：先探测浏览器是否已打开，必要时再拉起并等待就绪
    ws_send_json(
        ws,
        serde_json::json!({
            "type": "browser:is-opened",
            "dirId": dir_id,
        }),
    )?;
    let v = ws_wait_for_type(ws, "browser:is-opened", Duration::from_secs(5))?;
    let mut opened = v.get("opened").and_then(|x| x.as_bool()).unwrap_or(false);

    // 3) 未打开则请求拉起
    if !opened {
        ws_send_json(
            ws,
            serde_json::json!({
                "type": "browser:open-window",
                "dirId": dir_id,
                "workspaceId": workspace_id,
            }),
        )?;
    }

    // 4) 轮询确认已打开（避免 open-url 过早发送导致丢失）
    if !opened {
        let start = std::time::Instant::now();
        while start.elapsed() < Duration::from_secs(60) {
            std::thread::sleep(Duration::from_millis(500));
            ws_send_json(
                ws,
                serde_json::json!({
                    "type": "browser:is-opened",
                    "dirId": dir_id,
                }),
            )?;
            let v = ws_wait_for_type(ws, "browser:is-opened", Duration::from_secs(5))?;
            opened = v.get("opened").and_then(|x| x.as_bool()).unwrap_or(false);
            if opened {
                break;
            }
        }
    }

    if !opened {
        return Err("等待 Electron 浏览器打开超时".to_string());
    }

    // 4) 转发 URL/文件路径
    for t in targets.into_iter().filter(|s| !s.trim().is_empty()) {
        ws_send_json(
            ws,
            serde_json::json!({
                "type": "browser:open-url",
                "dirId": dir_id,
                "url": t,
            }),
        )?;
    }

    logging::info("forward: done");
    Ok(())
}

pub fn start_forwarder(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        logging::info("forwarder: thread started");

        let mut pending_since: Option<std::time::Instant> = None;
        let mut ws: Option<Ws> = None;
        let mut current_ws_url: Option<String> = None;
        let mut backoff_ms: u64 = 500;
        let mut last_ping = std::time::Instant::now();
        let mut last_wake = std::time::Instant::now() - Duration::from_secs(60);

        loop {
            std::thread::sleep(Duration::from_millis(150));

            if !open_targets::has_pending(&app) {
                pending_since = None;
                continue;
            }

            if pending_since.is_none() {
                pending_since = Some(std::time::Instant::now());
            }

            // 让批量点击/批量启动先“聚合”一下再发，减少 WS 往返
            if pending_since
                .as_ref()
                .is_some_and(|t| t.elapsed() >= Duration::from_millis(400))
            {
                let (ensure_window, targets, override_dir_id, override_workspace_id) =
                    open_targets::drain_batch(&app);
                pending_since = None;

                if !ensure_window && targets.is_empty() {
                    continue;
                }

                // 每次处理批次时都读配置（只读磁盘，不吃主进程 argv，避免“旧 CLI 覆盖值”锁死）
                let cfg = match load_roxy_config_from_disk() {
                    Ok(v) => v,
                    Err(e) => {
                        logging::error(&format!(
                            "forwarder: load config failed: {e} (will retry)"
                        ));
                        open_targets::requeue_batch(
                            &app,
                            ensure_window,
                            targets,
                        );
                        std::thread::sleep(Duration::from_secs(2));
                        continue;
                    }
                };

                // 每次都读磁盘 config.json，但允许本次启动用 CLI 临时覆盖（不持久化，不锁死）
                let dir_id = override_dir_id
                    .clone()
                    .or(cfg.current_dir_id.clone())
                    .or(cfg.default_browser_dir_id.clone())
                    .unwrap_or_default();
                let workspace_id = override_workspace_id
                    .or(cfg.current_workspace)
                    .or(cfg.default_browser_workspace_id)
                    .unwrap_or(0);
                let port = cfg.app_ws_port.unwrap_or(0);
                let token = cfg.app_ws_token.unwrap_or_default();

                if dir_id.is_empty() || workspace_id == 0 || port == 0 || token.is_empty() {
                    logging::error(
                        "forwarder: config missing fields (dirId/workspaceId/appWsPort/appWsToken), will retry",
                    );
                    open_targets::requeue_batch(
                        &app,
                        ensure_window,
                        targets,
                    );
                    std::thread::sleep(Duration::from_secs(2));
                    continue;
                }

                logging::info(&format!(
                    "forwarder: using dirId={} workspaceId={} (override_dirId={} override_workspaceId={})",
                    dir_id,
                    workspace_id,
                    override_dir_id.as_deref().unwrap_or("<none>"),
                    override_workspace_id
                        .map(|v| v.to_string())
                        .unwrap_or_else(|| "<none>".to_string())
                ));

                let ws_url = format!("ws://127.0.0.1:{port}?token={token}");
                if current_ws_url.as_deref() != Some(ws_url.as_str()) {
                    // 配置变更/首次连接：丢弃旧连接，触发重连
                    ws = None;
                    current_ws_url = Some(ws_url.clone());
                }

                // 确保长连接可用（断线自动重连）
                if ws.is_none() {
                    logging::info(&format!(
                        "forwarder: connecting ws://127.0.0.1:{port}?token=<redacted> (backoff={}ms)",
                        backoff_ms
                    ));

                    match connect_electron_ws(port, &token) {
                        Ok(sock) => {
                            ws = Some(sock);
                            backoff_ms = 500;
                            last_ping = std::time::Instant::now();
                            logging::info("forwarder: ws connected");
                        }
                        Err(e) => {
                            logging::error(&format!(
                                "forwarder: ws connect failed: {e} (可能是端口不是 Electron WS / 握手格式不兼容)"
                            ));

                            // Electron 未启动时兜底：通过自定义协议拉起 Electron
                            // 限频：最多每 10 秒尝试一次，避免反复刷屏
                            if last_wake.elapsed() >= Duration::from_secs(10) {
                                last_wake = std::time::Instant::now();
                                let first_target = targets.iter().find(|s| {
                                    s.starts_with("http://")
                                        || s.starts_with("https://")
                                        || s.starts_with("file://")
                                });
                                let r = if let Some(u) = first_target {
                                    wake_electron_via_protocol_with_url(&dir_id, workspace_id, u)
                                } else {
                                    wake_electron_via_protocol(&dir_id, workspace_id)
                                };
                                if let Err(e) = r {
                                    logging::error(&format!("wake-electron failed: {e}"));
                                }
                            }

                            open_targets::requeue_batch(
                                &app,
                                ensure_window,
                                targets,
                            );
                            std::thread::sleep(Duration::from_millis(backoff_ms));
                            backoff_ms = (backoff_ms * 2).min(30_000);
                            continue;
                        }
                    }
                }

                // 批次转发（复用同一条 ws 连接）
                let mut ok = false;
                if let Some(sock) = ws.as_mut() {
                    match forward_open_targets_to_electron_ws(
                        sock,
                        &dir_id,
                        workspace_id,
                        ensure_window,
                        targets.clone(),
                    ) {
                        Ok(_) => {
                            ok = true;
                            logging::info("forwarder: batch forwarded");
                        }
                        Err(e) => {
                            logging::error(&format!("forwarder: forward failed: {e} (will retry)"));
                        }
                    }
                }

                if !ok {
                    // 失败：放回队列，丢弃 ws 连接，触发下次重连（避免半开连接卡住）
                    open_targets::requeue_batch(
                        &app,
                        ensure_window,
                        targets,
                    );
                    ws = None;
                    std::thread::sleep(Duration::from_secs(2));
                }
            }

            // 空闲心跳：保持连接更像 Chrome；发送失败则触发重连
            if ws.is_some() && last_ping.elapsed() >= Duration::from_secs(30) {
                last_ping = std::time::Instant::now();
                if let Some(sock) = ws.as_mut() {
                    if sock.send(Message::Ping(Vec::new().into())).is_err() {
                        logging::warn("forwarder: ping failed, reconnecting");
                        ws = None;
                    }
                }
            }
        }
    });
}


