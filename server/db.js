import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
export const dataDir = path.resolve(process.env.DATA_DIR || 'data');
mkdirSync(dataDir, { recursive: true });
const keyPath = path.join(dataDir, 'vault.key');
if (!existsSync(keyPath) && existsSync(path.join(dataDir, 'store.sqlite'))) throw new Error('数据库存在但 vault.key 丢失，请恢复密钥备份');
if (!existsSync(keyPath)) writeFileSync(keyPath, randomBytes(32), { mode: 0o600 });
const secret = readFileSync(keyPath);
export function encrypt(text) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', secret, iv);
  const payload = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), payload]).toString('base64');
}
export function decrypt(value) {
  const data = Buffer.from(value, 'base64'), decipher = createDecipheriv('aes-256-gcm', secret, data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
}
export function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
export const db = new DatabaseSync(path.join(dataDir, 'store.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',balance INTEGER NOT NULL DEFAULT 10000 CHECK(balance>=0));
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>0),units INTEGER NOT NULL,active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS inventory(id INTEGER PRIMARY KEY,product_id INTEGER NOT NULL REFERENCES products(id),secret TEXT NOT NULL,used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),product_id INTEGER NOT NULL REFERENCES products(id),name TEXT NOT NULL,category TEXT NOT NULL,amount INTEGER NOT NULL,secret TEXT NOT NULL,remaining INTEGER NOT NULL,token_hash TEXT UNIQUE,request_key TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(user_id,request_key));
CREATE TABLE IF NOT EXISTS usage(id INTEGER PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),user_id INTEGER NOT NULL REFERENCES users(id),action TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,user_id INTEGER,action TEXT NOT NULL,detail TEXT NOT NULL,created TEXT NOT NULL);
`);
export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function audit(user, action, detail) {
  db.prepare('INSERT INTO audit(user_id,action,detail,created) VALUES(?,?,?,?)').run(user, action, detail, new Date().toISOString());
}
if (!db.prepare('SELECT id FROM products LIMIT 1').get()) {
  const items = [
    ['文本分析 API','api','关键词提取、文本统计。购买后获得专属 API Key，用一个接口连接你的应用。',1900,1000],
    ['开发者工具兑换码','code','一份本地演示工具包的授权兑换码，购买后即可查看并核销。',2900,1],
    ['代码审阅体验服务','service','提交一段 JavaScript，使用内置规则检查常见问题。每份包含 10 次检查。',3900,10],
    ['文本分析 API · 进阶','api','适合持续开发与接口测试的额度包，提供 5000 次独立调用额度。',5900,5000],
    ['设计资源兑换码','code','演示设计资源包的兑换凭证，用于体验数字商品购买与交付流程。',1500,1],
    ['文档检查服务','service','检查文本字数、行数和空行。适合课程文档的快速自查，每份 20 次。',2500,20]
  ];
  items.forEach(item => {
    const id = Number(db.prepare('INSERT INTO products(name,category,description,price,units) VALUES(?,?,?,?,?)').run(...item).lastInsertRowid);
    if (item[1] === 'code') for (let i=0;i<20;i++) db.prepare('INSERT INTO inventory(product_id,secret) VALUES(?,?)').run(id,encrypt('SM-'+randomBytes(10).toString('hex').toUpperCase()));
  });
}
const demo = process.env.DEMO_MODE !== 'false';
if (process.env.NODE_ENV === 'production' && demo) throw new Error('生产环境必须设置 DEMO_MODE=false');
if (demo) {
  for (const [email,name,password,role] of [['demo@stackmint.local','演示同学','Demo12345!','user'],['admin@stackmint.local','商店管理员','Admin12345!','admin']]) {
    db.prepare('INSERT OR IGNORE INTO users(email,name,password,role) VALUES(?,?,?,?)').run(email,name,passwordHash(password),role);
  }
}
export { demo };
