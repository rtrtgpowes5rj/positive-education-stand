import {createStage,THREE,PAL,toon,glow,outline,canvasTex,sprite,Sparks,Rings,ease,lerp,hdr,glowTexture} from './core';
import {LineSegments2} from 'three/examples/jsm/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import {cables,slots,tools,routes} from '../scene/topology';
import {sfx} from '../audio';
import {createFlow} from './flow';
import {TIER} from './tier';
import {studio,kitModel,mats,rack,switchBox,appliance,monitor,socDesk,labelTex,mesh,rbox,setAccent,ledDot,glowMat} from './kit';

const K=0.028;
// плоскость схемы 1000×640 → мир (X вправо, Z к зрителю)
export const W=(x,y,h=0)=>new THREE.Vector3((x-500)*K,h,(y-320)*K);

const INK=0xece6da,OL=0x121316,BONE=0xd9d4c9,STEEL=0xbfc3c9;
export const domeShader={
 vertex:'varying vec3 vL;varying vec3 vN;varying vec3 vV;void main(){vL=position;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
 fragment:`
 uniform float uTime,uR,uScan,uHex;uniform vec3 uColor;uniform vec4 uHit[4];varying vec3 vL;varying vec3 vN;varying vec3 vV;
 float hexD(vec2 p){p=abs(p);return max(dot(p,normalize(vec2(1.,1.73))),p.x);}
 void main(){
  float fres=pow(1.-abs(dot(normalize(vN),vV)),2.2);
  float hs=uHex>0.?uHex:2.6;vec2 uv=vL.xz*hs+vec2(vL.y*.8*hs/2.6);
  vec2 r=vec2(1.,1.73);vec2 h=r*.5;vec2 a=mod(uv,r)-h;vec2 b=mod(uv-h,r)-h;vec2 gv=dot(a,a)<dot(b,b)?a:b;
  float line=1.-smoothstep(0.,.07,.5-hexD(gv));
  float acc=0.;
  for(int i=0;i<4;i++){if(uHit[i].w>0.){float tt=uTime-uHit[i].w;vec3 dir=normalize(uHit[i].xyz);float ang=acos(clamp(dot(normalize(vL),dir),-1.,1.));float q=(ang-tt*2.6)*5.;acc+=exp(-q*q)*exp(-tt*1.7);}}
  float pulse=.85+.15*sin(uTime*1.6+vL.y*3.);float sb=uScan>=0.?exp(-pow((vL.y/uR-uScan)*8.,2.)):0.;acc+=sb*1.6;
  float a2=fres*.5+line*(.12+.1*pulse)+acc*1.1;
  vec3 col=uColor*(.9+acc*3.+line*.7);
  col=min(col,vec3(6.));gl_FragColor=vec4(col*a2,a2);
 }`
};
const beamShader={
 vertex:'varying float vY;void main(){vY=uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragment:'uniform vec3 uColor;uniform float uA,uTime;varying float vY;void main(){float a=pow(1.-vY,2.2)*uA*(.8+.2*sin(uTime*3.+vY*9.));gl_FragColor=vec4(uColor*a,a);}'
};

function plateTex(name,prod,accent='#7fe0b5'){
 return canvasTex(256,128,(g,w,h)=>{
  g.fillStyle='#17191c';g.fillRect(0,0,w,h);
  g.strokeStyle='#ece6da';g.lineWidth=5;g.strokeRect(6,6,w-12,h-12);
  g.fillStyle='#ece6da';g.font='800 54px sans-serif';g.textAlign='center';g.fillText(name,w/2,66);
  g.fillStyle=accent;g.font='600 22px monospace';g.fillText(prod,w/2,100);
 });
}
function mailTex(){return canvasTex(256,256,(g,w,h)=>{g.fillStyle='#1d2024';g.fillRect(0,0,w,h);g.strokeStyle='#ece6da';g.lineWidth=7;g.strokeRect(34,64,w-68,h-128);g.beginPath();g.moveTo(34,64);g.lineTo(w/2,h/2+10);g.lineTo(w-34,64);g.stroke()})}
function socDraw(g,w,h,lit,t){
 g.fillStyle=lit?'#0f2a22':'#1a1c20';g.fillRect(0,0,w,h);
 g.strokeStyle=lit?'#7fe0b5':'#3b3d43';g.lineWidth=4;g.beginPath();
 for(let i=0;i<=16;i++){const x=10+i*(w-20)/16,y=h*.55+Math.sin(i*.9+t)*h*.2+Math.sin(i*2.3+t*2)*h*.08;i?g.lineTo(x,y):g.moveTo(x,y)}g.stroke();
 g.fillStyle=lit?'#7fe0b5':'#3b3d43';for(let i=0;i<5;i++)g.fillRect(14+i*46,h-24-((i*37+Math.floor(t*3))%40),30,6);
}
export function createNetwork(parent,{quality=1}={}){
 const ctx=createStage(parent,{bg:0x0b0c0e,fog:0.012,quality,bloom:[0.5,0.55,0.92],ao:true,dof:true,aoRadius:1.6,aoIntensity:2.4});
 const {scene,camera}=ctx;
 const sparks=new Sparks(ctx,2600),rings=new Rings(ctx,28);
 const api={ctx,stats:{breach:0,block:0},handlers:{},mode:'attract',pointer:{x:0,y:0},placed:{},dev:{},slotObj:{}};
 const emit=(n,a)=>{if(api.mode==='play'){if(n==='breach')sfx.breach();else if(n==='block')sfx.shield()}api.handlers[n]&&api.handlers[n](a)};
 api.on=(n,f)=>{api.handlers[n]=f};

 // ----- свет -----
 scene.add(new THREE.HemisphereLight(0x9aa6c4,0x1a1410,0.55));
 const key=new THREE.DirectionalLight(0xfff0dc,2.4);key.position.set(-9,18,12);key.castShadow=true;
 key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-20,right:20,top:14,bottom:-14,near:1,far:60});key.shadow.bias=-0.001;key.shadow.normalBias=.03;key.shadow.radius=3;
 scene.add(key);
 const rim=new THREE.DirectionalLight(0x6f8cff,1.1);rim.position.set(12,7,-15);scene.add(rim);
 const redL=new THREE.PointLight(0xfc3e24,14,22,1.8);redL.position.copy(W(150,300,3.5));scene.add(redL);

 // ----- пол -----
 const dot=canvasTex(64,64,(g,w,h)=>{g.fillStyle='#1c1f24';g.fillRect(0,0,w,h);g.fillStyle='#3a3f48';g.beginPath();g.arc(32,32,2.2,0,7);g.fill()});
 dot.wrapS=dot.wrapT=THREE.RepeatWrapping;dot.repeat.set(46,34);dot.colorSpace=THREE.SRGBColorSpace;
 studio(ctx.renderer,scene,{intensity:.45});const M=mats();
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(92,68),new THREE.MeshStandardMaterial({color:0x15181c,roughness:.82,metalness:.2}));floor.rotation.x=-Math.PI/2;floor.position.y=-0.02;floor.receiveShadow=true;scene.add(floor);

 const zone=(x0,y0,x1,y1,color=0x4a4d55)=>{
  const a=W(x0,y0,.02),b=W(x1,y0,.02),c=W(x1,y1,.02),d=W(x0,y1,.02);
  const g=new LineSegmentsGeometry();g.setPositions([a,b,b,c,c,d,d,a].flatMap(v=>[v.x,v.y,v.z]));
  const l=new LineSegments2(g,ctx.lineMat(color,1.6,1,true));l.computeLineDistances();scene.add(l);
  const fill=new THREE.Mesh(new THREE.PlaneGeometry((x1-x0)*K,(y1-y0)*K),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.025}));
  fill.rotation.x=-Math.PI/2;fill.position.copy(W((x0+x1)/2,(y0+y1)/2,.01));scene.add(fill);
 };
 zone(392,52,760,358);zone(392,380,964,626);
 // фальшпол серверной: плитки 1.2 м, часть — перфорированные (продув), стыки темнее
 const tileTex=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#2a2f37';g.fillRect(0,0,w,h);
  for(let i=0;i<2;i++)for(let j=0;j<2;j++){const x=i*128,y=j*128;g.fillStyle=(i+j)%2?'#2d323a':'#282c33';g.fillRect(x+3,y+3,122,122);
   if(i===1&&j===0){g.fillStyle='#1a1d22';for(let u=0;u<9;u++)for(let v=0;v<9;v++){g.beginPath();g.arc(x+18+u*11.5,y+18+v*11.5,3.1,0,7);g.fill()}}
   g.fillStyle='rgba(255,255,255,.05)';g.fillRect(x+3,y+3,122,2)}
  g.fillStyle='#14171b';for(let k=0;k<=2;k++){g.fillRect(k*128-2,0,4,h);g.fillRect(0,k*128-2,w,4)}});
 tileTex.wrapS=tileTex.wrapT=THREE.RepeatWrapping;tileTex.anisotropy=8;
 const slab=(x0,y0,x1,y1)=>{const a=W(x0,y0),b=W(x1,y1);const tt=tileTex.clone();tt.needsUpdate=true;tt.repeat.set((b.x-a.x)/2.4,(b.z-a.z)/2.4);
  const m=new THREE.Mesh(new THREE.BoxGeometry(b.x-a.x,.22,b.z-a.z),[0,1,2,3,4,5].map(i=>i===2?new THREE.MeshStandardMaterial({map:tt,roughness:.5,metalness:.35}):new THREE.MeshStandardMaterial({color:0x1b1e23,roughness:.55,metalness:.45})));m.position.set((a.x+b.x)/2,.0,(a.z+b.z)/2);m.receiveShadow=true;m.castShadow=true;scene.add(m);outline(ctx,m,0x80858f,1.6,.9)};
 slab(392,52,760,358);slab(392,380,964,626);

 // ----- кабели -----
 const cableMat=new THREE.MeshStandardMaterial({color:0x5c626c,roughness:.35,metalness:.7});
 cables.forEach((c,i)=>{
  const path=new THREE.CurvePath();
  for(let k=1;k<c.length;k++){const a=W(c[k-1][0],c[k-1][1],.09),b=W(c[k][0],c[k][1],.09);if(a.distanceTo(b)>.001)path.add(new THREE.LineCurve3(a,b))}
  const tube=new THREE.Mesh(new THREE.TubeGeometry(path,Math.max(8,c.length*10),.055,6,false),i===7?new THREE.MeshStandardMaterial({color:0x1f5a46,roughness:.4,metalness:.5,emissive:0x0a2a20}):cableMat);tube.receiveShadow=true;scene.add(tube);
 });

 // поток данных по кабелям (на видеокарте)
 const flow=createFlow(scene,cables,W,{count:TIER.gpuPackets,logCable:7});

 // ----- помощники -----
 const group=(name,pos)=>{const g=new THREE.Group();g.position.copy(pos);g.userData.name=name;g.userData.mats=[];scene.add(g);api.dev[name]=g;return g};
 const addBox=(parent,w,h,d,color,pos,{edge=true,cast=true,ow=2}={})=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),toon(color));m.position.copy(pos);m.castShadow=cast;m.receiveShadow=true;parent.add(m);
  if(edge){const l=outline(ctx,m,OL,ow,1);const root=parent.userData.mats;if(root)root.push(l.material)}
  return m;
 };
 const leds=[];
 const led=(parent,pos,kind=0)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(.09,.09,.04),glow(.3,1.8,1));m.position.copy(pos);parent.add(m);
  leds.push({m,kind,ph:Math.random()*6.28,c:kind===2?[2.2,1.5,.3]:[.35,1.9,1.1]});
 };

 // мягкие контактные тени
 const blobTex=canvasTex(128,128,(g,w,h)=>{const q=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);q.addColorStop(0,'rgba(0,0,0,.65)');q.addColorStop(.6,'rgba(0,0,0,.25)');q.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=q;g.fillRect(0,0,w,h)});
 const blob=(x,y,w,d,o=.9)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false,opacity:o}));m.rotation.x=-Math.PI/2;const p=W(x,y);m.position.set(p.x,.125,p.z);scene.add(m)};
 blob(590,150,6,5);blob(584,268,4.4,3.6);blob(546,489,7,3.6);blob(790,512,7.5,6);blob(860,420,8.5,3.5);blob(150,330,5.5,4.6,.5);
 // подсветка пола под схемой
 const floorGlow=new THREE.Mesh(new THREE.PlaneGeometry(46,32),new THREE.MeshBasicMaterial({map:glowTexture(),color:hdr(.22,.27,.4),transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));floorGlow.rotation.x=-Math.PI/2;floorGlow.position.set(2,.03,2);scene.add(floorGlow);
 // ===== облако интернета и пул угроз =====
 const inet=group('inet',W(150,330));
 const cloudMat=inet.userData.cm=new THREE.MeshStandardMaterial({color:0x8995a6,roughness:.62,metalness:.05,emissive:0x0a0e14});
 const kc=kitModel('cloud',M,{extra:{cloud:cloudMat}});
 if(kc){inet.add(kc);inet.userData.mats.push(cloudMat)}
 else [[0,.55,0,1.5],[1.4,.4,.5,1.0],[-1.4,.35,.3,1.05],[.5,.3,-1.2,.9],[-.6,.3,1.2,.85]].forEach(([x,y,z,r],i)=>{
  const cm=inet.userData.cm||(inet.userData.cm=new THREE.MeshStandardMaterial({color:0x8995a6,roughness:.62,metalness:.05,emissive:0x0a0e14}));const m=new THREE.Mesh(new THREE.SphereGeometry(r,32,24),cm);m.position.set(x,y+.2,z);m.castShadow=true;inet.add(m);if(i===0)inet.userData.mats.push(cm);
 });
 const hive=new THREE.Group();hive.position.copy(W(150,260,6.2));scene.add(hive);
 const core=new THREE.Mesh(new THREE.IcosahedronGeometry(1.25,0),new THREE.MeshStandardMaterial({color:0x1a0c0c,roughness:.3,metalness:.8,flatShading:true,emissive:0x2a0604}));core.castShadow=true;hive.add(core);
 const coreW=new THREE.Mesh(new THREE.IcosahedronGeometry(1.27,0),new THREE.MeshBasicMaterial({color:hdr(1.8,.2,.1),wireframe:true,toneMapped:false}));hive.add(coreW);
 const core2=new THREE.Mesh(new THREE.IcosahedronGeometry(.62,0),glow(3.2,.35,.2));hive.add(core2);
 const halo=sprite(0xfc3e24,6,.3);hive.add(halo);
 const orbit=[];
 for(let i=0;i<22;i++){
  const m=new THREE.Mesh(new THREE.OctahedronGeometry(.11+Math.random()*.08),glow(3,.4,.25));hive.add(m);
  orbit.push({m,r:1.9+Math.random()*2.1,a:Math.random()*6.28,s:.4+Math.random()*.9,y:(Math.random()-.5)*1.8,t:Math.random()*2-1});
 }
 for(let k=0;k<2;k++){const r=new THREE.Mesh(new THREE.TorusGeometry(2.4+k*.9,.025,6,96),glow(1.6,.2,.12));r.rotation.x=1.2+k*.6;r.rotation.y=k*.8;hive.add(r);orbit.push({ring:r,sp:.35+k*.2})}
 const sweep=new THREE.Mesh(new THREE.RingGeometry(.8,9.5,72,1,0,.75),new THREE.MeshBasicMaterial({color:hdr(1.6,.18,.1),transparent:true,opacity:.07,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
 sweep.rotation.x=-Math.PI/2;sweep.position.copy(W(150,330,.04));scene.add(sweep);


 // ===== периметр: световой барьер вдоль границы сети с проёмом под межсетевой экран =====
 const gw=group('gw',new THREE.Vector3(0,0,0));
 const fenceMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  uniforms:{uColor:{value:new THREE.Color(1.8,.16,.07)},uTime:{value:0},uA:{value:.9},uLen:{value:10}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform vec3 uColor;uniform float uTime,uA,uLen;varying vec2 vUv;void main(){float st=step(.5,fract(vUv.x*uLen*1.1+vUv.y*1.2-uTime*.35));float edge=smoothstep(.16,.0,min(vUv.y,1.-vUv.y));float a=(st*.42+edge*.9+.06)*uA;gl_FragColor=vec4(uColor*a,a);}'});
 gw.userData.fence=fenceMat;const fenceRail=new THREE.MeshBasicMaterial({color:new THREE.Color(2.2,.22,.1),toneMapped:false});gw.userData.rail=fenceRail;
 const FX=W(322,0).x,gapA=262,gapB=382;
 const segs=[[48,gapA],[gapB,604]];
 for(const [y0,y1] of segs){
  const z0=W(0,y0).z,z1=W(0,y1).z,len=z1-z0;
  const fm2=fenceMat.clone();fm2.uniforms=THREE.UniformsUtils.clone(fenceMat.uniforms);fm2.uniforms.uLen.value=len;gw.userData.bands=(gw.userData.bands||[]);gw.userData.bands.push(fm2);
  const band=new THREE.Mesh(new THREE.PlaneGeometry(len,1.1),fm2);band.rotation.set(-Math.PI/2,0,Math.PI/2);band.position.set(FX,.05,(z0+z1)/2);gw.add(band);
  for(let z=z0+.6;z<=z1-.3;z+=1.6){mesh(new THREE.CylinderGeometry(.09,.11,.7,14),M.frame,gw,[FX,.35,z]);const c=new THREE.Mesh(new THREE.CylinderGeometry(.095,.095,.06,14),fenceRail);c.position.set(FX,.72,z);gw.add(c)}
 }
 // столбы проёма
 [gapA,gapB].forEach(y=>{const z=W(0,y).z;const kp=kitModel('post',M,{glow:{led_r:fenceRail}});if(kp){kp.position.set(FX,0,z);gw.add(kp);return}mesh(rbox(.46,1.0,.46,.1),M.frame,gw,[FX,.5,z]);const cap=new THREE.Mesh(new THREE.BoxGeometry(.5,.1,.5),fenceRail);cap.position.set(FX,1.04,z);gw.add(cap)});
 gw.userData.mats.push(fenceMat);

 // ===== DMZ: веб-портал (две стойки) и почта =====
 const web=group('web',W(576,150));
 [[0,0,1.5,3.6,1.3,8],[2.2,.25,1.3,2.9,1.2,6]].forEach(([x,z,w,h,d,u])=>{const rk=rack(M,{w,h,d,units:u,leds});rk.position.set(x,0,z);web.add(rk);web.userData.mats.push(rk.userData.body.material)});
 const mail=group('mail',W(584,268));
 {const ap=appliance(M,{w:2.6,h:1.7,d:1.7,face:mailTex(),faceW:1.05,faceH:1.05,leds,light:true});mail.add(ap);mail.userData.mats.push(ap.userData.body.material)}
 // ===== ядро сети =====
 const core3=group('core',W(546,489));
 {const sw=switchBox(M,{w:4.4,h:.9,d:1.5,ports:14,leds});core3.add(sw);core3.userData.mats.push(sw.userData.body.material)}

 // ===== рабочие станции и SOC =====
 const ws=group('ws',W(790,512));
 [[-1.9,.5,.35],[-.6,1.5,.12],[.8,1.6,-.12],[2.0,.6,-.35]].forEach(([x,z,ry],i)=>{const mo=monitor(M,{w:1.5,h:.92,color:0x1b2b33});mo.position.set(x,0,z);mo.rotation.y=ry;ws.add(mo)});
 const soc=group('soc',W(775,262));
 const socTexs=[0,1,2].map(()=>canvasTex(256,160,(g,w,h)=>socDraw(g,w,h,false,0)));
  const desk=socDesk(M,{screens:socTexs});desk.position.set(0,-.3,0);soc.add(desk);
 const socScreens=desk.userData.screens;
 let socLit=false,socT=0,socAcc=0;

 // ===== станция ИИ-агента: пульт с ядром агента и шлюзами конвейера CI/CD =====
 const agent=group('agent',W(990,120));
 {const plat=mesh(new THREE.CylinderGeometry(2.3,2.5,.32,72),M.frame,agent,[0,.16,0]);agent.userData.mats.push(plat.material);
  const edge=new THREE.Mesh(new THREE.TorusGeometry(2.38,.025,6,128),glowMat(.3,1.6,1.1));edge.rotation.x=Math.PI/2;edge.position.y=.33;agent.add(edge);
  const pearl=new THREE.Mesh(new THREE.SphereGeometry(.82,64,48),new THREE.MeshPhysicalMaterial({color:0xe8ecf0,roughness:.2,metalness:.1,clearcoat:1,clearcoatRoughness:.08,sheen:.6,sheenColor:new THREE.Color(0x9fe6ff)}));pearl.position.y=1.75;pearl.castShadow=true;agent.add(pearl);
  const visor=new THREE.Mesh(new THREE.CapsuleGeometry(.13,.62,8,24),glowMat(.35,1.9,1.2));visor.rotation.z=Math.PI/2;visor.position.set(0,1.86,.74);agent.add(visor);
  const orb=new THREE.Mesh(new THREE.TorusGeometry(1.25,.016,8,128),glowMat(.5,1.2,1.6));orb.rotation.x=1.2;orb.position.y=1.75;agent.add(orb);agent.userData.orb=orb;
  mesh(new THREE.CylinderGeometry(.06,.16,1.1,16),M.steel,agent,[0,.85,0]);
  [-1.4,0,1.4].forEach((x,i)=>{const gate=mesh(rbox(.34,1.15,.34,.06),M.frame,agent,[x,.9,1.75]);const l=new THREE.Mesh(new THREE.BoxGeometry(.2,.05,.05),glowMat(.35,1.9,1.1));l.position.set(x,1.32,1.93);agent.add(l)});
  agent.userData.pearl=pearl;}
 {const path=new THREE.CurvePath();const pts=[W(990,120,.09),W(990,70,.09),W(660,70,.09),W(660,150,.09)];for(let k=1;k<pts.length;k++)path.add(new THREE.LineCurve3(pts[k-1],pts[k]));
  const t=new THREE.Mesh(new THREE.TubeGeometry(path,40,.055,6,false),cableMat);t.receiveShadow=true;scene.add(t)}
 blob(990,120,6,6,.8);

 // ===== слоты =====
 const slotObj=api.slotObj;
 const plateGeo=new THREE.BoxGeometry(1.5,.8,1.1);
 slots.forEach(s=>{
  const pos=W(s.at[0],s.at[1]);
  const g=new THREE.Group();g.position.copy(pos);scene.add(g);
  // открытый маркер
  const open=new THREE.Group();g.add(open);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.9,.03,6,96),glow(1.7,.07,.03));ring.rotation.x=Math.PI/2;ring.position.y=.16;open.add(ring);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(.95,48),new THREE.MeshBasicMaterial({color:hdr(1.2,.08,.04),transparent:true,opacity:.08,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));disc.rotation.x=-Math.PI/2;disc.position.y=.15;open.add(disc);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.1,4,1,true),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{uColor:{value:new THREE.Color(1.8,.12,.05)},uA:{value:.07},uTime:{value:0}},vertexShader:beamShader.vertex,fragmentShader:beamShader.fragment}));beam.position.y=2.5;beam.scale.y=-1;open.add(beam);
  const chev=[];const bm=glow(2.7,.12,.05);
  [[1,1],[-1,1],[1,-1],[-1,-1]].forEach(([sx,sz])=>{const b=new THREE.Group();b.userData={sx,sz,mat:bm};
   const a=new THREE.Mesh(new THREE.BoxGeometry(.8,.08,.14),bm);a.position.set(-sx*.4,0,0);const c=new THREE.Mesh(new THREE.BoxGeometry(.14,.08,.8),bm);c.position.set(0,0,-sz*.4);b.add(a,c);b.position.set(sx*1.05,.17,sz*1.05);open.add(b);chev.push(b)});
  // установленное средство
  const placed=new THREE.Group();placed.visible=false;g.add(placed);
  const apl=appliance(M,{w:1.7,h:.95,d:1.2,face:labelTex(tools[s.id].name,tools[s.id].product),faceW:1.2,faceH:.6,leds});apl.userData.face.position.x=.14;placed.add(apl);
  const strip=new THREE.Mesh(new THREE.BoxGeometry(1.5,.04,.04),glowMat(.4,2,1.3));strip.position.set(0,.97,.5);placed.add(strip);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(1,56,28,0,Math.PI*2,0,Math.PI/2),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
   uniforms:{uTime:{value:0},uR:{value:1},uScan:{value:-1},uColor:{value:new THREE.Color(.35,1.5,1.0)},uHit:{value:[0,1,2,3].map(()=>new THREE.Vector4(0,1,0,-1))}},vertexShader:domeShader.vertex,fragmentShader:domeShader.fragment}));
  dome.visible=false;g.add(dome);
  const pillar=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,9,32,1,true),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{uColor:{value:new THREE.Color(.4,1.9,1.3)},uA:{value:0},uTime:{value:0}},vertexShader:beamShader.vertex,fragmentShader:beamShader.fragment}));pillar.scale.y=-1;pillar.position.y=4.5;pillar.visible=false;g.add(pillar);
  const glowDisc=new THREE.Mesh(new THREE.CircleGeometry(2.4,48),new THREE.MeshBasicMaterial({color:hdr(.3,1.3,.9),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,map:glowTexture()}));glowDisc.rotation.x=-Math.PI/2;glowDisc.position.y=.12;glowDisc.visible=false;g.add(glowDisc);
  slotObj[s.id]={g,pillar,glowDisc,open,ring,disc,beam,chev,placed,dome,state:'open',hover:false,armed:false,wrong:0,t:-1,landed:false,hitK:0,r:s.id==='ngfw'?2.4:s.id==='siem'?2.1:2.3,s,pos};
  g.visible=false;
 });
 api.slotsVisible=false;

 // ===== пакеты =====
 const pools={
  threat:new THREE.InstancedMesh(new THREE.OctahedronGeometry(.2),glow(4,.55,.3),48),
  legit:new THREE.InstancedMesh(new THREE.SphereGeometry(.11,10,8),glow(1.4,1.35,1.2),48),
  log:new THREE.InstancedMesh(new THREE.BoxGeometry(.15,.15,.15),glow(.45,1.7,1.1),40)
 };
 const trailMats={threat:glow(2.2,.25,.12,{transparent:true,opacity:.7}),legit:glow(.6,.58,.5,{transparent:true,opacity:.45}),log:glow(.2,.8,.5,{transparent:true,opacity:.5})};
 const trails={};
 for(const k in pools){pools[k].frustumCulled=false;pools[k].count=0;scene.add(pools[k]);trails[k]=new THREE.InstancedMesh(new THREE.BoxGeometry(.05,.05,1),trailMats[k],48);trails[k].frustumCulled=false;trails[k].count=0;scene.add(trails[k])}
 let lastFx=-9;const live=[],last={};let tStart=performance.now();
 const speed={threat:150,legit:185,log:230};
 const mm=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),tmp=new THREE.Object3D();

 function flashDev(name){
  const g=api.dev[name];if(!g)return;
  g.userData.flash=1;
 }
 function packetEnd(k,blocked){
  const [x,y]=k.r.p.at(Math.min(k.d,k.r.p.total));const pos=W(x,y,.35);
  if(blocked){
   const so=slotObj[k.r.guard];api.stats.block++;
   sparks.emit(pos,26,{speed:3.4,color:[.5,1.8,1.2],size:.13,life:.7,gravity:-3});
   rings.fire(pos,[.4,1.6,1.1],1.9,.55,false);
   if(so){const dir=pos.clone().sub(so.g.position).normalize();so.hitK=(so.hitK+1)%4;const u=so.dome.material.uniforms.uHit.value[so.hitK];u.set(dir.x,dir.y,dir.z,ctx.t)}
   emit('block',{id:k.r.guard});
  }else if(k.r.kind==='threat'){
   api.stats.breach++;
   const g=api.dev[k.r.hit];flashDev(k.r.hit);
   sparks.emit(pos.clone().setY(.6),40,{speed:5,color:[3,.5,.3],size:.16,life:.9,gravity:-4});
   rings.fire(pos.clone().setY(.05),[2.4,.3,.15],4.2,.9,true);
   if(ctx.t-lastFx>2.2){lastFx=ctx.t;ctx.kick(.14);ctx.flashRed(.06)}emit('breach',{id:k.r.hit});
  }
 }

 // ===== камера =====
 const cam={pos:new THREE.Vector3(-30,34,52),tgt:new THREE.Vector3(1.2,0,.4),fov:36,ox:-262,oy:10};
 const presets={
  attract:{pos:new THREE.Vector3(-22,10.5,27.5),tgt:new THREE.Vector3(2.8,.8,.2),fov:30,ox:-440,oy:-30},
  play:{pos:new THREE.Vector3(-4,24,31),tgt:new THREE.Vector3(.8,0,.6),fov:30,ox:-372,oy:10},
  pre:{pos:new THREE.Vector3(-30,34,52),tgt:new THREE.Vector3(1.2,0,.4),fov:36,ox:-262,oy:10}
 };
 // станции уровней: show — эффектный ракурс под название уровня, work — фон во время игры (объект слева, размыт)
 const V=(x,y,z)=>new THREE.Vector3(x,y,z);
 const ST={
  l0:{show:{pos:V(7.5,4.2,12.5),tgt:V(-5.2,1.6,-.6),fov:34,ox:-330,oy:0},work:presets.play},
  l1:{show:{pos:V(-5.5,5,5.5),tgt:V(2.6,1.7,-4.4),fov:32,ox:-330,oy:-10},work:{pos:V(-9,9,9),tgt:V(2.4,1.4,-4.2),fov:32,ox:560,oy:0}},
  l2:{show:{pos:V(-6,4,13.5),tgt:V(1.6,.6,4.4),fov:32,ox:-330,oy:0},work:{pos:V(-9.5,8,15),tgt:V(1.4,.6,4.4),fov:32,ox:560,oy:0}},
  l3:{show:{pos:V(.5,4.6,7.5),tgt:V(7.8,1.5,-1.6),fov:32,ox:-330,oy:-10},work:{pos:V(-2,8,10.5),tgt:V(7.6,1.3,-1.6),fov:32,ox:560,oy:0}},
  l4:{show:{pos:V(6.4,5.2,2.8),tgt:V(13.7,1.6,-5.6),fov:32,ox:-330,oy:-10},work:{pos:V(4.4,8.5,5.4),tgt:V(13.6,1.4,-5.6),fov:32,ox:560,oy:0}},
  finale:{show:{pos:V(-2,44,36),tgt:V(2.6,0,1),fov:34,ox:0,oy:40},work:{pos:V(-2,44,36),tgt:V(2.6,0,1),fov:34,ox:-420,oy:40}}
 };
 // переходы камеры — по времени с плавным разгоном и торможением, пролёт идёт дугой вверх
 let target=presets.pre,from=null,tt=1,dur=1,arc=0,blurTo=0,blurNow=0,curKey='';
 api.station=null;
 api.goStation=(key,phase='show',{snap=false,time}={})=>{
  const st=ST[key];if(!st)return;const p=st[phase];const k=key+':'+phase;if(k===curKey&&!snap)return;curKey=k;
  api.station=key;api.phase=phase;api.mode=key==='l0'&&phase==='work'?'play':'station';
  blurTo=phase==='work'&&key!=='l0'?(key==='finale'?3.2:4.2):0;
  ctx.throttle=phase==='work'&&key!=='l0'?(TIER.name==='low'?3:2):1;
  if(snap){target=p;from=null;blurNow=blurTo;return}
  const longHop=from===null&&target===presets.pre;
  from={pos:cam.pos.clone(),tgt:cam.tgt.clone(),fov:cam.fov,ox:cam.ox,oy:cam.oy};target=p;tt=0;
  const d=from.pos.distanceTo(p.pos);dur=time||(phase==='work'?1.6:Math.min(3.2,1.9+d*.035));arc=phase==='work'?0:Math.min(6,d*.18);
  if(phase==='show')sfx.whoosh(dur*.8);
 };
 api.pause=v=>{ctx.paused=!!v};
 api.mode='pre';
 api.setMode=m=>{if(!presets[m]||api.mode===m)return;
  // первый переход из «pre» — сразу в ракурс, без второго пролёта камеры после занавеса
  if(api.mode==='pre'||ctx.t<1.2){api.mode=m;target=presets[m];from=null;return}
  api.mode=m;target=presets[m];
  from={pos:cam.pos.clone(),tgt:cam.tgt.clone(),fov:cam.fov,ox:cam.ox,oy:cam.oy};tt=0;dur=m==='play'?2.2:1.6};
 api.setPointer=(x,y)=>{api.pointer.x=x;api.pointer.y=y};
 camera.position.copy(cam.pos);
 const look=new THREE.Vector3();

 // ===== финал: купол защиты закрывает всю сеть, угрозы гаснут =====
 const bigDome=new THREE.Mesh(new THREE.SphereGeometry(24,128,64,0,Math.PI*2,0,Math.PI/2),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  uniforms:{uTime:{value:0},uHex:{value:.5},uR:{value:24},uScan:{value:-1},uColor:{value:new THREE.Color(.16,.7,.5)},uHit:{value:[0,1,2,3].map(()=>new THREE.Vector4(0,1,0,-1))}},vertexShader:domeShader.vertex,fragmentShader:domeShader.fragment}));
 bigDome.position.copy(W(640,330));bigDome.visible=false;scene.add(bigDome);let bigT=0;
 api.calm=false;
 api.finale=()=>{api.calm=true;bigT=0;bigDome.visible=true;bigDome.scale.setScalar(.08);
  for(let i=live.length-1;i>=0;i--){if(live[i].r.kind==='threat'){const k=live[i];const [x,y]=k.r.p.at(k.d);sparks.emit(W(x,y,.4),24,{speed:3,color:[.5,1.8,1.2],size:.12,life:.8,gravity:-2});live.splice(i,1)}}
  core.material.emissive.setHex(0x06261c);coreW.material.color.setRGB(.3,1.4,1);core2.material.color.setRGB(.4,1.8,1.2);
  rings.fire(W(640,330,.05),[.4,1.8,1.2],18,1.6,true);rings.fire(W(640,330,.05),[.3,1.2,.9],11,1.2,true);ctx.kick(.35)};
 api.resetFinale=()=>{api.calm=false;bigDome.visible=false;core.material.emissive.setHex(0x2a0604);coreW.material.color.setRGB(1.8,.2,.1);core2.material.color.setRGB(3.2,.35,.2)};

 // ===== API слотов =====
 api.setSlotsVisible=v=>{const was=api.slotsVisible;api.slotsVisible=v;let i=0;
  for(const id in slotObj){const so=slotObj[id];so.g.visible=v||so.state==='placed';if(v&&!was&&so.state!=='placed'){so.pop=-.35-i*.11;so.open.scale.setScalar(.001)}i++}};
 api.setArmed=id=>{for(const k in slotObj)slotObj[k].armed=!!id&&slotObj[k].state!=='placed'};
 api.setHover=id=>{for(const k in slotObj)slotObj[k].hover=k===id&&slotObj[k].state!=='placed'};
 api.setWrong=id=>{if(id&&slotObj[id]){slotObj[id].wrong=1;ctx.kick(.12);ctx.flashRed(.07)}};
 api.setPlaced=map=>{
  for(const id in slotObj){
   const so=slotObj[id];
   if(map[id]&&so.state!=='placed'){
    so.state='placed';so.t=0;so.landed=false;so.g.visible=true;so.placed.visible=true;so.open.visible=false;so.dome.visible=true;
    so.placed.position.y=7;so.dome.scale.setScalar(.01);
    if(id==='siem')socLit=true;
   }
   if(!map[id]&&so.state==='placed'){so.state='open';so.placed.visible=false;so.dome.visible=false;so.open.visible=true;so.g.visible=api.slotsVisible;socLit=false}
  }
  api.placed={...map};
 };
 api.slotScreen=(id,h=.6)=>{const so=slotObj[id];if(!so)return null;return ctx.project(so.g.position.clone().setY(h))};
 api.pointScreen=(x,y,h=0)=>ctx.project(W(x,y,h));
 api.threatCount=()=>live.filter(k=>k.r.kind==='threat').length;

 // ===== цикл =====
 let dust=0,streamAcc=0,ringT=0,punch=0;
 ctx.add((dt,t)=>{
  // камера
  if(from&&tt<1){tt=Math.min(1,tt+dt/dur);const e=tt<.5?4*tt*tt*tt:1-Math.pow(-2*tt+2,3)/2,b=Math.sin(Math.PI*tt);
   cam.pos.lerpVectors(from.pos,target.pos,e);cam.pos.y+=b*arc;cam.tgt.lerpVectors(from.tgt,target.tgt,e);cam.fov=lerp(from.fov,target.fov,e)+b*3;cam.ox=lerp(from.ox,target.ox,e);cam.oy=lerp(from.oy,target.oy,e);
   if(arc>0)ctx.aberrate(b*.35)}
  else if(!from){cam.pos.copy(target.pos);cam.tgt.copy(target.tgt);cam.fov=target.fov;cam.ox=target.ox;cam.oy=target.oy}
  const sway=api.mode==='attract'?.35:0;
  camera.position.set(cam.pos.x+Math.sin(t*.12)*1.3*sway+api.pointer.x*.9*sway,cam.pos.y+Math.sin(t*.17)*.35*sway+api.pointer.y*-.4*sway,cam.pos.z+Math.cos(t*.1)*.8*sway);
  const sh=ctx.fx.shake;if(sh>.001){camera.position.x+=(Math.random()-.5)*sh*.5;camera.position.y+=(Math.random()-.5)*sh*.35}
  look.copy(cam.tgt);camera.lookAt(look);
  blurNow=lerp(blurNow,blurTo+(from&&tt<1&&arc>0?Math.sin(Math.PI*tt)*1.6:0),1-Math.exp(-dt*3));ctx.focus(blurTo>0&&!(from&&tt<1)?2.5:camera.position.distanceTo(cam.tgt),blurNow);
  if(agent.userData.orb){agent.userData.orb.rotation.z=t*.5;agent.userData.pearl.position.y=1.75+Math.sin(t*1.3)*.06}
  if(bigDome.visible){bigT+=dt;const k=Math.min(1,bigT/2.4),e=1-Math.pow(1-k,3);bigDome.scale.setScalar(.08+.92*e);bigDome.material.uniforms.uTime.value=t;bigDome.material.uniforms.uScan.value=k<1?k*1.15:-1;bigDome.material.opacity=1}
  punch*=Math.pow(.02,dt);camera.fov=cam.fov-punch*2.6;
  camera.setViewOffset(ctx.w,ctx.h,cam.ox*ctx.w/1920,cam.oy*ctx.h/1080,ctx.w,ctx.h);camera.updateProjectionMatrix();

  flow.update(t,ctx.h);
  // пул угроз
  hive.rotation.y=t*.2;
  hive.position.y=6.2;
  orbit.forEach(o=>{if(o.ring){o.ring.rotation.z+=o.sp*dt;return}o.a+=o.s*dt;o.m.position.set(Math.cos(o.a)*o.r,o.y+Math.sin(o.a*1.7)*.4,Math.sin(o.a)*o.r);o.m.rotation.x+=dt*2;o.m.rotation.y+=dt*1.4});
  sweep.visible=false;
  // поток ботов из улья к шлюзу
  // атмосфера
  // пламя
  {const on=!!api.placed.ngfw,fm=gw.userData.fence;fm.uniforms.uTime.value=t;(gw.userData.bands||[]).forEach(b=>{b.uniforms.uTime.value=t;b.uniforms.uColor.value.copy(fm.uniforms.uColor.value);b.uniforms.uA.value=fm.uniforms.uA.value});const tc=on?[.3,1.5,1.0]:[1.8,.16,.07];fm.uniforms.uColor.value.lerp(new THREE.Color(...tc),1-Math.exp(-dt*4));gw.userData.rail.color.lerp(new THREE.Color(tc[0]*1.2,tc[1]*1.2,tc[2]*1.2),1-Math.exp(-dt*4));fm.uniforms.uA.value=lerp(fm.uniforms.uA.value,on?.5:.85+Math.sin(t*3)*.1+(gw.userData.flash||0)*.8,1-Math.exp(-dt*8))}
  // светодиоды
  for(const l of leds){const b=Math.sin(t*(.6+l.ph*.1)+l.ph)>-.4?1:.45;l.m.material.color.setRGB(l.c[0]*b,l.c[1]*b,l.c[2]*b)}
  // вспышки устройств
  for(const n in api.dev){const g=api.dev[n];if(g.userData.flash>0){g.userData.flash=Math.max(0,g.userData.flash-dt*2.6);const f=g.userData.flash;if(n!=='gw')g.scale.setScalar(1+f*.05);
   g.userData.mats.forEach(m=>{if(m.uniforms)return;setAccent(m,0xfc3e24,Math.min(1,f*1.6)*.3)})}}
  // экраны SOC
  socAcc+=dt;if(socAcc>.4){socAcc=0;socT+=.9;socScreens.forEach((s,i)=>{const c=s.material.map.image;socDraw(c.getContext('2d'),c.width,c.height,socLit,socT+i*1.7);s.material.map.needsUpdate=true})}

  // слоты
  for(const id in slotObj){
   const so=slotObj[id];if(!so.g.visible)continue;
   if(so.pop!=null&&so.pop<1){so.pop+=dt*2.4;const k=Math.max(0,Math.min(1,so.pop));so.open.scale.setScalar(Math.max(.001,ease.back(k)));if(so.pop>0&&so.pop-dt*2.4<=0){rings.fire(so.g.position.clone().setY(.12),[2.2,.25,.1],2.4,.6,true)}}
   if(so.state==='open'){
    const hov=so.hover,arm=so.armed;
    const cr=hov?[2.8,2.4,.5]:arm?[2.8,1.8,.35]:[2.7,.12,.05];
    so.ring.material.color.setRGB(...cr);so.disc.material.color.setRGB(cr[0]*.5,cr[1]*.5,cr[2]*.5);so.beam.material.uniforms.uColor.value.setRGB(cr[0]*.8,cr[1]*.8,cr[2]*.8);
    so.beam.visible=false;
    so.chev[0].userData.mat.color.setRGB(...cr);so.chev.forEach(b=>{const d=(hov?.78:arm?.92:1.05)+Math.sin(t*2+so.s.at[0])*.025;b.position.x=lerp(b.position.x,b.userData.sx*d,1-Math.exp(-dt*12));b.position.z=lerp(b.position.z,b.userData.sz*d,1-Math.exp(-dt*12))});
    const pulse=1+(hov?.1:0);so.ring.scale.setScalar(pulse*.92);so.disc.scale.setScalar(pulse);
    if(so.wrong>0){so.wrong=Math.max(0,so.wrong-dt*2.2);so.open.position.x=Math.sin(so.wrong*40)*so.wrong*.35;so.ring.material.color.setRGB(4,.2,.1)}else so.open.position.x=0;
   }else{
    if(so.t>=0){so.t+=dt;const k=Math.min(1,so.t/.75);
     so.placed.position.y=lerp(7,0,ease.out3(k));
     so.pillar.visible=true;const pk2=so.t<.75?Math.min(1,so.t/.2):Math.max(0,1-(so.t-.75)/.7);so.pillar.material.uniforms.uA.value=1.1*pk2;so.pillar.scale.x=so.pillar.scale.z=so.t<.75?1:1+(so.t-.75)*1.4;so.glowDisc.visible=true;so.glowDisc.material.opacity=so.t<.75?.2*k:Math.max(0,.55-(so.t-.75)*.6);
     if(so.t>.75)so.dome.material.uniforms.uScan.value=Math.min(1.25,(so.t-.75)/.9*1.25);
     if(!so.landed&&so.t>=.75){
      so.landed=true;const p=so.g.position.clone();
      sparks.emit(p.clone().setY(.3),60,{speed:5,color:[.6,2,1.3],size:.15,life:.9,gravity:-3,up:.4});
      rings.fire(p.clone().setY(.05),[.4,1.8,1.2],6.2,1.1,true);rings.fire(p.clone().setY(.05),[.3,1.2,.9],3.6,.8,true);
      ctx.kick(.45);ctx.aberrate(.7);punch=1;sparks.emit(p.clone().setY(.15),40,{speed:2.4,dir:new THREE.Vector3(0,.4,0),spread:1.6,color:[.9,.9,.8],size:.1,life:.7,gravity:-1.2})}
     if(so.landed){const kk=Math.min(1,(so.t-.75)/.9),r=Math.max(.01,so.r*ease.out3(kk));so.dome.scale.setScalar(r);so.dome.material.uniforms.uR.value=r;if(kk>=1){so.t=-1;so.pillar.visible=false;so.dome.material.uniforms.uScan.value=-1;so.glowDisc.material.opacity=.0;so.glowDisc.visible=false}}
    }
    so.dome.material.uniforms.uTime.value=t;
   }
  }

  // трафик
  const now=performance.now();
  for(const r of routes){
   if(r.needs&&!api.placed[r.needs])continue;
   if(api.calm&&r.kind==='threat')continue;
   const due=last[r.id]??(tStart+r.delay-r.every);
   if(now-due>=r.every){last[r.id]=now;live.push({r,d:0})}
  }
  const cnt={threat:0,legit:0,log:0};
  for(let i=live.length-1;i>=0;i--){
   const k=live[i];k.d+=speed[k.r.kind]*dt;
   const blocked=k.r.block!=null&&api.placed[k.r.guard]&&k.d>=k.r.block;
   if(blocked||k.d>=k.r.p.total){packetEnd(k,blocked);live.splice(i,1);continue}
   const [x,y]=k.r.p.at(k.d),[tx,ty]=k.r.p.at(Math.max(0,k.d-(k.r.kind==='threat'?34:20)));
   const a=W(x,y,.35),b=W(tx,ty,.35);
   const kind=k.r.kind,idx=cnt[kind]++;if(idx>=47)continue;
   tmp.position.copy(a);tmp.rotation.set(t*3,t*2,0);tmp.scale.setScalar(kind==='threat'?1+Math.sin(t*10+i)*.12:1);tmp.updateMatrix();pools[kind].setMatrixAt(idx,tmp.matrix);
   const len=a.distanceTo(b)||.01;tmp.position.copy(a).add(b).multiplyScalar(.5);tmp.lookAt(b.x,b.y,b.z);tmp.scale.set(1,1,len);tmp.updateMatrix();trails[kind].setMatrixAt(idx,tmp.matrix);
  }
  for(const kk in pools){pools[kk].count=Math.min(47,cnt[kk]);trails[kk].count=Math.min(47,cnt[kk]);pools[kk].instanceMatrix.needsUpdate=true;trails[kk].instanceMatrix.needsUpdate=true}
 });

 if(import.meta.env.DEV)window.__net=api;
 api.dispose=()=>ctx.dispose();
 return api;
}
