import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

// Набор современных 3D-устройств: скруглённые корпуса, металл и светлые панели с отражениями окружения,
// светящиеся индикаторы и экраны. Используется во всех сценах.

// ---------- окружение «студия»: мягкие отражения на металле ----------
export function studio(renderer,scene,{intensity=.5}={}){
 const pm=new THREE.PMREMGenerator(renderer);
 const env=pm.fromScene(new RoomEnvironment(),.04).texture;pm.dispose();
 scene.environment=env;scene.environmentIntensity=intensity;
 return env;
}

// ---------- материалы ----------
const std=(color,roughness,metalness,extra={})=>new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});
export const mats=()=>({
 shell:std(0xb4b9c1,.34,.18),          // светлые панели корпуса (приглушены, чтобы не «горели» под светом)
 frame:std(0x2a2e35,.32,.7),           // тёмный анодированный металл
 dark:std(0x15181c,.55,.4),            // отсеки, решётки
 steel:std(0x9aa1ab,.28,.85),          // ножки, стойки
 rubber:std(0x0b0c0e,.9,0),
 glass:new THREE.MeshPhysicalMaterial({color:0x101418,roughness:.08,metalness:0,transparent:true,opacity:.42,clearcoat:1,clearcoatRoughness:.05})
});
export const glowMat=(r,g,b)=>new THREE.MeshBasicMaterial({color:new THREE.Color(r,g,b),toneMapped:false});

const RB={};
export const rbox=(w,h,d,r=.06)=>{const k=[w,h,d,r].map(v=>v.toFixed(3)).join('|');if(!RB[k])RB[k]=new RoundedBoxGeometry(w,h,d,3,Math.min(r,w/2-.001,h/2-.001,d/2-.001));return RB[k]};
export function mesh(geo,mat,parent,pos=[0,0,0],{cast=true,receive=true}={}){
 const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.castShadow=cast;m.receiveShadow=receive;parent.add(m);return m;
}

// мягкая контактная тень под прибором: объект «стоит», а не висит
let ctTex;
const contactTex=()=>{if(ctTex)return ctTex;const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
 const gr=g.createRadialGradient(64,64,4,64,64,64);gr.addColorStop(0,'rgba(0,0,0,.85)');gr.addColorStop(.45,'rgba(0,0,0,.45)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);
 ctTex=new THREE.CanvasTexture(c);return ctTex};
export function contact(parent,w,d,opacity=.75){
 const m=new THREE.Mesh(new THREE.PlaneGeometry(w*1.5,d*1.5),new THREE.MeshBasicMaterial({map:contactTex(),color:0x000000,transparent:true,opacity,depthWrite:false,toneMapped:false}));
 m.rotation.x=-Math.PI/2;m.position.y=.012;m.renderOrder=-1;parent.add(m);return m;
}

// акцентный материал для «подсветки» корпуса (вспышка при атаке, выделение)
export function accent(material,base=0x000000){material.emissive=new THREE.Color(base);material.userData.base=new THREE.Color(base);return material}
export function setAccent(material,hex,k=1){
 const b=material.userData.base||new THREE.Color(0);
 if(hex==null){material.emissive.copy(b);return}
 material.emissive.copy(b).lerp(new THREE.Color(hex),k);
}

// ---------- модели из Blender (blender/kit.py → public/models/kit.glb) ----------
// Пока файл не загрузился или не нашёлся, устройства собираются из простых форм, как раньше.
let KIT=null;
export const kitReady=new Promise(res=>{
 try{new GLTFLoader().load('./models/kit.glb',g=>{KIT={};g.scene.children.forEach(o=>{KIT[o.name]=o});res(true)},undefined,()=>res(false))}catch(e){res(false)}
 setTimeout(()=>res(false),8000);
});
const LED={led_g:[.35,1.9,1.1],led_a:[2.2,1.5,.3],led_b:[.3,1.5,2.2],led_r:[2.4,.22,.1]};
// Копия модели: материалы подменяются общими по имени метки, корпус получает свой материал для вспышек
export function kitModel(name,M,{size,base,body='frame',accentColor=0x000000,leds,faces=[],extra={},glow={}}={}){
 const src=KIT&&KIT[name];if(!src)return null;
 const g=new THREE.Group(),o=src.clone(true);o.position.set(0,0,0);g.add(o);
 if(size&&base)o.scale.set(size[0]/base[0],size[1]/base[1],size[2]/base[2]);
 const bodyMat=M[body]?accent(M[body].clone(),accentColor):null,fc=[];
 const map={shell:M.shell,frame:M.frame,dark:M.dark,steel:M.steel,rubber:M.rubber,glass:M.glass,mesh:M.dark,fabric:M.fabric||(M.fabric=new THREE.MeshStandardMaterial({color:0x1a1c21,roughness:.9})),...extra};
 o.traverse(m=>{
  if(!m.isMesh)return;const n=m.material.name;
  if(glow[n]){m.material=glow[n];return}
  if(LED[n]){const c=LED[n];m.material=glowMat(...c);if(leds&&(n==='led_g'||n==='led_a'))leds.push({m,c,ph:Math.random()*6.28});return}
  if(n==='screen'){fc.push(m);return}
  m.material=n===body&&bodyMat?bodyMat:(map[n]||M.dark);m.castShadow=n!=='glass';m.receiveShadow=true;
 });
 fc.sort((a,b)=>(a.name>b.name?1:-1)).forEach((m,i)=>{const t=faces[i];if(t){t.flipY=false;t.needsUpdate=true}m.material=t?new THREE.MeshBasicMaterial({map:t,toneMapped:false}):new THREE.MeshStandardMaterial({color:0x1b2b33,emissive:0x0d1a20,roughness:.2})});
 g.userData.body={material:bodyMat};g.userData.faces=fc;return g;
}

// ---------- устройства ----------
// LED-точка; список leds — для мигания
export function ledDot(parent,pos,color=[.35,1.9,1.1],size=.07,leds){
 const m=new THREE.Mesh(new THREE.SphereGeometry(size,10,8),glowMat(...color));m.position.set(...pos);parent.add(m);
 if(leds)leds.push({m,c:color,ph:Math.random()*6.28});return m;
}
// тонкая светящаяся полоска
export function strip(parent,w,pos,color=[.35,1.9,1.1],h=.035){
 const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,.02),glowMat(...color));m.position.set(...pos);parent.add(m);return m;
}

// Серверная стойка: тёмный корпус, стеклянная дверь, юниты с индикаторами, световая полоса сбоку
export function rack(M,{w=1.4,h=3.4,d=1.2,units=7,leds,accentColor=0x000000}={}){
 const k=kitModel('rack',M,{size:[w,h,d],base:[1.5,3.6,1.3],accentColor,leds});if(k){contact(k,w,d);return k}
 const g=new THREE.Group();
 const body=mesh(rbox(w,h,d,.08),accent(M.frame.clone(),accentColor),g,[0,h/2,0]);
 mesh(rbox(w*.98,.12,d*.98,.04),M.steel,g,[0,h-.02,0]);
 const inner=w*.78,uh=(h-.5)/units;
 for(let i=0;i<units;i++){
  const y=.3+uh*(i+.5);
  mesh(rbox(inner,uh*.78,.08,.02),i%3===1?M.shell:M.dark,g,[0,y,d/2-.02],{cast:false});
  for(let k=0;k<5;k++)mesh(new THREE.BoxGeometry(inner*.09,uh*.3,.02),M.rubber,g,[-inner*.36+k*inner*.11,y,d/2+.025],{cast:false,receive:false});
  ledDot(g,[inner*.38,y+uh*.12,d/2+.03],i%4===2?[2.2,1.5,.3]:[.35,1.9,1.1],.045,leds);
  ledDot(g,[inner*.3,y+uh*.12,d/2+.03],[.35,1.9,1.1],.035,leds);
 }
 const door=new THREE.Mesh(rbox(w*.96,h*.94,.03,.02),M.glass);door.position.set(0,h/2,d/2+.06);g.add(door);
 strip(g,.03,[-w/2+.06,h/2,d/2+.08],[.3,1.5,2.2],h*.82).scale.set(1,1,1);
 contact(g,w,d);g.userData.body=body;return g;
}

// Плоский сетевой коммутатор: 1–2 юнита, сетка портов, индикаторы
export function switchBox(M,{w=4.2,h=.7,d=1.4,ports=12,rows=2,leds,accentColor=0x000000}={}){
 const k=kitModel('switch',M,{size:[w,h,d],base:[4.4,.9,1.5],accentColor,leds});if(k){contact(k,w,d);return k}
 const g=new THREE.Group();
 const body=mesh(rbox(w,h,d,.08),accent(M.frame.clone(),accentColor),g,[0,h/2,0]);
 mesh(rbox(w*.97,h*.7,.05,.03),M.dark,g,[0,h/2,d/2+.0],{cast:false});
 const pw=(w*.72)/ports;
 for(let r=0;r<rows;r++)for(let i=0;i<ports;i++){
  const x=-w*.36+pw*(i+.5),y=h/2+(rows>1?(r?-.12:.1):0);
  mesh(new THREE.BoxGeometry(pw*.62,.13,.05),M.rubber,g,[x,y,d/2+.03],{cast:false,receive:false});
  if(r===0)ledDot(g,[x,y+.11,d/2+.04],i%5===3?[2.2,1.5,.3]:[.35,1.9,1.1],.025,leds);
 }
 strip(g,w*.16,[w*.4,h/2,d/2+.04],[.3,1.5,2.2],.05);
 contact(g,w,d);g.userData.body=body;return g;
}

// Аппарат (сервер/шлюз/«коробка»): корпус, решётка, лицевая панель с экраном/иконкой
export function appliance(M,{w=2.4,h=1.4,d=1.6,face=null,faceW,faceH,leds,accentColor=0x000000,light=false}={}){
 const small=h<1.2,k=kitModel(small?'tool':'appliance',M,{size:[w,h,d],base:small?[1.7,.95,1.2]:[2.6,1.7,1.7],body:light?'shell':'frame',accentColor,leds,faces:[face]});
 if(k){k.userData.face=k.userData.faces[0];contact(k,w,d);return k}
 const g=new THREE.Group();
 const body=mesh(rbox(w,h,d,.1),accent((light?M.shell:M.frame).clone(),accentColor),g,[0,h/2,0]);
 // решётка
 for(let i=0;i<6;i++)mesh(new THREE.BoxGeometry(.05,h*.5,.02),M.rubber,g,[-w/2+.22+i*.1,h/2,d/2+.01],{cast:false,receive:false});
 if(face){const fw=faceW||w*.52,fh=faceH||h*.62;const p=new THREE.Mesh(new THREE.PlaneGeometry(fw,fh),new THREE.MeshBasicMaterial({map:face,toneMapped:false}));p.position.set(w*.12,h/2,d/2+.012);g.add(p);g.userData.face=p}
 ledDot(g,[w/2-.18,h*.2,d/2+.02],[.35,1.9,1.1],.045,leds);
 strip(g,w*.3,[0,.05,d/2+.01],[.3,1.5,2.2],.03);
 contact(g,w,d);g.userData.body=body;return g;
}

// Монитор на подставке; screen — текстура или цвет
export function monitor(M,{w=1.7,h=1.05,screen=null,color=0x1d2a30,tilt=-.08}={}){
 const k=kitModel('monitor',M,{size:[w,w*1.0/1.5,w],base:[1.5,1,1.5],faces:[screen]});if(k){k.userData.screen=k.userData.faces[0];contact(k,.9,.6,.6);return k}
 const g=new THREE.Group();
 const head=new THREE.Group();head.position.y=1.0;head.rotation.x=tilt;g.add(head);
 const fr=mesh(rbox(w,h,.08,.04),accent(M.frame.clone()),head,[0,0,0]);g.userData.body=fr;
 const scrMat=screen?new THREE.MeshBasicMaterial({map:screen,toneMapped:false}):new THREE.MeshStandardMaterial({color,emissive:new THREE.Color(color).multiplyScalar(.6),roughness:.2});
 const s=new THREE.Mesh(new THREE.PlaneGeometry(w*.92,h*.86),scrMat);s.position.z=.045;head.add(s);
 mesh(new THREE.CylinderGeometry(.05,.07,.55,16),M.steel,g,[0,.5,-.06]);
 mesh(rbox(.75,.06,.45,.03),M.steel,g,[0,.03,0]);
 contact(g,.9,.6,.6);g.userData.screen=s;return g;
}

// Ноутбук-клиент
export function laptop(M,{w=1.9,screen=null}={}){
 const k=kitModel('laptop',M,{size:[w,w,w],base:[1.9,1.9,1.9],body:'shell',faces:[screen]});if(k){contact(k,w,w*.68,.6);return k}
 const g=new THREE.Group();
 mesh(rbox(w,.08,w*.68,.04),M.shell,g,[0,.04,0]);contact(g,w,w*.68,.6);
 mesh(rbox(w*.86,.01,w*.38,.01),M.dark,g,[0,.085,-.04],{cast:false});
 const lid=new THREE.Group();lid.position.set(0,.08,-w*.34);lid.rotation.x=-.25;g.add(lid);
 mesh(rbox(w,w*.62,.05,.03),M.shell,lid,[0,w*.31,0]);
 const s=new THREE.Mesh(new THREE.PlaneGeometry(w*.9,w*.54),screen?new THREE.MeshBasicMaterial({map:screen,toneMapped:false}):new THREE.MeshStandardMaterial({color:0x1f3a31,emissive:0x102a22}));s.position.set(0,w*.31,.03);lid.add(s);
 return g;
}

// Пульт SOC: стол на опорах и три монитора
export function socDesk(M,{screens=[]}={}){
 const k=kitModel('soc',M,{faces:screens});if(k){k.userData.screens=k.userData.faces;return k}
 const g=new THREE.Group();
 mesh(rbox(6.2,.12,1.6,.05),M.frame,g,[0,.82,.4]);
 [-2.8,2.8].forEach(x=>mesh(rbox(.12,.8,1.3,.04),M.steel,g,[x,.4,.4]));
 const heads=[];
 [-2.05,0,2.05].forEach((x,i)=>{
  const h=new THREE.Group();h.position.set(x,1.6+(i===1?.12:0),0);h.rotation.y=(i-1)*-.18;g.add(h);
  mesh(rbox(1.95,1.2,.08,.04),M.frame,h,[0,0,0]);
  const s=new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.06),new THREE.MeshBasicMaterial({map:screens[i]||null,color:screens[i]?0xffffff:0x1d2a30,toneMapped:false}));s.position.z=.045;h.add(s);
  mesh(new THREE.CylinderGeometry(.04,.04,.7,10),M.steel,g,[x,1.15,-.05]);
  heads.push(s);
 });
 g.userData.screens=heads;return g;
}

// Подписная табличка-текстура на корпусе (для средств защиты)
export function labelTex(title,sub,accentHex='#7fe0b5'){
 const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');
 const gr=x.createLinearGradient(0,0,0,256);gr.addColorStop(0,'#10161a');gr.addColorStop(1,'#0a0d10');x.fillStyle=gr;x.fillRect(0,0,512,256);
 x.strokeStyle=accentHex;x.globalAlpha=.55;x.lineWidth=4;x.strokeRect(10,10,492,236);x.globalAlpha=1;
 x.fillStyle=accentHex;x.fillRect(28,34,8,64);
 x.fillStyle='#eef2f4';x.font='800 92px Golos, Arial, sans-serif';x.textBaseline='middle';x.fillText(title,52,72);
 x.fillStyle=accentHex;x.font='600 34px "JetBrains Mono", monospace';x.fillText(sub,30,170);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
