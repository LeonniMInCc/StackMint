#!/bin/bash
# StackMint 一致性备份：SQLite 在线快照（VACUUM INTO，自动合并 WAL）+ vault.key，
# 打包为单个受限权限归档，保留最近 14 份。
# 需要按实际环境设置以下变量（可通过 export 覆盖）。
set -u
NODE=${NODE_BIN:-node}
APP_DIR=${APP_DIR:-/opt/stackmint}
DATA=${DATA_DIR:-$APP_DIR/data}
DEST=${BACKUP_DIR:-/var/backups/stackmint}
TS=$(date +%Y%m%d_%H%M%S)
TMP=$(mktemp -d /tmp/stackmint-backup.XXXXXX)
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$DEST"
if ! "$NODE" --input-type=module -e "
import {DatabaseSync} from 'node:sqlite';
const db = new DatabaseSync('${DATA}/store.sqlite', { readOnly: true });
db.prepare('VACUUM INTO ?').run('${TMP}/store.sqlite');
db.close();
"; then
    echo "$(date '+%F %T') 数据库快照失败" >> "$APP_DIR/.aiproject/backup.log"
    exit 1
fi
cp -p "$DATA/vault.key" "$TMP/vault.key"
chmod 600 "$TMP/store.sqlite" "$TMP/vault.key"
tar -czf "$DEST/stackmint_${TS}.tar.gz" -C "$TMP" .
chmod 600 "$DEST/stackmint_${TS}.tar.gz"
ls -1t "$DEST"/stackmint_*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "$(date '+%F %T') 备份完成 stackmint_${TS}.tar.gz" >> "$APP_DIR/.aiproject/backup.log"
