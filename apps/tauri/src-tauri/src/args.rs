pub fn has_arg(key: &str) -> bool {
    std::env::args().any(|a| a == key)
}

/// 从 argv 列表中读取参数值（支持 `--key=xxx` / `--key xxx`）。
pub fn argv_get_value(argv: &[String], key: &str) -> Option<String> {
    let key_eq = format!("{key}=");
    let mut prev_is_key = false;
    for a in argv {
        if prev_is_key {
            let v = strip_wrapping_quotes(a).trim();
            if !v.is_empty() && !v.starts_with("--") {
                return Some(v.to_string());
            }
            prev_is_key = false;
        }

        if a == key {
            prev_is_key = true;
            continue;
        }

        if let Some(v) = a.strip_prefix(&key_eq) {
            let v = strip_wrapping_quotes(v).trim();
            if !v.is_empty() {
                return Some(v.to_string());
            }
        }
    }
    None
}

pub fn argv_get_i64(argv: &[String], key: &str) -> Option<i64> {
    argv_get_value(argv, key).and_then(|s| s.parse::<i64>().ok())
}

fn strip_wrapping_quotes(s: &str) -> &str {
    let s = s.trim();
    if s.len() >= 2 {
        let bytes = s.as_bytes();
        let first = bytes[0];
        let last = bytes[bytes.len() - 1];
        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
            return &s[1..s.len() - 1];
        }
    }
    s
}

fn percent_decode_minimal(s: &str) -> String {
    // 用于 file:// URL 的 path，支持常见的 %XX（UTF-8 字节序列）。
    let mut out: Vec<u8> = Vec::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let h1 = bytes[i + 1];
            let h2 = bytes[i + 2];
            let v1 = (h1 as char).to_digit(16);
            let v2 = (h2 as char).to_digit(16);
            if let (Some(v1), Some(v2)) = (v1, v2) {
                out.push(((v1 << 4) | v2) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(out).unwrap_or_else(|_| s.to_string())
}

fn file_url_to_path(s: &str) -> Option<std::path::PathBuf> {
    // 仅处理 file:// URL（用于过滤“自身 exe 被当成 target”）。
    // 这里不追求覆盖所有 RFC 细节，但要在三大平台上足够可靠：
    // - file:///C:/path/to.exe
    // - file://localhost/C:/path/to.exe
    // - file:///Users/me/xxx
    let s = s.trim();
    if !s.to_lowercase().starts_with("file://") {
        return None;
    }
    let mut rest = &s[7..]; // after "file://"

    // 去掉可选的 host（只接受 localhost 或空 host）
    if let Some(pos) = rest.find('/') {
        let host = &rest[..pos];
        if !host.is_empty() && host != "localhost" {
            return None;
        }
        rest = &rest[pos..];
    }

    let rest = percent_decode_minimal(rest);

    #[cfg(target_os = "windows")]
    {
        // /C:/xxx -> C:/xxx
        let r = rest.strip_prefix('/').unwrap_or(rest.as_str());
        return Some(std::path::PathBuf::from(r.replace('/', "\\")));
    }
    #[cfg(not(target_os = "windows"))]
    {
        return Some(std::path::PathBuf::from(rest));
    }
}

#[cfg(target_os = "windows")]
fn normalize_path_for_compare(p: &std::path::Path) -> Option<String> {
    // Windows 大小写不敏感；PathBuf 的 == 是字面量比较，容易把同一路径当成不同路径。
    // 这里尽量 canonicalize，并做 lowercase/分隔符归一化后比较。
    std::fs::canonicalize(p)
        .ok()
        .and_then(|p| {
            p.to_str().map(|s| {
                s.replace('\\', "/")
                    .trim_end_matches('/')
                    .to_lowercase()
            })
        })
}

#[cfg(not(target_os = "windows"))]
fn normalize_path_for_compare(p: &std::path::Path) -> Option<String> {
    std::fs::canonicalize(p)
        .ok()
        .and_then(|p| p.to_str().map(|s| s.to_string()))
}

fn is_self_exe_path(arg: &str) -> bool {
    let arg = strip_wrapping_quotes(arg);
    let arg_path = file_url_to_path(arg).unwrap_or_else(|| std::path::PathBuf::from(arg));
    let self_exe = match std::env::current_exe() {
        Ok(p) => p,
        Err(_) => return false,
    };

    // 快速路径：字面相等
    if arg_path.as_path() == self_exe.as_path() {
        return true;
    }

    // 慢路径：canonicalize +（windows）大小写/分隔符归一化
    let a = normalize_path_for_compare(arg_path.as_path());
    let b = normalize_path_for_compare(self_exe.as_path());
    match (a, b) {
        (Some(a), Some(b)) => a == b,
        _ => false,
    }
}

pub fn collect_open_targets_from_args<I>(args: I) -> Vec<String>
where
    I: IntoIterator<Item = String>,
{
    let mut out: Vec<String> = Vec::new();

    for a in args {
        let a = strip_wrapping_quotes(&a).trim().to_string();
        if a.is_empty() {
            continue;
        }

        // 过滤常见 flag（默认浏览器/系统调用时，URL 往往是“非 flag 参数”）
        // - 兼容 macOS 的 -psn_xxx（单横杠）
        if a.starts_with('-') {
            // 但如果看起来像 URL（例如 "roxy://..."），就不要当 flag 丢掉
            if !a.contains("://") {
                continue;
            }
        }

        // URL：优先识别 http/https/file，其次识别任意 xxx://（预留自定义 scheme）
        if a.starts_with("http://")
            || a.starts_with("https://")
            || a.starts_with("file://")
            || a.contains("://")
        {
            // 防御：如果是 file:// 且指向自身 exe，则忽略
            if a.to_lowercase().starts_with("file://") && is_self_exe_path(&a) {
                continue;
            }
            out.push(a);
            continue;
        }

        // 文件路径：Finder “打开方式” 常见是直接传文件路径；Windows 也可能传本地路径
        if std::path::Path::new(&a).exists() {
            // 某些场景（比如 single-instance 插件）会把 exe 路径也传进来，这里必须过滤掉。
            if is_self_exe_path(&a) {
                continue;
            }
            out.push(a);
        }
    }

    out
}


