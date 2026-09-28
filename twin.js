import * as THREE from 'three';
import {Simulation} from './simulation.mjs';
const $=id=>document.getElementById(id);
const phases=[[-.23,-.168,1.87],[-.085,-.056,1.937],[.06,.056,2.004]];
const v=(x,y,z)=>new THREE.Vector3(x,z,-y); // source Blender meters -> glTF Y-up
export function createTwin({scene,components,showOperating,showStructure,selectComponent,dirty}){
  const sim=new Simulation(),group=new THREE.Group();group.name='Illustrative power paths';scene.add(group);
  let enabled=true,elapsed=0,tour=false,tourPaused=false,tourTime=0,tourStep=-1,uiTime=0,eventKey='',snapshot=null;
  const routes=[],ghosts=[];const upColor=0x4ebfff,normalColor=0x26bcff,warnColor=0xffa23b;
  const material=color=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:.95,depthTest:false,depthWrite:false});
  function route(points,kind){
    const curve=new THREE.CurvePath();for(let i=1;i<points.length;i++)curve.add(new THREE.LineCurve3(points[i-1],points[i]));
    const line=new THREE.Mesh(new THREE.TubeGeometry(curve,100,.004,6,false),material(normalColor));line.renderOrder=10;line.material.opacity=.32;group.add(line);
    const arrows=[];for(let i=0;i<8;i++){const arrow=new THREE.Mesh(new THREE.ConeGeometry(.014,.04,8),material(normalColor));arrow.renderOrder=11;group.add(arrow);arrows.push(arrow);}
    routes.push({curve,line,arrows,kind});
  }
  phases.forEach(([src,x,z])=>{
    route([v(-.33,.016,z),v(src,.016,z),v(src,.17,z),v(src,.17,1.6),v(x,.17,1.6),v(x,.01,1.6),v(x,.01,1.517)],'up');
    route([v(x,.01,1.517),v(x,.01,.975)],'breaker');
    route([v(x,-.008,.975),v(x,-.008,.78),v(x+.022,-.13,.55),v(x+.017,-.13,.25),v(x,-.025,.022)],'down');
  });
  // Local cable window: retain the rear insulation half and expose copper strands.
  const coreGroup=new THREE.Group();coreGroup.visible=false;scene.add(coreGroup);
  const copper=new THREE.MeshStandardMaterial({color:0xc57638,metalness:.82,roughness:.27});
  for(const x of [-.168,-.056,.056,.168])for(let strand=0;strand<7;strand++){
    const angle=(strand-1)*Math.PI/3,dx=strand?Math.cos(angle)*.006:0,dz=strand?Math.sin(angle)*.006:0;
    const curve=new THREE.LineCurve3(new THREE.Vector3(x+.0182+dx,.32,.13+dz),new THREE.Vector3(x+.0208+dx,.48,.13+dz));
    coreGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve,6,.0035,8,false),copper));
  }
  const cableWindows=[];
  components.get('SG-CABLE')?.traverse(o=>{if(o.isMesh){const original=o.material;const cut=[].concat(original).map(m=>{
    const c=m.clone();c.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec3 vCutWorld;\n'+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvCutWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
      shader.fragmentShader='varying vec3 vCutWorld;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(vCutWorld.y>0.32 && vCutWorld.y<0.48 && vCutWorld.z>0.13) discard;');
    };c.customProgramCacheKey=()=> 'sg-cable-window-v1';return c;
  });cableWindows.push({o,original,cut:Array.isArray(original)?cut:cut[0]});}});
  function cableCut(on){coreGroup.visible=on;for(const c of cableWindows)c.o.material=on?c.cut:c.original;}
  // Translucent shell preserves the assembly silhouette; overlays are schematic, not conductor simulation.
  for(const id of ['SG-DOOR-F','SG-SIDE-R','SG-TOP'])components.get(id)?.traverse(o=>{if(o.isMesh){const original=o.material;const faded=[].concat(original).map(m=>{const c=m.clone();c.transparent=true;c.opacity=.08;c.depthWrite=false;return c});ghosts.push({o,original,faded:Array.isArray(original)?faded:faded[0]});}});
  function ghost(on){for(const g of ghosts)g.o.material=on?g.faded:g.original;}
  function stopTour(){tour=false;tourPaused=false;$('tour').textContent='▶ 一键讲解 · 72 秒';}
  function mode(on){enabled=on;stopTour();selectComponent('');ghost(false);group.visible=on;
    document.body.dataset.mode=on?'operation':'structure';$('operation-panel').hidden=!on;$('structure-panel').hidden=on;$('logic-panel').hidden=!on;$('caption-card').hidden=!on;
    $('mode-operation').setAttribute('aria-pressed',String(on));$('mode-structure').setAttribute('aria-pressed',String(!on));
    if(on){showOperating();ghost(true);}else showStructure();cableCut(on&&$('cable-cut').checked);dirty();paint();
  }
  function choose(name){stopTour();sim.scenarioSet(name);paint();}
  const captions={standby:['01 / 电源就绪','上游母排带电，断路器分闸。下游没有供能光流。'],normal:['02 / 正常供电','QF01 合闸后，能量经母排、断路器及电缆传向负载。'],high:['03 / 负载升高','负载升高，电流与功率同步增加。橙色提示高负载，尚未跳闸。'],fault:['04 / 保护动作','模拟过载持续 4 秒后保护跳闸。演示延时不代表实际保护定值。']};
  function paint(){const s=sim.read();snapshot=s;document.body.dataset.scenario=s.scenario;document.body.dataset.breaker=s.tripped?'tripped':s.closed?'closed':'open';
    $('breaker-state').textContent=s.tripped?'保护跳闸':s.closed?'合闸 · 供电中':'分闸 · 待机';
    $('upstream-state').textContent='上游 400 V · 带电';$('downstream-state').textContent=s.closed?'下游已供电':'下游未供电';
    $('current-value').textContent=s.amps.toFixed(0);$('voltage-value').textContent=s.voltage.toFixed(0);$('power-value').textContent=s.power.toFixed(1);$('temp-value').textContent=s.temperature.toFixed(1);
    $('load-setting').value=s.load>100?100:s.load;$('load-output').textContent=s.load+'%';$('load-setting').disabled=s.fault||s.tripped;
    $('load-fill').style.width=Math.min(100,s.load)+'%';
    const [title,body]=captions[s.scenario];$('caption-title').textContent=s.tripped?'04 / 故障回路已切除':title;
    $('caption-text').textContent=s.tripped?'下游电流为 0；上游母排仍然带电。清除故障并复位后，才能重新模拟合闸。':body;
    $('trip-note').textContent=s.tripped?'已跳闸 · 请清除故障并复位':s.fault?`过载保护倒计时 ${s.remaining.toFixed(1)} s（演示值）`:s.warning?'高负载提示 · 尚未达到演示跳闸条件':'运行条件正常 · 参数均为模拟值';
    $('trip-note').className=s.fault?'alarm-note':s.warning?'warning-note':'quiet-note';
    $('reset-fault').disabled=!(s.fault||s.tripped);
    document.querySelectorAll('[data-scenario]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.scenario===s.scenario));b.disabled=(s.fault||s.tripped)&&b.dataset.scenario!=='fault';});
    $('scenario-fault').disabled=s.fault||s.tripped;
    $('diagram').classList.toggle('energized',s.closed);$('diagram').classList.toggle('warning',s.warning);$('diagram').classList.toggle('tripped',s.tripped);
    $('contact-blade').setAttribute('d',s.closed?'M 196 34 L 227 34':'M 196 34 L 221 14');
    $('diagram-breaker-state').textContent=s.tripped?'跳闸':s.closed?'合闸':'分闸';
    const key=JSON.stringify(sim.events);if(key!==eventKey){eventKey=key;$('event-list').replaceChildren(...sim.events.slice(0,3).map(e=>{const li=document.createElement('li');li.textContent=`${Math.floor(e.time/60).toString().padStart(2,'0')}:${Math.floor(e.time%60).toString().padStart(2,'0')}  ${e.text}`;return li;}));}
  }
  function update(dt){if(!enabled)return;if(!tourPaused){elapsed+=dt;sim.step(dt);}
    if(tour){tourTime+=dt;let idx=tourTime<8?0:tourTime<24?1:tourTime<40?2:tourTime<56?3:tourTime<64?4:5;
      if(idx!==tourStep){tourStep=idx;if(idx===0)sim.reset();if(idx===1||idx===5)sim.scenarioSet('normal');if(idx===2)sim.scenarioSet('high');if(idx===3)sim.scenarioSet('fault');if(idx===4)sim.reset();}
      $('tour-progress').value=Math.min(72,tourTime);$('tour').textContent=`Ⅱ 暂停讲解 · ${Math.floor(tourTime)} / 72 秒`;if(tourTime>=72)stopTour();
    }
    const s=sim.read(),motion=$('flow-motion').checked, color=s.warning?warnColor:normalColor;
    for(const r of routes){r.line.material.color.setHex(r.kind==='up'&&!s.closed?upColor:color);r.line.visible=r.kind==='up'||s.closed;r.line.material.opacity=s.closed?.55:.18;
      const count=s.load>=85?8:5;r.arrows.forEach((a,i)=>{a.visible=s.closed&&s.amps>0&&i<count; if(!a.visible)return;
        a.material.color.setHex(color);const t=((motion?elapsed*.17:0)+i/count)%1;a.position.copy(r.curve.getPoint(t));a.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),r.curve.getTangent(t).normalize());});
    }
    uiTime+=dt;if(uiTime>.12){paint();uiTime=0;}dirty();
  }
  $('mode-operation').addEventListener('click',()=>mode(true));$('mode-structure').addEventListener('click',()=>mode(false));
  document.querySelectorAll('[data-scenario]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.scenario)));
  $('load-setting').addEventListener('input',()=>{stopTour();sim.setLoad($('load-setting').value);paint();});
  $('reset-fault').addEventListener('click',()=>{stopTour();sim.reset();paint();});
  $('cable-cut').addEventListener('change',()=>{selectComponent('');cableCut($('cable-cut').checked);dirty();});
  $('tour').addEventListener('click',()=>{if(tour){tour=false;tourPaused=true;$('tour').textContent='▶ 继续讲解';return;}if(tourPaused){tourPaused=false;tour=true;return;}tour=true;tourTime=0;tourStep=-1;sim.reset();});
  for(const el of document.querySelectorAll('[data-component]'))el.addEventListener('click',()=>{selectComponent(el.dataset.component);});
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)$('flow-motion').checked=false;
  mode(true);return {update,isActive:()=>enabled,restoreGhost:()=>{if(enabled){ghost(true);cableCut($('cable-cut').checked);}}};
}
