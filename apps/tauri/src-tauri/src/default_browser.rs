#[cfg(target_os = "macos")]
mod macos {
  use core_foundation_sys::base::{CFRelease, OSStatus};
  use core_foundation_sys::string::{
    CFStringCreateWithCString, CFStringGetCStringPtr, CFStringRef, kCFStringEncodingUTF8,
  };
  use std::ffi::CString;
  use std::ptr;

  #[link(name = "CoreServices", kind = "framework")]
  extern "C" {
    fn LSSetDefaultHandlerForURLScheme(in_url_scheme: CFStringRef, in_handler_bundle_id: CFStringRef) -> OSStatus;
    fn LSCopyDefaultHandlerForURLScheme(in_url_scheme: CFStringRef) -> CFStringRef;
  }

  fn cf_string(s: &str) -> Result<CFStringRef, String> {
    let c = CString::new(s).map_err(|e| format!("invalid string: {e}"))?;
    let cf = unsafe { CFStringCreateWithCString(ptr::null(), c.as_ptr(), kCFStringEncodingUTF8) };
    if cf.is_null() {
      return Err("CFStringCreateWithCString returned null".to_string());
    }
    Ok(cf)
  }

  fn cf_string_to_rust(cf: CFStringRef) -> Option<String> {
    if cf.is_null() {
      return None;
    }
    // 这里用 CFStringGetCStringPtr 走 UTF8 快路径；失败则返回 None（足够用于我们的判断）
    let c_ptr = unsafe { CFStringGetCStringPtr(cf, kCFStringEncodingUTF8) };
    if c_ptr.is_null() {
      return None;
    }
    let c_str = unsafe { std::ffi::CStr::from_ptr(c_ptr) };
    c_str.to_str().ok().map(|s| s.to_string())
  }

  pub fn set_default_browser(bundle_id: &str) -> Result<(), String> {
    let bid = cf_string(bundle_id)?;
    let http = cf_string("http")?;
    let https = cf_string("https")?;

    let s1 = unsafe { LSSetDefaultHandlerForURLScheme(http, bid) };
    let s2 = unsafe { LSSetDefaultHandlerForURLScheme(https, bid) };

    unsafe {
      CFRelease(http as _);
      CFRelease(https as _);
      CFRelease(bid as _);
    }

    if s1 != 0 || s2 != 0 {
      return Err(format!("LSSetDefaultHandlerForURLScheme failed: http={s1} https={s2}"));
    }
    Ok(())
  }

  pub fn is_default_browser(bundle_id: &str) -> Result<bool, String> {
    let http = cf_string("http")?;
    let current = unsafe { LSCopyDefaultHandlerForURLScheme(http) };
    unsafe { CFRelease(http as _) };

    if current.is_null() {
      return Ok(false);
    }
    let current_str = cf_string_to_rust(current);
    unsafe { CFRelease(current as _) };

    Ok(current_str.as_deref() == Some(bundle_id))
  }
}

pub fn set_default_browser(bundle_id: &str) -> Result<(), String> {
  #[cfg(target_os = "macos")]
  {
    return macos::set_default_browser(bundle_id);
  }
  #[cfg(target_os = "windows")]
  {
    return windows::set_default_browser(bundle_id);
  }
  #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
  {
    return linux::set_default_browser(bundle_id);
  }
}

pub fn is_default_browser(bundle_id: &str) -> Result<bool, String> {
  #[cfg(target_os = "macos")]
  {
    return macos::is_default_browser(bundle_id);
  }
  #[cfg(target_os = "windows")]
  {
    return windows::is_default_browser(bundle_id);
  }
  #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
  {
    return linux::is_default_browser(bundle_id);
  }
}

// -----------------------------
// Windows（最佳实践：通常无法静默强制设置默认浏览器；这里采用“打开系统设置 + 尽力检测当前默认”）
// -----------------------------

#[cfg(target_os = "windows")]
mod windows {
  use std::path::PathBuf;
  use windows_sys::Win32::UI::Shell::{
    AssocQueryStringW, ShellExecuteW, ASSOCF_IS_PROTOCOL, ASSOCF_NONE, ASSOCSTR_EXECUTABLE,
  };
  use winreg::enums::{HKEY_CLASSES_ROOT, HKEY_CURRENT_USER, KEY_READ};
  use winreg::RegKey;

  fn hkcu() -> RegKey {
    RegKey::predef(HKEY_CURRENT_USER)
  }

  fn hkcr() -> RegKey {
    RegKey::predef(HKEY_CLASSES_ROOT)
  }

  fn to_wide_null(s: &str) -> Vec<u16> {
    let mut v: Vec<u16> = s.encode_utf16().collect();
    v.push(0);
    v
  }

  fn shell_open(target: &str) -> Result<(), String> {
    // 使用 ShellExecuteW 打开 URI（例如 ms-settings:xxx），比 explorer.exe 更可靠；
    // 返回值 <= 32 表示失败（https://learn.microsoft.com/windows/win32/api/shellapi/nf-shellapi-shellexecutew）
    let op = to_wide_null("open");
    let file = to_wide_null(target);
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

  fn assoc_query_executable_for_protocol(protocol: &str) -> Option<String> {
    // 通过系统 API 查询“协议最终会启动哪个 exe”，与 ShellExecute 的行为一致；
    // 这比直接读 UserChoice 更贴近用户实际体验（也能规避某些环境下 UserChoice 不更新的问题）。
    let proto = to_wide_null(protocol);

    let mut len: u32 = 0;
    // 第一次调用获取 buffer size（len 包含结尾 \0）
    let hr = unsafe {
      AssocQueryStringW(
        ASSOCF_IS_PROTOCOL | ASSOCF_NONE,
        ASSOCSTR_EXECUTABLE,
        proto.as_ptr(),
        std::ptr::null(),
        std::ptr::null_mut(),
        &mut len,
      )
    };

    // S_OK(0) / S_FALSE(1) 都可能返回长度；其他就认为失败
    if hr != 0 && hr != 1 {
      return None;
    }
    if len == 0 {
      return None;
    }

    let mut buf: Vec<u16> = vec![0; len as usize];
    let hr2 = unsafe {
      AssocQueryStringW(
        ASSOCF_IS_PROTOCOL | ASSOCF_NONE,
        ASSOCSTR_EXECUTABLE,
        proto.as_ptr(),
        std::ptr::null(),
        buf.as_mut_ptr(),
        &mut len,
      )
    };
    if hr2 != 0 {
      return None;
    }

    // len 是字符数（包含 \0），这里 trim 掉末尾 0
    let s = String::from_utf16_lossy(&buf);
    Some(s.trim_end_matches('\0').to_string())
  }

  fn path_like_matches_current_exe(candidate: &str) -> bool {
    let cand = candidate.trim().to_lowercase();
    let app_name_lc = default_browser_app_name().to_lowercase();
    let exe = match current_exe_path()
      .ok()
      .and_then(|p| p.file_name().map(|s| s.to_string_lossy().to_string()))
      .map(|s| s.to_lowercase())
    {
      Some(v) => v,
      None => return false,
    };

    // 常见两种：返回完整路径或返回带参数的 command。
    // - 先快速判断是否包含 app_name（兜底）
    // - 再判断是否包含当前 exe 文件名
    cand.contains(&app_name_lc) || cand.contains(&exe)
  }

  fn default_browser_app_name() -> &'static str {
    // build.rs 会把 apps/tauri/.env.* 注入为编译期常量；
    // 若没有配置，则按 build.rs 的默认规则：development => RoxyChromeDev，production => RoxyChrome
    option_env!("ROXY_DEFAULT_BROWSER_APP_NAME").unwrap_or_else(|| {
      if cfg!(debug_assertions) {
        "RoxyChromeDev"
      } else {
        "RoxyChrome"
      }
    })
  }

  fn default_browser_progid_url(app_name: &str) -> String {
    format!("{app_name}URL")
  }

  fn default_browser_progid_html(app_name: &str) -> String {
    format!("{app_name}HTML")
  }

  fn current_exe_path() -> Result<PathBuf, String> {
    std::env::current_exe().map_err(|e| format!("current_exe failed: {e}"))
  }

  fn reg_set_sz(root: &RegKey, subkey: &str, name: &str, value: &str) -> Result<(), String> {
    let (k, _) = root
      .create_subkey(subkey)
      .map_err(|e| format!("create_subkey failed: {subkey}: {e}"))?;
    k.set_value(name, &value.to_string())
      .map_err(|e| format!("set_value failed: {subkey}::{name}: {e}"))
  }

  fn register_default_browser_capabilities(app_name: &str) -> Result<(), String> {
    // 参考：Windows “默认应用/默认程序”识别 Win32 App 的注册方式：
    // - HKCU\Software\RegisteredApplications\<AppName> = "Software\Clients\StartMenuInternet\<AppName>\Capabilities"
    // - HKCU\Software\Clients\StartMenuInternet\<AppName>\Capabilities\{URLAssociations,FileAssociations}
    // - ProgId 定义：HKCU\Software\Classes\<ProgId>\shell\open\command
    //
    // 注意：Windows 10/11 不允许应用静默强制设置默认浏览器，只能“注册 + 引导用户在设置里确认”。

    let exe = current_exe_path()?;
    let exe_str = exe.to_string_lossy().to_string();
    let quoted_exe = format!("\"{exe_str}\"");

    // 约定 ProgId
    let progid_url = default_browser_progid_url(app_name);
    let progid_html = default_browser_progid_html(app_name);

    // 1) ProgId: URL (http/https)
    let key_url = format!(r"Software\Classes\{progid_url}");
    reg_set_sz(&hkcu(), &key_url, "", "Roxy Chrome URL")?;
    // URL Protocol 值存在且可为空字符串，表示这是一个 URL 协议处理器
    reg_set_sz(&hkcu(), &key_url, "URL Protocol", "")?;
    reg_set_sz(&hkcu(), &format!(r"{key_url}\DefaultIcon"), "", &format!("{quoted_exe},0"))?;
    reg_set_sz(
      &hkcu(),
      &format!(r"{key_url}\shell\open\command"),
      "",
      &format!("{quoted_exe} \"%1\""),
    )?;

    // 2) ProgId: HTML files (.htm/.html 等)
    let key_html = format!(r"Software\Classes\{progid_html}");
    reg_set_sz(&hkcu(), &key_html, "", "Roxy Chrome HTML Document")?;
    reg_set_sz(
      &hkcu(),
      &format!(r"{key_html}\DefaultIcon"),
      "",
      &format!("{quoted_exe},0"),
    )?;
    reg_set_sz(
      &hkcu(),
      &format!(r"{key_html}\shell\open\command"),
      "",
      &format!("{quoted_exe} \"%1\""),
    )?;

    // 3) RegisteredApplications + StartMenuInternet Capabilities
    let cap_root = format!(r"Software\Clients\StartMenuInternet\{app_name}\Capabilities");
    reg_set_sz(&hkcu(), &cap_root, "ApplicationName", "Roxy Chrome")?;
    reg_set_sz(
      &hkcu(),
      &cap_root,
      "ApplicationDescription",
      "Roxy Chrome - a minimal browser / URL handler.",
    )?;

    // URLAssociations: http/https -> ProgId
    let url_assoc = format!(r"{cap_root}\URLAssociations");
    reg_set_sz(&hkcu(), &url_assoc, "http", &progid_url)?;
    reg_set_sz(&hkcu(), &url_assoc, "https", &progid_url)?;

    // FileAssociations: 常见网页文件类型 -> ProgId
    let file_assoc = format!(r"{cap_root}\FileAssociations");
    for ext in [".htm", ".html", ".shtml", ".xhtml", ".webp", ".svg", ".xml"] {
      reg_set_sz(&hkcu(), &file_assoc, ext, &progid_html)?;
    }

    // 让 “默认应用” 能显示应用图标/打开命令（部分版本会读取）
    let app_root = format!(r"Software\Clients\StartMenuInternet\{app_name}");
    reg_set_sz(&hkcu(), &format!(r"{app_root}\DefaultIcon"), "", &format!("{quoted_exe},0"))?;
    reg_set_sz(&hkcu(), &format!(r"{app_root}\shell\open\command"), "", &format!("{quoted_exe}"))?;

    // 注册到 RegisteredApplications（关键）
    let reg_apps = r"Software\RegisteredApplications";
    let cap_path = format!(r"Software\Clients\StartMenuInternet\{app_name}\Capabilities");
    reg_set_sz(&hkcu(), reg_apps, app_name, &cap_path)?;

    Ok(())
  }

  fn url_encode_component(s: &str) -> String {
    // 针对 ms-settings URI 查询参数的最小编码：
    // - 空格等非 unreserved 字符做百分号编码
    // - 保持 ASCII 字母数字与 -._~ 不变
    //
    // 这里不引入额外依赖，足够覆盖 app_name 的常见字符集。
    let mut out = String::with_capacity(s.len());
    for b in s.as_bytes() {
      match *b {
        b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => out.push(*b as char),
        _ => out.push_str(&format!("%{:02X}", b)),
      }
    }
    out
  }

  fn query_default_http_progid() -> Option<String> {
    query_userchoice_progid_for_scheme("http")
  }

  fn query_userchoice_progid_for_scheme(scheme: &str) -> Option<String> {
    // HKCU\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\<scheme>\UserChoice -> ProgId
    // 这是 Windows 判定当前默认处理器的“权威来源”。
    let sub = format!(
      r"Software\Microsoft\Windows\Shell\Associations\UrlAssociations\{}\UserChoice",
      scheme
    );
    let k = hkcu().open_subkey_with_flags(sub, KEY_READ).ok()?;
    k.get_value::<String, _>("ProgId").ok()
  }

  fn query_registered_progid_for_scheme(app_name: &str, scheme: &str) -> Option<String> {
    // HKCU\Software\Clients\StartMenuInternet\<AppName>\Capabilities\URLAssociations\<scheme>
    // 这里保存了“我们注册给系统看的 ProgId”，用于和 UserChoice 精确对比。
    let sub = format!(
      r"Software\Clients\StartMenuInternet\{}\Capabilities\URLAssociations",
      app_name
    );
    let k = hkcu().open_subkey_with_flags(sub, KEY_READ).ok()?;
    k.get_value::<String, _>(scheme).ok()
  }

  fn query_progid_open_command(progid: &str) -> Option<String> {
    // HKCR\<ProgId>\shell\open\command default value
    let sub = format!(r"{progid}\shell\open\command");
    let k = hkcr().open_subkey_with_flags(&sub, KEY_READ).ok()
      .or_else(|| hkcu().open_subkey_with_flags(&format!(r"Software\Classes\{sub}"), KEY_READ).ok())?;
    k.get_value::<String, _>("").ok()
  }

  fn current_exe_hint() -> Option<String> {
    std::env::current_exe()
      .ok()
      .and_then(|p| p.file_name().map(|s| s.to_string_lossy().to_string()))
      .map(|s| s.to_lowercase())
  }

  pub fn is_default_browser(_bundle_id: &str) -> Result<bool, String> {
    // 0) 最优先：用系统 API 看 http/https 最终启动哪个 exe（与 Start-Process 的行为一致）
    let http_exe = assoc_query_executable_for_protocol("http");
    let https_exe = assoc_query_executable_for_protocol("https");
    if http_exe.as_deref().is_some_and(path_like_matches_current_exe)
      && https_exe.as_deref().is_some_and(path_like_matches_current_exe)
    {
      return Ok(true);
    }

    // 优先走“权威”判断：对比 UserChoice(http/https) 的 ProgId 是否等于我们注册的 ProgId。
    // 这能做到和 Chrome 一样：已经是默认浏览器就不再引导用户打开设置页。
    let app_name = default_browser_app_name();
    let fallback = default_browser_progid_url(app_name);
    let our_http = query_registered_progid_for_scheme(app_name, "http")
      .unwrap_or_else(|| fallback.clone());
    let our_https = query_registered_progid_for_scheme(app_name, "https")
      .unwrap_or_else(|| fallback.clone());

    let cur_http = query_userchoice_progid_for_scheme("http");
    let cur_https = query_userchoice_progid_for_scheme("https");

    if cur_http.as_deref() == Some(&our_http) && cur_https.as_deref() == Some(&our_https) {
      return Ok(true);
    }

    // 兜底：如果 UserChoice 无法读取（权限/策略），再用启发式“反查 command 是否指向当前 exe”
    // 以提高在特殊环境下的判断成功率。
    let progid = match cur_http.or_else(query_default_http_progid) {
      Some(v) => v,
      None => return Ok(false),
    };
    let cmd = match query_progid_open_command(&progid) {
      Some(v) => v.to_lowercase(),
      None => return Ok(false),
    };
    let exe = match current_exe_hint() {
      Some(v) => v,
      None => return Ok(false),
    };
    Ok(cmd.contains(&exe) || cmd.contains(&app_name.to_lowercase()))
  }

  pub fn set_default_browser(_bundle_id: &str) -> Result<(), String> {
    // 已经是默认浏览器则不再打扰用户（不注册/不打开设置页）
    if is_default_browser(_bundle_id).unwrap_or(false) {
      return Ok(());
    }

    // 1) 先把应用注册成“可选默认浏览器”（出现在系统默认应用列表里）
    //    这里用 HKCU（无需管理员权限），对当前用户生效。
    let app_name = default_browser_app_name();
    let _ = register_default_browser_capabilities(app_name);

    // 2) 再打开系统“默认应用”设置页，引导用户选择（Windows 不允许静默强制设置默认浏览器）
    // - 优先直接跳转到“当前应用的默认应用详情页”（Chrome 的体验）
    //   微软官方：ms-settings:defaultapps?registeredAppUser=<name>
    // - 如果系统不支持该参数，再回退到默认应用列表页
    //
    // 用 explorer.exe 打开 ms-settings，避免 cmd.exe 弹出黑框
    let deep_link = format!(
      "ms-settings:defaultapps?registeredAppUser={}",
      url_encode_component(app_name),
    );
    // 先尝试深链接到“当前应用详情页”；失败就回退到默认应用列表页
    if shell_open(&deep_link).is_err() {
      shell_open("ms-settings:defaultapps")
        .map_err(|e| format!("open default apps settings failed: {e}"))?;
    }
    Ok(())
  }
}

// -----------------------------
// Linux（xdg-settings / xdg-mime）
// -----------------------------

#[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
mod linux {
  use std::process::Command;

  fn run_capture(mut cmd: Command) -> Result<String, String> {
    let out = cmd.output().map_err(|e| format!("run failed: {e}"))?;
    let mut s = String::from_utf8_lossy(&out.stdout).to_string();
    s.push_str(&String::from_utf8_lossy(&out.stderr));
    Ok(s)
  }

  fn desktop_file_name(bundle_id: &str) -> String {
    // 需求：运行时不依赖环境变量/环境变量文件；
    // 若需要自定义 desktop 文件名，请在 apps/tauri/.env* 或 tauri.env* 中配置 ROXY_DESKTOP_FILE，
    // build.rs 会在构建期注入为编译期常量。
    if let Some(v) = option_env!("ROXY_DESKTOP_FILE") {
      if !v.trim().is_empty() {
        return v.trim().to_string();
      }
    }
    format!("{bundle_id}.desktop")
  }

  pub fn is_default_browser(bundle_id: &str) -> Result<bool, String> {
    let mut cmd = Command::new("xdg-settings");
    cmd.args(["get", "default-web-browser"]);
    let out = run_capture(cmd).unwrap_or_default().trim().to_string();
    if out.is_empty() {
      return Ok(false);
    }
    Ok(out == desktop_file_name(bundle_id))
  }

  pub fn set_default_browser(bundle_id: &str) -> Result<(), String> {
    let desktop = desktop_file_name(bundle_id);
    let mut cmd = Command::new("xdg-settings");
    cmd.args(["set", "default-web-browser", &desktop]);
    let out = run_capture(cmd)?;
    // xdg-settings 有时 stdout 为空，失败会在 stderr
    if out.to_lowercase().contains("error") {
      return Err(out);
    }
    Ok(())
  }
}


