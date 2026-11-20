import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const dir=mkdtempSync(path.join(tmpdir(),'stackmint-test-')),port=3307;
const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),DATA_DIR:dir,DEMO_MODE:'true',NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
async function call(url,body,cookie='',method=body?'POST':'GET',extra={}){const r=await fetch(`http://127.0.0.1:${port}/api${url}`,{method,headers:{'Content-Type':'application/json',Cookie:cookie,...extra},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
test('账户、购买、交付与安全边界',async t=>{
 t.after(()=>child.kill());
 for(let i=0;i<80;i++){try{await call('/config');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 assert.equal((await call('/config')).status,200,logs);
 const user=await call('/auth/login',{email:'demo@stackmint.local',password:'Demo12345!'}),cookie=user.cookie;
 assert.equal(user.status,200);
 const other=await call('/auth/register',{email:'other@test.local',name:'另一位同学',password:'Strong12345!'});
 const admin=await call('/auth/login',{email:'admin@stackmint.local',password:'Admin12345!'});
 await t.test('未登录及普通用户不能读取管理后台',async()=>{assert.equal((await call('/admin')).status,401);assert.equal((await call('/admin',null,cookie)).status,403);assert.equal((await call('/admin',null,admin.cookie)).status,200);});
 let order;
 await t.test('并发重复请求只扣一次余额',async()=>{const body={productId:1,requestKey:crypto.randomUUID()};const results=await Promise.all([call('/orders',body,cookie),call('/orders',body,cookie)]);assert.equal(results[0].status,201);assert.equal(results[0].data.id,results[1].data.id);order=results[0].data;assert.equal((await call('/me',null,cookie)).data.balance,8100);});
 await t.test('买家隔离与额度调用',async()=>{assert.equal((await call('/orders/'+order.id+'/use',{text:'test'},other.cookie)).status,404);const r=await call('/v1/analyze',{text:'你好 stackmint'},'', 'POST',{Authorization:'Bearer '+order.secret});assert.equal(r.status,200);assert.equal(r.data.remaining,999);assert.equal((await call('/usage',null,cookie)).data.length,1);});
 await t.test('兑换码只能使用一次',async()=>{const o=await call('/orders',{productId:2,requestKey:crypto.randomUUID()},cookie);assert.equal(o.status,201);assert.equal((await call('/orders/'+o.data.id+'/use',{},cookie)).status,200);assert.equal((await call('/orders/'+o.data.id+'/use',{},cookie)).status,409);});
 await t.test('余额不足与下架商品不会生成订单',async()=>{assert.equal((await call('/orders',{productId:4,requestKey:crypto.randomUUID()},cookie)).status,409);await call('/admin/products/3',{active:false},admin.cookie,'PATCH');assert.equal((await call('/orders',{productId:3,requestKey:crypto.randomUUID()},cookie)).status,404);});
 await t.test('管理员上新和补货，售罄时拒单',async()=>{const p=await call('/admin/products',{name:'测试兑换码',description:'库存边界验证',category:'code',price:100,units:1},admin.cookie);assert.equal(p.status,201);assert.equal((await call('/orders',{productId:p.data.id,requestKey:crypto.randomUUID()},cookie)).status,409);await call(`/admin/products/${p.data.id}/stock`,{count:1},admin.cookie);const a=await Promise.all([call('/orders',{productId:p.data.id,requestKey:crypto.randomUUID()},cookie),call('/orders',{productId:p.data.id,requestKey:crypto.randomUUID()},other.cookie)]);assert.deepEqual(a.map(x=>x.status).sort(),[201,409]);});
 await t.test('拒绝跨站写请求和错误凭证',async()=>{assert.equal((await call('/orders',{productId:1,requestKey:crypto.randomUUID()},cookie,'POST',{Origin:'https://evil.invalid'})).status,403);assert.equal((await call('/v1/analyze',{text:'abc'},'','POST',{Authorization:'Bearer invalid'})).status,401);});
 await t.test('数据库中密码、会话和交付凭证不以明文保存',async()=>{const db=new DatabaseSync(path.join(dir,'store.sqlite'));assert.notEqual(db.prepare('SELECT secret FROM orders WHERE id=?').get(order.id).secret,order.secret);assert(!db.prepare('SELECT password FROM users WHERE id=1').get().password.includes('Demo12345!'));assert(!db.prepare('SELECT token FROM sessions LIMIT 1').get().token.includes(cookie.slice(4)));db.close();});
 await t.test('退出后会话失效',async()=>{await call('/auth/logout',{},cookie);assert.equal((await call('/me',null,cookie)).status,401);});
});
