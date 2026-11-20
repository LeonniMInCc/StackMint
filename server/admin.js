import { db } from './db.js';
const email=process.argv[2];
if(!email){console.error('用法：node --env-file-if-exists=.env server/admin.js 用户邮箱');process.exitCode=1;}
else {const result=db.prepare("UPDATE users SET role='admin' WHERE email=?").run(email.toLowerCase());console.log(result.changes?'该账户已设为管理员':'找不到账户，请先注册');}
db.close();
