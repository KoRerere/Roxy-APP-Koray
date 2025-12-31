use std::{
    collections::HashMap,
    env,
    fs,
    path::{Path, PathBuf},
};

fn parse_env_file(contents: &str) -> HashMap<String, String> {
    let mut out = HashMap::new();
    for line in contents.lines() {
        let mut line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        // 兼容：dotenv 常见写法 `export KEY=VALUE`
        if let Some(rest) = line.strip_prefix("export ") {
            line = rest.trim();
        }
        let Some((k, v)) = line.split_once('=') else {
            continue;
        };
        let k = k.trim();
        if k.is_empty() {
            continue;
        }
        let mut v = v.trim();
        // 兼容：引号包裹的值
        // - 单引号：不做转义处理
        // - 双引号：支持常见转义（\n \r \t \\ \")
        if v.len() >= 2 {
            let bytes = v.as_bytes();
            let first = bytes[0];
            let last = bytes[bytes.len() - 1];
            if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
                v = &v[1..v.len() - 1];
                if first == b'"' {
                    let mut s = String::with_capacity(v.len());
                    let mut it = v.chars();
                    while let Some(ch) = it.next() {
                        if ch != '\\' {
                            s.push(ch);
                            continue;
                        }
                        match it.next() {
                            Some('n') => s.push('\n'),
                            Some('r') => s.push('\r'),
                            Some('t') => s.push('\t'),
                            Some('\\') => s.push('\\'),
                            Some('"') => s.push('"'),
                            Some(other) => {
                                // 未识别转义：保留原样（含反斜杠）
                                s.push('\\');
                                s.push(other);
                            }
                            None => s.push('\\'),
                        }
                    }
                    out.insert(k.to_string(), s);
                    continue;
                }
            }
        }
        out.insert(k.to_string(), v.to_string());
    }
    out
}

fn read_env_file(path: &Path) -> HashMap<String, String> {
    match fs::read_to_string(path) {
        Ok(s) => parse_env_file(&s),
        Err(_) => HashMap::new(),
    }
}

fn first_non_empty<'a>(vals: impl IntoIterator<Item = Option<&'a str>>) -> Option<&'a str> {
    for v in vals {
        if let Some(v) = v {
            if !v.trim().is_empty() {
                return Some(v);
            }
        }
    }
    None
}

fn is_valid_rustc_env_key(k: &str) -> bool {
    if k.is_empty() {
        return false;
    }
    // Cargo/Rustc 环境变量名尽量保持简单：仅允许 ASCII 字母数字与下划线
    k.as_bytes()
        .iter()
        .all(|b| b.is_ascii_alphanumeric() || *b == b'_')
}

fn main() {
    // 让修改 .env / tauri.env 能触发重新构建（即使文件不存在也不影响）
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let app_root = manifest_dir.parent().unwrap_or(&manifest_dir).to_path_buf(); // apps/tauri
    // 兼容：仓库可提交的配置文件（避免某些环境禁写 .env*）
    let watch_files = [
        ".env",
        ".env.local",
        ".env.development",
        ".env.development.local",
        ".env.production",
        ".env.production.local",
        "tauri.env",
        "tauri.env.local",
        "tauri.env.development",
        "tauri.env.development.local",
        "tauri.env.production",
        "tauri.env.production.local",
    ]
    .map(|p| app_root.join(p));

    for p in &watch_files {
        println!("cargo:rerun-if-changed={}", p.display());
    }

    // 读取 apps/tauri/.env*（可选），用于构建期注入（打包后的二进制不依赖运行时环境变量/.env）
    // 加载顺序（后者覆盖前者）：
    // - .env
    // - .env.local
    // - tauri.env
    // - tauri.env.local
    // - .env.<mode>
    // - .env.<mode>.local
    // - tauri.env.<mode>
    // - tauri.env.<mode>.local
    let mut env_map: HashMap<String, String> = HashMap::new();
    for p in [".env", ".env.local", "tauri.env", "tauri.env.local"] {
        env_map.extend(read_env_file(&app_root.join(p)));
    }

    // 先判定 mode：优先用 .env 中的 NODE_ENV，再兜底 debug/release
    // 需求：运行时不依赖环境变量/环境变量文件；因此这里也不使用“构建机环境变量”做覆盖，保证构建结果可复现。
    let node_env = first_non_empty([
        env_map.get("NODE_ENV").map(|s| s.as_str()),
        Some(if cfg!(debug_assertions) { "development" } else { "production" }),
    ])
    .unwrap_or("development")
    .to_string();

    let mode = if node_env == "production" {
        "production"
    } else {
        "development"
    };
    for p in [
        format!(".env.{mode}"),
        format!(".env.{mode}.local"),
        format!("tauri.env.{mode}"),
        format!("tauri.env.{mode}.local"),
    ] {
        env_map.extend(read_env_file(&app_root.join(p)));
    }

    // 1) 注入 ROXY_NODE_ENV（你们现有逻辑）
    println!("cargo:rustc-env=ROXY_NODE_ENV={}", node_env);

    // 2) 注入默认浏览器注册用的 AppName/ID（可被 .env 或系统环境变量覆盖）
    //    约定：开发/测试默认 RoxyChromeDev；生产默认 RoxyChrome
    let app_name = first_non_empty([
        env_map
            .get("ROXY_DEFAULT_BROWSER_APP_NAME")
            .map(|s| s.as_str()),
        Some(if node_env == "production" {
            "RoxyChrome"
        } else {
            "RoxyChromeDev"
        }),
    ])
    .unwrap_or("RoxyChromeDev");

    println!("cargo:rustc-env=ROXY_DEFAULT_BROWSER_APP_NAME={}", app_name);

    // 3) 额外注入：把 .env / tauri.env 里所有 ROXY_ 开头的键在构建期写入二进制（运行时无需 env/.env）
    //    - 只注入 ROXY_ 前缀：避免把前端/其他工具的变量误塞进 Rust
    //    - 变量名需要满足 [A-Za-z0-9_]+，否则跳过并提示 warning
    for (k, v) in &env_map {
        if !k.starts_with("ROXY_") {
            continue;
        }
        if k == "ROXY_DEFAULT_BROWSER_APP_NAME" {
            // 已由上面的 app_name 统一处理（含默认值规则）
            continue;
        }
        if !is_valid_rustc_env_key(k) {
            println!(
                "cargo:warning=skip invalid env key for rustc-env: {} (only [A-Za-z0-9_]+ allowed)",
                k
            );
            continue;
        }
        println!("cargo:rustc-env={k}={v}");
    }

    tauri_build::build()
}
