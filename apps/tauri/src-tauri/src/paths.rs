use std::path::PathBuf;

pub fn home_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(v) = std::env::var("USERPROFILE") {
            if !v.trim().is_empty() {
                return Some(PathBuf::from(v));
            }
        }
        if let Ok(v) = std::env::var("HOMEPATH") {
            if !v.trim().is_empty() {
                return Some(PathBuf::from(v));
            }
        }
    }
    if let Ok(v) = std::env::var("HOME") {
        if !v.trim().is_empty() {
            return Some(PathBuf::from(v));
        }
    }
    None
}

pub fn roxy_data_dir_name() -> &'static str {
    // 用户要求：目录名由 NODE_ENV 决定
    // - production => .roxybrowser
    // - 其他/缺省  => .roxybrowser-dev（方便本地开发）
    // 注意：打包后的 APP 不会自动加载 .env，所以这里优先使用编译期常量 ROXY_NODE_ENV（由 build.rs 注入）。
    // 需求：运行时不依赖环境变量/环境变量文件；因此不再允许用运行时 NODE_ENV 覆盖。
    let node_env = option_env!("ROXY_NODE_ENV")
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            if cfg!(debug_assertions) {
                "development".into()
            } else {
                "production".into()
            }
        })
        .to_lowercase();
    if node_env == "production" {
        ".roxybrowser"
    } else {
        ".roxybrowser-dev"
    }
}

pub fn roxy_config_file_path() -> Result<PathBuf, String> {
    let home = home_dir().ok_or_else(|| "无法获取用户 home 目录".to_string())?;
    Ok(home.join(roxy_data_dir_name()).join("config.json"))
}

pub fn log_file_path() -> Option<PathBuf> {
    // 统一放到 ~/.roxybrowser[-dev]/logs/launcher.log
    let home = home_dir()?;
    let dir = home.join(roxy_data_dir_name()).join("logs");
    let _ = std::fs::create_dir_all(&dir);
    Some(dir.join("launcher.log"))
}


