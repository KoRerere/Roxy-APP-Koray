!macro customInit
  ; 初始化时不需要做任何操作
!macroend

!macro customInstall
  ; 在安装完成后执行，此时安装位置已经确定
  StrCpy $R0 "$APPDATA\${PRODUCT_NAME}"
  CreateDirectory "$R0"
  StrCpy $R0 "$R0\installer-path"

  FileOpen $R1 $R0 w
  FileWrite $R1 "$EXEPATH"
  FileClose $R1

  ; 显示确认消息
  ; MessageBox MB_OK "安装程序路径已写入: $R0$\n路径内容: $EXEPATH"
!macroend