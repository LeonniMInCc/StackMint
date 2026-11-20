# 后端导读

先读 db.js：建表 → 种子商品 → 演示账户 → 导出数据库工具。再读 index.js：安全头 → JSON解析 → 限流 → 认证 → 业务路由 → 静态文件 → 错误处理。

- auth：用 Cookie 查会话，再拿到数据库里的用户角色。后续业务只信 req.user，不信客户端自报用户ID。
- admin：管理员权限校验。前端隐藏按钮不是权限控制。
- transaction：BEGIN IMMEDIATE / COMMIT / ROLLBACK。函数必须是同步的，不能在里面 await 外部接口。
- orderView：只在授权的本人订单响应中解密凭证。
- consume：原子扣次数、执行业务规则、写使用记录。API Key调用和网页试用复用它。
- audit：记录操作类型与订单/商品ID，不把密码或凭证写进日志。

当前规模采用一个后端入口文件，便于课堂顺着请求讲解。若系统扩展，可以把 auth、orders、admin 路由分别移到 routers，把 consume 移到 services；不要为了目录数量先引入复杂抽象。
