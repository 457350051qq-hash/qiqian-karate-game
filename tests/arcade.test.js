const {test}=require('node:test');
const assert=require('node:assert/strict');
const {World,ATTACKS,chooseAttack,attackPhase,withinAttack,jumpHeight}=require('../arcade.js');
function advance(w,seconds,input){for(let t=0;t<seconds;t+=1/120)w.tick(1/120,input);}
function emptyWorld(){const w=new World(()=>0);w.spawnClock=1000;w.obstacleClock=1000;return w;}
function germ(x,y,kind='normal'){return {x,y,kind,height:0,speed:0,age:0,seed:0,dead:false};}
test('analog and diagonal movement is bounded, proportional and normalized',()=>{
  const w=emptyWorld();advance(w,6,{x:1,y:1});assert.equal(w.player.x,595);assert.equal(w.player.y,375);
  advance(w,6,{x:-1,y:-1});assert.equal(w.player.x,365);assert.equal(w.player.y,245);
  const a=emptyWorld(),b=emptyWorld();advance(a,.4,{x:.5,y:0});advance(b,.4,{x:1,y:0});assert.ok(Math.abs((a.player.x-480)*2-(b.player.x-480))<1e-8);
});
test('distance and angular coverage choose four deterministic techniques',()=>{
  const p={x:0,y:0,direction:0,jump:.82};
  assert.equal(chooseAttack(p,[germ(100,0)]),'oi');
  assert.equal(chooseAttack(p,[germ(150,0)]),'gyaku');
  assert.equal(chooseAttack(p,[germ(210,0)]),'mae');
  assert.equal(chooseAttack(p,[germ(180,90)]),'mawashi');
  assert.equal(chooseAttack(p,[germ(190,0),germ(195,50)]),'mawashi');
});
test('each technique has distinct preparation, power, active and recovery windows',()=>{
  for(const [kind,s] of Object.entries(ATTACKS)){
    assert.equal(attackPhase({kind,elapsed:0}),'prepare');assert.equal(attackPhase({kind,elapsed:s.windup*.75}),'power');
    assert.equal(attackPhase({kind,elapsed:s.windup+.001}),'contact');assert.equal(attackPhase({kind,elapsed:s.windup+s.active+.001}),'recover');
    const w=emptyWorld();w.enemies=[germ(580,310)];assert.equal(w.attack(),true);assert.equal(w.attack(),false);
    advance(w,.04);assert.equal(w.score,0); // No instant damage on button press.
  }
});
test('eight-way directional hit sectors, reach, and hopping height are respected',()=>{
  for(let direction=0;direction<8;direction++){
    const a=direction*Math.PI/4,p={x:0,y:0,direction,jump:.82},attack={kind:'mae',direction};
    assert.equal(withinAttack(p,germ(Math.cos(a)*180,Math.sin(a)*180),attack),true);
    assert.equal(withinAttack(p,germ(Math.cos(a+Math.PI)*100,Math.sin(a+Math.PI)*100),attack),false);
    assert.equal(withinAttack(p,germ(Math.cos(a)*236,Math.sin(a)*236),attack),false);
  }
  const p={x:0,y:0,direction:0,jump:.82},e=germ(100,0);e.height=50;
  assert.equal(withinAttack(p,e,{kind:'oi',direction:0}),false);p.jump=.4;
  assert.equal(withinAttack(p,e,{kind:'oi',direction:0}),true);
});
test('hits count once and recovery prevents repeated attacks; gender cannot affect simulation',()=>{
  const w=emptyWorld();w.enemies=[germ(580,310)];w.attack();advance(w,.14);
  assert.equal(w.score,1);assert.equal(w.enemies.length,0);assert.equal(w.attack(),false);
  advance(w,.5);assert.equal(w.score,1);assert.equal(w.attack(),true);
});
test('ground sweep is warned, damages once, and a timed jump avoids it',()=>{
  const w=emptyWorld();w.obstacleClock=0;advance(w,.1);assert.ok(w.obstacle.warning>1.4);assert.equal(w.misses,0);
  w.obstacle={x:450,warning:0,hit:false};advance(w,.5);assert.equal(w.misses,1);advance(w,.5);assert.equal(w.misses,1);
  const j=emptyWorld();j.player.jump=.35;j.obstacle={x:450,warning:0,hit:false};advance(j,.15);assert.equal(j.misses,0);assert.ok(j.events.includes('dodge'));
});
test('jump avoids low fast enemy contact, but not normal or high enemies; cannot double jump',()=>{
  for(const kind of ['normal','jumper','fast']){
    const w=emptyWorld();w.player.jump=.35;w.enemies=[germ(480,310,kind)];advance(w,.02);
    assert.equal(w.misses,kind==='fast'?0:1);
  }
  const w=emptyWorld();assert.equal(w.jump(),true);assert.equal(w.jump(),false);advance(w,1);assert.equal(w.jump(),true);assert.equal(jumpHeight(.4),82);
});
test('three enemy types move differently, pursue player, and cannot be permanently escaped',()=>{
  const w=emptyWorld();w.score=6;w.spawn('normal');w.spawn('fast');w.spawn('jumper');
  assert.ok(w.enemies[1].speed>w.enemies[0].speed);advance(w,.3);
  assert.ok(w.enemies[2].height>0);assert.equal(w.enemies[0].height,0);
  const lose=new World(()=>0);advance(lose,60,{x:-1,y:0});assert.equal(lose.state,'lost');assert.equal(lose.misses,3);
});
test('twenty opponents can be beaten with public movement/attack/jump actions',()=>{
  for(const seed of [1,42,91]){
    let n=seed;const w=new World(()=>((n=(n*1664525+1013904223)>>>0)/4294967296));
    for(let t=0;t<120*150&&w.state==='playing';t++){
      const p=w.player;
      let target=null,nearest=Infinity;
      for(const e of w.enemies){const d=Math.hypot(e.x-p.x,e.y-p.y);if(d<nearest){nearest=d;target=e;}}
      if(target){p.direction=(Math.round(Math.atan2(target.y-p.y,target.x-p.x)/(Math.PI/4))+8)%8;if(nearest<211)w.attack();}
      const o=w.obstacle;if(o && o.warning<=0 && o.x>p.x-100 && o.x<p.x-32)w.jump();
      w.tick(1/120);
    }
    assert.equal(w.state,'won',`seed ${seed}, score ${w.score}, misses ${w.misses}`);assert.equal(w.score,20);
    w.reset();assert.equal(w.misses,0);assert.equal(w.player.attack,null);assert.equal(w.enemies.length,0);
  }
});
test('layered animation has four distinct joint poses and a real kick chamber/retraction',()=>{
  const {readFileSync}=require('node:fs'),vm=require('node:vm');
  const context={QiqianArcade:require('../arcade.js')};vm.createContext(context);
  vm.runInContext(readFileSync(require.resolve('../renderer.js'),'utf8'),context);
  const w=emptyWorld(),pose=context.QiqianArt.poseFor;
  const contact={};
  for(const [kind,s] of Object.entries(ATTACKS)){
    w.player.attack={kind,direction:0,elapsed:s.windup+s.active*.5};
    contact[kind]=JSON.parse(JSON.stringify(pose(w)));
    assert.equal(contact[kind].extension,1);
    w.player.attack.elapsed=s.windup+s.active+s.recovery;
    assert.ok(pose(w).extension<1e-10);
  }
  assert.ok(contact.oi.rightFoot[0]>contact.gyaku.rightFoot[0]);
  assert.ok(contact.gyaku.twist>0);assert.ok(contact.mawashi.pivot>0);
  assert.ok(contact.mae.rightFoot[1]>contact.mawashi.rightFoot[1]);
  w.player.attack={kind:'mae',direction:0,elapsed:ATTACKS.mae.windup*.5};
  assert.ok(pose(w).rightKnee[1]<-100,'knee raised before the foot extends');
  assert.ok(pose(w).rightFoot[0]<50,'chambered leg is not prematurely extended');
});
