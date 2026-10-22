'use strict';
// Pure simulation in a fixed 960 × 540 arena. No DOM, sprites, network or wall clock.
(function (root) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const angleDelta = (a, b) => Math.atan2(Math.sin(a-b), Math.cos(a-b));
  const directionIndex = (x,y) => (Math.round(Math.atan2(y,x)/(Math.PI/4))+8)%8;
  const ATTACKS = Object.freeze({
    oi: {name:'顺突', latin:'OI-ZUKI', windup:.09, active:.10, recovery:.19, min:0, reach:142, arc:.43},
    gyaku: {name:'逆突', latin:'GYAKU-ZUKI', windup:.15, active:.11, recovery:.25, min:0, reach:177, arc:.43},
    mae: {name:'前蹴', latin:'MAE-GERI', windup:.18, active:.13, recovery:.25, min:0, reach:235, arc:.43},
    mawashi: {name:'回蹴', latin:'MAWASHI-GERI', windup:.22, active:.13, recovery:.29, min:45, reach:216, arc:.85}
  });
  function attackPhase(attack) {
    const spec=ATTACKS[attack.kind], t=attack.elapsed;
    if(t<spec.windup*.55)return 'prepare';
    if(t<spec.windup)return 'power';
    if(t<spec.windup+spec.active)return 'contact';
    return 'recover';
  }
  function jumpHeight(elapsed) {
    return elapsed>=.12 && elapsed<.68 ? 82*Math.sin(Math.PI*(elapsed-.12)/.56) : 0;
  }
  function chooseAttack(player, enemies) {
    const angle=player.direction*Math.PI/4;
    let nearest=Infinity, offset=0, count=0;
    for(const e of enemies){
      if(e.dead)continue;
      const dx=e.x-player.x,dy=e.y-player.y,d=Math.hypot(dx,dy);
      const a=Math.abs(angleDelta(Math.atan2(dy,dx),angle));
      if(a<=.85 && d<=260){count++;if(d<nearest){nearest=d;offset=a;}}
    }
    if(nearest<=110)return 'oi';
    if(nearest<=165 && offset<=.43)return 'gyaku';
    if(count>1 || (offset>.43 && nearest<216))return 'mawashi';
    if(nearest<Infinity || jumpHeight(player.jump)>20)return 'mae';
    return 'oi';
  }
  function withinAttack(player, enemy, attack) {
    const s=ATTACKS[attack.kind],dx=enemy.x-player.x,dy=enemy.y-player.y;
    const distance=Math.hypot(dx,dy);
    const aerial=jumpHeight(player.jump)>28;
    // High hopping germs can be intercepted by an aerial kick; grounded punches pass beneath their apex.
    if(enemy.height>34 && !aerial && (attack.kind==='oi'||attack.kind==='gyaku'))return false;
    return distance>=s.min && distance<=s.reach && Math.abs(angleDelta(Math.atan2(dy,dx),attack.direction*Math.PI/4))<=s.arc;
  }
  class World {
    constructor(random=Math.random){this.random=random;this.reset();}
    reset(){
      this.state='playing';this.celebration=0;this.score=0;this.misses=0;this.combo=0;this.time=0;this.spawnClock=1.6;this.spawned=0;
      this.obstacleClock=9;this.obstacle=null;this.enemies=[];this.defeated=[];this.events=[];this.hitstop=0;this.shake=0;
      this.player={x:480,y:310,direction:0,jump:.82,attack:null,hurt:0,whiff:0,walk:0,moving:false};
    }
    emit(type){if(this.events.length<20)this.events.push(type);}
    attack(){
      const p=this.player;if(this.state!=='playing'||p.attack)return false;
      p.attack={kind:chooseAttack(p,this.enemies),direction:p.direction,elapsed:0,connected:false};
      this.emit('swing');return true;
    }
    jump(){if(this.state!=='playing'||this.player.jump<.82)return false;this.player.jump=0;this.emit('jump');return true;}
    spawn(kind){
      const d=Math.floor(this.random()*8),a=d*Math.PI/4;
      // Eight entry gates, including upper and lower diagonals, all inside the scene.
      const x=480+Math.cos(a)*420,y=310+Math.sin(a)*185;
      kind ||= this.score<3?'normal':this.spawned%3===1?'fast':this.spawned%3===2?'jumper':'normal';
      this.enemies.push({x,y,kind,age:0,height:0,dead:false,seed:this.spawned++,speed:(kind==='fast'?88:kind==='jumper'?61:49)+this.score*1.25});
    }
    hurt(){
      if(this.player.hurt>0)return false;
      this.misses++;this.combo=0;this.player.hurt=.85;this.shake=.20;this.emit('hurt');
      if(this.misses>=3){this.state='lost';this.emit('lost');}
      return true;
    }
    tick(dt, input={x:0,y:0}){
      if(this.state!=='playing')return;
      dt=clamp(dt,0,.04);
      if(this.hitstop>0){this.hitstop=Math.max(0,this.hitstop-dt);return;}
      this.time+=dt;const p=this.player;
      p.hurt=Math.max(0,p.hurt-dt);p.whiff=Math.max(0,p.whiff-dt);this.shake=Math.max(0,this.shake-dt);
      p.jump=Math.min(.82,p.jump+dt);
      const magnitude=Math.hypot(input.x,input.y),strength=Math.min(1,magnitude);
      p.moving=strength>.05;
      if(p.moving){
        p.direction=directionIndex(input.x,input.y);
        const movementFactor = !p.attack ? 1 : p.attack.kind==='oi' ? 1.05 : p.attack.kind==='gyaku' ? .35 : .45;
        const speed=125*movementFactor;
        p.x=clamp(p.x+input.x/(magnitude||1)*strength*speed*dt,365,595);
        p.y=clamp(p.y+input.y/(magnitude||1)*strength*speed*dt,245,375);
        p.walk+=dt*9;
      }
      if(p.attack)p.attack.elapsed+=dt;
      this.spawnClock-=dt;
      if(this.spawnClock<=0 && this.enemies.length<5){this.spawn();this.spawnClock=Math.max(1.02,2.1-this.score*.043);}
      this.obstacleClock-=dt;
      if(!this.obstacle && this.obstacleClock<=0){this.obstacle={warning:1.6,x:90,hit:false};this.emit('warning');}
      if(this.obstacle){
        const o=this.obstacle;
        if(o.warning>0)o.warning-=dt;
        else{
          const old=o.x;o.x+=215*dt;
          if(!o.hit && old<=p.x+26 && o.x>=p.x-26){o.hit=true;if(jumpHeight(p.jump)<32)this.hurt();else this.emit('dodge');}
          if(o.x>885){this.obstacle=null;this.obstacleClock=8.5;}
        }
      }
      for(const e of this.enemies){
        e.age+=dt;
        e.height=e.kind==='jumper'?Math.max(0,Math.sin(e.age*4))*55:0;
        let speed=e.speed;
        if(e.kind==='jumper')speed*=e.height>0?1.45:.65;
        if(this.obstacle && this.obstacle.warning<=0 && Math.abs(e.x-this.obstacle.x)<40 && e.kind!=='jumper')speed*=.3;
        const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy);
        e.x+=dx/(d||1)*Math.min(d,speed*dt);e.y+=dy/(d||1)*Math.min(d,speed*dt);
        const attack=p.attack;
        if(attack && attackPhase(attack)==='contact' && withinAttack(p,e,attack)){
          e.dead=true;attack.connected=true;this.score++;this.combo++;this.hitstop=.045;this.shake=.10;
          const a=attack.direction*Math.PI/4;
          this.defeated.push({...e,life:.5,vx:Math.cos(a)*290,vy:Math.sin(a)*180-80});this.emit('hit');
          if(this.score>=20){this.state='won';this.emit('won');break;}
        }else if(d<31 && (e.kind!=='fast' || jumpHeight(p.jump)<32) && p.hurt<=0){
          e.dead=true;this.hurt();if(this.state==='lost')break;
        }
      }
      let alive=0;for(const e of this.enemies)if(!e.dead)this.enemies[alive++]=e;this.enemies.length=alive;
      for(const e of this.defeated){e.life-=dt;e.x+=e.vx*dt;e.y+=e.vy*dt;e.height+=dt*60;}
      let visible=0;for(const e of this.defeated)if(e.life>0)this.defeated[visible++]=e;this.defeated.length=visible;
      if(p.attack){const a=p.attack,s=ATTACKS[a.kind];if(a.elapsed>=s.windup+s.active+s.recovery){if(!a.connected && (a.kind==='mae'||a.kind==='mawashi'))p.whiff=.35;p.attack=null;}}
    }
  }
  const api={World,ATTACKS,chooseAttack,attackPhase,withinAttack,jumpHeight,angleDelta};
  if(typeof module!=='undefined')module.exports=api;else root.QiqianArcade=api;
})(typeof globalThis!=='undefined'?globalThis:this);
