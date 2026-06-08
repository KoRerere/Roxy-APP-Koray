/// 从当前可执行文件名推导启动器注册名（RoxyChrome / RoxyFirefox / RoxyChromeDev 等），
/// 保证同一份逻辑可打出多个仅名称/图标不同的产物。
pub fn launcher_app_name() -> String {
  if let Ok(exe) = std::env::current_exe() {
    if let Some(stem) = exe.file_stem().and_then(|s| s.to_str()) {
      let stem = stem.trim();
      if !stem.is_empty() {
        return stem.to_string();
      }
    }
  }

  if let Some(v) = option_env!("ROXY_DEFAULT_BROWSER_APP_NAME") {
    let v = v.trim();
    if !v.is_empty() {
      return v.to_string();
    }
  }

  if cfg!(debug_assertions) {
    "RoxyChromeDev".to_string()
  } else {
    "RoxyChrome".to_string()
  }
}

pub fn is_firefox_launcher(app_name: &str) -> bool {
  app_name.to_ascii_lowercase().contains("firefox")
}

pub fn launcher_display_brand(app_name: &str) -> &'static str {
  if is_firefox_launcher(app_name) {
    "Roxy Firefox"
  } else {
    "Roxy Chrome"
  }
}
