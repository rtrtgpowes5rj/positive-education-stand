import React,{useEffect,useRef,useState} from 'react';
import {Briefing,useThread,Win,Btn,stagePt,TapHint} from '../ui';

const events=[
 {id:'n1',time:'08:58:12',src:'kadry-03',code:'4624',type:'Security',text:'a.ivanova — интерактивный вход (тип 2)'},
 {id:'s1',time:'09:12:04',src:'dc-01',code:'4625 ×212',type:'Security',text:'Неудачные входы: 37 учётных записей с buh-07 за 2 минуты'},
 {id:'n2',time:'09:13:40',src:'dc-01',code:'4740',type:'Security',text:'p.smirnov заблокирован после 5 попыток ввода пароля'},
 {id:'s2',time:'09:21:55',src:'fs-01',code:'4672',type:'Security',text:'svc_backup получил специальные привилегии при входе с buh-07'},
 {id:'n3',time:'09:24:10',src:'kadry-03',code:'Sysmon 1',type:'Sysmon',text:'chrome.exe --type=renderer, родитель chrome.exe'},
 {id:'s3',time:'09:27:31',src:'fs-01',code:'Sysmon 10',type:'Sysmon',text:'rundll32.exe comsvcs.dll MiniDump — доступ к памяти lsass.exe'},
 {id:'n4',time:'09:30:00',src:'upd-01',code:'4672',type:'Security',text:'SYSTEM — запуск службы обновлений по расписанию'},
 {id:'s4',time:'09:33:18',src:'6 хостов',code:'4624 тип 3',type:'Security',text:'svc_backup: сетевые входы по NTLM на 6 серверов за 40 секунд'}
];
const stages=[
 {id:'s1',name:'Подбор пароля',hint:'начальный доступ'},
 {id:'s2',name:'Повышение привилегий',hint:'права в системе'},
 {id:'s3',name:'Кража учётных данных',hint:'дамп памяти'},
 {id:'s4',name:'Перемещение по сети',hint:'pass-the-hash'}
];
const responses=[
 {id:'iso',label:'Изолировать buh-07 и fs-01, сбросить пароль svc_backup',ok:true,why:'Точечная изоляция: атака остановлена, остальная сеть работает.'},
 {id:'all',label:'Отключить весь домен до утра',why:'Бизнес встанет вместе с атакующим. Нужна точная изоляция.'},
 {id:'close',label:'Закрыть как ложное: svc_backup — служебная учётка бэкапа',why:'Служебные учётки — любимая цель: права широкие, проверяют их редко.'}
];
const STIC=['st_brute','st_priv','st_dump','st_lateral'];
const byId=Object.fromEntries(events.map(e=>[e.id,e]));

// Схема пути атаки: 3D-иконки устройств из Blender (blender/icons.py), под атакой — красный вариант
const IC=n=>`./icons/${n}.webp`;
const N={ws:{cx:72,cy:96,ic:'pc',label:'buh-07',sub:'ПК бухгалтерии'},dc:{cx:282,cy:46,ic:'dc',label:'dc-01',sub:'контроллер домена'},fs:{cx:282,cy:164,ic:'fs',label:'fs-01',sub:'файловый сервер'}};
// Рёбра пути атаки: этап, геометрия, задержка импульса при проверке
const EDGES=[
 {st:'s1',d:'M126 84 C190 84 190 44 236 44',t:0},
 {st:'s2',d:'M126 112 C190 112 190 162 236 162',t:.35},
 {st:'s4',d:'M330 160 C392 160 392 136 452 136',t:.95},
 {st:'s4',d:'M330 168 C392 168 392 196 452 196',t:.95}
];
const SRV=[0,1,2,3,4,5].map(i=>({x:458+(i%3)*58,y:i<3?110:170}));
function Dev({n,hot,iso,t,size=92}){
 const h=size/2;
 return <g className={'pm-node'+(hot?' hot':'')+(iso?' iso':'')} style={{'--d':t+'s'}}>
  {iso&&<><ellipse className="pm-ring" cx={n.cx} cy={n.cy+h*.62} rx={h*1.05} ry={h*.36}/><ellipse className="pm-ring r2" cx={n.cx} cy={n.cy+h*.62} rx={h*1.05} ry={h*.36}/></>}
  <image href={IC(n.ic)} x={n.cx-h} y={n.cy-h} width={size} height={size}/>
  <image className="pm-hotimg" href={IC(n.ic+'_hot')} x={n.cx-h} y={n.cy-h} width={size} height={size}/>
  {n.label&&<><text className="pm-l" x={n.cx} y={n.cy+h+14} textAnchor="middle">{n.label}</text><text className="pm-s" x={n.cx} y={n.cy+h+30} textAnchor="middle">{iso?'изолирован':n.sub}</text></>}
 </g>;
}
function PathMap({chain,phase,bad}){
 const on=id=>chain.includes(id),cut=phase==='done',ok=phase!=='build';
 return <svg className={'pathmap pm-'+phase+(bad.length?' pm-bad':'')} viewBox="0 0 640 256" role="img" aria-label="Путь атаки по сети">
  {EDGES.map((e,k)=><path key={'e'+k} className={'pm-e'+(on(e.st)?' hot':'')+(cut?' cut':'')} d={e.d}/>)}
  {ok&&!cut&&EDGES.map((e,k)=><path key={'p'+k} className="pm-pulse" d={e.d} pathLength="100" style={{'--d':e.t+'s'}}/>)}
  {cut&&<g className="pm-cuts"><path d="M184 58l12 12M196 58l-12 12"/><path d="M184 131l12 12M196 131l-12 12"/><path d="M386 154l12 12M398 154l-12 12"/></g>}
  <Dev n={N.ws} hot={on('s1')||on('s2')} iso={cut} t={0} size={104}/><Dev n={N.dc} hot={on('s1')} t={.3}/><Dev n={N.fs} hot={on('s2')||on('s3')} iso={cut} t={.65}/>
  {on('s3')&&<g className="pm-dump"><circle cx="318" cy="200" r="6"/><text x="330" y="205">lsass</text></g>}
  {SRV.map((p,i)=><Dev key={i} n={{cx:p.x+26,cy:p.y+26,ic:'srv'}} hot={on('s4')&&!cut} t={1.15+i*.06} size={50}/>)}
  <text className="pm-s" x="576" y="246" textAnchor="middle">6 серверов</text>
 </svg>;
}

export default function Soc({level,onWin}){
 const [chain,setChain]=useState([null,null,null,null]),[pick,setPick]=useState(null),[phase,setPhase]=useState('build'),[mistakes,setMistakes]=useState(0),[bad,setBad]=useState([]);
 const th=useThread(level),[over,setOver]=useState(-1);
 const drag=useRef(null),slotEls=useRef([]),[ghost,setGhost]=useState(null),ghostEl=useRef(),ghostPos=useRef({x:0,y:0});
 const used=new Set(chain.filter(Boolean));

 const put=(id,i)=>{if(phase!=='build'||!id)return;setBad([]);setChain(c=>{const n=c.map(x=>x===id?null:x);n[i]=id;return n});setPick(null);th.say(`${byId[id].code} · ${byId[id].src} — на этап «${stages[i].name}».`)};
 const clear=i=>{if(phase!=='build')return;setBad([]);setChain(c=>c.map((x,j)=>j===i?null:x))};

 useEffect(()=>{
  const slotAt=(x,y)=>slotEls.current.findIndex(el=>{if(!el)return false;const r=el.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom});
  const move=e=>{const dr=drag.current;if(!dr)return;if(!dr.moving&&Math.hypot(e.clientX-dr.x,e.clientY-dr.y)>8)dr.moving=true;if(dr.moving){const p=stagePt(e);ghostPos.current=p;if(ghostEl.current){ghostEl.current.style.left=p.x+'px';ghostEl.current.style.top=p.y+'px'}setGhost(g=>g&&g.id===dr.id?g:{id:dr.id});setOver(slotAt(e.clientX,e.clientY))}};
  const up=e=>{const dr=drag.current;if(!dr)return;drag.current=null;setGhost(null);setOver(-1);if(!dr.moving)return;const i=slotAt(e.clientX,e.clientY);if(i>=0)put(dr.id,i)};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)};
 });

 const verify=()=>{
  const wrong=chain.map((id,i)=>id!==stages[i].id?i:-1).filter(i=>i>=0);
  if(!wrong.length){setPhase('respond');th.say('Цепочка подтверждена: buh-07 → fs-01 → шесть серверов. Теперь — как остановим?','ok');return}
  setBad(wrong);setMistakes(m=>m+wrong.length);
  const e=chain[wrong[0]]&&byId[chain[wrong[0]]];
  th.say(e&&e.id.startsWith('n')?`«${e.text}» — фоновая активность, не часть атаки.`:`Этапов не на месте: ${wrong.length}. Сверь время и хосты — атака идёт от buh-07.`,'error');
 };
 const respond=r=>{if(phase==='done')return;if(r.ok){setPhase('done');th.say(r.why,'ok');setTimeout(()=>onWin(mistakes),2200)}else{setMistakes(m=>m+1);th.say(r.why,'error')}};

 const goals=[phase!=='build',phase==='done'];
 return <main className="level soc">
  <Briefing level={level} thread={th} done={goals}/>
  <div className="work">
   <Win className="siem" title="MaxPatrol SIEM · инцидент" sub="События за последние 40 минут" right={<span className="chip">{used.size} / 4 в цепочке</span>}>
    <div className="siem-grid">
     <div className={'feed'+(!used.size&&!pick&&phase==='build'?' nudge':'')}>
      <div className="feed-h"><span>Время</span><span>Событие</span><span>Хост</span>{phase==='build'&&<TapHint>Нажмите на событие, затем на этап</TapHint>}</div>
      {events.map((e,i)=><button key={e.id} style={{'--i':i}} className={'ev'+(pick===e.id?' pick':'')+(used.has(e.id)?' used':'')} disabled={phase!=='build'}
        onPointerDown={ev=>{drag.current={id:e.id,x:ev.clientX,y:ev.clientY,moving:false}}}
        onClick={()=>{setPick(pick===e.id?null:e.id);if(pick!==e.id)th.say('Теперь выбери этап цепочки справа.')}}>
       <span className="t">{e.time}</span><span className={'code '+e.type.toLowerCase()}>{e.code}</span><span className="src">{e.src}</span><span className="txt">{e.text}</span>
      </button>)}
     </div>
     <div className="side">
      <PathMap key={phase+bad.join()} chain={chain} phase={phase} bad={bad}/>
      <ol className={"chain ch-"+phase}>{stages.map((s,i)=>{const e=chain[i]&&byId[chain[i]];return <li key={s.id+(bad.includes(i)?'b':'')} style={{'--i':i}} ref={el=>slotEls.current[i]=el} className={'ch-step'+(e?' filled':'')+(bad.includes(i)?' bad':'')+(phase!=='build'?' locked':'')+(pick||ghost?' armed':'')+(over===i?' over':'')} onClick={()=>pick?put(pick,i):e&&clear(i)}>
       <i className="ch-dot" aria-hidden="true"/><img className="ch-ic" src={IC(STIC[i])} alt="" draggable="false"/>
       <div className="ch-name"><b>{s.name}</b><span>{s.hint}</span></div>
       <div className="ch-slot">{e?<><code>{e.code}</code><span className="ch-host">{e.src}</span><span className="ch-txt">{e.text}</span></>:<span className="ch-ph">{pick?'Нажмите, чтобы поставить сюда':'Перетащите событие сюда'}</span>}</div>
      </li>})}</ol>
      {phase==='build'&&<Btn className="primary" disabled={used.size<4} onClick={verify}>Проверить цепочку</Btn>}
      {phase!=='build'&&<div className="respond"><small>Реагирование</small>{responses.map(r=><button key={r.id} onClick={()=>respond(r)} className={phase==='done'&&r.ok?'ok':''}>{r.label}</button>)}</div>}
     </div>
    </div>
   </Win>
  </div>
  {ghost&&<div ref={ghostEl} className="ghost chip-ghost" style={{left:ghostPos.current.x,top:ghostPos.current.y}}><b>{byId[ghost.id].code}</b><small>{byId[ghost.id].src}</small></div>}
 </main>;
}
