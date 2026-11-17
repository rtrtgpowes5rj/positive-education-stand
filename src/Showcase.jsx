import React,{useLayoutEffect,useEffect,useRef,useState} from 'react';
import {gsap} from 'gsap';
import {programs,catalogs,ecosystem,baseShort} from './data';
import {Qr,reduced,Reveal} from './ui';
import {useBoard} from './records';
import {fmtTime} from './scoring';

// Витрина: слева — профессиональные программы (в т.ч. планы 2027), справа — курсы по продуктам.
// Структура — из проекта roadmap_courses (docs/ecosystem.md).
export default function Showcase({results,onRestart,mine}){
 const [sel,setSel]=useState(null),ref=useRef();
 useLayoutEffect(()=>{if(reduced())return;gsap.from(ref.current.querySelectorAll('.s-anim'),{y:26,opacity:0,duration:.6,stagger:.05,ease:'power3.out'})},[]);
 const p=sel&&programs[sel];

 return <main className="showcase" ref={ref}>
  <section className="eco">
   <div className="s-anim s-head"><span className="kicker">Витрина Positive Education</span><h1>Продолжите обучение</h1>
    <p>Нажмите на программу — справа появится её QR. Анонсы 2027 года раскрываются по чипу «2027».</p></div>
   <div className="s-anim eco-cols"><span>Профессиональные программы</span><span>Курсы по эксплуатации продуктов</span></div>
   <div className="eco-canvas">
    {ecosystem.rows.map(r=><div key={r.id} className="s-anim eco-row">
     <div className="eco-label">{r.name}<small>{r.note}</small></div>
     <div className="eco-pro">{r.pro.filter(id=>!programs[id].plan).map(id=>{const pr=programs[id];return <button key={id} className={'prog'+(sel===id?' sel':'')} onClick={()=>setSel(sel===id?null:id)}>
      <em>{pr.kind}</em><b>{pr.name}</b></button>})}
      {(()=>{const plan=r.pro.filter(id=>programs[id].plan);if(!plan.length)return null;
       return <Reveal className="plan-rv" panelClass="plan-panel" label={<><i className="yr">2027</i><span>{plan.length===1?'ещё 1 программа':`ещё ${plan.length} программы`}</span></>}>
        <b className="rv-i rv-title">Анонсы 2027 · {r.name}</b>
        {plan.map(id=>{const pr=programs[id];return <button key={id} className={'rv-i prog plan'+(sel===id?' sel':'')} onClick={()=>setSel(id)}><em>{pr.kind}</em><b>{pr.name}</b></button>})}
       </Reveal>})()}</div>
     <div className="eco-base">{r.base.map(id=><button key={id} className={'chip-prod'+(sel===id?' sel':'')} onClick={()=>setSel(sel===id?null:id)}>
      <b>{baseShort[id]}</b></button>)}</div>
    </div>)}
   </div>
  </section>
  <section className="codes">
   {[catalogs.pros,catalogs.products].map(c=><div key={c.url} className="s-anim qr-card"><Qr url={c.url} label={c.title}/><div><b>{c.title}</b><small>{c.note}</small><span>{c.short}</span></div></div>)}
   <div className={'s-anim qr-card sel'+(p?' on':'')}>
    {p&&!p.plan&&<><Qr url={p.url} label={p.name}/><div><em>{p.kind}</em><b>{p.name}</b><span>{p.short}</span></div></>}
    {p&&p.plan&&<div className="sel-plan"><em>{p.kind} · запуск в 2027 году</em><b>{p.name}</b><span>Ссылка и QR появятся после анонса.</span></div>}
    {!p&&<div className="sel-empty"><b>QR выбранной программы</b><span>Нажмите на любую программу слева — её код появится здесь.</span></div>}
   </div>
   <TopBoard mine={mine}/>
   <button className="s-anim ghost-btn again" onClick={onRestart}>Пройти заново</button>
  </section>
 </main>;
}

// Топ стенда по очкам: лучшие результаты из таблицы рекордов, свой результат подсвечен
export function TopBoard({mine,limit=5,className='s-anim'}){
 const list=useBoard(),top=list.slice(0,limit),myPlace=mine?list.findIndex(r=>r.at===mine)+1:0;
 return <div className={className+' top-board'}>
  <div className="tb-head"><span>Топ стенда</span><small>по очкам · {list.length?`участников: ${list.length}`:'таблица пуста'}</small></div>
  {top.length?<ol>{top.map((r,i)=><li key={r.at} className={'tb-r p'+(i+1)+(r.at===mine?' me':'')}>
   <i>{i+1}</i><b>{r.name}</b><small>{fmtTime(r.secs)}</small><em>{r.score}</em></li>)}</ol>
  :<p>Пока пусто — пройдите смену и станьте первым.</p>}
  {myPlace>limit&&<div className="tb-r me tb-mine"><i>{myPlace}</i><b>{list[myPlace-1].name}</b><small>{fmtTime(list[myPlace-1].secs)}</small><em>{list[myPlace-1].score}</em></div>}
 </div>;
}
