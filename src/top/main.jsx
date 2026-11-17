import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import logo from '../assets/edu_long.svg';
import {useBoard,boardReady,boardMode} from '../records';
import {fmtTime} from '../scoring';
import {VList} from '../VList';
import {makeXlsx} from './xlsx';
import './top.css';

// Отдельная страница для организаторов: только просмотр топа и выгрузка в Excel
const TOPS=[[5,'Топ-5'],[10,'Топ-10'],[50,'Топ-50'],[100,'Топ-100'],[0,'Все']];
const fmtDate=ms=>new Date(ms).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const stamp=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};

function save(rows,top){
 const url=URL.createObjectURL(makeXlsx(rows)),a=document.createElement('a'),name=`positive-education-${top?'top-'+top:'all'}-${stamp()}.xlsx`;
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 return name;
}

function App(){
 const list=useBoard(),[top,setTop]=useState(5),[saved,setSaved]=useState('');
 const rows=top?list.slice(0,top):list;
 return <main className="tp">
  <header className="tp-top"><img src={logo} alt="Positive Education"/><a href="./">К игре</a></header>
  <div className="tp-head">
   <div><h1>Топ игроков</h1><p>Участников: {list.length}. {boardMode()==='server'?'Общий топ всех стендов, обновляется сам.':'Показаны результаты, сохранённые в этом браузере.'}</p></div>
   <button className="tp-export" disabled={!rows.length} onClick={()=>setSaved(save(rows,top))}>Скачать Excel</button>
  </div>
  <div className="tp-bar">
   <div className="tp-seg">{TOPS.map(([n,l])=><button key={n} aria-pressed={top===n} onClick={()=>{setTop(n);setSaved('')}}>{l}</button>)}</div>
   <span className="tp-saved" role="status">{saved&&`Сохранено: ${saved}`}</span>
  </div>
  <div className="tp-table">
   <div className="tp-row tp-th"><span>Место</span><span>Ник</span><span className="n">Очки</span><span className="n">Время</span><span className="n tp-date">Дата</span></div>
   {rows.length?<VList key={top} className="tp-list" style={{height:rows.length*52}} items={rows} rowH={52} span={60} render={(r,i)=><div className={'tp-row p'+(i+1)}>
     <span className="tp-place"><i>{i+1}</i></span><b>{r.name}</b><span className="n tp-score">{r.score}</span><span className="n">{fmtTime(r.secs)}</span><span className="n tp-date">{fmtDate(r.at)}</span></div>}/>
   :<p className="tp-empty">На этом устройстве пока нет результатов.</p>}
  </div>
 </main>;
}
boardReady.then(()=>createRoot(document.getElementById('root')).render(<App/>));
