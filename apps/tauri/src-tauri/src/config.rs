use std::fs;

use crate::paths::roxy_config_file_path;

#[derive(Debug, serde::Deserialize)]
pub struct RoxyDefaultBrowserConfig {
    #[serde(rename = "defaultBrowserDirId")]
    pub default_browser_dir_id: Option<String>,
    #[serde(rename = "defaultBrowserWorkspaceId")]
    pub default_browser_workspace_id: Option<i64>,
    #[serde(rename = "currentDirId")]
    pub current_dir_id: Option<String>,
    #[serde(rename = "currentWorkspace")]
    pub current_workspace: Option<i64>,
    #[serde(rename = "appWsPort")]
    pub app_ws_port: Option<u16>,
    #[serde(rename = "appWsToken")]
    pub app_ws_token: Option<String>,
}

/// 只从磁盘读取 config.json（不做任何 CLI 覆盖注入）。
pub fn read_roxy_default_browser_config_value_raw() -> Result<serde_json::Value, String> {
    let path = roxy_config_file_path()?;
    let path_str = path.to_string_lossy().to_string();
    let raw = fs::read_to_string(&path).map_err(|e| format!("读取配置文件失败({path_str}): {e}"))?;
    let base: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| format!("解析 JSON 失败({path_str}): {e}"))?;
    Ok(base)
}

pub fn load_roxy_config_from_disk() -> Result<RoxyDefaultBrowserConfig, String> {
    let v = read_roxy_default_browser_config_value_raw()?;
    serde_json::from_value::<RoxyDefaultBrowserConfig>(v).map_err(|e| format!("解析 RoxyConfig 失败: {e}"))
}


