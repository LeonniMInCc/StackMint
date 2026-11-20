# StackMint 项目交接给 Hermes

更新时间：2026-11-10（Asia/Shanghai）
交接原因：用户受额度限制，明确要求停止当前开发，后续交给 Hermes。本文是开发状态说明，不代表项目已经最终交付。

## 1. 用户目标与边界

用户课程期末项目要求综合运用 HTML、CSS、JavaScript、React、Node.js，完整可运行、界面美观、功能稳定，能课堂公开演示、回答问题并现场修改代码。截止日：2026-11-18。

选题已确认：数字商品交易平台，卖 API 调用额度、兑换码、数字服务；不是加密货币交易、股票或真实资金交易系统。重点是美观、易用、完整业务闭环，可适当加入安全架构，不追求大而全。

先完成本地工程，再考虑用户自有云服务器，域名 example.com。未获得服务器凭据，未配置 DNS、HTTPS 或部署；不要声称已上线。

用户希望注释少而简洁，代码清晰自然。需要详细的业务逻辑/代码逻辑知识书，小白可理解，覆盖答辩问题和现场修改练习。需要完整项目代码和详细实验报告，报告包含实验目标、内容、工具平台、需求、架构、核心模块/关键问题及解法、重要代码、总结。

课程原文明确“拒绝 AIGC 技术生成代码”。此前已向用户说明：本工程含 AI 生成代码，不满足该条款，不得声称完全由学生独立手写、不得用减少注释掩盖来源。README 已保留真实说明。继续帮助时不要伪造独立开发经历或测试结果。

## 2. 工程位置与技术栈

项目：D:\codex_about\stackmint
工作区：D:\codex_about
不要修改、删除工作区其他课程作业。

项目名称：栈点 StackMint。React SPA + Express 5 + Node 内置 SQLite + Vite。无外部 API 依赖、无真实支付。
当前环境：Windows PowerShell；Node 26.7.0、npm 12.1.0；package.json 要求 Node >=24。
当前依赖（以 package-lock.json 为准）：React/react-dom 19.3.1、Express 5.3.0、lucide-react 1.71.0、Vite 8.3.7。

文件：
- index.html：Vite入口。
- src/main.jsx：React主界面。api/send请求封装；App状态、页面切换、商品、登录注册、订单、试用、后台和弹窗。
- src/style.css：淡紫与浅灰风格，固定侧栏、商品卡片、模态框、管理表格。
- server/db.js：SQLite建表、演示数据、加解密、密码哈希、事务工具、审计。
- server/index.js：Express入口、中间件、认证、所有业务接口、静态dist服务。
- server/admin.js：本地命令行将已有注册用户设为管理员。
- server/README.md：后端模块导读。
- tests/integration.test.js：真实HTTP + SQLite集成测试，用独立临时数据目录，端口3307。
- package.json / package-lock.json：依赖、构建、启动与测试。
- .env.example：本地环境变量样例；.env尚未创建。
- .gitignore：忽略node_modules、dist、data、.env和日志。
- start-local.cmd：Windows安装依赖、构建、启动脚本。
- README.md：已有基本运行与功能说明。
- docs/：已创建但当前为空！README链接的答辩知识书、实验报告、部署说明还不存在，需要补齐。
- data/：当前真实本地演示运行数据，不是源码。
- dist/：已构建前端。

## 3. 当前运行状态

交接时 http://localhost:3000/api/config 返回 {"demo":true}，说明本地服务仍在运行。用户已在侧栏浏览器看到该地址。

后台由 Start-Process 启动 node server/index.js，WindowStyle Hidden。输出日志：
- D:\codex_about\stackmint-local.log
- D:\codex_about\stackmint-error.log

启动时间早于最后一次后端源码修改，所以运行中的进程没有加载最后两项后端修改：
1. db.js：已有数据库但缺少 vault.key 时拒绝启动，而不是静默生成错误的新密钥。
2. index.js：文本结果中加入 blankLines 空行计数。

这两项源码已写入，但还没重启验证，也没有在改完后重新跑 npm test。package.json新增.env支持和server/admin.js、start-local.cmd也尚未验证。

不要随意杀掉所有node进程。先查询监听3000端口的具体PID并验证命令行确为此工程，再只重启该服务。保留数据库，不要为了获得空白页面删除data。

正常运行：
```sh
cd D:\codex_about\stackmint
npm ci
npm run build
npm start
```
开发后端可 npm run dev（node --watch），前端修改仍需 npm run build；当前未实现Vite热更新开发代理。

演示账号：
- 用户 demo@stackmint.local / Demo12345!
- 管理员 admin@stackmint.local / Admin12345!
- 新注册账户在DEMO_MODE=true时得到10000分=¥100.00演示余额。

浏览器端到端测试用演示用户买了一份19元API包并成功调用一次：该账户应余额81元、订单1份、额度999次。不要将这种测试数据误认为Bug。没有最终压缩包。

## 4. 已实现的业务

访客：浏览、搜索、按api/code/service分类筛选6个初始商品。
账户：注册、登录、退出，HTTP-only Cookie会话。普通用户与管理员角色区分。
购买：确认弹窗显示交付内容和价格；使用演示余额；服务器读取价格而非信任前端传价；事务扣余额、分配兑换码/生成token、创建订单、审计。
订单：本人订单列表、凭证查看复制、余额/额度/消费汇总。
API：每订单生成独立token，可用Bearer调用POST /api/v1/analyze；网页也有试用入口。统计字数、行数、空行、空白分词数量、Intl.Segmenter分出的前8个不同词（不是按重要性排序的专业关键词提取）。
兑换码：库存凭证一次发放，购买后可核销一次；不会真的激活外部商业软件。
数字服务：本地文本统计和少量代码字符串规则（var/eval提示），不是AI审核或完整代码安全分析。所有service当前共用这套规则。
使用记录：最近100条调用与兑换，不存用户提交的文本内容。
管理员：新增商品、上下架、兑换码补货、最近100笔订单和审计。后台订单不返回完整交付凭证。

不要增加真实付款、购物车、优惠券、退款、短信、微服务等无关功能，除非用户新要求。

## 5. 后端结构与接口

数据库表：users / sessions / products / inventory / orders / usage / audit。
金额单位为分，INTEGER；余额有CHECK>=0。
商品分类：api、code、service；价格正整数；code单位固定1。
orders同时保存商品名称、分类和购买时金额快照。
订单request_key在(user_id,request_key)上唯一。重复购买请求返回原订单；不同商品重复使用同一key返回冲突。
transaction(fn)用BEGIN IMMEDIATE/COMMIT/ROLLBACK，fn必须同步，不可在其中await外部网络调用。
consume(order,text)统一扣减额度和插入使用记录；remaining>0条件更新防负数。

公开：
- GET /api/config：是否演示环境
- GET /api/products：已上架商品及code可用库存
- POST /api/auth/register、/login
- POST /api/v1/analyze：Bearer API Key，无需Cookie

登录：
- GET /api/me
- POST /api/auth/logout
- GET /api/orders
- POST /api/orders：{productId,requestKey}
- POST /api/orders/:id/use：{text}；code可空对象
- GET /api/usage

管理员（先auth再admin）：
- GET /api/admin
- POST /api/admin/products：name/description/category/price(分)/units
- PATCH /api/admin/products/:id：{active:boolean}
- POST /api/admin/products/:id/stock：{count:1..100}

错误返回JSON {message}，400输入错误、401登录问题、403权限/来源问题、404不存在、409余额库存/额度冲突、429频率限制。

## 6. 已有安全措施与边界

已实现：
- 密码随机盐+scrypt，不明文保存。
- 会话随机token，数据库仅存SHA-256摘要，24小时过期。
- Cookie HttpOnly、SameSite=Strict；NODE_ENV=production时Secure。
- 后端认证与角色校验；本人订单查询同时限制id+user_id，防横向越权。
- 参数化SQL；React默认转义；不用危险HTML注入显示用户输入。
- 对购买使用事务及幂等key，库存/余额/额度条件更新。
- 交付凭证AES-256-GCM加密，API查找只存token摘要。
- 安全头CSP、X-Frame-Options、nosniff、Referrer-Policy。
- 写请求Origin校验（无Origin的命令行请求允许）；同源部署，无CORS开放。
- JSON请求体24KB限制，文本5000字上限；按IP内存限流。
- 只在本人订单响应解密凭证；API响应no-store；不日志记录秘密。
- 生产模式如果DEMO_MODE没有明确false则拒绝启动。

限制/待审查：
- 密钥与数据库同在data目录，防的是数据库单独泄露，不防整个服务器文件系统失陷。需一起离线备份，不能丢vault.key。
- 如果直接把现有演示数据库复制到生产并设置DEMO_MODE=false，既有演示用户仍存在！目前未实现生产环境检查默认演示账号残留。必须处理，不能宣称生产已安全。
- 默认APP_ORIGIN固定localhost。未来HTTPS域名、代理可信范围、按真实IP限流要重新配置。不要随便app.set('trust proxy',true)。
- 限流在内存，单实例适用，重启会清零；不是集群级防护。
- 注册hash使用同步scrypt且SQLite同步；小型课程规模合适，不声称高并发平台。
- 使用接口没有幂等键：重试会再扣额度，应在文档说明，或者后续按实际需要补幂等。
- 管理员没有浏览器改价、改名、改密/重置密码入口，仅上新/上下架/补货。
- 管理审计只是数据库记录，不是不可篡改审计系统。
- 前端多个模态框尚未实现完善焦点圈定/回归；错误与loading处理可继续检查。
- 后台统计来自最近100笔订单，不是全量历史总额，页面已标“近期”。
- 没有真实支付，没有用户自助充值；生产模式新注册余额0，未来如何给演示/正式账户充值需要确定。

## 7. 已执行的验证，不要夸大

npm依赖安装完成，安装时audit报告0漏洞；这不是安全审计结论。
npm run build成功。lucide-react模块的use client在Vite构建有警告，不影响当前SPA构建。
node --check server/index.js通过（最后的blankLines改动后未重新检查）。

npm test：10项通过（总测试1+子测试9），覆盖：
1 未登录和普通用户不能读管理后台。
2 同一requestKey并发请求只生成一个订单、扣一次余额。
3 其他用户不能使用该订单，Bearer API调用扣额度并写日志。
4 兑换码只能核销一次。
5 余额不足和已下架商品拒单。
6 管理员新增/补货，最后一个库存被两个不同订单并发购买时仅一个成功。
7 跨站Origin请求和错误API凭证被拒绝。
8 数据库存储不含明文密码/会话/交付凭证。
9 退出后会话失效。

Playwright真实浏览器验证（系统Python安装了playwright，Edge路径如下）：
C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe

已走完：商店加载 → 登录演示用户 → 买API → 查看凭证 → 文本试用成功 → 使用记录显示调用；无pageerror。
截图：
- D:\codex_about\stackmint-store.png：已目视检查的完整商店首页。
- D:\codex_about\stackmint-asset.png：资产试用结果。

还没做：完整管理员浏览器演练、注册浏览器流程、冷启动解压包验证、长时间稳定性/并发压测、部署验证。不能写成全部测试通过。

## 8. Hermes接手后的推荐顺序

1. 先读README、server/README和源码，确认当前进程状态。不重建项目、不覆盖数据、不重复安装已有依赖。
2. 运行npm test和npm run build；重启仅本工程服务加载最新源码。确认浏览器流程保持正常。
3. 检查上述安全/功能限制，修复真正影响本地演示的缺陷；避免扩大范围。
4. 演练管理员新增、补货、上下架；普通用户注册、缺余额、售罄与重复使用的界面提示。补必要测试，不机械重复所有检查。
5. 编写docs/答辩知识书.md：要求见下一节。
6. 编写docs/实验报告.md，覆盖课程所列8个部分。当前只有README，没有报告。需要docx/pdf时再按对应文档技能生成并渲染检查，不能只改后缀。
7. 写docs/部署准备.md，讲清部署前需要HTTPS、关闭演示账号、初始化管理员、安全备份、进程守护、反向代理和日志。不在缺少服务器授权/信息时实际部署。
8. 更新README，所有链接必须存在。准备完整源码压缩包：包含源码、lockfile、tests、docs、.env.example；排除node_modules、data、.env、日志和私钥。是否包含dist可自行选择，README必须匹配。
9. 在新临时目录解压后npm ci/build/start验证，避免遗漏文件；交付本地URL、源码目录、知识书、报告与ZIP，说明限制与未部署状态。

## 9. 知识书具体要求

面向新手，但必须对应真实源码，不要泛泛背概念。

建议章节：
- 五分钟演示路线：访客商品 → 注册/登录 → 买API → 查看资产 → 调用 → 用量 → 管理员上新/下架。
- 用“商店/仓库/收银台/门禁”类比React、Express、SQLite、认证，但给出准确术语。
- 一个购买请求从点击到数据库和React更新的全过程，标出api/send、auth、transaction、orderView、refresh。
- 文件地图，说明每个文件谁调用谁；前端状态user/page/products/orders/modal/busy/error的作用。
- 表关系及金额单位，区分商品库存、订单额度、余额。
- 登录、Cookie、哈希、加密的区别；为什么密码不能解密，而交付凭证需要解密。
- SQL事务与幂等为什么都需要；“双击购买”和“两个买家抢最后一个码”是不同问题。
- API Key与网页登录Cookie的区别；使用curl或PowerShell调用示例。
- 同源、CSRF、XSS、SQL注入、水平/垂直越权、限流的已实现措施及局限。
- 常见错误定位：端口占用、Node版本不支持node:sqlite、未build、401/403/409/429、密钥缺失。
- 答辩问题与实事求是答案，尤其“原创/AIGC”问题不能伪造过程。
- 现场改代码练习：新注册余额100改50；新增商品分类涉及前后端哪些地方；额度上限改动；给商品加字段怎样迁移数据库；变更登录会话时长；说明各自测试方式。
- 不要把“高并发、高可用、商用支付安全”当作当前已达成能力。

## 10. 环境工具与操作注意

之前普通exec在Windows沙箱中多次出现helper_unknown_error，实际开发用require_escalated通过自动审核执行。不要为了绕过拒绝改走其他通道；按环境可用权限正常使用。

当前文件编辑多用PowerShell here-string写入UTF-8，注意引号和中文编码。需要读取源码优先rg；不要在输出里打印data/vault.key、已有订单完整secret或Cookie。

该工程没有主动初始化Git，尚未检查工作区是否存在父Git；不要声称已有提交记录。

用户这条消息只是要求交接，应完成本文后停止开发。不需要自动给其他聊天发消息，也不要假装已向Hermes发送了文件；用户会自行交付。
## 2026-11-13 接续更新

前端已改为社区式商品列表，参考NodeLoc的分类与列表组织方式，新增原创SVG像素猫。代码位于src/main.jsx与src/community.css，旧前端备份src/main.before-community.jsx.bak。没有复制NodeLoc源码或帖子。

npm run build与npm test再次通过（10项计数含父测试）；浏览器验证目录、分类、搜索、登录和购买确认。docs/答辩知识书.md、docs/实验报告.md、docs/部署准备.md已创建，之前“docs为空”的交接状态已过期。尚未部署云服务器，原有生产安全限制仍需处理。
