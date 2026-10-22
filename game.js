'use strict';
// Eight discrete directions, clockwise from right; canvas coordinates point downward.
const TAU = Math.PI * 2;
function directionIndex(x, y) { return (Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8; }
function canHit(germ, direction) { return germ.distance >= 64 && germ.distance <= 152 && germ.direction === direction; }
const JUMP_DURATION = .82;
const SHAKE_COOLDOWN_MS = 1200;
function joystickVector(x, y, radius, deadZone = 10) {
  const distance = Math.hypot(x, y), k = Math.min(1, radius / (distance || 1));
  return { x: x * k, y: y * k, direction: distance > deadZone ? directionIndex(x, y) : null };
}
function jumpPose(elapsed) {
  if (elapsed < 0 || elapsed >= JUMP_DURATION) return { height: 0, squash: 1, phase: 'grounded' };
  if (elapsed < .12) return { height: 0, squash: 1 - .18 * elapsed / .12, phase: 'takeoff' };
  if (elapsed < .68) return { height: 82 * Math.sin(Math.PI * (elapsed - .12) / .56), squash: 1, phase: 'airborne' };
  return { height: 0, squash: 1 - .18 * Math.sin(Math.PI * (elapsed - .68) / .14), phase: 'landing' };
}
function createShakeDetector() {
  let previous = null, lastTrigger = -Infinity;
  return {
    reset() { previous = null; lastTrigger = -Infinity; },
    sample(acceleration, includesGravity, now, threshold) {
      if (!acceleration || !['x','y','z'].every(axis => Number.isFinite(acceleration[axis]))) return false;
      const values = [acceleration.x, acceleration.y, acceleration.z];
      // Gravity fallback uses the change between readings, ignoring a stationary phone's gravity.
      const strength = includesGravity ? (previous ? Math.hypot(...values.map((v,i) => v - previous[i])) : 0) : Math.hypot(...values);
      previous = values;
      if (strength < threshold || now - lastTrigger < SHAKE_COOLDOWN_MS) return false;
      lastTrigger = now; return true;
    }
  };
}
if (typeof module !== 'undefined') module.exports = { directionIndex, canHit, joystickVector, jumpPose, createShakeDetector, JUMP_DURATION, SHAKE_COOLDOWN_MS };
if (typeof document !== 'undefined') {
const $ = id => document.getElementById(id);
const {World, ATTACKS, attackPhase} = QiqianArcade;
const world = new World(), canvas = $('game'), renderer = new QiqianArt.Renderer(canvas);
world.state = 'menu';
let gender = 'male', paused = false, focused = true, settingsOpen = false, manualPause = false;
let joystickPointer = null, analog = {x:0,y:0}, soundOn = true, audioContext;
let motionEnabled = false, motionPending = false, motionTimer;
let last = performance.now(), accumulator = 0, shownState = 'menu';
const shakeDetector = createShakeDetector(), keys = new Set();
const directionNames = ['右','右下','下','左下','左','左上','上','右上'];
function sound(hit) {
  if (!soundOn) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume().catch(() => {});
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.type = hit ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(hit ? 620 : 180, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(hit ? 130 : 75, audioContext.currentTime + .12);
    gain.gain.setValueAtTime(.09, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .15);
    oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + .16);
  } catch (_) { /* Sound is optional when Web Audio is unavailable. */ }
}

function resetInput() {
  keys.clear(); analog.x = analog.y = 0;
  const pointer = joystickPointer; joystickPointer = null;
  if (pointer !== null && $('joystick').hasPointerCapture(pointer)) $('joystick').releasePointerCapture(pointer);
  $('knob').style.transform = ''; shakeDetector.reset();
}
function resumeAudio() { if (soundOn && audioContext?.state==='suspended') audioContext.resume().catch(()=>{}); }
function jump() { resumeAudio(); if (!paused) world.jump(); }
function attack() { resumeAudio(); if (!paused) world.attack(); }
function onMotion(event) {
  if (!motionEnabled) return;
  const direct = event.acceleration;
  const hasDirect = direct && ['x','y','z'].every(axis => Number.isFinite(direct[axis]));
  const sample = hasDirect ? direct : event.accelerationIncludingGravity;
  if (!sample || !['x','y','z'].every(axis => Number.isFinite(sample[axis]))) return;
  clearTimeout(motionTimer);
  if($('motion-status').textContent !== '摇晃已开启 · 冷却 1.2 秒 · 也可按「跳」') $('motion-status').textContent = '摇晃已开启 · 冷却 1.2 秒 · 也可按「跳」';
  if (world.state !== 'playing' || paused) { shakeDetector.reset(); return; }
  if (shakeDetector.sample(sample, !hasDirect, performance.now(), Number($('shake-threshold').value))) jump();
}
async function toggleMotion() {
  if (motionPending) return;
  if (motionEnabled) {
    motionEnabled = false; window.removeEventListener('devicemotion', onMotion); clearTimeout(motionTimer); shakeDetector.reset();
    $('motion').textContent = '开启摇晃跳跃（实验）'; $('motion').setAttribute('aria-pressed','false');
    $('motion-status').textContent = '摇晃已关闭；可按「跳」或 J 键。'; return;
  }
  if (!window.isSecureContext) { $('motion-status').textContent = '摇晃需要 HTTPS 安全连接；请使用「跳」按钮。'; return; }
  if (!window.DeviceMotionEvent) { $('motion-status').textContent = '此浏览器不支持运动传感器；请使用「跳」按钮。'; return; }
  motionPending = true;
  try {
    // iOS requires this call directly inside a user-initiated button handler.
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== 'granted') { $('motion-status').textContent = '运动权限未获允许；可使用「跳」按钮。'; return; }
    }
    motionEnabled = true; shakeDetector.reset(); window.addEventListener('devicemotion', onMotion);
    $('motion').textContent = '关闭摇晃跳跃'; $('motion').setAttribute('aria-pressed','true');
    $('motion-status').textContent = '等待传感器读数…也可按「跳」';
    motionTimer = setTimeout(() => { $('motion-status').textContent = '尚未收到有效读数；请轻摇手机，或使用「跳」按钮。'; }, 3500);
  } catch (_) { $('motion-status').textContent = '无法启用运动传感器；请使用「跳」按钮。'; }
  finally { motionPending = false; }
}

function syncPause() {
  const portrait = matchMedia('(pointer: coarse) and (orientation: portrait)').matches;
  $('rotate').hidden = !portrait;
  paused = document.hidden || !focused || portrait || settingsOpen || manualPause;
  $('pause').hidden = !paused || world.state !== 'playing';
  $('pause-toggle').textContent = manualPause ? '继续' : '暂停';
  resetInput(); accumulator = 0; last = performance.now();
}
function start() {
  world.reset(); shownState = 'playing';manualPause = false;syncPause();
  $('score').textContent = '0'; $('misses').textContent = '0'; $('overlay').hidden = true;
  sound(false);
}
function end() {
  shownState=world.state;world.player.attack=null;world.player.jump=.82;resetInput();
  $('overlay').hidden=false;$('characters').hidden=true;
  const won=world.state==='won';
  $('badge').textContent=won?'本回修行完成':'调整呼吸，再来一回';
  $('title').textContent=won?'二十击，守护成功！':'道场失守';
  $('message').textContent=`击碎 ${world.score} 个 · 失守 ${world.misses} 次。${won?'先行一礼，再接再厉。':'观察来向，等敌人接近再出招；扫杆到脚前记得跳。'}`;
  $('start').textContent='再战一回';
}
function inputVector() {
  const x=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));
  const y=Number(keys.has('ArrowDown')||keys.has('KeyS'))-Number(keys.has('ArrowUp')||keys.has('KeyW'));
  if(x||y){const d=Math.hypot(x,y);return {x:x/d,y:y/d};}
  return analog;
}
function updateHud() {
  const a=world.player.attack;
  const technique=a?`${ATTACKS[a.kind].name} · ${{prepare:'准备',power:'发力',contact:'命中窗',recover:'收招'}[attackPhase(a)]}`:`${directionNames[world.player.direction]} · 准备`;
  if($('technique').textContent!==technique)$('technique').textContent=technique;
  if($('score').textContent!==String(world.score))$('score').textContent=world.score;
  if($('misses').textContent!==String(world.misses))$('misses').textContent=world.misses;
  const level=world.score<6?'一 · 见招':world.score<13?'二 · 应变':'三 · 定心';
  if($('level').textContent!==level)$('level').textContent=level;
  if(canvas.dataset.state!==world.state)canvas.dataset.state=world.state;
}
function frame(now) {
  const dt=Math.max(0,Math.min((now-last)/1000,.05));last=now;
  if(!paused && world.state==='playing'){
    accumulator+=dt;const input=inputVector();
    while(accumulator>=1/120){world.tick(1/120,input);accumulator-=1/120;}
    if(world.state!==shownState)end();
  }
  if(!paused && world.state==='won')world.celebration=(world.celebration||0)+dt;
  for(const event of world.events){if(event==='hit'||event==='won')sound(true);else if(['swing','hurt','jump','warning'].includes(event))sound(false);}
  world.events.length=0;
  updateHud();renderer.draw(world,gender);requestAnimationFrame(frame);
}
const movementCodes=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'];
window.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLInputElement)return;
  if(!movementCodes.includes(e.code)&&e.code!=='Space'&&e.code!=='KeyJ')return;
  if(world.state!=='playing'||paused)return;
  e.preventDefault();
  if(movementCodes.includes(e.code)){
    keys.add(e.code);const v=inputVector();if(v.x||v.y)world.player.direction=directionIndex(v.x,v.y);
  }else if(!e.repeat){if(e.code==='Space')attack();else jump();}
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{focused=false;syncPause();});
window.addEventListener('focus',()=>{focused=true;syncPause();});
document.addEventListener('visibilitychange',syncPause);
const stick=$('joystick');
function moveStick(e){
  const r=stick.getBoundingClientRect(),radius=Math.max(1,(stick.clientWidth-$('knob').offsetWidth)/2);
  const v=joystickVector(e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2,radius,8);
  analog.x=v.direction===null?0:v.x/radius;analog.y=v.direction===null?0:v.y/radius;
  if(v.direction!==null)world.player.direction=v.direction;
  $('knob').style.transform=`translate(${v.x}px,${v.y}px)`;
}
stick.addEventListener('pointerdown',e=>{if(joystickPointer!==null||paused)return;e.preventDefault();joystickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e);});
stick.addEventListener('pointermove',e=>{if(e.pointerId===joystickPointer)moveStick(e);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,e=>{if(e.pointerId===joystickPointer){joystickPointer=null;analog.x=analog.y=0;$('knob').style.transform='';}});
for(const [id,action] of [['attack',attack],['jump',jump]]){
  $(id).addEventListener('pointerdown',e=>{e.preventDefault();action();});
  $(id).addEventListener('click',e=>{if(e.detail===0)action();});
}
$('start').addEventListener('click',()=>{start();$('start').blur();});
$('restart').addEventListener('click',start);
$('character-menu').addEventListener('click',()=>{
  world.state='menu';shownState='menu';resetInput();$('overlay').hidden=false;$('characters').hidden=false;
  $('title').textContent='以武，守护自己。';$('message').textContent='摇杆移动，朝来敌出招；扫杆到脚前跳跃。';$('start').textContent='进入道场';
});
for(const b of document.querySelectorAll('[data-gender]'))b.addEventListener('click',()=>{gender=b.dataset.gender;document.querySelectorAll('[data-gender]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));});
$('sound').addEventListener('click',()=>{soundOn=!soundOn;$('sound').textContent=`声音：${soundOn?'开':'关'}`;$('sound').setAttribute('aria-pressed',String(soundOn));});
$('motion').addEventListener('click',toggleMotion);
$('shake-threshold').addEventListener('input',()=>{$('threshold-value').textContent=`${$('shake-threshold').value} m/s²`;shakeDetector.reset();});
$('settings-toggle').addEventListener('click',()=>{settingsOpen=true;$('settings').hidden=false;syncPause();$('settings-close').focus();});
$('settings-close').addEventListener('click',()=>{settingsOpen=false;$('settings').hidden=true;syncPause();$('settings-toggle').focus();});
$('pause-toggle').addEventListener('click',()=>{manualPause=!manualPause;syncPause();});
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&settingsOpen)$('settings-close').click();});
window.addEventListener('resize',()=>{syncPause();renderer.resize();});
window.visualViewport?.addEventListener('resize',()=>{syncPause();renderer.resize();});
document.addEventListener('gesturestart',e=>e.preventDefault(),{passive:false});
window.addEventListener('pagehide',()=>{focused=false;syncPause();});
window.addEventListener('pageshow',()=>{focused=true;syncPause();});
renderer.resize();syncPause();requestAnimationFrame(frame);
}
