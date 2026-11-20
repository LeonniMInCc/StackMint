import express from 'express';
import { randomBytes, createHash, timingSafeEqual, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { db, demo, encrypt, decrypt, transaction, passwordHash, audit } from './db.js';
const app = express(), port = Number(process.env.PORT || 3000), host = process.env.HOST || '127.0.0.1';
const digest = text => createHash('sha256').update(text).digest('hex');
const now = () => new Date().toISOString();
const fail = (status,message) => { const e=new Error(message);e.status=status;throw e; };
const productQuery = `SELECT p.*, (SELECT COUNT(*) FROM inventory WHERE product_id=p.id AND used=0) stock FROM products p`;
app.disable('x-powered-by');
// 仅信任本机单层 Nginx 反向代理转发的 X-Forwarded-For，使按 IP 限流能取到真实客户端地址
app.set('trust proxy', 'loopback');
app.use((req,res,next) => {
  res.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"});
  if(req.path.startsWith('/api')) res.set('Cache-Control','no-store');
  if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin !== (process.env.APP_ORIGIN || `http://localhost:${port}`) && req.headers.origin !== `http://127.0.0.1:${port}`) return res.status(403).json({message:'请求来源不被允许'});
  next();
});
app.use(express.json({limit:'24kb'}));
const buckets=new Map();
setInterval(()=>{for(const [k,v] of buckets)if(v.until<Date.now())buckets.delete(k);db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());},60000).unref();
function limit(label,max){return(req,res,next)=>{const key=label+req.ip;let b=buckets.get(key);if(!b||b.until<Date.now())b={count:0,until:Date.now()+60000};buckets.set(key,b);if(++b.count>max)return res.status(429).json({message:'操作过于频繁，请一分钟后重试'});next();};}
app.use('/api',limit('api',180));
function auth(req,res,next) {
  const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('sid='))?.slice(4);
  if(!token)return res.status(401).json({message:'请先登录'});
  const user=db.prepare('SELECT u.id,u.email,u.name,u.role,u.balance FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=? AND s.expires>?').get(digest(token),Date.now());
  if(!user)return res.status(401).json({message:'登录已过期，请重新登录'});
  req.user=user;next();
}
const admin=(req,res,next)=>req.user.role==='admin'?next():res.status(403).json({message:'需要管理员权限'});
const publicUser=u=>({id:u.id,email:u.email,name:u.name,role:u.role,balance:u.balance});
function createSession(res,id){const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),id,Date.now()+86400000);res.cookie('sid',token,{httpOnly:true,sameSite:'strict',secure:process.env.COOKIE_SECURE==='false'?false:process.env.NODE_ENV==='production',maxAge:86400000,path:'/'});}
app.get('/api/config',(req,res)=>res.json({demo}));
app.get('/api/products',(req,res)=>res.json(db.prepare(productQuery+' WHERE p.active=1 ORDER BY p.id').all()));
app.post('/api/auth/login',limit('login',12),async(req,res)=>{
  const {email,password}=req.body;if(typeof email!=='string'||typeof password!=='string'||password.length>128)fail(400,'请输入正确的邮箱和密码');
  const user=db.prepare('SELECT * FROM users WHERE email=?').get(email.trim().toLowerCase());
  const [salt,hash]=(user?.password||'missing:'+ '0'.repeat(128)).split(':');
  const computed=await promisify(scrypt)(password,salt,64);
  if(!user||!timingSafeEqual(computed,Buffer.from(hash,'hex')))fail(401,'邮箱或密码不正确');
  createSession(res,user.id);audit(user.id,'login','登录成功');res.json(publicUser(user));
});
app.post('/api/auth/register',limit('register',5),(req,res)=>{
 const {email,name,password}=req.body;
 if(typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email)||email.length>100||typeof name!=='string'||name.trim().length<2||name.length>24||typeof password!=='string'||password.length<10||password.length>128)fail(400,'昵称 2—24 字，邮箱有效，密码至少 10 位');
 if(db.prepare('SELECT id FROM users WHERE email=?').get(email.toLowerCase()))fail(409,'该邮箱已经注册');
 const id=Number(db.prepare('INSERT INTO users(email,name,password,balance) VALUES(?,?,?,?)').run(email.toLowerCase(),name.trim(),passwordHash(password),demo?10000:0).lastInsertRowid);
 createSession(res,id);res.status(201).json(publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id)));
});
app.get('/api/me',auth,(req,res)=>res.json(req.user));
app.post('/api/auth/logout',auth,(req,res)=>{const token=(req.headers.cookie||'').match(/(?:^|;\s*)sid=([^;]+)/)?.[1];if(token)db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));res.clearCookie('sid',{path:'/'});res.json({ok:true});});
function orderView(o){return {...o,secret:decrypt(o.secret),token_hash:undefined,request_key:undefined};}
app.get('/api/orders',auth,(req,res)=>res.json(db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created DESC').all(req.user.id).map(orderView)));
app.post('/api/orders',auth,limit('buy',20),(req,res)=>{
 const {productId,requestKey}=req.body;
 if(!Number.isInteger(productId)||typeof requestKey!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(requestKey))fail(400,'订单参数无效');
 const result=transaction(()=>{
  const old=db.prepare('SELECT * FROM orders WHERE user_id=? AND request_key=?').get(req.user.id,requestKey);
  if(old){if(old.product_id!==productId)fail(409,'订单请求标识已用于其他商品');return old;}
  const p=db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(productId);if(!p)fail(404,'商品已下架');
  const inv=p.category==='code'?db.prepare('SELECT * FROM inventory WHERE product_id=? AND used=0 LIMIT 1').get(p.id):null;
  if(p.category==='code'&&!inv)fail(409,'兑换码已售罄');
  if(!db.prepare('UPDATE users SET balance=balance-? WHERE id=? AND balance>=?').run(p.price,req.user.id,p.price).changes)fail(409,'演示余额不足，请选择其他商品');
  const secret=inv?decrypt(inv.secret):(p.category==='api'?'sm_live_':'SVC-')+randomBytes(24).toString('hex');
  if(inv)db.prepare('UPDATE inventory SET used=1 WHERE id=?').run(inv.id);
  const id='SM'+Date.now().toString(36).toUpperCase()+randomBytes(3).toString('hex').toUpperCase();
  db.prepare('INSERT INTO orders VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,req.user.id,p.id,p.name,p.category,p.price,encrypt(secret),p.units,p.category==='api'?digest(secret):null,requestKey,now());
  audit(req.user.id,'purchase',id);return db.prepare('SELECT * FROM orders WHERE id=?').get(id);
 });res.status(201).json(orderView(result));
});
function consume(order,text){
 return transaction(()=>{
  if(!db.prepare('UPDATE orders SET remaining=remaining-1 WHERE id=? AND remaining>0').run(order.id).changes)fail(409,'可用次数已用完');
  let result;
  if(order.category==='code')result={message:'兑换成功，演示授权已激活',license:order.id};
  else {const lines=text.split('\n');result={characters:Array.from(text).length,lines:lines.length,blankLines:lines.filter(line=>!line.trim()).length,keywords:[...new Set([...new Intl.Segmenter('zh',{granularity:'word'}).segment(text)].filter(s=>s.isWordLike).map(s=>s.segment))].slice(0,8),words:text.trim().split(/\s+/).filter(Boolean).length};if(order.category==='service')result.suggestions=[...(text.includes('var ')?['可考虑使用 let 或 const 代替 var']:[]),...(text.includes('eval(')?['避免执行动态 eval 表达式']:[]),...(!text.trim()?['请输入待检查内容']:[])];}
  db.prepare('INSERT INTO usage(order_id,user_id,action,created) VALUES(?,?,?,?)').run(order.id,order.user_id,order.category==='code'?'兑换授权':'调用服务',now());
  return {result,remaining:db.prepare('SELECT remaining FROM orders WHERE id=?').get(order.id).remaining};
 });
}
app.post('/api/orders/:id/use',auth,(req,res)=>{
 const o=db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(req.params.id,req.user.id);if(!o)fail(404,'订单不存在');
 const text=req.body.text??'';if(typeof text!=='string'||text.length>5000)fail(400,'文本最多 5000 字');if(o.category!=='code'&&!text.trim())fail(400,'请先输入要分析的文本');res.json(consume(o,text));
});
app.post('/api/v1/analyze',limit('key',60),(req,res)=>{
 const token=req.headers.authorization?.replace(/^Bearer /,'');if(!token)fail(401,'请通过 Bearer 提供 API Key');
 const o=db.prepare("SELECT * FROM orders WHERE token_hash=? AND category='api'").get(digest(token));if(!o)fail(401,'API Key 无效');
 if(typeof req.body.text!=='string'||!req.body.text.trim()||req.body.text.length>5000)fail(400,'请输入 1—5000 字文本');res.json(consume(o,req.body.text));
});
app.get('/api/usage',auth,(req,res)=>res.json(db.prepare('SELECT u.*,o.name FROM usage u JOIN orders o ON o.id=u.order_id WHERE u.user_id=? ORDER BY u.id DESC LIMIT 100').all(req.user.id)));
app.get('/api/admin',auth,admin,(req,res)=>res.json({products:db.prepare(productQuery+' ORDER BY p.id').all(),orders:db.prepare('SELECT o.id,o.name,o.amount,o.created,u.email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created DESC LIMIT 100').all(),audit:db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 100').all()}));
app.post('/api/admin/products',auth,admin,(req,res)=>{
 const {name,description,category,price,units}=req.body;
 if(typeof name!=='string'||name.trim().length<2||name.length>60||typeof description!=='string'||description.length>300||!['api','code','service'].includes(category)||!Number.isInteger(price)||price<1||price>1000000||!Number.isInteger(units)||units<1||units>100000||category==='code'&&units!==1)fail(400,'请检查商品名称、分类、价格和额度');
 const id=Number(db.prepare('INSERT INTO products(name,description,category,price,units) VALUES(?,?,?,?,?)').run(name.trim(),description,category,price,units).lastInsertRowid);audit(req.user.id,'create_product',String(id));res.status(201).json({id});
});
app.patch('/api/admin/products/:id',auth,admin,(req,res)=>{if(typeof req.body.active!=='boolean')fail(400,'状态无效');if(!db.prepare('UPDATE products SET active=? WHERE id=?').run(Number(req.body.active),req.params.id).changes)fail(404,'商品不存在');audit(req.user.id,'product_status',req.params.id);res.json({ok:true});});
app.post('/api/admin/products/:id/stock',auth,admin,(req,res)=>{
 const p=db.prepare("SELECT * FROM products WHERE id=? AND category='code'").get(req.params.id);if(!p)fail(404,'只能给兑换码商品补货');const count=req.body.count;if(!Number.isInteger(count)||count<1||count>100)fail(400,'每次补货 1—100 个');
 transaction(()=>{for(let i=0;i<count;i++)db.prepare('INSERT INTO inventory(product_id,secret) VALUES(?,?)').run(p.id,encrypt('SM-'+randomBytes(10).toString('hex').toUpperCase()));audit(req.user.id,'restock',`${p.id}: ${count}`);});res.json({ok:true});
});
app.use('/api',(req,res)=>res.status(404).json({message:'接口不存在'}));
app.use(express.static(path.resolve('dist')));
app.get('/{*path}',(req,res)=>{if(existsSync('dist/index.html'))res.sendFile(path.resolve('dist/index.html'));else res.status(503).send('请先运行 npm run build');});
app.use((err,req,res,next)=>{if(!err.status)console.error(err.message);res.status(err.status||500).json({message:err.status?err.message:'服务暂时出错，请稍后重试'});});
const server=app.listen(port,host,()=>console.log(`StackMint: http://localhost:${port} (${demo?'本地演示':'生产模式'})`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
