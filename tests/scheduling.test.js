import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/app.js';
import { createRepository } from '../server/db.js';
import { emptyClinicalRecord } from '../shared/clinical-fields.js';
import { validateAppointment, validatePlan } from '../shared/scheduling.js';
const origin = 'http://localhost:5173';
const post = (agent, path, data) => agent.post(path).set('Origin',origin).send(data);
const put = (agent, path, data) => agent.put(path).set('Origin',origin).send(data);
test('agenda: rechaza horarios y fechas imposibles; planificación valida objetivos y sesión obligatoria',()=>{
 const id=randomUUID();
 assert.equal(Object.keys(validateAppointment({recordId:id,title:'Sesión',date:'2026-11-02',time:'09:30'}).fields).length,0);
 for(const patch of [{date:'2026-02-30'},{time:'24:00'},{time:'9:00'},{recordId:'otro'},{title:[]}]) assert.ok(Object.keys(validateAppointment({recordId:id,title:'',date:'2026-11-02',time:'09:30',...patch}).fields).length);
 const plan={sessionId:id,materials:'Tarjetas',objectives:[{text:'Objetivo',done:false}],executionPlan:'Secuencia',observations:''};
 assert.equal(Object.keys(validatePlan(plan).fields).length,0);
 for(const patch of [{sessionId:''},{objectives:[]},{objectives:[{text:'',done:false}]},{objectives:[{text:'Objetivo',done:'sí'}]},{executionPlan:''}]) assert.ok(Object.keys(validatePlan({...plan,...patch}).fields).length);
});
test('MySQL: agenda compartida con sesiones, asignación de planes, reprogramación y registro de atención', {skip:process.env.RUN_MYSQL_TESTS!=='1'}, async()=>{
 const repository=createRepository(process.env);const users=[];
 try{
  await repository.initialize();
  const app=createApp({repository,config:{origin,clientId:'test',sessionSecret:'test-secret-long-enough-for-authentication',production:false,allowedEmails:[]},verifyGoogle:async credential=>JSON.parse(credential)});
  async function login(){const agent=request.agent(app);const settings=await agent.get('/api/auth/config');const googleId=`schedule-test-${randomUUID()}`;const result=await post(agent,'/api/auth/google',{credential:JSON.stringify({sub:googleId,name:'Terapeuta sintético',email:`${googleId}@example.com`,email_verified:true,nonce:settings.body.nonce})}).expect(200);users.push(result.body.user);return agent;}
  const a=await login();const b=await login();
  const recordA=(await post(a,'/api/usuarios',{...emptyClinicalRecord(),name:'Usuario agenda A',age:34}).expect(201)).body.record;
  const recordB=(await post(b,'/api/usuarios',{...emptyClinicalRecord(),name:'Usuario agenda B',age:34}).expect(201)).body.record;
  const otherA=(await post(a,'/api/usuarios',{...emptyClinicalRecord(),name:'Otro usuario A',age:34}).expect(201)).body.record;
  await request(app).get('/api/calendario').expect(401);
  await post(request(app),'/api/calendario',{recordId:recordA.id,title:'',date:'2026-10-31',time:'10:30'}).expect(401);
  await post(a,'/api/calendario',{recordId:recordB.id,title:'',date:'2026-10-31',time:'10:30'}).expect(404);
  const appointment={recordId:recordA.id,title:'',date:'2026-10-31',time:'10:30'};
  const saved=(await post(a,'/api/calendario',{...appointment,status:'completed',amount:50000}).expect(201)).body.session;
  assert.equal(saved.title,'Sesión número 1');assert.equal(saved.time,'10:30');assert.equal(saved.status,'scheduled');assert.equal(saved.amount,null);
  const bSession=(await post(b,'/api/calendario',{...appointment,recordId:recordB.id}).expect(201)).body.session;
  const calendar=await a.get('/api/calendario?mes=2026-10').expect(200);assert.equal(calendar.body.total,1);assert.equal(calendar.body.sessions[0].id,saved.id);assert.match(calendar.headers['cache-control'],/no-store/);
  assert.equal((await a.get('/api/finanzas?mes=2026-10')).body.summary.totalAmount,0);assert.equal((await a.get('/api/finanzas?mes=2026-10')).body.summary.sessionCount,0);
  assert.equal((await repository.reportSources(users[0].id,recordA.id,null,null)).length,0);
  await b.get(`/api/calendario/${saved.id}`).expect(404);await put(b,`/api/calendario/${saved.id}`,{...appointment,version:1}).expect(404);
  const planPath=`/api/usuarios/${recordA.id}/planificaciones`;
  const planData={sessionId:saved.id,materials:'Tarjetas y lápices',objectives:[{text:'Secuenciar una actividad',done:false},{text:'Preparar materiales',done:true}],executionPlan:'Preparación\nActividad central\nCierre',observations:'Texto sintético de prueba.'};
  await post(a,planPath,{...planData,sessionId:bSession.id}).expect(404);
  await post(a,`/api/usuarios/${otherA.id}/planificaciones`,planData).expect(404);
  const plan=(await post(a,planPath,planData).expect(201)).body.plan;
  assert.equal(plan.sessionId,saved.id);assert.equal(plan.time,'10:30');assert.equal(plan.date,'2026-10-31');assert.deepEqual(plan.objectives,planData.objectives);
  await b.get(`${planPath}/${plan.id}`).expect(404);await put(b,`${planPath}/${plan.id}`,{...planData,version:1}).expect(404);
  const moved=(await put(a,`/api/calendario/${saved.id}`,{...appointment,title:'Sesión número 1 · Secuencias',date:'2026-11-02',time:'11:45',version:1}).expect(200)).body.session;
  assert.equal(moved.status,'scheduled');
  const linked=(await a.get(`${planPath}/${plan.id}`).expect(200)).body.plan;
  assert.equal(linked.date,'2026-11-02');assert.equal(linked.time,'11:45');assert.equal(linked.title,'Sesión número 1 · Secuencias');
  assert.equal((await a.get('/api/calendario?mes=2026-10')).body.total,0);assert.equal((await a.get('/api/calendario?mes=2026-11')).body.total,1);
  await put(a,`/api/calendario/${saved.id}`,{...appointment,version:1}).expect(409);
  const newObjectives=planData.objectives.map(row=>({...row,done:true}));
  const edited=(await put(a,`${planPath}/${plan.id}`,{...planData,objectives:newObjectives,version:1}).expect(200)).body.plan;assert.equal(edited.version,2);assert.ok(edited.objectives.every(row=>row.done));
  await put(a,`${planPath}/${plan.id}`,{...planData,version:1}).expect(409);
  const attended=(await put(a,`/api/usuarios/${recordA.id}/sesiones/${saved.id}`,{date:'2026-11-02',amount:20000,activities:'Se realizó la actividad de prueba.',version:2}).expect(200)).body.session;
  assert.equal(attended.status,'completed');assert.equal(attended.time,'11:45');assert.equal(attended.title,moved.title);
  assert.equal((await a.get('/api/finanzas?mes=2026-11')).body.summary.totalAmount,20000);
  assert.equal((await repository.reportSources(users[0].id,recordA.id,null,null)).length,1);
  assert.equal((await a.get(`${planPath}/${plan.id}`)).body.plan.sessionStatus,'completed');
  // Concurrent scheduling generates distinct sequence numbers under the record lock.
  const concurrent=await Promise.all(Array.from({length:3},()=>repository.createClinicalSession(users[0].id,recordA.id,randomUUID(),{date:'2026-11-03',time:'12:00',status:'scheduled'})));
  assert.equal(new Set(concurrent.map(row=>row.sessionNumber)).size,3);assert.deepEqual(concurrent.map(row=>row.sessionNumber).sort(),[2,3,4]);
  assert.equal((await a.get(`/api/usuarios/${recordA.id}/sesiones-agendadas`)).body.total,4);
 }finally{
  const env=process.env;const connection=await mysql.createConnection({host:env.DB_HOST,port:Number(env.DB_PORT),user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_NAME});
  try{for(const user of users){await connection.execute('DELETE FROM clinical_records WHERE therapist_id = ?',[user.id]);await connection.execute('DELETE FROM users WHERE id = ?',[user.id]);}}finally{await connection.end();await repository.close();}
 }
});
