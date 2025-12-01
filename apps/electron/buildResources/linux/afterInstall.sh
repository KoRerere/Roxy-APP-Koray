#!/bin/bash
# postinst script for {{APP_NAME}}
# 安装 polkit policy 文件以自定义认证提示

set -e

POLKIT_DIR="/usr/share/polkit-1/actions"
APP_POLICY_FILE="{{POLICY_FILENAME}}"
POLICY_SOURCE="/opt/{{APP_NAME}}/resources/com.roxybrowser.policy"

# 确保 polkit 目录存在
if [ -d "$POLKIT_DIR" ]; then
    # 复制 policy 文件到 polkit 目录
    if [ -f "$POLICY_SOURCE" ]; then
        cp "$POLICY_SOURCE" "$POLKIT_DIR/$APP_POLICY_FILE"
        chmod 644 "$POLKIT_DIR/$APP_POLICY_FILE"
        echo "已安装 polkit policy 文件: $POLKIT_DIR/$APP_POLICY_FILE"
    fi
fi

# 更新桌面数据库（如果存在）
if command -v update-desktop-database > /dev/null 2>&1; then
    update-desktop-database -q /usr/share/applications 2>/dev/null || true
fi

# 更新图标缓存（如果存在）
if command -v gtk-update-icon-cache > /dev/null 2>&1; then
    gtk-update-icon-cache -f -t /usr/share/icons/hicolor 2>/dev/null || true
fi

exit 0

