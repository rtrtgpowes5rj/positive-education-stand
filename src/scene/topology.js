// Плоская схема сети в координатах viewBox 0 0 1000 640
export const poly=pts=>{
 const seg=[];let total=0;
 for(let i=1;i<pts.length;i++){const l=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);seg.push(l);total+=l}
 const at=dist=>{
  if(dist<=0)return pts[0];
  for(let i=0;i<seg.length;i++){if(dist<=seg[i]){const t=dist/(seg[i]||1);return[pts[i][0]+(pts[i+1][0]-pts[i][0])*t,pts[i][1]+(pts[i+1][1]-pts[i][1])*t]}dist-=seg[i]}
  return pts[pts.length-1];
 };
 const project=q=>{
  let best=Infinity,bd=0,acc=0;
  for(let i=0;i<seg.length;i++){
   const a=pts[i],b=pts[i+1],dx=b[0]-a[0],dy=b[1]-a[1];
   const t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/(seg[i]*seg[i]||1)));
   const px=a[0]+dx*t,py=a[1]+dy*t,dd=Math.hypot(q[0]-px,q[1]-py);
   if(dd<best){best=dd;bd=acc+seg[i]*t}acc+=seg[i];
  }
  return bd;
 };
 return{pts,total,at,project};
};
export const rev=a=>[...a].reverse();

export const IN=[[222,322],[292,322],[352,322],[430,322]];
export const TRUNK=[[430,322],[430,150]];
export const WEB=[[430,150],[548,150]];
export const MAIL=[[430,268],[538,268]];
export const CORE=[[430,322],[430,489],[470,489]];
export const PCS=[[622,500],[690,500],[690,540],[732,540]];
export const SOC=[[622,478],[650,478],[650,330],[775,330]];
export const cables=[IN,TRUNK,WEB,[[430,268],[430,322]],MAIL,CORE,PCS,SOC];

export const tools={
 ngfw:{name:'NGFW',product:'PT NGFW',desc:'фильтрует соединения на границе сети'},
 waf:{name:'WAF',product:'PT AF PRO',desc:'разбирает HTTP-запросы к приложению'},
 sandbox:{name:'Sandbox',product:'PT Sandbox',desc:'запускает вложения в изоляции'},
 nta:{name:'NTA',product:'PT NAD',desc:'видит движение внутри сети'},
 edr:{name:'EDR',product:'MaxPatrol EDR',desc:'следит за процессами на хостах'},
 siem:{name:'SIEM',product:'MaxPatrol SIEM',desc:'собирает и коррелирует события'}
};

// at — центр кольца; note — подпись от руки; na — смещение подписи
export const slots=[
 {id:'ngfw',at:[322,322],label:'Граница с интернетом',note:'сюда идут сканы',need:'фильтровать соединения на границе',tag:[-30,96,'middle']},
 {id:'waf',at:[490,150],label:'Веб-портал',note:'HTTPS · /api',need:'разбирать HTTP-запросы к порталу',tag:[38,-50,'end']},
 {id:'sandbox',at:[484,268],label:'Почтовый сервер',note:'вложения из писем',need:'проверять файлы до доставки',tag:[104,56,'middle']},
 {id:'nta',at:[546,440],label:'Ядро сети',note:'трафик между сегментами',need:'видеть трафик между узлами',tag:[0,100,'middle']},
 {id:'edr',at:[810,500],label:'Рабочие станции',note:'процессы на хостах',need:'контролировать процессы на хостах',tag:[0,100,'middle']},
 {id:'siem',at:[775,318],label:'SOC',note:'журналы всех систем',need:'собирать события со всех систем',tag:[0,-46,'middle']}
];

const R=(id,kind,world,guard,every,hit,delay=0,extra={})=>{
 const p=poly(world),s=guard&&slots.find(x=>x.id===guard);
 return{id,kind,guard,every,hit,delay,p,block:s&&kind==='threat'?p.project(s.at):null,...extra};
};
const webWorld=[...IN,[430,150],[548,150]];
const mailWorld=[...IN,[430,268],[538,268]];
const c2World=[...rev(PCS),[622,489],[470,489],[430,489],[430,322],...rev(IN)];
const latWorld=[...rev(PCS),[622,489],[470,489],[430,489],[430,322]];
export const routes=[
 R('scan','threat',IN,'ngfw',2300,'gw'),
 R('sqli','threat',webWorld,'waf',2900,'web',600),
 R('phish','threat',mailWorld,'sandbox',3700,'mail',1300),
 R('c2','threat',c2World,'edr',3300,'inet',400),
 R('lateral','threat',latWorld,'nta',2600,'core',1800),
 R('users','legit',webWorld,null,1150,null),
 R('lan','legit',rev(PCS),null,1700,null,300),
 R('logs','log',SOC,'siem',520,null,0,{needs:'siem'})
];
