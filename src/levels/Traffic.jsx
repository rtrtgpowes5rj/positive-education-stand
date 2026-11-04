import React,{useMemo,useRef,useState} from 'react';
import {Briefing,useThread,Win,Btn,TapHint} from '../ui';

let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const gen={
 beacon:()=>Array.from({length:20},(_,i)=>[14+i*30+(rnd()-.5)*.8,.22]),
 tunnel:()=>{const a=[];for(let t=6;t<596;t+=3+rnd()*4)a.push([t,.38+rnd()*.12]);return a},
 update:()=>[[88,.9],[93,.75],[97,.95],[101,.6],[318,.85],[322,.7],[480,.98],[485,.8],[489,.55]],
 imap:()=>[[28,.16],[31,.1],[322,.18],[326,.08],[574,.14]],
 backup:()=>[],
 dns:()=>{const a=[];[[40,6],[200,9],[205,4],[410,7],[520,5]].forEach(([s,n])=>{for(let i=0;i<n;i++)a.push([s+i*2.2+rnd()*2,.1+rnd()*.12])});return a}
};
const IC={update:'pc',beacon:'pc',backup:'fs',imap:'pc',tunnel:'laptop',dns:'laptop'};
const icon=(id,hot)=>`./icons/${IC[id]}${hot?'_hot':''}.webp`;
const flows=[
 {id:'update',src:'10.20.4.22',host:'kadry-03',dst:'13.107.4.50:443',proto:'TLS',app:'Windows Update',stats:[['Сессий','9'],['Объём','412 МБ'],['Интервал','нерегулярно']],sample:['SNI download.windowsupdate.com','Сертификат Microsoft, цепочка доверена','3 пакета обновлений KB50xxxx'],sus:false,why:'Крупные редкие загрузки с известного сервера обновлений — плановая работа.'},
 {id:'beacon',src:'10.20.4.17',host:'buh-07',dst:'185.71.66.12:443',proto:'TLS',app:'не опознано',stats:[['Сессий','20'],['Объём','20 × 1,2 КБ'],['Интервал','30,0 с ± 0,2 с']],sample:['SNI cdn-static-update.net','JA3 72a589da586844d7f0818ce684948eea','Сертификат выпущен 2 дня назад','Каждый ответ — ровно 1 184 байта'],sus:true,why:'Одинаковый размер и интервал ровно 30 секунд — так ведёт себя программа, а не человек. Это скрытый канал связи с сервером злоумышленника.'},
 {id:'backup',src:'10.20.9.4',host:'backup-02',dst:'10.20.9.40:445',proto:'SMB3',app:'Резервное копирование',stats:[['Сессий','1'],['Объём','18,4 ГБ'],['Окно','02:00–02:05, по расписанию']],sample:['\\\\storage-01\\nightly-fs$','Задание «nightly-fs», учётка svc_veeam','Сегмент серверов резервного копирования'],sus:false,why:'Объём большой, но в окне задания и между серверами резервного копирования.'},
 {id:'imap',src:'10.20.4.17',host:'buh-07',dst:'10.20.1.25:993',proto:'IMAPS',app:'Почта · mail-01',stats:[['Сессий','5'],['Объём','86 КБ'],['Интервал','≈ 5 мин, разброс 40 с']],sample:['Внутренний сервер mail-01','Клиент Outlook 16.0','Проверка ящика и синхронизация'],sus:false,why:'Неровный интервал к внутреннему почтовому серверу — клиент просто проверяет ящик.'},
 {id:'tunnel',src:'10.20.4.31',host:'sales-12',dst:'10.20.0.53:53',proto:'DNS',app:'TXT-запросы',stats:[['Запросов','412'],['Уникальных имён','412'],['Средняя длина','61 символ']],sample:['mzxw6ytb.ojsxg5dp.4f2a.sync-cdn.net  TXT','nfxgq2lb.mfzxi3tf.4f2b.sync-cdn.net  TXT','obqxg43x.n5zgiyla.4f2c.sync-cdn.net  TXT'],sus:true,why:'Сотни длинных уникальных поддоменов и TXT-ответы — данные уходят наружу внутри DNS.'},
 {id:'dns',src:'10.20.4.40',host:'it-21',dst:'10.20.0.53:53',proto:'DNS',app:'A / AAAA',stats:[['Запросов','31'],['Уникальных имён','9'],['Средняя длина','14 символов']],sample:['portal.corp.local  A','teams.microsoft.com  A','update.1c.ru  A'],sus:false,why:'Короткие имена известных сервисов, всплески — когда человек работает.'}
];

function Strip({id,on}){
 const ev=useMemo(()=>gen[id](),[id]);
 return <svg className="strip" viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden="true">
  {[100,200,300,400,500].map(x=><line key={x} x1={x} x2={x} y1="0" y2="40" className="tick"/>)}
  {id==='backup'&&<rect x="120" y="8" width="300" height="32" className="band"/>}
  {ev.map(([t,s],i)=><rect key={i} x={t} width="2.6" y={40-s*38} height={s*38} className={on?'bar on':'bar'}/>)}
 </svg>;
}

// Шестнадцатеричный «срез пакета» для инспектора
const hex=s=>{const b=[...new TextEncoder().encode(s)].slice(0,16);return{h:b.map(x=>x.toString(16).padStart(2,'0')).join(' '),a:b.map(x=>x>31&&x<127?String.fromCharCode(x):'·').join('')}};

export default function Traffic({level,onWin}){
 const [seen,setSeen]=useState({update:true}),[sel,setSel]=useState('update'),[marked,setMarked]=useState({}),[result,setResult]=useState(null),[mistakes,setMistakes]=useState(0),[won,setWon]=useState(false);
 const th=useThread(level);
 const f=flows.find(x=>x.id===sel),n=Object.values(marked).filter(Boolean).length;
 const mark=id=>{if(won)return;setResult(null);setMarked(m=>({...m,[id]:!m[id]}))};
 const open=id=>{setSel(id);setSeen(s=>({...s,[id]:true}))};
 const nSeen=Object.keys(seen).length;
 const check=()=>{
  const wrong=flows.filter(x=>marked[x.id]&&!x.sus),miss=flows.filter(x=>x.sus&&!marked[x.id]);
  const r={};flows.forEach(x=>{if(marked[x.id])r[x.id]=x.sus?'ok':'fp';else if(x.sus)r[x.id]='miss'});setResult(r);
  if(!wrong.length&&!miss.length){setWon(true);th.say('Оба канала найдены: C2-маяк с buh-07 и DNS-туннель с sales-12. Передаю хосты в SOC — дальше их разберут по событиям.','ok');setTimeout(()=>onWin(mistakes),2000);return}
  setMistakes(m=>m+wrong.length+miss.length);
  th.say(wrong.length?`Ложное срабатывание: ${wrong[0].why}`:`Пропущено каналов: ${miss.length}. Ищи ровный ритм или необычно длинные имена.`,'error');
 };
 const doneGoals=[!!result&&result.beacon==='ok',!!result&&result.tunnel==='ok',won];
 return <main className="level traffic">
  <Briefing level={level} thread={th} done={doneGoals}/>
  <div className="work">
   <Win className="nad" title="PT NAD · сессии" sub="Последние 10 минут" right={<span className="chip">{n} помечено</span>}>
    <div className="axis"><TapHint>{nSeen<flows.length?`Нажимайте на строки по очереди: ${nSeen} из ${flows.length}`:'Все сессии открыты: пометьте подозрительные'}</TapHint><span>−10:00</span><span>−07:30</span><span>−05:00</span><span>−02:30</span><span>сейчас</span></div>
    <div className="flow-list"><div className="playhead"/>
     {flows.map((x,i)=><button key={x.id} style={{'--i':i}} className={'flow'+(seen[x.id]?'':' unseen')+(sel===x.id?' sel':'')+(marked[x.id]?' marked':'')+(result?.[x.id]?' r-'+result[x.id]:'')} onClick={()=>open(x.id)}>
      <span className="who"><span className="dev"><img src={icon(x.id)} alt="" draggable="false"/><img className="hot" src={icon(x.id,true)} alt="" draggable="false"/></span><span><b>{x.host}</b><small>{x.src} → {x.dst}</small></span></span>
      <span className="proto">{x.proto}</span>
      <Strip id={x.id} on={sel===x.id}/>
      <span className="mk">{marked[x.id]&&<i className="mk-dot" aria-label="помечено"/>}</span>
     </button>)}
    </div>
    <div className="insp">
     <div className="insp-l">
      <div className={'insp-top'+(marked[f.id]?' hot':'')}><span className="dev big" key={f.id}><img src={icon(f.id)} alt=""/><img className="hot" src={icon(f.id,true)} alt=""/></span><b>{f.host}</b><span>{f.src} → {f.dst}</span><em>{f.app}</em></div>
      <dl>{f.stats.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
     </div>
     <div className="insp-r">
      <div className="decode"><small>Декодированные поля</small>{f.sample.map(s=><div key={s}><i>›</i><code>{s}</code></div>)}</div>
      <button className={'mark-btn'+(marked[f.id]?' on':'')} onClick={()=>mark(f.id)}>{marked[f.id]?'Снять пометку':'Пометить подозрительным'}</button>
     </div>
    </div>
    <div className="win-foot"><Btn className="primary" disabled={!n||won} onClick={check}>Передать в расследование</Btn></div>

   </Win>
  </div>
 </main>;
}
