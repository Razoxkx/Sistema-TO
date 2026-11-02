import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/app.js';
import { createRepository } from '../server/db.js';
import { hashPassword, verifyPassword } from '../server/passwords.js';
import { emptyClinicalRecord } from '../shared/clinical-fields.js';
const origin='http://localhost:5173';const lan='http://192.168.1.8:5173';
const password='Prueba local ficticia 2026';const newPassword='Otra contraseña ficticia 2026';
const post=(agent,path,body,source=lan)=>agent.post(path).set('Origin',source).send(body);
const put=(agent,path,body,source=lan)=>agent.put(path).set('Origin',source).send(body);
function setup(overrides={}) {
 const users=new Map();const sessions=new Map();let seq=0;
 const repository={
  findSession:async token=>sessions.get(token),deleteSession:async token=>sessions.delete(token),createSession:async(id,token)=>{const user=users.get(id);sessions.set(token,{id:user.id,name:user.name,email:user.email,picture:null});},
  createLocalUser:async data=>{if([...users.values()].some(user=>user.email===data.email))throw Object.assign(new Error('duplicate'),{code:'ACCOUNT_EXISTS'});const user={...data,id:String(++seq),localEmail:data.email};users.set(user.id,user);return user;},
  findLocalUser:async email=>[...users.values()].find(user=>user.localEmail===email),
  localAccount:async id=>{const user=users.get(id);return user&&{localEmail:user.localEmail,passwordHash:user.passwordHash};},
  setLocalPassword:async(id,email,hash,previous,token)=>{const user=users.get(id);if(user.passwordHash!==previous)return false;user.localEmail=email;user.passwordHash=hash;return true;},
  listRecords:async()=>({records:[],total:0,page:1,pageSize:20}),
 };
 const config={origin,allowedOrigins:[lan],localAuthEnabled:true,clientId:'',sessionSecret:'test-secret-at-least-thirty-two-characters',production:false,allowedEmails:[],...overrides};
 const app=createApp({repository,config,verifyGoogle:async()=>{throw new Error('Google not used');}});
 return {app,users,sessions};
}
test('contraseñas: hashes con sal distinta y verificación sin guardar texto original',async()=>{
 const a=await hashPassword(password);const b=await hashPassword(password);assert.notEqual(a,b);assert.ok(!a.includes(password));assert.equal(await verifyPassword(password,a),true);assert.equal(await verifyPassword('incorrecta',a),false);assert.equal(await verifyPassword(password,null),false);
});
test('registro e ingreso local funcionan sin Google y solo desde orígenes explícitos',async()=>{
 const s=setup();const a=request.agent(s.app);
 const settings=await a.get('/api/auth/config').expect(200);assert.deepEqual(settings.body,{enabled:false,localEnabled:true});
 const data={name:'Terapeuta de prueba',email:' LOCAL@EXAMPLE.COM ',password};
 await post(a,'/api/auth/register',data,'http://192.168.1.9:5173').expect(403);
 await a.post('/api/auth/register').send(data).expect(403);
 const registered=await post(a,'/api/auth/register',data).expect(201);
 assert.equal(registered.body.user.email,'local@example.com');assert.equal(registered.body.user.passwordHash,undefined);assert.equal(registered.body.user.password,undefined);
 assert.match(registered.headers['set-cookie'].find(cookie=>cookie.startsWith('espacio_session=')&&cookie.includes('Path=/api;')),/HttpOnly/);
 assert.equal((await a.get('/api/auth/me')).body.user.id,registered.body.user.id);
 await post(a,'/api/auth/logout',{}).expect(200);
 await post(a,'/api/auth/local',{email:'local@example.com',password:'equivocada'}).expect(401);
 const missing=await post(a,'/api/auth/local',{email:'otro@example.com',password}).expect(401);
 assert.equal(missing.body.error,'Correo o contraseña incorrectos.');
 const signed=await post(a,'/api/auth/local',{email:'local@example.com',password}).expect(200);assert.equal(signed.body.user.id,registered.body.user.id);
 await a.get('/api/usuarios').expect(200);
 await post(a,'/api/auth/register',{...data,email:'local@example.com'}).expect(409);
});
test('registro valida campos, restricción de correos y configuración deshabilitada',async()=>{
 const s=setup();
 for(const patch of [{name:''},{email:'mal'},{password:'corta'},{password:'x'.repeat(129)},{name:'x'.repeat(101)}])assert.ok((await post(request(s.app),'/api/auth/register',{name:'Prueba',email:'test@example.com',password,...patch}).expect(400)).body.fields);
 const disabled=setup({localAuthEnabled:false});await post(request(disabled.app),'/api/auth/register',{name:'Prueba',email:'test@example.com',password}).expect(503);
 const restricted=setup({allowedEmails:['permitido@example.com']});await post(request(restricted.app),'/api/auth/register',{name:'Prueba',email:'otro@example.com',password}).expect(403);
});
test('cambio de contraseña exige sesión y contraseña actual; no acepta modificaciones anónimas',async()=>{
 const s=setup();const a=request.agent(s.app);
 await put(a,'/api/auth/local-account',{password:newPassword}).expect(401);
 await post(a,'/api/auth/register',{name:'Prueba',email:'test@example.com',password}).expect(201);
 assert.equal((await a.get('/api/auth/local-account')).body.enabled,true);
 await put(a,'/api/auth/local-account',{password:newPassword,currentPassword:'equivocada'}).expect(401);
 await put(a,'/api/auth/local-account',{password:newPassword,currentPassword:password}).expect(200);
 await post(a,'/api/auth/logout',{}).expect(200);
 await post(a,'/api/auth/local',{email:'test@example.com',password}).expect(401);
 await post(a,'/api/auth/local',{email:'test@example.com',password:newPassword}).expect(200);
});
test('MySQL: registro local, vinculación de contraseña Google, propiedad de fichas y revocación de otras sesiones',{skip:process.env.RUN_MYSQL_TESTS!=='1'},async()=>{
 const repository=createRepository(process.env);const created=[];const suffix=randomUUID();
 try{
  await repository.initialize();const app=createApp({repository,config:{origin,allowedOrigins:[lan],localAuthEnabled:true,clientId:'test-client',sessionSecret:'integration-secret-at-least-32-characters',production:false,allowedEmails:[]},verifyGoogle:async credential=>JSON.parse(credential)});
  const a=request.agent(app);const email=`local-${suffix}@example.com`;
  const user=(await post(a,'/api/auth/register',{name:'Cuenta local sintética',email,password}).expect(201)).body.user;created.push(user.id);
  const account=await repository.localAccount(user.id);assert.ok(account.passwordHash.startsWith('scrypt$'));assert.ok(!account.passwordHash.includes(password));
  const record=(await post(a,'/api/usuarios',{...emptyClinicalRecord(),name:'Ficha sintética local',age:34}).expect(201)).body.record;
  const device=request.agent(app);await post(device,'/api/auth/local',{email,password}).expect(200);
  assert.equal((await device.get(`/api/usuarios/${record.id}`)).body.record.name,'Ficha sintética local');
  const other=request.agent(app);const otherUser=(await post(other,'/api/auth/register',{name:'Otra cuenta local',email:`other-${suffix}@example.com`,password}).expect(201)).body.user;created.push(otherUser.id);
  await other.get(`/api/usuarios/${record.id}`).expect(404);
  await put(a,'/api/auth/local-account',{currentPassword:password,password:newPassword}).expect(200);
  await device.get('/api/usuarios').expect(401);await a.get('/api/usuarios').expect(200);
  await post(request(app),'/api/auth/local',{email,password}).expect(401);
  await post(device,'/api/auth/local',{email,password:newPassword}).expect(200);
  const google=request.agent(app);const config=await google.get('/api/auth/config');const googleEmail=`google-${suffix}@example.com`;
  const googleUser=(await post(google,'/api/auth/google',{credential:JSON.stringify({sub:`google-${suffix}`,name:'Cuenta Google sintética',email:googleEmail,email_verified:true,nonce:config.body.nonce})},origin).expect(200)).body.user;created.push(googleUser.id);
  const googleRecord=(await post(google,'/api/usuarios',{...emptyClinicalRecord(),name:'Ficha de Google conservada',age:34},origin).expect(201)).body.record;
  await post(request(app),'/api/auth/register',{name:'Duplicada',email:googleEmail,password}).expect(409);
  const before=await google.get('/api/auth/local-account');assert.equal(before.body.enabled,false);
  await put(google,'/api/auth/local-account',{password},origin).expect(200);
  const phone=request.agent(app);const localSigned=await post(phone,'/api/auth/local',{email:googleEmail,password}).expect(200);assert.equal(localSigned.body.user.id,googleUser.id);
  await phone.get(`/api/usuarios/${googleRecord.id}`).expect(200);
  // An unverified local registration is never silently merged with Google authentication.
  const attempt=request.agent(app);const nonce=await attempt.get('/api/auth/config');
  await post(attempt,'/api/auth/google',{credential:JSON.stringify({sub:`another-google-${suffix}`,name:'Nueva cuenta Google',email,email_verified:true,nonce:nonce.body.nonce})},origin).expect(409);
 }finally{const env=process.env;const connection=await mysql.createConnection({host:env.DB_HOST,port:Number(env.DB_PORT),user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_NAME});try{for(const id of created){await connection.execute('DELETE FROM clinical_records WHERE therapist_id = ?',[id]);await connection.execute('DELETE FROM users WHERE id = ?',[id]);}}finally{await connection.end();await repository.close();}}
});
