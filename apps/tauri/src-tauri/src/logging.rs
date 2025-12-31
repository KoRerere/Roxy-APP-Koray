use std::io::Write;

use crate::paths::log_file_path;

fn log_line(level: &str, msg: &str) {
    // 本地时间，便于人类排查
    let ts = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let line = format!("[{ts}][{level}] {msg}\n");

    // best-effort：日志失败不影响主流程
    if let Some(p) = log_file_path() {
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(p) {
            let _ = f.write_all(line.as_bytes());
            let _ = f.flush();
        }
    }
}

pub fn info(msg: &str) {
    log_line("INFO", msg);
}

pub fn warn(msg: &str) {
    log_line("WARN", msg);
}

pub fn error(msg: &str) {
    log_line("ERROR", msg);
}


