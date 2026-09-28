// Demonstration only: assumed 400 V / 630 A balanced three-phase load.
export class Simulation {
  constructor(){this.time=0;this.temperature=28;this.events=[];this.load=60;this.scenario='standby';this.closed=false;this.fault=false;this.tripped=false;this.overloadTime=0;this.log('电源可用，QF01 分闸');}
  log(text){this.events.unshift({time:this.time,text});this.events=this.events.slice(0,5);}
  scenarioSet(name){
    if(name==='fault'){this.fault=true;this.tripped=false;this.closed=true;this.load=125;this.scenario='fault';this.overloadTime=0;this.log('注入模拟过载：125%');return;}
    if(this.fault||this.tripped){this.log('请先清除故障并复位');return;}
    this.scenario=name;this.closed=name!=='standby';this.load=name==='high'?90:60;this.overloadTime=0;
    this.log(name==='standby'?'模拟分闸，下游停止供能':name==='high'?'负载升至 90%':'模拟合闸，正常供电');
  }
  setLoad(value){if(this.fault||this.tripped)return;this.load=Math.max(0,Math.min(100,Number(value)||0));if(this.closed)this.scenario=this.load>=85?'high':'normal';}
  reset(){this.fault=false;this.tripped=false;this.closed=false;this.load=60;this.scenario='standby';this.overloadTime=0;this.log('故障已清除并复位；保持分闸');}
  step(dt){this.time+=dt;
    if(this.fault&&this.closed){this.overloadTime+=dt;if(this.overloadTime>=4){this.closed=false;this.tripped=true;this.log('保护跳闸：下游电流归零，上游仍带电');}}
    const target=this.closed?28+this.load*.28:28;
    this.temperature+=(target-this.temperature)*(1-Math.exp(-dt/8));
    return this.read();
  }
  read(){const amps=this.closed?630*this.load/100:0;return {scenario:this.scenario,closed:this.closed,fault:this.fault,tripped:this.tripped,load:this.load,amps,voltage:this.closed?400:0,upstreamVoltage:400,power:Math.sqrt(3)*400*amps*.92/1000,temperature:this.temperature,remaining:Math.max(0,4-this.overloadTime),warning:this.closed&&this.load>=85};}
}
