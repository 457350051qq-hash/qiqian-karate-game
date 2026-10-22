// V0.3 regression of V0.1/V0.2 flows, with a controllable animation clock for reproducibility.
// Only the test browser receives clock, RNG and sensor mocks. Production code has no test hooks.
import assert from 'node:assert/strict';
import {browserSession,delay} from './cdp.mjs';
const b=await browserSession(),{send,run}=b;
try {
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`
    let testNow=0;let callbacks=[];
    performance.now=()=>testNow;
    window.requestAnimationFrame=f=>{callbacks.push(f);return callbacks.length;};
    window.step=(seconds)=>{for(let i=0;i<Math.ceil(seconds*120);i++){testNow+=1000/120;const work=callbacks;callbacks=[];for(const f of work)f(testNow);}};
    let seed=42;Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
    window.motionTestPermission='denied';window.DeviceMotionEvent=class {static async requestPermission(){return motionTestPermission;}};
    Object.defineProperty(window,'QiqianArcade',{configurable:true,set(api){const Original=api.World;api.World=class extends Original{constructor(...args){super(...args);window.testWorld=this;}};Object.defineProperty(window,'QiqianArcade',{value:api,configurable:true});}});
  `});
  const base=process.env.TEST_URL||'http://127.0.0.1:8000/';
  await send('Page.navigate',{url:base});
  for(let i=0;i<100;i++){if(await run(`!!document.getElementById('start') && typeof testWorld!=='undefined'`))break;await delay(30);}
  assert.equal(await run('document.title'),'七千武道 · 净心道场');
  await run(`document.querySelector('[data-gender="female"]').click();document.getElementById('start').click();step(.01)`);
  assert.equal(await run(`document.querySelector('[data-gender="female"]').getAttribute('aria-pressed')`),'true');
  const key=async(code,type='keyDown')=>send('Input.dispatchKeyEvent',{type,code,key:code==='Space'?' ':code});
  await key('KeyD');await run('step(.4)');await key('KeyD','keyUp');
  assert.ok(await run('testWorld.player.x>520'),'WASD moves');
  await key('ArrowUp');await key('ArrowLeft');await run('step(.05)');
  assert.ok((await run(`document.getElementById('technique').textContent`)).startsWith('左上'));
  await key('ArrowUp','keyUp');await key('ArrowLeft','keyUp');
  await run(`window.dispatchEvent(new Event('blur'));step(2)`);const frozen=await run('testWorld.time');await run('step(1)');assert.equal(await run('testWorld.time'),frozen);
  await run(`window.dispatchEvent(new Event('focus'));document.getElementById('restart').click();step(.1)`);
  await send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:3});await delay(100);
  await run('step(.05)');
  const positions=await run(`(()=>{const point=id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}};return {stick:point('joystick'),attack:point('attack'),jump:point('jump')}})()`);
  const left={x:positions.stick.x+25,y:positions.stick.y,id:1},right={...positions.attack,id:2},jump={...positions.jump,id:3};
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[left]});await run('step(.1)');
  const x=await run('testWorld.player.x');
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[left,right,jump]});await run('step(.20)');
  assert.ok(await run(`testWorld.player.x>${x}`),'stick continues while attack and jump are pressed');
  assert.equal(await run(`document.getElementById('game').dataset.jumpPhase`),'airborne');
  assert.ok(await run('!!testWorld.player.attack'),'third finger did not cancel attack');
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await run('step(.01)');
  assert.equal(await run(`document.getElementById('knob').style.transform`),'');
  const stopped=await run('testWorld.player.x');await run('step(.15)');assert.equal(await run('testWorld.player.x'),stopped);
  for(const [width,height] of [[667,375],[844,390],[1024,768],[1366,768]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await delay(50);
    assert.ok(await run(`(()=>{const box=id=>document.getElementById(id).getBoundingClientRect(),c=box('game'),j=box('joystick'),a=box('attack'),b=box('jump');return j.right<=c.left && a.left>=c.right && [j,a,b].every(r=>r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight)&&document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight})()`),`${width}x${height} controls fit outside canvas`);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(50);
  assert.equal(await run(`document.getElementById('rotate').hidden`),false);const t=await run('testWorld.time');await run('step(1)');assert.equal(await run('testWorld.time'),t);
  await send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});await delay(50);
  assert.equal(await run(`document.getElementById('rotate').hidden`),true);
  await run(`document.getElementById('settings-toggle').click();document.getElementById('motion').click()`);
  assert.ok((await run(`document.getElementById('motion-status').textContent`)).includes('未获允许'));
  await run(`motionTestPermission='granted';document.getElementById('motion').click()`);
  assert.equal(await run(`document.getElementById('motion').getAttribute('aria-pressed')`),'true');
  await run(`document.getElementById('settings-close').click();document.getElementById('restart').click();const e=new Event('devicemotion');e.acceleration={x:20,y:0,z:0};window.dispatchEvent(e);step(.2)`);
  assert.equal(await run(`document.getElementById('game').dataset.jumpPhase`),'airborne');
  await run(`step(.8);document.getElementById('jump').click();step(.2)`);assert.equal(await run(`document.getElementById('game').dataset.jumpPhase`),'airborne');
  await run('step(.8)');await key('KeyJ');await key('KeyJ','keyUp');await run('step(.2)');assert.equal(await run(`document.getElementById('game').dataset.jumpPhase`),'airborne');
  await run(`document.getElementById('restart').click();step(60)`);
  assert.equal(await run(`document.getElementById('title').textContent`),'道场失守');assert.equal(await run(`document.getElementById('misses').textContent`),'3');
  await run(`document.getElementById('restart').click()`);
  // Use normal keyboard events to aim/attack and jump, reading targets only from the test-side World reference.
  const result=await run(`(()=>{
    const codes=['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'];
    for(let t=0;t<150*30 && testWorld.state==='playing';t++){
      const p=testWorld.player;let nearest=null,distance=Infinity;
      for(const e of testWorld.enemies){const d=Math.hypot(e.x-p.x,e.y-p.y);if(d<distance){nearest=e;distance=d;}}
      if(nearest){
        const d=(Math.round(Math.atan2(nearest.y-p.y,nearest.x-p.x)/(Math.PI/4))+8)%8;
        const x=Math.round(Math.cos(d*Math.PI/4)),y=Math.round(Math.sin(d*Math.PI/4));
        const held=[];if(x)held.push(x>0?'ArrowRight':'ArrowLeft');if(y)held.push(y>0?'ArrowDown':'ArrowUp');
        for(const code of held)window.dispatchEvent(new KeyboardEvent('keydown',{code,cancelable:true}));
        // Aiming is latched on keydown; release before advancing so the bot stays in the central stance.
        for(const code of held)window.dispatchEvent(new KeyboardEvent('keyup',{code}));
        if(distance<211)window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',cancelable:true}));
      }
      const o=testWorld.obstacle;if(o&&o.warning<=0&&o.x>p.x-100&&o.x<p.x-32)window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyJ',cancelable:true}));
      step(1/30);
    }
    return {state:testWorld.state,score:testWorld.score,misses:testWorld.misses};
  })()`);
  assert.equal(result.state,'won',JSON.stringify(result));assert.equal(result.score,20);
  assert.equal(await run(`document.getElementById('title').textContent`),'二十击，守护成功！');
  assert.deepEqual(b.errors,[]);
  console.log('PASS: real DOM/Canvas loading, character selection, WASD/diagonal movement, blur pause, three-finger move/attack/jump, recenter, four landscape sizes, portrait pause/resume, iOS permission denial/grant mocks, sensor/button/keyboard jump, 3-miss defeat, keyboard-driven 20-hit victory.');
} finally {await b.close();}
