# 栈点 StackMint

课程项目：一间卖虚拟数字商品的小店。React + Vite 前端，Express 后端，Node.js 内置 SQLite 存储。
余额、商品、支付全部为演示性质，不接真实支付。

## 功能

- 数字集市：商品列表、分类筛选、关键词搜索
- 账户：邮箱注册 / 登录 / 退出，服务端 Session（HttpOnly Cookie）
- 购买：虚拟余额扣款，订单幂等（重复提交不重复扣费），自动交付凭证
- 资产：兑换码 / API Key / 服务额度，可在站内使用或通过 API 调用
- 使用记录：每次调用留痕，不记录用户提交的正文
- 商店管理：商品上新、上下架、兑换码补货、交易与操作审计

## 技术栈

| 层 | 选型 |
|----|------|
| 前端 | React 19、Vite、lucide-react |
| 后端 | Express 5 |
| 存储 | Node.js 内置 `node:sqlite`（WAL 模式），无需 MySQL |
| 运行时 | Node.js ≥ 24（依赖内置 SQLite） |
| 测试 | `node --test` |

## 目录结构

```
.
├── index.html                 Vite 入口
├── src/                       前端源码
├── server/
│   ├── index.js               Express 入口：安全头、限流、认证、业务接口、静态资源
│   ├── db.js                  SQLite 建表、种子商品、加解密、密码哈希、事务、审计
│   └── admin.js               命令行把已注册用户设为管理员
├── tests/integration.test.js  集成测试（独立临时数据目录与端口）
├── docs/                      项目文档
└── deploy/                    进程守护、备份、日志轮转脚本
```

## 本地运行

```bash
npm ci
npm run dev      # 前端开发服务器 + 后端
# 或
npm run build && npm start
```

本地可用 `.env.example` 复制为 `.env`：

```bash
cp .env.example .env
```

`DEMO_MODE=true` 会创建演示账户并放开初始余额，**仅限本地开发**。

## 生产部署要点

1. `npm ci && npm run build`
2. 用 `.env` 配置正式参数，`NODE_ENV=production`、`DEMO_MODE=false`
3. 反向代理到 `HOST:PORT`（默认 `127.0.0.1:3000`），不要用静态站点直接指向项目目录，
   否则 `data/`、`.env` 会被下载
4. 反向代理需透传 `Host`、`X-Real-IP`、`X-Forwarded-For`、`X-Forwarded-Proto`；
   应用已设置 `trust proxy` 为 loopback，只信任本机代理
5. `APP_ORIGIN` 必须与用户实际访问的地址完全一致（协议、域名、端口），否则写请求会被 403
6. 使用 HTTPS 时保持默认的 Secure Cookie；仅有纯 HTTP 场景才需要 `COOKIE_SECURE=false`

### 环境变量

| 变量 | 说明 |
|------|------|
| `NODE_ENV` | `production` 时为生产模式 |
| `DEMO_MODE` | `true` 创建演示账户；生产必须为 `false` |
| `HOST` / `PORT` | 监听地址与端口，默认 `127.0.0.1:3000` |
| `APP_ORIGIN` | 允许的写请求来源，例如 `https://shop.example.com` |
| `COOKIE_SECURE` | 设为 `false` 才关闭 Cookie 的 Secure 标志（仅纯 HTTP 部署） |
| `DATA_DIR` | 数据目录，存放 `store.sqlite` 与 `vault.key` |

### 数据与密钥

- `DATA_DIR/store.sqlite`：全部业务数据
- `DATA_DIR/vault.key`：凭证加密密钥。**必须与数据库成对备份**，缺失则已有凭证无法解密

### 运维脚本

`deploy/` 下三个脚本均可通过环境变量覆盖路径：

```bash
APP_DIR=/opt/stackmint \
NODE_BIN=/usr/bin/node \
DATA_DIR=/opt/stackmint/data \
BACKUP_DIR=/var/backups/stackmint \
bash deploy/backup.sh
```

- `watchdog.sh`：端口无监听且面板中项目为启用状态时拉起进程
- `backup.sh`：`VACUUM INTO` 在线快照 + `vault.key`，保留最近 14 份
- `rotate.sh`：`backend.log` 超 50MB 归档，保留 7 天

## 管理员

```bash
node --env-file-if-exists=.env server/admin.js user@example.com
```

只提升已注册用户，不设置密码。

## 测试

```bash
npm test
```

使用独立临时数据目录与端口，不会影响生产数据。

## 安全边界

- 无真实支付、无自助充值，余额由运维在服务器侧发放
- 管理员不能查看买家的完整凭证，也无改价、重置密码入口
- 密码使用 scrypt 加盐哈希，会话令牌与 API Key 仅存摘要
- 限流为单实例内存计数，重启清零
