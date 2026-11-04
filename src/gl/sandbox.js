import {THREE,toon,glow,outline,sprite,hdr,ease,lerp,labelSprite,panelScene,box,canvasTex,OL,BONE,STEEL} from './core';
import {domeShader} from './network';
import {mats,rbox,mesh,kitModel} from './kit';

const RED=[1.9,.16,.07],MINT=[.4,1.6,1.1],AMB=[2.0,1.3,.25],DIM=[.35,.38,.45];
const mat=(c,x={})=>glow(c[0],c[1],c[2],x);

// Права агента — шесть «портов» вокруг ядра. Нужные для задачи — светлые; лишние — со знаком опасности.
export const PERMS=[
 {id:'read',label:'репозиторий',need:true,pos:[-4.5,-1.4]},
 {id:'tests',label:'тесты в песочнице',need:true,pos:[4.5,-1.4]},
 {id:'net',label:'интернет',need:false,pos:[-3.6,3.0]},
 {id:'secrets',label:'секреты CI',need:false,pos:[-2.2,-5.0]},
 {id:'deploy',label:'деплой в прод',need:false,pos:[3.6,3.0]}
];

export function createAgentSandbox(parent,{quality=1,cb={},steps=[]}={}){
 const ctx=panelScene(parent,{quality,pos:[0,12,17],look:[0,.8,.8],fov:42,sway:0,bloom:[.45,.5,.92]});
 const {scene,camera}=ctx;const sp=ctx.sparks,rg=ctx.rings;
 const api={ctx,grant:{},hot:null,hover:null,pipe:null};

 // платформа и ядро
 const plat=new THREE.Mesh(new THREE.CylinderGeometry(3.3,3.5,.3,96),new THREE.MeshStandardMaterial({color:0x1f2329,roughness:.35,metalness:.7}));plat.position.y=.15;plat.receiveShadow=true;scene.add(plat);outline(ctx,plat,0x80858f,1.6,.9,30);
 const platRing=new THREE.Mesh(new THREE.TorusGeometry(2.9,.04,8,96),mat([.4,.8,.9]));platRing.rotation.x=Math.PI/2;platRing.position.y=.33;scene.add(platRing);
 const core=new THREE.Group();core.position.set(0,2.4,0);scene.add(core);
 const M=mats();
 const body=new THREE.Mesh(new THREE.SphereGeometry(1.05,64,48),new THREE.MeshPhysicalMaterial({color:0xe8ecf0,roughness:.22,metalness:.1,clearcoat:1,clearcoatRoughness:.08,sheen:.6,sheenColor:new THREE.Color(0x9fe6ff)}));body.castShadow=true;core.add(body);
 const band=new THREE.Mesh(new THREE.TorusGeometry(1.07,.05,12,96),M.frame);band.rotation.x=Math.PI/2;core.add(band);
 const orb=new THREE.Mesh(new THREE.TorusGeometry(1.55,.018,8,128),glow(.5,1.2,1.6));orb.rotation.x=1.25;core.add(orb);
 const visor=new THREE.Mesh(new THREE.CapsuleGeometry(.16,.8,8,24),mat(MINT));visor.rotation.z=Math.PI/2;visor.position.set(0,.18,.93);core.add(visor);
 const halo=sprite(0x7fe0b5,4.2,.22);core.add(halo);
 const leg=new THREE.Mesh(new THREE.CylinderGeometry(.06,.16,1.6,16),M.steel);leg.position.y=-1.5;core.add(leg);

 // защитный купол «песочница»
 const domeMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  uniforms:{uTime:{value:0},uR:{value:3.45},uScan:{value:-1},uColor:{value:new THREE.Color(.3,1.3,.9)},uHit:{value:[0,1,2,3].map(()=>new THREE.Vector4(0,1,0,-1))}},vertexShader:domeShader.vertex,fragmentShader:domeShader.fragment});
 const dome=new THREE.Mesh(new THREE.SphereGeometry(3.45,72,36,0,Math.PI*2,0,Math.PI/2),domeMat);dome.position.y=.3;scene.add(dome);let domeHit=0;

 // порты прав
 const icon=(draw)=>canvasTex(128,128,(g,w,h)=>{g.clearRect(0,0,w,h);g.strokeStyle='#fff';g.fillStyle='#fff';g.lineWidth=8;g.lineCap='round';g.lineJoin='round';draw(g)});
 const iconTex={
  read:icon(g=>{g.strokeRect(34,26,60,76);[46,62,78].forEach(y=>{g.beginPath();g.moveTo(46,y);g.lineTo(82,y);g.stroke()})}),
  tests:icon(g=>{g.beginPath();g.moveTo(34,66);g.lineTo(56,88);g.lineTo(96,40);g.stroke()}),
  net:icon(g=>{g.beginPath();g.arc(64,64,34,0,7);g.stroke();g.beginPath();g.ellipse(64,64,14,34,0,0,7);g.stroke();g.beginPath();g.moveTo(30,64);g.lineTo(98,64);g.stroke()}),
  secrets:icon(g=>{g.strokeRect(38,58,52,40);g.beginPath();g.arc(64,58,16,Math.PI,0);g.stroke()}),
  deploy:icon(g=>{g.beginPath();g.moveTo(64,28);g.lineTo(64,96);g.moveTo(40,52);g.lineTo(64,28);g.lineTo(88,52);g.stroke()})
 };
 const yellow=new THREE.MeshStandardMaterial({color:0xd9a21c,roughness:.45,metalness:.1});
 const mods=PERMS.map(p=>{
  const g=new THREE.Group();g.position.set(p.pos[0],0,p.pos[1]);scene.add(g);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.25,.22,6),toon(0x2a2e35));base.position.y=.11;base.receiveShadow=true;g.add(base);outline(ctx,base,0x80858f,1.4,.9,30);
  const blk=new THREE.Mesh(new THREE.CylinderGeometry(.82,.9,.95,6),new THREE.MeshStandardMaterial({color:p.need?0x2a2f36:0x2b2224,roughness:.3,metalness:.75}));blk.position.y=.7;blk.castShadow=true;g.add(blk);
  // модель из Blender (blender/kit.py, p_<id>): сам шестигранник остаётся невидимой зоной касания
  const stateMat=mat(DIM),model=kitModel('p_'+p.id,M,{body:'shell',glow:{state:stateMat},extra:{paint_y:yellow}});
  let cap=null,bodyMat=null;
  if(model){blk.material.visible=false;model.position.y=-.475;model.scale.setScalar(1.4);model.rotation.y=-Math.atan2(p.pos[0],p.pos[1]+6)*.6;blk.add(model);bodyMat=model.userData.body.material;model.traverse(o=>{if(o.isMesh&&o.material!==stateMat)o.castShadow=true})}
  else{blk.userData.ol=outline(ctx,blk);cap=new THREE.Mesh(new THREE.CircleGeometry(.62,6),new THREE.MeshBasicMaterial({map:iconTex[p.id],color:0xffffff,transparent:true,toneMapped:false}));cap.rotation.x=-Math.PI/2;cap.rotation.z=Math.PI/6;cap.position.y=.48;blk.add(cap)}
  blk.userData.id=p.id;
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.05,.04,8,48),mat(DIM));ring.rotation.x=Math.PI/2;ring.position.y=.26;g.add(ring);
  const led=new THREE.Mesh(new THREE.BoxGeometry(.7,.07,.07),mat(DIM));led.position.set(0,1.0,.88);g.add(led);
  if(!p.need){ // знак опасности: красный треугольник на грани
   const tri=new THREE.Mesh(new THREE.ConeGeometry(.2,.1,3),mat(RED));tri.position.set(0,1.32,0);g.add(tri);
  }
  const lab=labelSprite(p.label,{size:.85,font:'700 34px sans-serif'});if(model&&p.pos[1]>0)lab.position.set(0,.15,1.75);else lab.position.set(0,model?2.55:2.1,0);g.add(lab);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,1,8),mat(p.need?MINT:RED));beam.visible=false;scene.add(beam);
  return{p,g,blk,ring,led,lab,beam,cap,stateMat,bodyMat,hov:0,k:0,col:new THREE.Color()};
 });
 const meshes=mods.map(m=>m.blk);

 // конвейер проверок (внизу): пять площадок
 const pads=[...Array(5)].map((_,i)=>{
  const g=new THREE.Group();g.position.set(-3.8+i*1.9,0,7.0);scene.add(g);
  const b=new THREE.Mesh(new THREE.CylinderGeometry(.7,.76,.16,48),new THREE.MeshStandardMaterial({color:0x1f2329,roughness:.35,metalness:.7}));b.position.y=.08;g.add(b);outline(ctx,b,0x80858f,1.2,.9,30);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.52,.035,8,40),mat(DIM));ring.rotation.x=Math.PI/2;ring.position.y=.2;g.add(ring);
  const lab=labelSprite(steps[i]||String(i+1),{size:.6,font:'700 32px sans-serif',color:'#c4c0b6'});lab.position.set(0,i%2?.15:1.05,i%2?1.15:0);g.add(lab);
  return{g,ring,st:0,k:0};
 });
 const pk=new THREE.Mesh(new THREE.OctahedronGeometry(.3),mat(AMB));pk.position.set(-5.2,.8,7.0);pk.visible=false;scene.add(pk);
 let runT=-1,fail=99;
 api.run=(f,n,cb2)=>{runT=0;fail=f;api.cb=cb2;pads.forEach(x=>{x.st=0});pk.visible=true;pk.position.x=-5.2};
 api.resetPipe=()=>{runT=-1;pads.forEach(x=>{x.st=0});pk.visible=false};

 api.set=s=>{api.grant=s.grant||{}};
 api.setHot=id=>{api.hot=id};

 // взаимодействие
 const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
 let az=0,azT=0,down=null,moved=false;
 const pick=e=>{const r=parent.getBoundingClientRect();ndc.set(((e.clientX-r.left)/r.width)*2-1,-(((e.clientY-r.top)/r.height)*2-1));ray.setFromCamera(ndc,camera);const h=ray.intersectObjects(meshes,false)[0];return h?h.object.userData.id:null};
 const onMove=e=>{
  if(down){const dx=e.clientX-down.x;if(Math.abs(dx)>6)moved=true;if(moved){azT=Math.max(-.7,Math.min(.7,down.az-dx*.004));return}}
  const id=pick(e);if(id!==api.hover){api.hover=id;parent.style.cursor=id?'pointer':'grab';cb.hover&&cb.hover(id)}
 };
 const onDown=e=>{down={x:e.clientX,az:azT};moved=false;parent.setPointerCapture&&parent.setPointerCapture(e.pointerId)};
 const onUp=e=>{const was=moved;down=null;moved=false;if(was)return;const id=pick(e);if(id&&runT===-1)cb.toggle&&cb.toggle(id)};
 const onLeave=()=>{if(api.hover){api.hover=null;cb.hover&&cb.hover(null)}};
 parent.style.cursor='grab';parent.style.touchAction='none';
 parent.addEventListener('pointermove',onMove);parent.addEventListener('pointerdown',onDown);parent.addEventListener('pointerup',onUp);parent.addEventListener('pointerleave',onLeave);
 const baseDispose=ctx.dispose;ctx.dispose=()=>{parent.removeEventListener('pointermove',onMove);parent.removeEventListener('pointerdown',onDown);parent.removeEventListener('pointerup',onUp);parent.removeEventListener('pointerleave',onLeave);baseDispose()};
 const base=new THREE.Vector3(0,12,17),look=new THREE.Vector3(0,.8,.8);
 api.moduleScreen=id=>{const m=mods.find(x=>x.p.id===id);const p=ctx.project(m.g.position.clone().setY(.8));const r=parent.getBoundingClientRect(),k=r.width/ctx.w;return{x:r.left+p.x*k,y:r.top+p.y*k}};

 const tmp=new THREE.Color(),from=new THREE.Vector3(),to=new THREE.Vector3();
 let wasDanger=false;
 ctx.add((dt,t)=>{
  az=lerp(az,azT,1-Math.exp(-dt*6));
  const rel=base.clone().sub(look),c=Math.cos(az),s=Math.sin(az);
  camera.position.set(look.x+rel.x*c+rel.z*s,base.y,look.z-rel.x*s+rel.z*c);camera.lookAt(look);
  const danger=PERMS.some(p=>!p.need&&api.grant[p.id]);
  if(danger&&!wasDanger){ctx.kick(.3);ctx.flashRed(.15)}wasDanger=danger;
  const noNeed=PERMS.some(p=>p.need&&!api.grant[p.id]);
  core.rotation.y=t*.35;core.position.y=2.4+Math.sin(t*1.2)*.06;
  const tint=danger?RED:noNeed?AMB:MINT;
  tmp.setRGB(tint[0],tint[1],tint[2]);visor.material.color.lerp(tmp,1-Math.exp(-dt*8));
  halo.material.color.setRGB(tint[0]/2,tint[1]/2,tint[2]/2);
  domeMat.uniforms.uTime.value=t;domeMat.uniforms.uColor.value.lerp(tmp.setRGB(danger?1.1:.3,danger?.14:1.3,danger?.08:.9),1-Math.exp(-dt*6));
  if(danger&&t-domeHit>.9){domeHit=t;const v=new THREE.Vector3(Math.random()-.5,.6,Math.random()-.5).normalize();domeMat.uniforms.uHit.value[Math.floor(t)%4].set(v.x,v.y,v.z,t)}
  platRing.material.color.setRGB(tint[0]*.6,tint[1]*.6,tint[2]*.6);
  // порты
  for(const m of mods){
   const on=!!api.grant[m.p.id],risky=!m.p.need;
   const col=!on?DIM:risky?RED:MINT;
   tmp.setRGB(col[0],col[1],col[2]);m.ring.material.color.lerp(tmp,1-Math.exp(-dt*9));m.led.material.color.lerp(tmp,1-Math.exp(-dt*9));
   const h=(api.hover===m.p.id||api.hot===m.p.id)?1:0;m.hov=lerp(m.hov,h,1-Math.exp(-dt*12));
   m.blk.position.y=.7+m.hov*.14;m.blk.scale.setScalar(1+m.hov*.08);m.ring.scale.setScalar(1+m.hov*.12);
   m.k=lerp(m.k,on?1:0,1-Math.exp(-dt*7));
   from.copy(core.position);to.set(m.g.position.x,.9,m.g.position.z);const len=from.distanceTo(to);
   m.beam.visible=m.k>.03;m.beam.position.copy(from).add(to).multiplyScalar(.5);m.beam.scale.set(1+m.hov*.5,len*m.k,1+m.hov*.5);m.beam.lookAt(to);m.beam.rotateX(Math.PI/2);
   m.beam.position.lerpVectors(from,to,m.k*.5);
   if(on&&risky&&Math.random()<dt*5)sp.emit(m.g.position.clone().setY(1.2),1,{speed:1.2,color:RED,size:.09,life:.7,gravity:1.4});
   const em=m.bodyMat&&m.bodyMat.emissive||(m.cap?m.blk.material.emissive:null);if(em)em.setRGB(on&&risky?.22:.0,on&&risky?.02:.0,.0);(m.cap?m.cap.material.color:m.stateMat.color).setRGB(col[0]*(on?1.2:.6),col[1]*(on?1.2:.6),col[2]*(on?1.2:.6));
  }
  // конвейер
  if(runT>=0){runT+=dt;pk.position.x=-5.2+runT*3.8;
   const idx=Math.floor((pk.position.x+3.8+.95)/1.9);
   for(let i=0;i<=Math.min(idx,4);i++){const p=pads[i];if(p.st===0){
    if(i===fail){p.st=2;sp.emit(p.g.position.clone().setY(.6),50,{speed:4.5,color:RED,size:.13,life:.9,gravity:-3});rg.fire(p.g.position.clone().setY(.1),RED,3.2,.8,true);ctx.kick(.55);ctx.aberrate(.9);ctx.flashRed(.3);runT=-1;pk.visible=false;const cb2=api.cb;api.cb=null;cb2&&cb2();break}
    p.st=1;rg.fire(p.g.position.clone().setY(.1),MINT,2.2,.7,true)}}
   if(runT>=0&&pk.position.x>4.8){runT=-1;pk.visible=false;const cb2=api.cb;api.cb=null;cb2&&cb2()}}
  pk.rotation.y+=dt*3;
  pads.forEach(p=>{const col=p.st===1?MINT:p.st===2?RED:DIM;tmp.setRGB(col[0],col[1],col[2]);p.ring.material.color.lerp(tmp,1-Math.exp(-dt*10))});
 });
 if(import.meta.env.DEV)window.__sbx=api;
 return api;
}
