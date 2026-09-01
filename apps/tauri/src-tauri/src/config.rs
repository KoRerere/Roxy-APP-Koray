use std::fs;

use serde::Deserialize;

use crate::paths::roxy_config_file_path;

/** 从磁盘读取的默认浏览器配置。workspaceId 已统一为字符串长 ID。 */
#[derive(Debug, Deserialize)]
pub struct RoxyDefaultBrowserConfig {
    #[serde(rename = "defaultBrowserDirId")]
    pub default_browser_dir_id: Option<String>,
    /// 默认浏览器所属工作空间 ID（兼容旧数字）
    #[serde(default, rename = "defaultBrowserWorkspaceId", deserialize_with = "deserialize_optional_id")]
    pub default_browser_workspace_id: Option<String>,
    #[serde(rename = "currentDirId")]
    pub current_dir_id: Option<String>,
    /// 本次启动覆盖的工作空间 ID（兼容旧数字）
    #[serde(default, rename = "currentWorkspace", deserialize_with = "deserialize_optional_id")]
    pub current_workspace: Option<String>,
    #[serde(rename = "appWsPort")]
    pub app_ws_port: Option<u16>,
    #[serde(rename = "appWsToken")]
    pub app_ws_token: Option<String>,
}

/// 兼容旧版数字 ID 与新版字符串长 ID，统一成 String。
fn deserialize_optional_id<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = Option::<serde_json::Value>::deserialize(deserializer)?;
    Ok(normalize_id_value(value))
}

/// 把 JSON 里的 ID（字符串或数字）归一成非空字符串。
fn normalize_id_value(value: Option<serde_json::Value>) -> Option<String> {
    match value {
        None | Some(serde_json::Value::Null) => None,
        Some(serde_json::Value::String(s)) => {
            let s = s.trim();
            if s.is_empty() {
                None
            } else {
                Some(s.to_string())
            }
        }
        Some(serde_json::Value::Number(n)) => Some(n.to_string()),
        Some(_) => None,
    }
}

/// 缺省或历史占位 `0` 视为未配置。
pub fn is_blank_id(s: &str) -> bool {
    s.is_empty() || s == "0"
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

/// 从磁盘解析默认浏览器配置。
pub fn load_roxy_config_from_disk() -> Result<RoxyDefaultBrowserConfig, String> {
    let v = read_roxy_default_browser_config_value_raw()?;
    serde_json::from_value::<RoxyDefaultBrowserConfig>(v).map_err(|e| format!("解析 RoxyConfig 失败: {e}"))
}
