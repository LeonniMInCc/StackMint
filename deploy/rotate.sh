#!/bin/bash
# 后端日志轮转：超过 50MB 时以 copytruncate 方式归档，归档保留 7 天
# 需要按实际环境设置 APP_DIR（可通过 export 覆盖）。
set -u
APP_DIR=${APP_DIR:-/opt/stackmint}
DIR="$APP_DIR/.aiproject"
LOG=$DIR/backend.log
MAX=$((50 * 1024 * 1024))
[ -f "$LOG" ] || exit 0
SIZE=$(stat -c%s "$LOG")
if [ "$SIZE" -gt "$MAX" ]; then
    TS=$(date +%Y%m%d_%H%M%S)
    cp "$LOG" "$DIR/backend.log.$TS"
    : > "$LOG"
    gzip -f "$DIR/backend.log.$TS"
fi
find "$DIR" -name 'backend.log.*.gz' -mtime +7 -delete
