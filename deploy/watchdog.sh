#!/bin/bash
# StackMint 进程守护：仅在 Node 服务端口无监听、且面板中该项目为启用状态时，
# 通过面板 AI 项目接口拉起，避免与面板重复占用同一端口。
# 需要按实际环境设置以下变量（可通过 export 覆盖）。
set -u
PORT=${PORT:-3000}
PROJECT=${PROJECT_NAME:-stackmint}
APP_DIR=${APP_DIR:-/opt/stackmint}
PY=${BT_PYTHON:-/www/server/panel/pyenv/bin/python}
AI_SITE=${AI_SITE_PY:-/www/server/panel/data/agent/skills/btpanel/btpanel_ai_site/scripts/ai_site.py}
LOG="$APP_DIR/.aiproject/daemon.log"

if ss -ltn 2>/dev/null | grep -q "127\.0\.0\.1:${PORT} "; then
    exit 0
fi

STAT=$("$PY" "$AI_SITE" stat --project_name "$PROJECT" 2>/dev/null)
if ! printf '%s' "$STAT" | grep -q '"status": "1"'; then
    exit 0
fi

echo "$(date '+%F %T') 端口 ${PORT} 未监听，调用面板启动" >> "$LOG"
"$PY" "$AI_SITE" start --project_name "$PROJECT" >> "$LOG" 2>&1
