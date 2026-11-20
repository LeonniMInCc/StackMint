#!/usr/bin/env node
// 手工发放演示余额：事务内更新 users.balance 并写入 audit 审计记录。
// 用法：sudo -u www node --env-file-if-exists=.env deploy/grant_balance.cjs --email <邮箱> --amount <元> [--note 说明] [--dry-run]
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const email = arg('email');
const amountYuan = Number(arg('amount'));
const note = arg('note', '手工发放');
const dryRun = process.argv.includes('--dry-run');

if (!email || !Number.isFinite(amountYuan) || amountYuan <= 0) {
  console.error('用法: node deploy/grant_balance.cjs --email <邮箱> --amount <元> [--note 说明] [--dry-run]');
  process.exit(2);
}

const cents = Math.round(amountYuan * 100);
if (cents <= 0 || cents > 100000000) {
  console.error('金额超出允许范围（0.01 — 1000000 元）');
  process.exit(2);
}

const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'store.sqlite');
if (!fs.existsSync(dbPath)) {
  console.error('找不到数据库: ' + dbPath);
  process.exit(2);
}

const db = new DatabaseSync(dbPath);
db.exec('BEGIN IMMEDIATE');
try {
  const u = db.prepare('SELECT id,email,name,balance,role FROM users WHERE email=?').get(email);
  if (!u) throw new Error('用户不存在，请先在网站注册该邮箱: ' + email);
  if (dryRun) {
    db.exec('ROLLBACK');
  } else {
    db.prepare('UPDATE users SET balance=balance+? WHERE id=?').run(cents, u.id);
    db.prepare('INSERT INTO audit(user_id,action,detail,created) VALUES(?,?,?,?)')
      .run(u.id, 'admin_grant', '+' + amountYuan.toFixed(2) + ' 元（' + note + '）', new Date().toISOString());
    db.exec('COMMIT');
  }
  console.log(JSON.stringify({
    dryRun,
    邮箱: u.email,
    昵称: u.name,
    角色: u.role,
    原余额: (u.balance / 100).toFixed(2),
    增加: amountYuan.toFixed(2),
    新余额: ((u.balance + cents) / 100).toFixed(2),
    已写入: !dryRun
  }, null, 2));
} catch (e) {
  try { db.exec('ROLLBACK'); } catch {}
  console.error('失败（已回滚，余额未变）: ' + e.message);
  process.exit(1);
}
