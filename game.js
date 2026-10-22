'use strict';
// Eight discrete directions, clockwise from right; canvas coordinates point downward.
const TAU = Math.PI * 2;
function directionIndex(x, y) { return (Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8; }
function canHit(germ, direction) { return germ.distance >= 64 && germ.distance <= 152 && germ.direction === direction; }
const techniques = ['正拳突', '下段侧踢', '下段払い', '下段逆突', '逆突', '上段受け・反击', '上段突', '上段前踢'];
if (typeof module !== 'undefined') module.exports = { directionIndex, canHit };
if (typeof document !== 'undefined') {
const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
let state = 'menu', gender = 'male', direction = 0, score = 0, misses = 0;
let germs = [], particles = [], time = 0, spawnClock = 0, attackClock = 0, cooldown = 0, last = 0, paused = false;
let joystickPointer = null, soundOn = true, audioContext, flash = 0;
const keys = new Set();
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
function setDirection(d) { direction = d; $('technique').textContent = techniques[d]; }
function resetInput() { keys.clear(); joystickPointer = null; $('knob').style.transform = ''; }
function start() {
  resetInput(); score = misses = 0; germs = []; particles = []; time = 0; spawnClock = .65; attackClock = cooldown = flash = 0;
  paused = document.hidden; $('pause').hidden = !paused; state = 'playing'; setDirection(0);
  $('score').textContent = '0'; $('misses').textContent = '0'; $('overlay').hidden = true;
  sound(false);
}
function end(won) {
  state = won ? 'won' : 'lost'; resetInput(); $('overlay').hidden = false; $('characters').hidden = true;
  $('badge').textContent = won ? '本回修行完成' : '调整呼吸，再来一回';
  $('title').textContent = won ? '二十击，守护成功！' : '道场失守';
  $('message').textContent = `击碎 ${score} 个病菌，漏掉 ${misses} 个。${won ? '你的判断与拳脚配合得很好。' : '等病菌进入金色圆环，再朝它攻击。'}`;
  $('start').textContent = '再战一回';
}
function attack() {
  if (state !== 'playing' || paused || cooldown > 0) return;
  attackClock = .22; cooldown = .26;
  const targets = germs.filter(g => canHit(g, direction));
  if (!targets.length) { sound(false); return; }
  for (const germ of targets) {
    germs.splice(germs.indexOf(germ), 1); score++;
    const a = germ.direction * Math.PI / 4;
    for (let i = 0; i < 16; i++) particles.push({ x: Math.cos(a)*germ.distance, y: Math.sin(a)*germ.distance, vx:(Math.random()-.5)*280, vy:(Math.random()-.5)*280, life:.5, color:germ.color });
    if (score >= 20) break;
  }
  $('score').textContent = score; sound(true); if (score >= 20) end(true);
}
function spawn() {
  const d = Math.floor(Math.random()*8);
  germs.push({ direction:d, distance:350, speed:72 + Math.min(score,20)*1.8, phase:Math.random()*TAU, color:['#a5d871','#72cfbc','#d5a4cd'][Math.floor(Math.random()*3)] });
}
function update(dt) {
  if (state !== 'playing' || paused) return;
  time += dt; cooldown = Math.max(0,cooldown-dt); attackClock = Math.max(0,attackClock-dt); flash = Math.max(0,flash-dt);
  spawnClock -= dt; if (spawnClock <= 0) { spawn(); spawnClock = Math.max(.85,1.6-score*.025); }
  for (let i=germs.length-1;i>=0;i--) {
    germs[i].distance -= germs[i].speed*dt;
    if (germs[i].distance < 58) { germs.splice(i,1); misses++; flash=.25; $('misses').textContent=misses; sound(false); if(misses>=3){end(false);break;} }
  }
  particles = particles.filter(p => p.life>0); for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}
}
function line(x1,y1,x2,y2,color,width) {ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function circle(x,y,r,color) {ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
function fighter() {
  const a=direction*Math.PI/4, active=attackClock>0, kick=[1,2,7].includes(direction);
  const dx=Math.cos(a),dy=Math.sin(a);
  ctx.save();ctx.translate(0,10);
  ctx.fillStyle='#081d2055';ctx.beginPath();ctx.ellipse(0,48,43,11,0,0,TAU);ctx.fill();
  // White gi, dark belt, guarded stance; extension follows the selected attack direction.
  line(-10,12,-24,43,'#e4eae3',15);line(10,12,24,43,'#e4eae3',15);
  if(active&&kick)line(6,12,dx*104,dy*104,'#f5f5ea',17);
  ctx.fillStyle='#f6f4e9';ctx.beginPath();ctx.moveTo(-19,-34);ctx.lineTo(19,-34);ctx.lineTo(23,16);ctx.lineTo(-23,16);ctx.closePath();ctx.fill();
  line(-10,-32,8,-8,'#a7b7b2',2);line(10,-32,-6,-6,'#a7b7b2',2);
  line(-20,7,20,7,'#293634',7);line(4,8,10,27,'#293634',5);
  line(-18,-24,-31,-1,'#edf1e8',13);line(18,-24,31,-14,'#edf1e8',13);
  circle(-31,-1,7,'#e9b492');circle(31,-14,7,'#e9b492');
  if(active&&!kick){line(0,-20,dx*98,dy*98-10,'#f5f5ea',14);circle(dx*102,dy*102-10,8,'#e9b492');}
  if(gender==='female'){circle(-14,-46,11,'#292b2b');line(-17,-47,-24,-30,'#292b2b',9);}
  circle(0,-48,17,'#ebba97');ctx.fillStyle='#29302e';ctx.beginPath();ctx.arc(0,-51,17,Math.PI,TAU);ctx.fill();
  line(-7,-49,-3,-49,'#29302e',2);line(4,-49,8,-49,'#29302e',2);line(-3,-40,4,-40,'#ac725e',2);
  ctx.restore();
}
function draw() {
  const w=canvas.width,h=canvas.height;
  ctx.fillStyle='#193739';ctx.fillRect(0,0,w,h);
  const gradient=ctx.createRadialGradient(w/2,h/2,30,w/2,h/2,w*.65);gradient.addColorStop(0,'#416056');gradient.addColorStop(1,'#132c31');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#c8d6bb0e';ctx.lineWidth=1;
  for(let x=0;x<w;x+=70){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=0;y<h;y+=70){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  ctx.save();ctx.translate(w/2,h/2+10);const scale=Math.min(w/820,h/800);ctx.scale(scale,scale);
  ctx.strokeStyle='#e7c78855';ctx.lineWidth=88;ctx.beginPath();ctx.arc(0,0,108,0,TAU);ctx.stroke();
  for(const r of [64,152,325]){ctx.strokeStyle=r===325?'#e4ddbb18':'#e7c78888';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke();}
  for(let i=0;i<8;i++){const a=i*Math.PI/4;line(Math.cos(a)*165,Math.sin(a)*165,Math.cos(a)*305,Math.sin(a)*305,'#dce2c21c',1);}
  const a=direction*Math.PI/4;ctx.fillStyle='#f3d08b44';ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,155,a-.35,a+.35);ctx.closePath();ctx.fill();
  fighter();
  for(const g of germs){
    const angle=g.direction*Math.PI/4,x=Math.cos(angle)*g.distance,y=Math.sin(angle)*g.distance;
    ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(time*3+g.phase)*.15);
    for(let i=0;i<8;i++){const t=i*TAU/8;line(Math.cos(t)*18,Math.sin(t)*18,Math.cos(t)*29,Math.sin(t)*29,g.color,5);circle(Math.cos(t)*29,Math.sin(t)*29,4,g.color);}
    circle(0,0,23,g.color);circle(-7,-3,6,'#fff9e8');circle(7,-3,6,'#fff9e8');circle(-6,-2,3,'#233f38');circle(6,-2,3,'#233f38');line(-6,11,6,8,'#34554c',3);circle(-13,10,3,'#ffffff44');ctx.restore();
  }
  for(const p of particles){ctx.globalAlpha=Math.max(0,p.life*2);circle(p.x,p.y,5,p.color);}ctx.globalAlpha=1;
  if(attackClock>0){ctx.strokeStyle='#fff1bc';ctx.lineWidth=9;ctx.beginPath();ctx.arc(0,0,117,a-.3,a+.3);ctx.stroke();}
  ctx.restore();
  if(flash>0){ctx.fillStyle=`rgba(240,100,85,${flash})`;ctx.fillRect(0,0,w,h);}
}
function frame(now){const dt=Math.min((now-last)/1000,.04);last=now;update(dt);draw();requestAnimationFrame(frame);}
function resize(){const rect=canvas.getBoundingClientRect();canvas.width=Math.round(rect.width*Math.min(devicePixelRatio||1,2));canvas.height=Math.round(rect.height*Math.min(devicePixelRatio||1,2));}
function keyboardDirection(){const x=Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')),y=Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp'));if(x||y)setDirection(directionIndex(x,y));}
window.addEventListener('keydown',e=>{if(e.code.startsWith('Arrow')||e.code==='Space'){if(state!=='playing')return;e.preventDefault();if(e.code==='Space'){if(!e.repeat)attack();}else{keys.add(e.code);keyboardDirection();}}});
window.addEventListener('keyup',e=>{keys.delete(e.code);keyboardDirection();});
window.addEventListener('blur',()=>{resetInput();if(state==='playing'){paused=true;$('pause').hidden=false;}});
window.addEventListener('focus',()=>{paused=false;last=performance.now();$('pause').hidden=true;});
document.addEventListener('visibilitychange',()=>{resetInput();paused=document.hidden;last=performance.now();$('pause').hidden=!paused||state!=='playing';});
const stick=$('joystick');
function moveStick(e){const r=stick.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,dist=Math.hypot(x,y),limit=r.width*.3; if(dist>10)setDirection(directionIndex(x,y));const k=Math.min(1,limit/(dist||1));$('knob').style.transform=`translate(${x*k}px,${y*k}px)`;}
stick.addEventListener('pointerdown',e=>{if(joystickPointer!==null)return;e.preventDefault();joystickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e);});
stick.addEventListener('pointermove',e=>{if(e.pointerId===joystickPointer)moveStick(e);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,e=>{if(e.pointerId===joystickPointer){joystickPointer=null;$('knob').style.transform='';}});
$('attack').addEventListener('pointerdown',e=>{e.preventDefault();attack();});
$('attack').addEventListener('click',e=>{if(e.detail===0)attack();});
$('start').addEventListener('click',()=>{start();$('start').blur();});$('restart').addEventListener('click',start);
for(const button of document.querySelectorAll('[data-gender]'))button.addEventListener('click',()=>{gender=button.dataset.gender;document.querySelectorAll('[data-gender]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});
$('sound').addEventListener('click',()=>{soundOn=!soundOn;$('sound').textContent=`声音：${soundOn?'开':'关'}`;$('sound').setAttribute('aria-pressed',String(soundOn));});
window.addEventListener('resize',resize);resize();requestAnimationFrame(frame);
}
