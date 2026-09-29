import {validatePerson} from '../family-registry/core.mjs';
const encoder=new TextEncoder();
export const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
export async function digest(value){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)))}
export async function passwordHash(password,salt){
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256));
}
function equal(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
function fail(status,error){throw Object.assign(new Error(error),{status})}
const publicUser=u=>({id:u.id,name:u.name,username:u.username,role:u.role,regions:JSON.parse(u.regions),enabled:u.enabled});
export function authorizeRegion(user,region){if(!['quds','jordan'].includes(region))fail(400,'اختر القدس أو الأردن.');if(!JSON.parse(user.regions).includes(region))fail(403,'ليس لديك صلاحية لهذه العائلة.')}
async function jsonBody(req){const reader=req.body?.getReader();if(!reader)fail(400,'طلب غير صالح.');const decoder=new TextDecoder();let text='',size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>12000){await reader.cancel();fail(413,'حجم الطلب كبير.')}text+=decoder.decode(value,{stream:true})}text+=decoder.decode();try{const b=JSON.parse(text);if(!b||Array.isArray(b)||typeof b!=='object')throw 0;return b}catch{fail(400,'طلب غير صالح.')}}
async function all(db,sql,...params){return (await db.prepare(sql).bind(...params).all()).results}
async function rateLimit(db,key,now,max){
 const k=key+':'+Math.floor(now/600);
 const r=await db.prepare('INSERT INTO login_limits(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(k,now+600).first();
 if(r.attempts>max)fail(429,'محاولات كثيرة. انتظر عشر دقائق ثم حاول مجددًا.');
}
async function handle(req,env){
 const url=new URL(req.url),path=url.pathname.replace(/^\/api\//,''),now=Math.floor(Date.now()/1000);
 if(path==='health'&&req.method==='GET')return {ok:true,service:'family-registry'};
 if(path==='login'&&req.method==='POST'){
  const b=await jsonBody(req);if(typeof b.username!=='string'||typeof b.password!=='string'||b.username.length>60||b.password.length>200)fail(400,'بيانات الدخول غير صحيحة.');
  const username=b.username.trim().normalize('NFKC');
  await rateLimit(env.AUTH_DB,'ip:'+await digest(req.headers.get('CF-Connecting-IP')||'unknown'),now,30);
  await rateLimit(env.AUTH_DB,'user:'+await digest(username),now,10);
  const user=await env.AUTH_DB.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
  const hash=await passwordHash(b.password,user?.salt||'missing-user-dummy-salt');
  if(!user||!user.enabled||!equal(hash,user.password_hash))fail(401,'اسم المستخدم أو كلمة المرور غير صحيحة.');
  const token=hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.AUTH_DB.batch([
   env.AUTH_DB.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(now),
   env.AUTH_DB.prepare('DELETE FROM login_limits WHERE expires_at<=?').bind(now),
   env.AUTH_DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),user.id,now+7200)
  ]);
  return {token,user:publicUser(user)};
 }
 const token=req.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!token)fail(401,'يرجى تسجيل الدخول.');
 const tokenHash=await digest(token);
 const user=await env.AUTH_DB.prepare('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND u.enabled=1').bind(tokenHash,now).first();
 if(!user)fail(401,'انتهت الجلسة. سجّل الدخول مجددًا.');
 if(path==='logout'&&req.method==='POST'){await env.AUTH_DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(tokenHash).run();return {ok:true}}
 const region=url.searchParams.get('region');authorizeRegion(user,region);
 const db=region==='quds'?env.QUDS_DB:env.JORDAN_DB;
 const row=await db.prepare('SELECT revision,data FROM registry WHERE id=1').first();if(!row)fail(503,'لم تكتمل تهيئة سجل هذه العائلة.');
 const data=JSON.parse(row.data);
 if(data.people.some(p=>p.region!==region))fail(503,'عدم تطابق نطاق قاعدة البيانات.');
 if(path==='data'&&req.method==='GET'){
  const response={...data,user:publicUser(user),users:[],audit:user.role==='admin'?data.audit:[]};
  if(user.role==='viewer')response.people=data.people.filter(p=>!p.archived).map(p=>{const {phone,email,notes,duesPaid,duesRemaining,duesRequired,...safe}=p;return safe});
  if(user.role==='admin')response.users=(await all(env.AUTH_DB,'SELECT id,name,username,role,regions,enabled FROM users')).filter(u=>JSON.parse(u.regions).every(r=>JSON.parse(user.regions).includes(r))).map(publicUser);
  return response;
 }
 const b=await jsonBody(req);
 if(path==='users'&&req.method==='POST'){
  if(user.role!=='admin')fail(403,'للمدير فقط.');
  const scopes=b.regions||[region];
  if(!Array.isArray(scopes)||!scopes.length||scopes.some(r=>!['quds','jordan'].includes(r)||!JSON.parse(user.regions).includes(r)))fail(403,'نطاق غير مسموح.');
  if(!['admin','editor','viewer'].includes(b.role)||typeof b.name!=='string'||!b.name.trim()||b.name.length>80||typeof b.username!=='string'||!b.username.trim()||b.username.length>60||typeof b.password!=='string'||b.password.length<12||b.password.length>200)fail(400,'تحقق من الاسم وكلمة مرور من 12 حرفًا على الأقل.');
  const salt=hex(crypto.getRandomValues(new Uint8Array(16))),id=crypto.randomUUID();
  try{await env.AUTH_DB.prepare('INSERT INTO users(id,name,username,role,regions,salt,password_hash) VALUES(?,?,?,?,?,?,?)').bind(id,b.name.trim(),b.username.trim().normalize('NFKC'),b.role,JSON.stringify([...new Set(scopes)]),salt,await passwordHash(b.password,salt)).run()}catch{fail(409,'تعذر إنشاء الحساب؛ قد يكون اسم المستخدم موجودًا.')}
  return {ok:true};
 }
 if(path.startsWith('users/')&&req.method==='PUT'){
  if(user.role!=='admin')fail(403,'للمدير فقط.');const id=path.slice(6);if(id===user.id)fail(400,'لا يمكنك تعطيل حسابك.');
  const target=await env.AUTH_DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();if(!target)fail(404,'الحساب غير موجود.');
  if(!JSON.parse(target.regions).every(r=>JSON.parse(user.regions).includes(r)))fail(403,'الحساب خارج نطاق صلاحياتك.');
  if(b.enabled!==0&&b.enabled!==1)fail(400,'حالة الحساب غير صحيحة.');
  await env.AUTH_DB.batch([env.AUTH_DB.prepare('UPDATE users SET enabled=? WHERE id=?').bind(b.enabled,id),env.AUTH_DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id)]);return {ok:true};
 }
 if(!['admin','editor'].includes(user.role))fail(403,'الحساب للقراءة فقط.');
 let action='';
 if(path==='branches'&&req.method==='POST'){
  const name=typeof b.name==='string'?b.name.trim():'';if(!name||name.length>80||data.branches.includes(name))fail(400,'اسم الفخذ غير صالح أو مكرر.');data.branches.push(name);action='إضافة فخذ';
 }else if(path==='members'&&req.method==='POST'||/^members\/[^/]+$/.test(path)&&req.method==='PUT'){
  const id=path==='members'?region+'-'+Date.now()+Math.floor(Math.random()*1000):path.split('/')[1];
  const old=data.people.find(p=>p.id===id);if(path!=='members'&&!old)fail(404,'الفرد غير موجود.');if(old&&b.version!==old.version)fail(409,'تم تحديث الملف؛ أعد تحميله قبل التعديل.');
  const clean={};for(const k of ['firstName','fatherName','grandName','branch','gender','birthYear','deathYear','life','marital','parentId','city','profession','education','phone','email','notes']){if(typeof b[k]!=='string'||b[k].length>(k==='notes'?2000:150))fail(400,'حقول الملف غير صحيحة.');clean[k]=b[k].trim()}
  if(clean.life==='alive')clean.deathYear='';
  const errors=validatePerson({...clean,region},data.people,data.branches,id);if(errors.length)fail(400,errors.join(' '));
  const person={...old,...clean,id,region,version:(old?.version||0)+1,archived:old?.archived||0,updatedAt:new Date().toISOString()};
  if(old)Object.assign(old,person);else data.people.unshift(person);action=old?'تعديل فرد':'إضافة فرد';
 }else if(/^members\/[^/]+\/archive$/.test(path)&&req.method==='POST'){
  const p=data.people.find(p=>p.id===path.split('/')[1]);if(!p)fail(404,'الفرد غير موجود.');if(b.version!==p.version)fail(409,'تغير الملف؛ أعد تحميله.');
  if(b.archived!==0&&b.archived!==1)fail(400,'حالة غير صحيحة.');
  if(b.archived&&data.people.some(c=>!c.archived&&c.parentId===p.id))fail(409,'الفرد مرتبط بأبناء نشطين.');
  if(!b.archived&&p.parentId&&!data.people.some(a=>a.id===p.parentId&&!a.archived))fail(409,'استعد ملف الأب أولًا.');
  p.archived=b.archived;p.version++;p.updatedAt=new Date().toISOString();action=b.archived?'أرشفة فرد':'استعادة فرد';
 }else fail(404,'المسار غير موجود.');
 data.audit.unshift({action,actor:user.name,createdAt:new Date().toISOString()});data.audit=data.audit.slice(0,100);
 const serialized=JSON.stringify(data);if(encoder.encode(serialized).length>900000)fail(413,'بلغ السجل حد التخزين الحالي.');
 const saved=await db.prepare('UPDATE registry SET data=?,revision=revision+1 WHERE id=1 AND revision=?').bind(serialized,row.revision).run();
 if(saved.meta.changes!==1)fail(409,'تم تعديل السجل بواسطة مشرف آخر؛ أعد التحميل ثم حاول مجددًا.');
 return {ok:true};
}
export default {async fetch(req,env){
 const origin=req.headers.get('Origin');const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Origin'};
 if(origin===env.ALLOWED_ORIGIN)headers['Access-Control-Allow-Origin']=origin;
 if(origin&&origin!==env.ALLOWED_ORIGIN)return new Response(JSON.stringify({error:'Origin not allowed'}),{status:403,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'}});
 try{return new Response(JSON.stringify(await handle(req,env)),{headers})}catch(e){return new Response(JSON.stringify({error:e.status?e.message:'تعذر إتمام العملية الآن.'}),{status:e.status||500,headers})}
}};
