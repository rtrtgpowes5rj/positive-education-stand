import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {gsap} from 'gsap';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import './style.css';
import logo from './assets/edu_long.svg';
import {levels,blitz,programs,people,rankFor,ticker,loadQuestions} from './data';
import NetMap from './scene/NetMap';
import NetStage,{net} from './gl/NetStage';
import Hero3D,{hero} from './gl/Hero3D';
import {webglOK,stagesWarm} from './gl/core';
import {kitReady} from './gl/kit';
import {reduced,Btn,hintStat,Odo,holdGate,releaseGate,SoundToggle} from './ui';
import {sfx} from './audio';
import Showcase from './Showcase';
import Demo,{demoOrder} from './Demo';
import {accScore,speedScore,blitzScore,makeResult,fmtTime} from './scoring';
import {loadBoard,addRecord,seedBoard} from './records';
import {NickPrompt,BoardAdmin,MiniBoard,AttBoard} from './RecordsUI';
import Perimeter from './levels/Perimeter';
import Hardening from './levels/Hardening';
import Traffic from './levels/Traffic';
import Soc from './levels/Soc';
import Agent from './levels/Agent';

if(import.meta.env.DEV)window.gsap=gsap;
// iPad/Safari: системный щипок-масштаб страницы отключён (масштаб планеты — свой, через pointer events)
['gesturestart','gesturechange','gestureend'].forEach(t=>document.addEventListener(t,e=>e.preventDefault(),{passive:false}));
document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
const views={perimeter:Perimeter,hardening:Hardening,traffic:Traffic,soc:Soc,agent:Agent};
const IDLE_MS=120000;
const WARN_MS=15000;
const fmt=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');

// сцена 1920×1080 вписывается в любое окно
function useFit(){
 const [k,setK]=useState(1);
 useLayoutEffect(()=>{const f=()=>setK(Math.min(innerWidth/1920,innerHeight/1080));f();addEventListener('resize',f);return()=>removeEventListener('resize',f)},[]);
 return k;
}

// Число прокручивается одометром
const Num=({value,dur=.9,delay=0,prefix=''})=><Odo value={value} dur={dur+.3} delay={delay} prefix={prefix}/>;

function ScoreBox({score}){
 const prev=useRef(score),[pops,setPops]=useState([]);
 useEffect(()=>{const d=score-prev.current;prev.current=score;if(d>0){const id=Date.now()+Math.random();setPops(p=>[...p,{id,d}]);setTimeout(()=>setPops(p=>p.filter(x=>x.id!==id)),1600)}},[score]);
 return <div className="score-box"><small>Очки</small><Num value={score}/>{pops.map(p=><span key={p.id} className="pop">+{p.d}</span>)}</div>;
}

function Hud({level,score,seconds,onHome}){
 const xs=levels.map((_,i)=>30+i*120);
 return <header className="hud">
  <button className="logo" onClick={onHome} aria-label="В начало"><img src={logo} alt="Positive Education"/></button>
  <ol className="steps">{levels.map((l,i)=><li key={l.id} className={i<level?'done':i===level?'now':''}>
   <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="10" className="st-ring"/>{i===level&&<circle cx="12" cy="12" r="4.5" className="st-dot"/>}{i<level&&<path d="M7.5 12.3l3 3 6-6.3" className="st-chk"/>}</svg>
   <span>{l.name}</span></li>)}</ol>
  <div className="hud-right"><SoundToggle className="hud-sound"/><ScoreBox score={score}/><div><small>Время</small><b>{fmt(seconds)}</b></div></div>
  <i className="hud-prog" style={{transform:`scaleX(${Math.min(1,level/levels.length)})`}}/>
 </header>;
}


function Attract({onStart,onDemo,diving,locked}){
 const ref=useRef();
 const rec=loadBoard().slice(0,3).map((r,i)=>`★ ${i+1}. ${r.name} — ${r.score} очков · ${fmtTime(r.secs)}`);
 const items=[...ticker.slice(0,3),...(rec.length?rec:['★ Таблица рекордов пуста — станьте первым']),...ticker.slice(3)];
 useEffect(()=>{if(!diving||reduced())return;const q=x=>ref.current.querySelectorAll(x);
  const tl=gsap.timeline();tl.to(q('.att-anim'),{opacity:0,x:-70,duration:.6,stagger:.05,ease:'power3.in'},0).to(q('.att-ticker,.demo-open,.att-grad'),{opacity:0,duration:.5},0);return()=>tl.kill()},[diving]);
 useEffect(()=>{if(locked)return;const k=e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat&&document.activeElement===document.body){e.preventDefault();onStart()}};addEventListener('keydown',k);return()=>removeEventListener('keydown',k)},[onStart,locked]);
 useEffect(()=>{if(reduced())return;const q=s=>ref.current.querySelectorAll(s);
  const tl=gsap.timeline({delay:.15});
  tl.from(q('.att-anim'),{opacity:0,y:28,duration:.8,stagger:.1,ease:'power3.out'},0);
  return()=>tl.kill()},[]);
 return <main className={"attract"+(diving?" diving":"")} ref={ref}>
  <div className="att-grad"/>
  <div className="cine-bars" aria-hidden="true"><i/><i/></div>
  {!webglOK()&&<div className="att-map"><NetMap/></div>}
  <div className="att-copy">
   <img className="att-anim att-logo" src={logo} alt="Positive Education"/>
   <h1 className="att-anim">Вас атакуют.<br/><em>Прямо сейчас.</em></h1>
   <p className="att-anim">Расставьте защиту, настройте конфигурации, найдите атакующего в трафике и событиях — и проверьте код ИИ-агента до мёржа.</p>
   <ol className="att-anim att-levels">{levels.map(l=><li key={l.id}>{l.name}</li>)}</ol>
   <Btn className="att-anim primary big" onClick={e=>{e.stopPropagation();onStart()}}>Начать смену</Btn>
   <p className="att-anim att-how">Пять уровней, около пяти минут. В финале — рейтинг и рекомендации по развитию.</p>
  </div>
  <AttBoard/>
  <SoundToggle className="att-sound"/>
  <button className="demo-open" onClick={e=>{e.stopPropagation();onDemo()}}>Демо-режим</button>
  <div className="att-ticker" aria-hidden="true"><div className="tk-track">{[0,1].map(k=><div key={k} className="tk-set">{items.map((t,i)=><span key={i}>{t}</span>)}</div>)}</div></div>
 </main>;
}

// Занавес между сценами. Панель едет через transform средствами браузера (WAAPI) — движение идёт
// на композиторе и не дёргается, пока за панелью монтируется тяжёлая 3D-сцена. Порядок: закрыть кадр →
// показать заставку уровня → onCovered (монтаж новой сцены за занавесом) → пауза + пара кадров на
// компиляцию шейдеров → onLift (анимации появления стартуют) → открыть → onDone.
function Curtain({level,lv=0,hold,onCovered,onLift,onDone}){
 const ref=useRef(),cb=useRef();cb.current={onCovered,onLift,onDone};
 const skipRef=useRef(null);
 useEffect(()=>{
  const el=ref.current,q=s=>el.querySelectorAll(s);let dead=false,held=false;const anims=[];
  const wait=ms=>new Promise(r=>{const t=setTimeout(r,ms);skipRef.current=()=>{clearTimeout(t);r()}});
  const frames=n=>new Promise(r=>{const f=()=>{if(--n<=0)r();else requestAnimationFrame(f)};requestAnimationFrame(f)});
  const ease='cubic-bezier(.77,0,.175,1)';
  const cover=()=>{held=true;holdGate();cb.current.onCovered&&cb.current.onCovered()};
  const lift=()=>{cb.current.onLift&&cb.current.onLift();held=false;releaseGate()};
  (async()=>{
   if(reduced()){cover();await wait(level?1400:150);await frames(2);if(dead)return;lift();cb.current.onDone&&cb.current.onDone();return}
   sfx.whoosh(.7);
   const a=el.animate([{transform:'translateY(100%)'},{transform:'translateY(0)'}],{duration:620,easing:ease,fill:'forwards'});anims.push(a);
   await a.finished.catch(()=>{});if(dead)return;
   // сначала тяжёлое: новая сцена монтируется и прогревается за закрытым кадром
   cover();
   await frames(3);await stagesWarm(4);if(dead)return;
   if(level){
    // текст заставки анимируется, когда главный поток уже свободен, и держится ~5 с
    el.classList.add('li-go');
    gsap.fromTo(q('.li-mask > *'),{yPercent:110},{yPercent:0,duration:.9,stagger:.12,ease:'expo.out'});
    gsap.fromTo(q('.li-steps li'),{opacity:0,y:10},{opacity:1,y:0,duration:.5,stagger:.06,ease:'power2.out',delay:.4});
    await wait(hold??5000);if(dead)return;
   }else{await wait(hold??300);if(dead)return}
   lift();sfx.whoosh(.8);
   const b=el.animate([{transform:'translateY(0)'},{transform:'translateY(-100%)'}],{duration:720,easing:ease,fill:'forwards'});anims.push(b);
   await b.finished.catch(()=>{});if(dead)return;
   cb.current.onDone&&cb.current.onDone();
  })();
  return()=>{dead=true;anims.forEach(x=>x.cancel());gsap.killTweensOf(q('.li-mask > *, .li-steps li'));if(held)releaseGate()};
 },[]);
 const skip=()=>skipRef.current&&skipRef.current();
 return <div className={'curtain'+(level?' with-level':'')} ref={ref} onClick={skip}>
  <i className="c-edge"/>
  {level&&<>
   <div className="li-body">
    <div className="li-mask"><div className="li-name">Уровень {lv+1} из {levels.length} · {level.name}</div></div>
    <div className="li-mask"><div className="li-title">{level.title}</div></div>
    <div className="li-mask"><div className="li-how">{level.how}</div></div>
   </div>
   <ol className="li-steps">{levels.map((l,i)=><li key={l.id} className={i<lv?'done':i===lv?'now':''}>{l.name}</li>)}</ol>
   <div className="li-skip">Нажмите, чтобы начать сразу</div>
  </>}
 </div>;
}

function Debrief({level,mistakes,hints=0,secs=0,onAnswer,onNext,last}){
 const b=useMemo(()=>{const pool=blitz[level.id];return pool[Math.floor(Math.random()*pool.length)]},[level.id]);
 const [ans,setAns]=useState(null),[bs,setBs]=useState(0),ref=useRef(),t0=useRef(Date.now());
 const acc=accScore(mistakes,hints),spd=speedScore(level.id,secs,acc),bl=ans==null?0:blitzScore(ans===b.ok,bs);
 useLayoutEffect(()=>{if(!reduced())gsap.from(ref.current.querySelectorAll('.d-anim'),{y:26,opacity:0,duration:.6,stagger:.06,ease:'power3.out'})},[]);
 useEffect(()=>{if(ans!=null&&!reduced())gsap.from(ref.current.querySelectorAll('.d-late'),{y:20,opacity:0,duration:.5,stagger:.05,ease:'power3.out'})},[ans]);
 const choose=i=>{if(ans!=null)return;const sec=(Date.now()-t0.current)/1000;setBs(sec);setAns(i);onAnswer(i===b.ok,sec);
  if(i===b.ok)sfx.good();else sfx.bad();
  if(reduced())return;
  if(i===b.ok)gsap.fromTo(ref.current.querySelector('.d-sweep'),{xPercent:-100,opacity:1},{xPercent:100,duration:1.1,ease:'power2.inOut'});
  else gsap.fromTo(ref.current,{x:0},{keyframes:[{x:-10,duration:.07,ease:'power2.out'},{x:6,duration:.09},{x:-2,duration:.1},{x:0,duration:.14,ease:'power2.out'}],clearProps:'x'})};
 return <div className="debrief-wrap"><div className="debrief" ref={ref}><i className="d-sweep" aria-hidden="true"/>
  <div className="d-anim d-head"><svg className="d-check" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22"/><path d="M14.5 24.5l6.5 6.5 12.5-13"/></svg>
   <div><small>Уровень {level.code} пройден за {fmtTime(secs)}</small><b>{level.name}</b></div>
   <div className="d-pts"><Num value={acc+spd+bl} prefix="+" delay={.35} dur={1.1}/><small>за уровень</small></div></div>
  <div className="d-anim d-brk">
   <div><small>Точность</small><Num value={acc} prefix="+" delay={.45}/><em>{mistakes?`ошибок: ${mistakes}`:'без ошибок'}{hints?` · подсказок: ${hints}`:''}</em></div>
   <div><small>Скорость</small><Num value={spd} prefix="+" delay={.6}/><em>{spd>=150?'суперскорость':spd>=50?'очень быстро':spd>=25?'неплохо':'можно быстрее'}</em></div>
   <div className={ans==null?'wait':''}><small>Блиц</small>{ans==null?<b>?</b>:<Num value={bl} prefix="+"/>}<em>{ans==null?'ответьте ниже':ans===b.ok?`ответ за ${Math.round(bs)} с`:'неверно'}</em></div>
  </div>
  <div className="d-anim blitz"><div className="blitz-tag">Блиц · чем быстрее, тем больше очков</div><h2>{b.q}</h2>
   <div className="answers">{b.a.map((a,i)=><button key={i} onClick={()=>choose(i)} disabled={ans!=null} className={ans==null?'':i===b.ok?'right':i===ans?'wrong':'dim'}><span>{String.fromCharCode(65+i)}</span>{a}</button>)}</div>
   {ans!=null&&<p className={'why d-late '+(ans===b.ok?'ok':'no')}>{ans===b.ok?'Верно. ':'Не совсем. '}{b.why}</p>}
  </div>
  {ans!=null&&<div className="d-progs d-late"><Btn className="primary" onClick={onNext}>{last?'Итоги смены':'Следующий уровень'}</Btn></div>}
 </div></div>;
}

function Results({results,onNext,onRestart,nick,onSaved}){
 const total=results.reduce((s,r)=>s+r.total,0),playSecs=results.reduce((s,r)=>s+r.secs+r.blitzSecs,0),speedSum=results.reduce((s,r)=>s+r.speed,0);
 const ref=useRef(),num=useRef(),barMax=Math.max(200,...results.map(r=>r.total));
 // результат пишется в таблицу сразу под ником, указанным перед сменой
 const [{place,at:mine,kept}]=useState(()=>nick?addRecord(nick,total,playSecs):{});
 useEffect(()=>{
  if(mine&&onSaved)onSaved(mine);
  if(!reduced()){
   gsap.from(ref.current.querySelectorAll('.f-anim'),{y:30,opacity:0,duration:.7,stagger:.07,ease:'power3.out'});
   gsap.from(ref.current.querySelectorAll('.f-bar i'),{scaleX:0,duration:1,stagger:.08,ease:'power3.out',delay:.6});
   gsap.fromTo(ref.current.querySelector('.rank-stamp'),{scale:1.9,opacity:0,rotate:-12,filter:'blur(6px)'},{scale:1,opacity:1,rotate:-3,filter:'blur(0px)',duration:.6,delay:2.2,ease:'expo.out'});
  }
 },[]);
 return <main className="results" ref={ref}>
  <section className="r-left">
   <span className="f-anim kicker">Смена закончена · время прохождения {fmtTime(playSecs)}</span>
   <h1 className="f-anim">Атака<br/><em>остановлена.</em></h1>
   <div className="f-anim score"><Odo value={total} delay={.55} dur={1.9}/><em className="rank-stamp">{rankFor(total)}</em></div>
   <div className="f-anim r-meta"><span>бонус скорости <b>+{speedSum}</b></span>{mine&&<span>{nick} · место на стенде <b>{place}</b></span>}{kept&&<span>ваш лучший результат <b>{kept}</b></span>}</div>
   <div className="f-anim r-btns"><Btn className="primary big" onClick={onNext}>К программам обучения</Btn><button className="ghost-btn" onClick={onRestart}>Пройти заново</button></div>
  </section>
  <section className="r-right">
   <ol className="r-levels">{levels.map((l,i)=>{const r=results[i]||{total:0};return <li key={l.id} className="f-anim"><span className="n">{l.name}</span><span className="f-bar"><i style={{transform:`scaleX(${r.total/barMax})`}}/></span><b>{r.total}</b></li>})}</ol>
   <div className="f-anim"><MiniBoard mine={mine}/></div>
  </section>
 </main>;
}

const fakeResults=()=>levels.map((_,i)=>{const acc=100-i*10,speed=46-i*7,blitz=i%2?0:44;return{acc,speed,blitz,total:acc+speed+blitz,secs:44+i*12,blitzSecs:7,mistakes:i,hints:0}});

function IdleWarn({left}){
 return <div className="idle-warn"><div><b>Вы ещё здесь?</b><p>Нажмите в любом месте, чтобы продолжить. Через {left} с игра вернётся на заставку.</p></div></div>;
}

// Облёт для зала: когда у стенда никого нет, камера сама летает по станциям уровней
const TOUR_STEP=7000;
function TourCaption({i}){
 const ref=useRef(),L=levels[i];
 useLayoutEffect(()=>{if(reduced())return;const q=s=>ref.current.querySelectorAll(s);
  const tl=gsap.timeline();tl.fromTo(q('.tc-k'),{yPercent:110},{yPercent:0,duration:.8,ease:'expo.out'},.9).fromTo(q('.tc-w'),{yPercent:112},{yPercent:0,duration:1,stagger:.08,ease:'expo.out'},1.05)
   .to(q('.tc-k,.tc-w'),{yPercent:-110,duration:.4,stagger:.02,ease:'power2.in'},TOUR_STEP/1000-.7);return()=>tl.kill()},[i]);
 return <div className="tour" ref={ref}>
  <div className="tour-scrim"/>
  <div className="tc-body" key={i}><div className="ft-mask"><div className="tc-k">Уровень {i+1} из {levels.length} · {L.name}</div></div>
   <h2 className="tc-title">{L.title.split(' ').map((w,j)=><span className="ft-mask" key={j}><span className="tc-w">{w}</span></span>)}</h2></div>
  <div className="tc-cta"><i/>Коснитесь экрана, чтобы начать смену</div>
 </div>;
}

// Заставка уровня поверх мира: камера пролетает к станции, название собирается словами и держится ~5 с
function FlightTitle({level,lv,onDone}){
 const ref=useRef(),cb=useRef(onDone);cb.current=onDone;const tlRef=useRef();
 useEffect(()=>{
  const el=ref.current,q=s=>el.querySelectorAll(s);let dead=false;
  const done=()=>{if(!dead)cb.current&&cb.current()};
  if(reduced()){const t=setTimeout(done,3200);return()=>{dead=true;clearTimeout(t)}}
  const tl=gsap.timeline({onComplete:done});tlRef.current=tl;
  tl.fromTo(q('.ft-k'),{yPercent:110},{yPercent:0,duration:.8,ease:'expo.out'},.45)
   .fromTo(q('.ft-w'),{yPercent:112},{yPercent:0,duration:1,stagger:.09,ease:'expo.out'},.6)
   .fromTo(q('.ft-how'),{y:18,opacity:0},{y:0,opacity:1,duration:.8,ease:'expo.out'},1.25)
   .fromTo(q('.ft-steps li'),{opacity:0,y:8},{opacity:1,y:0,duration:.5,stagger:.06,ease:'power2.out'},1.1)
   .addLabel('hold')
   .to({},{duration:3.4})
   .addLabel('out')
   .to(q('.ft-k,.ft-w'),{yPercent:-110,duration:.45,stagger:.025,ease:'power2.in'})
   .to(q('.ft-how,.ft-steps,.ft-skip'),{opacity:0,duration:.3},'<')
   .to(q('.ft-scrim'),{opacity:0,duration:.5},'<.15');
  return()=>{dead=true;tl.kill()};
 },[]);
 const skip=()=>{const tl=tlRef.current;if(tl&&tl.time()<tl.labels.out)tl.seek('out')};
 return <div className="flight" ref={ref} onClick={skip}>
  <div className="ft-scrim"/>
  <div className="ft-body">
   <div className="ft-mask"><div className="ft-k">Уровень {lv+1} из {levels.length} · {level.name}</div></div>
   <h2 className="ft-title">{level.title.split(' ').map((w,i)=><span className="ft-mask" key={i}><span className="ft-w">{w}</span></span>)}</h2>
   <p className="ft-how">{level.how}</p>
  </div>
  <ol className="ft-steps">{levels.map((l,i)=><li key={l.id} className={i<lv?'done':i===lv?'now':''}>{l.name}</li>)}</ol>
  <div className="ft-skip">Нажмите, чтобы начать сразу</div>
 </div>;
}

const GLW=webglOK()&&!reduced(); // один мир с пролётами камеры; без WebGL или при «уменьшить движение» — шторки

function App(){
 const k=useFit();
 const Q=+(new URLSearchParams(location.search).get('q'))||Math.min(2,k*(window.devicePixelRatio||1));
 const [screen,setScreen]=useState('attract'),[li,setLi]=useState(0),[curtain,setCurtain]=useState(null),[ready,setReady]=useState(true);
 const cid=useRef(0),snapRef=useRef(true);
 const [results,setResults]=useState([]),[pending,setPending]=useState(null),[t0,setT0]=useState(0),[seconds,setSeconds]=useState(0),[runId,setRunId]=useState(0);
 const [myRec,setMyRec]=useState(null),[demo,setDemo]=useState(false),[idleLeft,setIdleLeft]=useState(null),[diving,setDiving]=useState(false);
 const [trans,setTrans]=useState(null),[impact,setImpact]=useState(0),[tour,setTour]=useState(-1),[nick,setNick]=useState(''),[askNick,setAskNick]=useState(false),[,setBoardV]=useState(0);
 const keyRef=useRef(''),lastTouch=useRef(Date.now()),demoRef=useRef(false),lvT0=useRef(Date.now()),[admin,setAdmin]=useState(false);demoRef.current=demo;
 useEffect(()=>{const k=e=>{if(e.ctrlKey&&e.shiftKey&&(e.key==='L'||e.key==='l'||e.key==='Д'||e.key==='д')){e.preventDefault();setAdmin(a=>!a)}};addEventListener('keydown',k);return()=>removeEventListener('keydown',k)},[]);
 // мир ↔ экран
 useEffect(()=>{
  if(!GLW){net.set({paused:screen!=='play',station:'l0',phase:'work',slotsVisible:screen==='play'&&li===0&&ready});return}
  const sn=snapRef.current;snapRef.current=false;
  if(screen==='attract'){if(tour>=0)net.set({paused:false,station:'l'+tour,phase:'show',snap:false,slotsVisible:false});else net.set({paused:true});return}
  if(screen==='play')net.set({paused:false,station:'l'+li,phase:trans?'show':'work',snap:sn,slotsVisible:li===0&&!trans&&ready});
  if(screen==='peak')net.set({paused:false,station:'finale',phase:'show',snap:sn,slotsVisible:false});
  if(screen==='results'||screen==='final')net.set({paused:false,station:'finale',phase:'work',snap:sn,slotsVisible:false});
 },[screen,li,trans,ready,tour]);
 // облёт: через 30 с без касаний на заставке; круг по пяти станциям, затем снова планета
 useEffect(()=>{if(screen!=='attract'||!GLW||demo||askNick){setTour(-1);return}
  let i=-1,t;const tick=()=>{const idle=Date.now()-lastTouch.current;
   if(i<0){if(idle>30000&&!diving){i=0;setTour(0)}}else{i++;if(i>=levels.length){i=-1;setTour(-1);lastTouch.current=Date.now()}else setTour(i)}
   t=setTimeout(tick,i<0?1000:TOUR_STEP)};t=setTimeout(tick,1000);
  const stop=()=>{if(i>=0){i=-1;setTour(-1)}};addEventListener('pointerdown',stop,true);
  return()=>{clearTimeout(t);removeEventListener('pointerdown',stop,true)}},[screen,demo,diving,askNick]);
 // ввод ника брошен: минута без касаний — обратно на заставку
 useEffect(()=>{if(!askNick)return;const t=setInterval(()=>{if(Date.now()-lastTouch.current>60000)setAskNick(false)},1000);return()=>clearInterval(t)},[askNick]);
 useEffect(()=>{const a=hero.api;if(a)a.ctx.paused=tour>=0},[tour]);
 useEffect(()=>{loadQuestions()},[]);
 useEffect(()=>{const t=e=>{if(e.target.closest&&e.target.closest('button:not(:disabled)'))sfx.tap()};addEventListener('pointerdown',t,true);return()=>removeEventListener('pointerdown',t,true)},[]);
 useEffect(()=>{if(!import.meta.env.DEV)return;const h=location.hash.match(/^#(l([1-5])|results|final|demo)$/);if(!h)return;
  snapRef.current=true;
  if(h[1]==='demo'){setDemo(true);return}
  if(h[1]==='results'||h[1]==='final'){setResults(fakeResults());setSeconds(287);setScreen(h[1]==='final'?'final':'results');return}
  hintStat.n=0;lvT0.current=Date.now();setLi(+h[2]-1);setT0(Date.now());setScreen('play')},[]);
 const score=results.reduce((s,r)=>s+r.total,0);
 useEffect(()=>{if(screen==='attract'){setNick('');setTrans(null);releaseGate();const a=net.get().api;a&&a.resetFinale&&a.resetFinale()}},[screen]);

 // занавес (запасной путь без 3D): kind 'level' — с заставкой уровня lv, иначе короткая шторка
 const cut=(lv,covered,{lifted}={})=>setCurtain({id:++cid.current,lv,covered,lifted});
 const resetRun=()=>{hintStat.n=0;setMyRec(null);setResults([]);setLi(0);setPending(null);setSeconds(0);setRunId(x=>x+1)};
 // вход в уровень через мир: пролёт к станции + название; интерфейс уровня появляется после
 const enterLevel=n=>{holdGate();setReady(false);setTrans({lv:n,id:++cid.current})};
 const flightDone=()=>{const lv=trans&&trans.lv;setTrans(null);const now=Date.now();lvT0.current=now;if(lv===0)setT0(now);setReady(true);releaseGate()};
 const start=()=>{
  if(!GLW){cut(0,()=>{resetRun();setReady(false);setScreen('play');setDiving(false)},{lifted:()=>{const n=Date.now();lvT0.current=n;setT0(n);setReady(true)}});return}
  const a=net.get().api;a&&a.resetFinale&&a.resetFinale();
  setCurtain(null);resetRun();setT0(Date.now());setScreen('play');setDiving(false);enterLevel(0);
 };
 const home=()=>{setCurtain(null);setTrans(null);releaseGate();setReady(true);setScreen('attract');setPending(null)};
 useEffect(()=>{if(screen!=='play')return;const t=setInterval(()=>setSeconds(Math.floor((Date.now()-t0)/1000)),1000);return()=>clearInterval(t)},[screen,t0]);
 useEffect(()=>{
  const touch=()=>{lastTouch.current=Date.now();setIdleLeft(null)};
  ['pointerdown','keydown'].forEach(e=>addEventListener(e,touch));
  const t=setInterval(()=>{
   if(demoRef.current)return;
   const idle=Date.now()-lastTouch.current;
   setScreen(s=>{
    if(s==='attract'){return s}
    if(idle>IDLE_MS){setPending(null);setCurtain(null);setReady(true);setIdleLeft(null);return 'attract'}
    setIdleLeft(idle>IDLE_MS-WARN_MS?Math.ceil((IDLE_MS-idle)/1000):null);return s;
   });
  },1000);
  return()=>{['pointerdown','keydown'].forEach(e=>removeEventListener(e,touch));clearInterval(t)};
 },[]);

 const win=m=>setPending({mistakes:m,hints:hintStat.n,secs:(Date.now()-lvT0.current)/1000,blitz:null,blitzSecs:0});
 const answer=(ok,sec)=>setPending(p=>({...p,blitz:ok,blitzSecs:sec}));
 // пока игрок читает разбор, следующий уровень монтируется скрытно — пролёт потом не дёргается
 const preloading=GLW&&screen==='play'&&!!pending&&li<levels.length-1;
 useEffect(()=>{if(preloading)holdGate()},[preloading]);
 const next=()=>{const r=makeResult(L.id,{mistakes:pending.mistakes,hints:pending.hints,secs:pending.secs,blitzOk:pending.blitz,blitzSecs:pending.blitzSecs});const all=[...results,r];setResults(all);hintStat.n=0;
  if(li===levels.length-1){
   if(!GLW){cut(null,()=>{setPending(null);setScreen('results')});return}
   // пик: камера уходит вверх, купол защиты закрывает всю сеть, угрозы гаснут
   setPending(null);setScreen('peak');sfx.peak();
   setTimeout(()=>{const a=net.get().api;a&&a.finale&&a.finale()},1500);
   setTimeout(()=>{setScreen(s=>s==='peak'?'results':s)},4600);
   return}
  const n=li+1;
  if(!GLW){cut(n,()=>{setPending(null);setReady(false);setLi(n)},{lifted:()=>{lvT0.current=Date.now();setReady(true)}});return}
  setPending(null);setLi(n);enterLevel(n);sfx.level()};

 // демо: переход на любой экран без прохождения
 const demoAt=screen==='play'?(pending?'debrief':'l'+li):screen;
 const go=target=>{
  const i=demoOrder.indexOf(demoAt);
  if(target==='prev')target=demoOrder[Math.max(0,i-1)];
  if(target==='next')target=demoOrder[Math.min(demoOrder.length-1,i+1)];
  hintStat.n=0;setCurtain(null);setTrans(null);releaseGate();setReady(true);setPending(null);snapRef.current=true;
  if(target==='attract'){setScreen('attract');return}
  if(target==='results'||target==='final'){setResults(fakeResults());setSeconds(287);setScreen(target);return}
  setRunId(x=>x+1);setT0(Date.now());setSeconds(0);lvT0.current=Date.now();
  if(target==='debrief'){setResults(fakeResults().slice(0,li));setPending({mistakes:1,hints:0,secs:42,blitz:null,blitzSecs:0});setScreen('play');return}
  const n=+target.slice(1);setResults(fakeResults().slice(0,n));setLi(n);setScreen('play');
 };
 // нырок в планету → монтажная склейка «удар» → кран над сетью компании
 const beginDive=()=>{if(diving||curtain||trans)return;if(!webglOK()||!hero.api||reduced()){start();return}
  setDiving(true);hero.api.dive({coverAt:GLW?.9:.58,onCover:()=>{if(GLW){setImpact(x=>x+1);sfx.place()}start()}})};
 const askStart=()=>{if(!diving&&!curtain&&!trans)setAskNick(true)};
 const nickDone=name=>{setNick(name);setAskNick(false);beginDive()};
 const startDemo=()=>{setDemo(true);go('l0')};
 const exitDemo=()=>{setDemo(false);setResults([]);setPending(null);setScreen('attract')};

 const L=levels[li],View=views[L.id];
 keyRef.current=screen==='play'?runId+'-'+li:'';
 const shown=score+(pending?accScore(pending.mistakes,pending.hints)+speedScore(L.id,pending.secs,accScore(pending.mistakes,pending.hints))+(pending.blitz==null?0:blitzScore(pending.blitz,pending.blitzSecs)):0);
 const hosts=preloading?[li,li+1]:[li];
 return <div className="viewport"><div className={'stage'+(webglOK()?'':' nogl')+(GLW?' world':'')} style={{transform:`translate(-50%,-50%) scale(${k})`}}>
  {webglOK()&&<NetStage quality={Q}/>}
  {screen==='attract'&&webglOK()&&<div className={'hero-wrap'+(tour>=0?' away':'')}><Hero3D diving={diving} quality={Q}/></div>}
  {screen==='attract'&&<div className={'attract-wrap'+(tour>=0?' away':'')}><Attract onStart={askStart} onDemo={startDemo} diving={diving} locked={askNick}/></div>}
  {screen==='attract'&&askNick&&<NickPrompt onSave={nickDone} onCancel={()=>setAskNick(false)}/>}
  {screen==='attract'&&tour>=0&&<TourCaption i={tour}/>}
  {screen==='play'&&<>
   <div className={'hud-wrap'+(trans?' muted':'')}><Hud level={li} score={shown} seconds={trans&&trans.lv===0?0:seconds} onHome={home}/></div>
   {hosts.map(i=>{const V=views[levels[i].id],key=runId+'-'+i;
    return <div key={key} className={'level-host'+(i>0?' over-world':'')+(i!==li?' preload':'')+(i===li&&pending?' dim':'')+(i===li&&trans?' awaiting':'')} aria-hidden={i!==li}>
     <V level={levels[i]} onWin={m=>{if(keyRef.current===key)win(m)}}/></div>})}
   {pending&&<Debrief key={'d'+li+runId} level={L} mistakes={pending.mistakes} hints={pending.hints} secs={pending.secs} onAnswer={answer} onNext={next} last={li===levels.length-1}/>}
   {trans&&<FlightTitle key={trans.id} level={levels[trans.lv]} lv={trans.lv} onDone={flightDone}/>}
  </>}
  {screen==='results'&&<><Hud level={levels.length} score={score} seconds={seconds} onHome={home}/><Results results={results} nick={demo?'':nick} onSaved={setMyRec} onNext={()=>GLW?setScreen('final'):cut(null,()=>setScreen('final'))} onRestart={start}/></>}
  {screen==='final'&&<><Hud level={levels.length} score={score} seconds={seconds} onHome={home}/><Showcase results={results} mine={myRec} onRestart={start}/></>}
  {(screen==='results'||screen==='final')&&!webglOK()&&null}
  {impact>0&&<i key={impact} className="impact" aria-hidden="true"/>}
  {curtain&&<Curtain key={curtain.id} level={curtain.lv!=null?levels[curtain.lv]:null} lv={curtain.lv??0} onCovered={curtain.covered} onLift={curtain.lifted} onDone={()=>setCurtain(c=>c&&c.id===curtain.id?null:c)}/>}
  {idleLeft!=null&&!demo&&<IdleWarn left={idleLeft}/>}
  {demo&&<Demo at={demoAt} onGo={go} onExit={exitDemo} onBoard={()=>setBoardV(v=>v+1)}/>}
  {admin&&<BoardAdmin onClose={()=>setAdmin(false)}/>}
 </div></div>;
}
// ссылка ?seed — тестовые результаты на этом устройстве
const qs=new URLSearchParams(location.search);
if(qs.has('seed')){seedBoard();qs.delete('seed');const q=qs.toString();history.replaceState(null,'',location.pathname+(q?'?'+q:'')+location.hash)}
// сцены собираются из моделей Blender: ждём их загрузку (не дольше 8 с, иначе — простые формы)
kitReady.then(()=>createRoot(document.getElementById('root')).render(<App/>));
