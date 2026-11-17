import React,{useState} from 'react';
import {levels} from './data';
import {seedBoard,clearBoard,boardMode} from './records';

// Демо-режим: свободная навигация по всем экранам без прохождения
export default function Demo({at,onGo,onExit,onBoard}){
 const [open,setOpen]=useState(false),[msg,setMsg]=useState('');
 const run=(f,ok)=>f().then(()=>{setMsg(ok);onBoard()}).catch(e=>setMsg(e.message||'Не удалось'));
 const items=[
  {id:'attract',label:'Заставка'},
  ...levels.map((l,i)=>({id:'l'+i,label:`${l.code} ${l.name}`})),
  {id:'debrief',label:'Разбор'},
  {id:'results',label:'Итоги'},
  {id:'final',label:'Витрина'}
 ];
 return <div className={'demo'+(open?' open':'')}>
  <button className="demo-tab" onClick={()=>setOpen(o=>!o)} aria-expanded={open}><i/>Демо {open?'▾':'▴'}</button>
  {open&&<nav className="demo-bar" aria-label="Демо-навигация">
   <button className="demo-step" onClick={()=>onGo('prev')} aria-label="Назад">←</button>
   {items.map(it=><button key={it.id} className={at===it.id?'on':''} onClick={()=>onGo(it.id)}>{it.label}</button>)}
   <button className="demo-step" onClick={()=>onGo('next')} aria-label="Вперёд">→</button>
   <button className="demo-top" onClick={()=>run(seedBoard,'Тестовые результаты добавлены')}>Нагенерить топ</button>
   <button onClick={()=>{if(confirm(boardMode()==='server'?'Очистить ОБЩИЙ топ на всех стендах, включая настоящие результаты?':'Очистить весь топ, включая настоящие результаты?'))run(clearBoard,'Топ очищен')}}>Очистить топ</button>
   <button className="demo-exit" onClick={onExit}>Выйти из демо</button>
   {msg&&<span className="demo-msg" role="status">{msg}</span>}
  </nav>}
 </div>;
}
export const demoOrder=['attract',...levels.map((_,i)=>'l'+i),'debrief','results','final'];
