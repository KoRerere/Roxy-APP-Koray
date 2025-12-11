#!/bin/bash
# 以 root 权限执行传入的命令，并输出调试日志，供 pkexec 使用

set -e

LOG_FILE="/var/log/roxybrowser-update-wrapper.log"

log() {
  echo "[wrapper][$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

log "wrapper 启动，当前用户: $(whoami)，命令: $*"

if [ $# -eq 0 ]; then
  log "未收到任何参数，直接退出"
  exit 1
fi

exec "$@"

