; ============================================================================
; NSIS 安装脚本模板
; ============================================================================
; 构建时会替换以下占位符：
;   {{REPORT_DOMAINS}} - 上报域名列表，用 | 分隔
;   {{REPORT_API_PATH}} - API 路径
; ============================================================================

; 定义上报域名（构建时替换）
!define REPORT_DOMAINS "{{REPORT_DOMAINS}}"
!define REPORT_API_PATH "{{REPORT_API_PATH}}"
!define APP_PROTOCOL "{{APP_PROTOCOL}}"

!include "FileFunc.nsh"
!include "FileFunc.nsh"

; ============================================================================
; 自定义宏定义
; ============================================================================

; ----------------------------------------------------------------------------
; 说明：
; - 不要在这里引入任何 `un.*` Function（会触发 NSIS warning 6020，并被 electron-builder 当作 error）
; - 我们改用 `customUnInit` 内的 `HideWindow` 来隐藏卸载器窗口（此宏会被插入到卸载器初始化流程中）
; ----------------------------------------------------------------------------

!macro customInit
  ; 初始化时不需要做任何操作
!macroend

!macro customInstall
  ; ========================================================================
  ; 0. 安装目录自动调整
  ; ========================================================================
  ; 如果用户选择的目录末尾不是应用名称，自动创建应用名称子目录
  Push $0
  Push $1
  Push $2

  ; 提取最后一级目录名
  StrCpy $0 $INSTDIR
  StrCpy $2 $0 1 -1
  StrCmp $2 "\" 0 +2
    StrCpy $0 $0 -1

  StrLen $2 $0
  IntOp $2 $2 - 1

  customInstall_find_slash:
    IntCmp $2 0 customInstall_start 0 0
    StrCpy $1 $0 1 $2
    StrCmp $1 "\" customInstall_found 0
    IntOp $2 $2 - 1
    Goto customInstall_find_slash

  customInstall_found:
    IntOp $2 $2 + 1
    StrCpy $1 $0 "" $2
    Goto customInstall_check

  customInstall_start:
    StrCpy $1 $0

  customInstall_check:
    ; 检查目录名是否为应用名称
    StrCmp $1 "${PRODUCT_NAME}" customInstall_ok 0

    ; 不匹配，调整安装目录
    StrCpy $0 $INSTDIR
    StrCpy $2 $0 1 -1
    StrCmp $2 "\" +2
      StrCpy $0 "$0\"
    StrCpy $INSTDIR "$0${PRODUCT_NAME}"

  customInstall_ok:
    Pop $2
    Pop $1
    Pop $0

  ; ========================================================================
  ; 1. 从安装程序文件名中提取 UUID
  ; ========================================================================
  ; 文件名格式: RoxyBrowser_x64_6.5.9_2025_10_10-H-test__<UUID>.exe
  ; UUID 位于最后两个下划线（__）之后，42位十六进制字符

  Push $0
  Push $1
  Push $2
  Push $3

  StrCpy $0 "$EXEPATH"
  StrLen $2 $0
  IntOp $3 $2 - 1

  ; 从后往前查找 "__"
  uuid_loop:
    IntCmp $3 0 uuid_notfound uuid_notfound 0
    StrCpy $1 $0 2 $3
    StrCmp $1 "__" uuid_found 0
    IntOp $3 $3 - 1
    Goto uuid_loop

  uuid_found:
    IntOp $3 $3 + 2
    StrCpy $R3 $0 42 $3  ; 提取 42 位 UUID
    Goto uuid_end

  uuid_notfound:
    StrCpy $R3 ""

  uuid_end:
    Pop $3
    Pop $2
    Pop $1
    Pop $0

  ; ========================================================================
  ; 2. 保存安装程序路径到本地文件
  ; ========================================================================
  StrCpy $R0 "$APPDATA\${PRODUCT_NAME}\installer-path"
  CreateDirectory "$APPDATA\${PRODUCT_NAME}"

  ; 写入失败时不要阻塞安装，失败则降级写到 TEMP
  ClearErrors
  FileOpen $R1 $R0 w
  IfErrors write_installer_path_fallback 0
  FileWrite $R1 "$EXEPATH"
  FileClose $R1
  Goto write_installer_path_end

  write_installer_path_fallback:
    StrCpy $R0 "$TEMP\${PRODUCT_NAME}\installer-path"
    CreateDirectory "$TEMP\${PRODUCT_NAME}"
    ClearErrors
    FileOpen $R1 $R0 w
    IfErrors write_installer_path_end 0
    FileWrite $R1 "$EXEPATH"
    FileClose $R1

  write_installer_path_end:

  ; ========================================================================
  ; 3. 遍历域名列表发送安装完成上报
  ; ========================================================================
  ; 采用多域名故障转移策略：依次尝试每个域名，任一成功即停止
  ; 使用 VBScript + WinHTTP COM 方式（Win7+ 原生支持，较少被安全软件拦截）

  StrCpy $R4 "${REPORT_DOMAINS}"  ; 域名列表
  StrCpy $R5 0                     ; 当前解析位置
  StrLen $R8 $R4                   ; 域名列表总长度

  domain_loop_start:
    StrCpy $R6 ""  ; 重置当前域名

    ; 从当前位置解析下一个域名（以 | 分隔或字符串结尾）
    find_next_domain:
      IntCmp $R5 $R8 domain_end continue_parse domain_end

    continue_parse:
      StrCpy $1 $R4 1 $R5
      StrCmp $1 "|" domain_found 0
      StrCmp $1 "" domain_end 0
      StrCpy $R6 "$R6$1"
      IntOp $R5 $R5 + 1
      Goto find_next_domain

    domain_found:
      IntOp $R5 $R5 + 1  ; 跳过分隔符
      Goto try_request

    domain_end:
      StrCmp $R6 "" all_domains_failed 0  ; 已无更多域名
      Goto try_request

    ; 尝试向当前域名发送请求
    try_request:
      StrCpy $R7 "$R6${REPORT_API_PATH}"

      ; 方案1: 使用 curl 发送请求（优先，Win10 1803+ 内置）
      nsExec::ExecToStack 'cmd /c curl -m 6 -s -X POST -H "Content-Type: application/json" -d "{\"uuid\":\"$R3\",\"eventType\":\"install_complete\"}" "$R7"'
      Pop $0
      Pop $1
      StrCmp $0 "0" report_success 0

      ; 方案2: 创建 VBScript 文件使用 WinHTTP COM 对象发送请求
      ClearErrors
      FileOpen $2 "$TEMP\installer-report.vbs" w
      FileWrite $2 'On Error Resume Next$\r$\n'
      FileWrite $2 'Set http = CreateObject("WinHttp.WinHttpRequest.5.1")$\r$\n'
      FileWrite $2 'If Err.Number <> 0 Then WScript.Quit(1)$\r$\n'
      FileWrite $2 '$\r$\n'
      FileWrite $2 'http.SetTimeouts 6000, 6000, 6000, 6000$\r$\n'
      FileWrite $2 'http.Open "POST", "$R7", False$\r$\n'
      FileWrite $2 'If Err.Number <> 0 Then WScript.Quit(1)$\r$\n'
      FileWrite $2 '$\r$\n'
      FileWrite $2 'http.SetRequestHeader "Content-Type", "application/json"$\r$\n'
      FileWrite $2 'jsonData = "{""uuid"":""$R3"",""eventType"":""install_complete""}"$\r$\n'
      FileWrite $2 'http.Send jsonData$\r$\n'
      FileWrite $2 'If Err.Number <> 0 Then WScript.Quit(1)$\r$\n'
      FileWrite $2 '$\r$\n'
      FileWrite $2 'If http.Status >= 200 And http.Status < 300 Then$\r$\n'
      FileWrite $2 '  WScript.Quit(0)$\r$\n'
      FileWrite $2 'Else$\r$\n'
      FileWrite $2 '  WScript.Quit(1)$\r$\n'
      FileWrite $2 'End If$\r$\n'
      FileClose $2

      ; 使用 cscript 静默执行 VBScript
      nsExec::ExecToStack 'cscript //Nologo //B "$TEMP\installer-report.vbs"'
      Pop $0
      Pop $1
      Delete "$TEMP\installer-report.vbs"
      StrCmp $0 "0" report_success 0

      ; 当前域名失败，尝试下一个域名
      IntCmp $R5 $R8 all_domains_failed all_domains_failed domain_loop_start

  report_success:
    ; 上报成功，结束流程
    Goto report_done

  all_domains_failed:
    ; 所有域名都失败，静默处理（不影响安装）
    Goto report_done

  report_done:
!macroend

!macro customUnInit
  ; ========================================================================
  ; 卸载流程控制（由应用 executeUninstall() 函数统一管理）
  ; ========================================================================
  ; 流程：
  ; 1. 用户点击卸载 -> NSIS 启动应用显示反馈窗口 -> 立即 Abort
  ; 2. 用户确认 -> 应用调用 executeUninstall() 带 /roxy-force-uninstall -> 真正卸载
  ; 3. 用户取消 -> 应用直接退出，卸载已中断
  ; ========================================================================

  ; 检查是否带 /roxy-force-uninstall 参数（由应用传递）
  ${GetParameters} $0
  ClearErrors
  ${GetOptions} $0 "/roxy-force-uninstall" $1
  IfErrors no_force_uninstall uninit_done

  no_force_uninstall:
    ; 隐藏卸载器窗口，避免与反馈窗口冲突
    HideWindow

    ; 覆盖安装/静默卸载时不弹出反馈窗口
    IfSilent uninit_done

    ; 如果主程序不存在，直接继续卸载
    IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 uninit_done

    ; 启动应用显示卸载反馈窗口（使用 Exec 非阻塞模式）
    ClearErrors
    Exec '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --uninstall-feedback'

    ; 立即中断卸载，交由应用 executeUninstall() 控制后续流程
    Abort

  uninit_done:
    ; 带参数时直接继续卸载，无需任何额外判断
!macroend

!macro customUnInstall
  DeleteRegKey HKCR "${APP_PROTOCOL}"
  DeleteRegKey HKCU "Software\Classes\${APP_PROTOCOL}"
!macroend





