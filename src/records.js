// Таблица рекордов стенда: все участники.
// Два режима, выбираются сами при запуске:
//  · server — рядом с игрой работает server/server.mjs (/api): общий топ для всех планшетов в зале,
//    обновления приходят сразу (SSE), результаты без сети ждут в очереди и уходят, когда сеть вернётся;
//  · local — сервера нет (GitHub Pages, файл с диска): таблица в localStorage этого устройства.
// Сортировка: больше очков выше; при равенстве — быстрее выше, затем кто раньше.
import {useEffect,useState} from 'react';
import {sha256hex} from './sha256';

const KEY='pe-board-v3',CACHE='pe-board-srv',QUEUE='pe-board-queue',TOKEN='pe-admin',MAX=20000;
const API=(import.meta.env.VITE_API_BASE||'./api/').replace(/\/?$/,'/');
// Пароль демо-режима и служебного окна. На сервере проверяется по ADMIN_PASSWORD_HASH,
// без сервера — по этому отпечатку (sha256 от соли и пароля). Сменить: node server/hash-password.mjs
const LOCAL_SALT='pe-stand-2026',LOCAL_HASH='5a840df53de2676dae5a73477162f69ec4f919b861f94a532b4025ff71cd1db8';

export const cmp=(a,b)=>b.score-a.score||a.secs-b.secs||a.at-b.at;
const clean=l=>Array.isArray(l)?l.filter(x=>x&&x.name&&Number.isFinite(x.score)).sort(cmp):[];
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};

let mode='local',list=clean(read(KEY)),rev=0;
const subs=new Set();
const emit=()=>subs.forEach(f=>f(list));
const setList=(l,persist=true)=>{list=l;if(persist)write(mode==='server'?CACHE:KEY,l);emit()};
export const boardMode=()=>mode;
export const loadBoard=()=>list;
// подписка компонента на изменения таблицы
export function useBoard(){const [l,set]=useState(list);useEffect(()=>{subs.add(set);set(list);return()=>subs.delete(set)},[]);return l}

// ник в таблице один: регистр и лишние пробелы не важны
export const nickKey=s=>String(s).trim().replace(/\s+/g,' ').toLowerCase();
export const nickTaken=name=>{const k=nickKey(name);return list.some(x=>nickKey(x.name)===k)};

// вставка с правилом «под одним ником — лучший результат»; kept — прежний оказался лучше
function upsert(all,rec){
 const k=nickKey(rec.name),same=all.find(x=>nickKey(x.name)===k);
 if(same&&cmp(same,rec)<0)return{l:all,res:{at:same.at,place:all.indexOf(same)+1,kept:same.score}};
 const l=[...all.filter(x=>x!==same),rec].sort(cmp).slice(0,MAX);
 return{l,res:{at:rec.at,place:l.findIndex(x=>x.at===rec.at)+1}};
}

// ---------- сервер ----------
const req=async(path,{method='GET',body,token,timeout=6000}={})=>{
 const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
 try{const r=await fetch(API+path,{method,signal:c.signal,cache:'no-store',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(j.error||('HTTP '+r.status)),{status:r.status});return j}
 finally{clearTimeout(t)}
};
// свежая таблица с сервера + свои результаты, которые ещё ждут отправки (чтобы не пропадали из топа)
async function pull(){try{const j=await req('board');rev=j.rev;let l=clean(j.list);for(const r of read(QUEUE)||[])l=upsert(l,r).l;setList(l)}catch(e){}}
let es=null,poll=0;
function live(){
 // SSE: сервер сообщает номер версии таблицы, при изменении забираем её целиком
 try{es=new EventSource(API+'stream');es.addEventListener('rev',e=>{const r=+e.data;if(r!==rev)pull()});es.onerror=()=>{}}catch(e){}
 // страховка на случай прокси, который режет SSE
 poll=setInterval(()=>{flush();if(!es||es.readyState!==1)pull()},8000);
 addEventListener('online',()=>{flush();pull()});
}
// очередь результатов, которые не дошли до сервера (нет сети) — отправляются при первой возможности
async function flush(){
 const q=read(QUEUE)||[];if(!q.length)return;
 const left=[];for(const r of q){try{await req('records',{method:'POST',body:r})}catch(e){if(e.status>=400&&e.status<500)continue;left.push(r)}}
 write(QUEUE,left);if(left.length<q.length)pull();
}

// при запуске: есть ли сервер рядом с игрой
export const boardReady=(async()=>{
 try{const h=await req('health',{timeout:2500});if(h&&h.ok){mode='server';list=clean(read(CACHE));await pull();live();flush()}}catch(e){}
 return mode;
})();

export const addRecord=(name,score,secs)=>{
 const rec={name:name.trim().slice(0,14),score:Math.round(score),secs:Math.round(secs*10)/10,at:Date.now()};
 const {l,res}=upsert(list,rec);setList(l);
 if(mode==='server'){const q=read(QUEUE)||[];write(QUEUE,[...q,rec]);flush()}
 return res;
};

// ---------- служебные действия: только с паролем ----------
const token=()=>{try{const t=JSON.parse(sessionStorage.getItem(TOKEN)||'null');return t&&t.exp>Date.now()?t:null}catch(e){return null}};
export const isAdmin=()=>!!token();
export async function adminLogin(password){
 if(mode==='server'){
  try{const j=await req('admin/login',{method:'POST',body:{password}});sessionStorage.setItem(TOKEN,JSON.stringify({t:j.token,exp:Date.now()+j.expiresIn*1000}));return{ok:true}}
  catch(e){return{ok:false,error:e.status===429?'Слишком много попыток. Подождите 15 минут.':e.status===401?'Неверный пароль':'Сервер недоступен'}}
 }
 if(sha256hex(LOCAL_SALT+':'+String(password).normalize('NFC'))===LOCAL_HASH){sessionStorage.setItem(TOKEN,JSON.stringify({t:'local',exp:Date.now()+12*3600e3}));return{ok:true}}
 return{ok:false,error:'Неверный пароль'};
}
export const adminLogout=()=>{const t=token();try{sessionStorage.removeItem(TOKEN)}catch(e){}if(t&&mode==='server')req('admin/logout',{method:'POST',token:t.t}).catch(()=>{})};
const admin=async(path,body)=>{const t=token();if(!t)throw new Error('Нужен пароль');return req(path,{method:'POST',body,token:t.t})};

export async function removeRecord(at){
 if(mode==='server'){await admin('admin/remove',{at});return pull()}
 if(!isAdmin())return;setList(list.filter(x=>x.at!==at));
}
export async function clearBoard(){
 if(mode==='server'){await admin('admin/clear');write(QUEUE,[]);return pull()}
 if(!isAdmin())return;setList([]);
}

// Тестовые результаты для демо: заменяют прежние тестовые, настоящие не трогают
const FAKE=`Алексей_К Марина Dmitry_SOC Катя_ИБ root_access Николай Анна_Ф blue_team Сергей_П Ольга
ИгорьAppSec Настя pentester88 Роман_К Вика Tim_DevOps Елена_В Паша_NOC zero_day Юля
Артём Светлана_К kernel_panic Михаил_И Даша_Ф Vlad_CISO Ирина Женя_SIEM phishing_no Кирилл
Татьяна_М Глеб hash_cat Полина Антон_ИТ Liza_QA Денис_К Вера red_team_1 Максим_Р
Оксана firewall_guy Степан Алина_Б Руслан_SOC nmap_fan Георгий Ксения_Л Илья_П Mila_Sec`.split(/\s+/);
const fakeRows=real=>{const now=Date.now();return FAKE.filter(n=>!real.some(x=>nickKey(x.name)===nickKey(n))).map((name,i)=>({name,score:Math.round(300+1700*Math.pow(Math.random(),2.4)),secs:Math.round((170+Math.random()*260)*10)/10,at:now-i*97000-1000,fake:true}))};
export async function seedBoard({force=false}={}){
 if(mode==='server'){await admin('admin/seed',{rows:fakeRows(list.filter(x=>!x.fake))});return pull()}
 if(!force&&!isAdmin())return;
 const real=list.filter(x=>!x.fake);setList([...real,...fakeRows(real)].sort(cmp));
}
