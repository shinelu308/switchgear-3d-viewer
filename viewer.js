import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const $=id=>document.getElementById(id);
const names={'SG-FRAME':'柜体骨架','SG-BASE':'底板与进线孔','SG-TOP':'顶盖','SG-DOOR-F':'仪表柜门','SG-SIDE-L':'左侧板','SG-SIDE-R':'右侧板','SG-REAR':'后检修板','SG-MOUNT':'设备安装板','SG-BUS':'母排系统','SG-BREAKER':'主断路器','SG-SUPPORT':'断路器安装支架','SG-CABLE':'主电缆','SG-TERM-01':'端子排 XT01','SG-TERM-02':'端子排 XT02','SG-TERM-03':'端子排 XT03','SG-AUX':'辅助控制模块','SG-PE':'接地排','SG-DUCT':'二次接线线槽'};
const host=$('canvas-host');let renderer,scene,camera,controls,model,mixer,clip,action;
const components=new Map(),pickable=[],originalMaterials=new Map();
let ready=false,playing=false,currentTime=0,pose='exploded',selected='',lastFrame=performance.now();
let savedCamera=null,needsRender=true;
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
function status(text){$('status').textContent=text}
function fail(message){status('交互模型暂未加载');$('loading').hidden=false;$('load-title').textContent='可以先查看高清渲染';$('load-message').textContent=message;$('progress').hidden=true}
try{
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setClearColor(0x000000,0);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  host.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','可旋转缩放的开关柜三维模型');
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(35,1,.01,150);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;
  controls.minDistance=.4;controls.maxDistance=30;controls.autoRotateSpeed=.5;controls.maxPolarAngle=Math.PI*.9;
  const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();
  scene.environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xeaf4ff,0x596879,1.5));
  const key=new THREE.DirectionalLight(0xffffff,2.6);key.position.set(3,6,6);scene.add(key);
  const fill=new THREE.DirectionalLight(0xc6deff,1.1);fill.position.set(-4,2,-3);scene.add(fill);
  new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();needsRender=true;if(ready)fit();}).observe(host);
  controls.addEventListener('change',()=>needsRender=true);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;fail('浏览器的三维绘图暂时中断，请刷新页面。右侧仍可打开高清图片。')});
  new GLTFLoader().load('./assets/switchgear.glb',gltf=>{
    model=gltf.scene;scene.add(model);clip=gltf.animations[0];mixer=new THREE.AnimationMixer(model);
    if(clip){action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();}
    model.traverse(o=>{if(o.userData.component_id)components.set(o.userData.component_id,o);if(o.isMesh){pickable.push(o);originalMaterials.set(o,o.material);}});
    for(const [id,label] of Object.entries(names)){if(components.has(id)){const option=document.createElement('option');option.value=id;option.textContent=label;$('component').appendChild(option);}}
    ready=true;$('loading').hidden=true;document.querySelectorAll('button:disabled,input:disabled,select:disabled').forEach(el=>el.disabled=false);
    document.body.dataset.loaded='true';document.body.dataset.componentCount=String(components.size);
    status(`${components.size} 个组件 · 已加载`);setPose('exploded');animate(performance.now());
  },e=>{if(e.total){const pct=Math.min(99,Math.round(e.loaded/e.total*100));$('progress').value=pct;status(`加载 ${pct}%`)}},error=>{console.error(error);fail('模型下载失败，请刷新重试，或在右侧查看高清渲染图。')});
}catch(error){console.error(error);fail('当前浏览器未能启动三维显示。请使用支持 WebGL 的新版浏览器，或查看右侧高清图片。')}

function setTime(t){currentTime=Math.max(0,Math.min(t,clip?.duration??0));if(action){action.paused=false;action.enabled=true;mixer.setTime(currentTime);}model?.updateMatrixWorld(true);needsRender=true;document.body.dataset.animationTime=currentTime.toFixed(3)}
function timeForFrame(frame){return (frame-1)/209*(clip?.duration??0)}
function visible(o){for(let p=o;p;p=p.parent)if(!p.visible)return false;return true}
function bounds(){const box=new THREE.Box3();model.updateMatrixWorld(true);model.traverse(o=>{if(o.isMesh&&visible(o)){o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld))}});return box}
function fit(box=bounds()){
  const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const vfov=THREE.MathUtils.degToRad(camera.fov),hfov=2*Math.atan(Math.tan(vfov/2)*camera.aspect);
  const radius=size.length()/2,dist=radius/Math.sin(Math.min(vfov,hfov)/2)*1.13;
  camera.position.copy(center).add(new THREE.Vector3(.52,.28,1).normalize().multiplyScalar(dist));
  controls.target.copy(center);controls.update();savedCamera={position:camera.position.clone(),target:center.clone()};needsRender=true;
}
function stop(){playing=false;$('play').textContent='▷ 播放拆装演示'}
function setPose(next){if(!ready)return;stop();pose=next;setTime(timeForFrame({assembled:1,exploded:90,open:175}[next]));
  $('cutaway').checked=next==='open';applyCutaway();$('view-name').textContent={assembled:'完整装配',exploded:'爆炸分解',open:'开门剖视'}[next];
  document.querySelectorAll('button[data-pose]').forEach(b=>{const on=b.dataset.pose===next;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});
  $('explode').value=next==='exploded'?100:0;$('explode-value').textContent=$('explode').value+'%';document.body.dataset.pose=next;fit();
}
function applyCutaway(){for(const id of ['SG-SIDE-R','SG-TOP'])if(components.has(id))components.get(id).visible=!$('cutaway').checked;needsRender=true;document.body.dataset.cutaway=String($('cutaway').checked)}
function selectComponent(id){
  for(const [mesh,mat] of originalMaterials){if(mesh.material!==mat){for(const m of [].concat(mesh.material))m.dispose();mesh.material=mat;}}
  selected=id;$('component').value=id;$('clear-selection').hidden=!id;$('selection').hidden=!id;
  if(id&&components.has(id)){
    const group=components.get(id);group.traverse(o=>{if(o.isMesh){o.material=[].concat(originalMaterials.get(o)).map(m=>{const c=m.clone();c.emissive=new THREE.Color(0x1475e8);c.emissiveIntensity=.28;return c});if(!Array.isArray(originalMaterials.get(o)))o.material=o.material[0];}});
    $('selection').textContent=`${names[id]??id}  ·  ${id}`;$('component-note').textContent=group.visible?'已高亮选中组件。':'该组件在当前剖视状态下隐藏，可关闭“查看柜内结构”。';
  }else $('component-note').textContent='也可以直接点击模型选择组件。';
  needsRender=true;document.body.dataset.selected=id;
}
function animate(now){if(!ready)return;requestAnimationFrame(animate);const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;
  if(playing){setTime((currentTime+dt*.8)%(clip?.duration||1));needsRender=true}controls.update();
  if(needsRender||playing||controls.autoRotate){renderer.render(scene,camera);needsRender=false}
}
document.querySelectorAll('button[data-pose]').forEach(b=>b.addEventListener('click',()=>setPose(b.dataset.pose)));
$('explode').addEventListener('input',()=>{if(!ready)return;stop();const previous=currentTime;setTime(timeForFrame(90));fit();setTime(previous);const t=Number($('explode').value)/100;setTime(timeForFrame(24+t*66));$('explode-value').textContent=Math.round(t*100)+'%';$('view-name').textContent='展开程度 '+Math.round(t*100)+'%';document.querySelectorAll('button[data-pose]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false')});});
$('cutaway').addEventListener('change',()=>applyCutaway());$('rotate').addEventListener('change',()=>{controls.autoRotate=$('rotate').checked;needsRender=true});
$('reset').addEventListener('click',()=>fit());$('component').addEventListener('change',()=>selectComponent($('component').value));$('clear-selection').addEventListener('click',()=>selectComponent(''));
$('play').addEventListener('click',()=>{if(!ready)return;if(playing){stop();return;}$('cutaway').checked=false;applyCutaway();const all=new THREE.Box3();for(const f of [1,90,175]){setTime(timeForFrame(f));all.union(bounds())}fit(all);setTime(0);playing=true;$('play').textContent='Ⅱ 暂停演示';$('view-name').textContent='拆装与开门演示';document.querySelectorAll('button[data-pose]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false')});});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{$('fullscreen').title='当前浏览器不支持全屏'}});
let down=null;host.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY});host.addEventListener('pointerup',e=>{
  if(!ready||!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;
  const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObjects(pickable,false).find(h=>visible(h.object));let object=hit?.object;
  while(object&&!object.userData.component_id)object=object.parent;selectComponent(object?.userData.component_id??'');
});
