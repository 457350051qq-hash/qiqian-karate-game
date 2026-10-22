'use strict';
// Layered vector artwork: feet → trouser legs → gi/hips → sleeves → face/hair → belt.
// Joint poses are independent of collision geometry and can later drive replacement artwork.
(function(root){
  const {ATTACKS,attackPhase,jumpHeight}=QiqianArcade;
  const ink='#293d42', ivory='#fff8e6', shade='#cdd9d0', skin='#e9ad83';
  const mix=(a,b,t)=>a+(b-a)*t;
  const lerpPoint=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t)];
  function path(c,points,fill,stroke=ink,width=3){c.beginPath();points(c);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.lineJoin='round';c.stroke();}}
  function ellipse(c,x,y,rx,ry,color,stroke=null){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=3;c.stroke();}}
  function line(c,points,color,width=3){c.beginPath();c.moveTo(...points[0]);for(let i=1;i<points.length;i++)c.lineTo(...points[i]);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
  function cloth(c,a,b,width,color=ivory){
    const dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy)||1,nx=-dy/d,ny=dx/d;
    path(c,p=>{p.moveTo(a[0]+nx*width*.6,a[1]+ny*width*.6);p.quadraticCurveTo((a[0]+b[0])/2+nx*width*.8,(a[1]+b[1])/2+ny*width*.8,b[0]+nx*width*.4,b[1]+ny*width*.4);p.lineTo(b[0]-nx*width*.4,b[1]-ny*width*.4);p.quadraticCurveTo((a[0]+b[0])/2-nx*width*.7,(a[1]+b[1])/2-ny*width*.7,a[0]-nx*width*.6,a[1]-ny*width*.6);p.closePath();},color);
    line(c,[[a[0]+nx*width*.2,a[1]+ny*width*.2],[b[0]+nx*width*.15,b[1]+ny*width*.15]],shade,2);
  }
  function limb(c,a,k,b,width){cloth(c,a,k,width);cloth(c,k,b,width*.85);line(c,[[k[0]-7,k[1]+2],[k[0]+6,k[1]+5]],'#9daea8',2);}
  function fist(c,p){ellipse(c,p[0],p[1],11,9,skin,ink);line(c,[[p[0]-4,p[1]-3],[p[0]+4,p[1]-3]],'#b97b63',1.5);}
  function poseFor(world){
    const p=world.player,a=p.attack,angle=(a?a.direction:p.direction)*Math.PI/4;
    const pose={hips:[0,-80],leftKnee:[-25,-39],leftFoot:[-39,-4],rightKnee:[30,-40],rightFoot:[43,-4],leftElbow:[-38,-119],leftHand:[-25,-145],rightElbow:[41,-113],rightHand:[49,-137],lean:0,twist:0,pivot:0,extension:0,angle};
    if(p.moving && !a){const stride=Math.sin(p.walk)*9;pose.leftFoot[0]+=stride;pose.rightFoot[0]-=stride;pose.leftKnee[1]-=Math.max(0,stride)*.5;pose.rightKnee[1]+=Math.min(0,stride)*.5;}
    if(!p.moving&&!a&&world.time%9>7.8){pose.leftHand=[-1,-80];pose.leftElbow=[-35,-96];}
    if(jumpHeight(p.jump)>0){pose.leftKnee=[-35,-65];pose.leftFoot=[-13,-37];pose.rightKnee=[36,-69];pose.rightFoot=[60,-37];}
    if(!a)return pose;
    const spec=ATTACKS[a.kind],t=a.elapsed,activeEnd=spec.windup+spec.active;
    let extension=t<spec.windup ? Math.max(0,(t-spec.windup*.5)/(spec.windup*.5)) : t<activeEnd?1:Math.max(0,1-(t-activeEnd)/spec.recovery);
    const chamber=t<spec.windup?Math.min(1,t/(spec.windup*.5)):Math.max(0,1-(t-activeEnd)/spec.recovery);
    pose.extension=extension;
    const dx=Math.max(.16,Math.abs(Math.cos(angle))),dy=Math.sin(angle)*.85;
    if(a.kind==='oi'){
      pose.lean=15*extension;pose.rightFoot=[43+28*extension,-4];pose.rightKnee=[35+20*extension,-43];
      pose.rightHand=lerpPoint([30,-148],[dx*145,-120+dy*120],extension);pose.rightElbow=lerpPoint([45,-113],[dx*82,-115+dy*55],extension);
      pose.leftHand=[-9,-93];pose.leftElbow=[-41,-107];
    }else if(a.kind==='gyaku'){
      pose.twist=extension;pose.lean=7*extension;
      pose.leftHand=lerpPoint([-29,-151],[dx*164,-119+dy*130],extension);pose.leftElbow=lerpPoint([-42,-113],[dx*71,-117+dy*55],extension);
      pose.rightHand=[14,-95];pose.rightElbow=[44,-112];pose.leftFoot[0]+=extension*9;
    }else if(a.kind==='mae'){
      pose.rightKnee=lerpPoint([30,-40],[42,-116],chamber);
      pose.rightFoot=lerpPoint([43,-4],[25,-76],chamber);
      pose.rightKnee=lerpPoint(pose.rightKnee,[dx*93,-65+dy*85],extension);
      pose.rightFoot=lerpPoint(pose.rightFoot,[dx*205,-77+dy*140],extension);pose.lean=-7*extension;
    }else{
      pose.pivot=extension;pose.twist=extension;pose.lean=-11*extension;
      // Chamber across the body, sweep the bent knee, extend, then fold back on the same route.
      const sweep=Math.sin(extension*Math.PI/2);
      pose.rightKnee=lerpPoint([30,-40],[12,-111],chamber);
      pose.rightFoot=lerpPoint([43,-4],[-8,-74],chamber);
      pose.rightKnee=lerpPoint(pose.rightKnee,[96,-72+dy*67],sweep);
      pose.rightFoot=lerpPoint(pose.rightFoot,[dx*188,-120+dy*110],extension);
      pose.leftFoot=[-39+12*extension,-4];
    }
    return pose;
  }
  function fighter(c,world,gender){
    const p=world.player,pose=poseFor(world),height=jumpHeight(p.jump),facing=Math.cos(pose.angle)<-.05?-1:1;
    const idle=Math.sin(world.time*3)*1.8;
    c.save();c.translate(p.x,p.y+82);
    ellipse(c,0,0,57-height*.20,12-height*.04,'#273b3938');
    const landing=p.jump>=.68&&p.jump<.82?Math.sin((p.jump-.68)/.14*Math.PI)*.13:0;
    const prep=p.jump<.12?p.jump/.12*.12:0;
    c.translate(0,-height);c.scale(facing*(1+landing*.15),1-landing-prep);
    if(p.hurt>0)c.rotate(Math.sin(p.hurt*24)*.06);
    if(p.whiff>0)c.rotate(-Math.sin(p.whiff/.35*Math.PI)*.12);
    if(world.state==='won'){pose.leftHand=[-15,-160];pose.rightHand=[17,-160];pose.leftElbow=[-36,-131];pose.rightElbow=[37,-131];c.rotate(Math.sin(Math.min(1,world.celebration||0)*Math.PI)*.1);}
    // Support foot pivot is visible independently of the kicking hip.
    c.save();c.translate(...pose.leftFoot);c.rotate(-pose.pivot*.65);ellipse(c,0,0,21,8,skin,ink);c.restore();ellipse(c,...pose.rightFoot,21,8,skin,ink);
    limb(c,[-14,-82],pose.leftKnee,pose.leftFoot,27);limb(c,[15,-82],pose.rightKnee,pose.rightFoot,28);
    c.translate(pose.lean,idle);
    // Tailored silhouette with broad sleeves, waist taper and a shaded rear panel.
    path(c,q=>{q.moveTo(-30,-155);q.quadraticCurveTo(0,-167,31,-153);q.lineTo(39,-127);q.lineTo(29,-82);q.quadraticCurveTo(0,-74,-31,-82);q.lineTo(-38,-126);q.closePath();},ivory);
    path(c,q=>{q.moveTo(19,-151);q.lineTo(34,-128);q.lineTo(25,-83);q.lineTo(8,-82);q.closePath();},shade,null);
    line(c,[[-17,-155],[7+pose.twist*9,-117],[-4,-85]],'#9aada7',3);
    line(c,[[16,-155],[-8,-122],[-14,-87]],'#b8c6bc',2);
    line(c,[[-27,-111],[-16,-116]],'#a6b7ae',2);line(c,[[15,-103],[27,-99]],'#a6b7ae',2);
    const leftShoulder=[-27+pose.twist*20,-145],rightShoulder=[27-pose.twist*17,-145];
    // Rear arm is rendered before front arm; gyaku exchanges the active side.
    const arm=(shoulder,elbow,hand)=>{limb(c,shoulder,elbow,hand,19);fist(c,hand);};
    if(p.attack?.kind==='gyaku'){arm(rightShoulder,pose.rightElbow,pose.rightHand);arm(leftShoulder,pose.leftElbow,pose.leftHand);}
    else{arm(leftShoulder,pose.leftElbow,pose.leftHand);arm(rightShoulder,pose.rightElbow,pose.rightHand);}
    // Neck, asymmetric cheek/jaw contour and expressive brow/eye layers.
    path(c,q=>{q.moveTo(-12,-168);q.lineTo(-10,-149);q.quadraticCurveTo(4,-142,14,-152);q.lineTo(14,-172);q.closePath();},skin);
    if(gender==='female'){
      path(c,q=>{q.moveTo(-24,-198);q.bezierCurveTo(-66,-210,-61,-165,-42,-156);q.quadraticCurveTo(-37,-174,-23,-178);q.closePath();},'#44332f');
      ellipse(c,-29,-191,8,7,'#cc735e',ink);
    }
    path(c,q=>{q.moveTo(-27,-194);q.bezierCurveTo(-26,-224,24,-225,29,-194);q.lineTo(31,-180);q.quadraticCurveTo(22,-154,3,-155);q.quadraticCurveTo(-23,-157,-28,-181);q.closePath();},skin);
    path(c,q=>{q.moveTo(17,-202);q.quadraticCurveTo(35,-176,12,-158);q.quadraticCurveTo(26,-161,31,-181);q.lineTo(29,-195);q.closePath();},'#d18e73',null);
    ellipse(c,-28,-180,6,10,skin,ink);
    path(c,q=>{q.moveTo(-28,-190);q.bezierCurveTo(-39,-220,13,-236,29,-208);q.lineTo(33,-192);q.lineTo(17,-200);q.lineTo(4,-193);q.lineTo(-3,-205);q.lineTo(-20,-194);q.lineTo(-23,-181);q.closePath();},gender==='female'?'#44332f':'#283b42');
    line(c,[[-19,-210],[-9,-217],[8,-215]],'#64716b',3);
    const blink=world.time%4.7<.10,hurt=p.hurt>0,confident=world.combo>=3;
    if(hurt){line(c,[[-15,-186],[-6,-178],[-15,-173]],ink,2.5);line(c,[[12,-185],[21,-177],[12,-172]],ink,2.5);}
    else if(blink){line(c,[[-17,-182],[-7,-181]],ink,3);line(c,[[8,-181],[19,-181]],ink,3);}
    else{ellipse(c,-12,-183,6,8,'#fffdf1');ellipse(c,14,-182,6,8,'#fffdf1');ellipse(c,-9,-182,2.8,4,ink);ellipse(c,17,-181,2.8,4,ink);}
    line(c,[[-20,-195],[-7,-192+(confident?3:0)]],ink,3);line(c,[[7,-192],[22,-194]],ink,3);
    line(c,[[2,-183],[5,-174],[0,-173]],'#ab6b59',2);
    if(hurt||p.whiff>0)ellipse(c,6,-165,6,4,'#713f3c');
    else{path(c,q=>{q.moveTo(-7,-168);q.quadraticCurveTo(6,-158,19,-170);q.quadraticCurveTo(7,-165,-7,-168);},'#fff6e1',ink,1.5);}
    // Belt knot and independently swinging tails, never a rigid body rotation.
    path(c,q=>{q.moveTo(-31,-93);q.lineTo(29,-93);q.lineTo(29,-83);q.lineTo(-31,-83);q.closePath();},'#36484a');
    const sway=Math.sin(world.time*5)*4+(p.attack?pose.extension*12:0);
    path(c,q=>{q.moveTo(1,-86);q.quadraticCurveTo(12+sway,-68,8+sway,-53);q.lineTo(17+sway,-55);q.lineTo(12,-88);q.closePath();},'#36484a');
    path(c,q=>{q.moveTo(0,-87);q.lineTo(-7,-61);q.lineTo(-16+sway*.4,-65);q.lineTo(-8,-90);q.closePath();},'#465b5a');ellipse(c,0,-87,9,7,'#2f4144',ink);
    c.restore();
  }
  function enemy(c,e,time,defeated=false){
    const fast=e.kind==='fast',hop=e.kind==='jumper',r=fast?22:hop?32:30;
    ellipse(c,e.x,e.y+76,r*.9,7,'#283f3833');
    c.save();c.translate(e.x,e.y+46-e.height);c.rotate(defeated?(1-e.life)*7:Math.sin(time*5+e.seed)*.12);
    const squash=defeated?.8:1+Math.sin(e.age*6)*.05;c.scale(1/squash,squash);
    const color=fast?'#eea353':hop?'#b59ed9':'#87c6a0';
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;line(c,[[Math.cos(a)*r*.8,Math.sin(a)*r*.8],[Math.cos(a)*(r+10),Math.sin(a)*(r+10)]],ink,6);ellipse(c,Math.cos(a)*(r+10),Math.sin(a)*(r+10),4,4,color);}
    path(c,q=>{q.moveTo(-r,0);q.bezierCurveTo(-r*1.2,-r*.9,-r*.3,-r*1.2,0,-r);q.bezierCurveTo(r*.7,-r*1.2,r*1.2,-r*.4,r,0);q.bezierCurveTo(r*1.1,r*.9,-r*.6,r*1.3,-r,0);},color);
    ellipse(c,9,12,r*.55,r*.35,'#293d4218');ellipse(c,-12,-14,7,4,'#ffffff65');
    if(defeated){line(c,[[-16,-10],[-7,-1],[-16,3]],ink,3);line(c,[[7,-10],[16,-1],[7,3]],ink,3);ellipse(c,4,13,8,5,'#fff6dd',ink);}
    else{ellipse(c,-9,-5,8,10,'#fffae9');ellipse(c,10,-5,8,10,'#fffae9');ellipse(c,-6,-3,3,5,ink);ellipse(c,7,-3,3,5,ink);line(c,[[-17,-18],[-4,-14]],ink,3);line(c,[[4,-14],[18,-18]],ink,3);path(c,q=>{q.moveTo(-10,12);q.quadraticCurveTo(4,23,16,8);q.lineTo(10,9);q.quadraticCurveTo(0,16,-10,12);},'#fff7de',ink,2);}
    if(fast){line(c,[[-r-24,-4],[-r-12,-4]],'#e7b97e',3);line(c,[[-r-18,7],[-r-7,7]],'#e7b97e',3);}
    if(hop){path(c,q=>{q.moveTo(-13,-r);q.lineTo(-8,-r-12);q.lineTo(5,-r-5);q.lineTo(13,-r-12);q.lineTo(18,-r);q.closePath();},'#e2c46e');}
    c.restore();
  }
  function background(c){
    c.fillStyle='#edf0df';c.fillRect(0,0,960,540);
    const light=c.createLinearGradient(0,0,0,540);light.addColorStop(0,'#e7e9d6');light.addColorStop(.43,'#f6eacb');light.addColorStop(.44,'#c69d72');light.addColorStop(1,'#e0bb86');c.fillStyle=light;c.fillRect(0,0,960,540);
    c.fillStyle='#344c48';c.fillRect(0,218,960,13);c.fillStyle='#9a7955';c.fillRect(0,231,960,10);
    for(const x of [50,800]){c.fillStyle='#6f8173';c.fillRect(x,36,110,146);c.fillStyle='#e3e5ce';c.fillRect(x+7,43,96,132);for(let i=1;i<4;i++)line(c,[[x+7,43+i*33],[x+103,43+i*33]],'#a3b09b',3);line(c,[[x+55,43],[x+55,175]],'#a3b09b',3);}
    c.fillStyle='#36534c';c.fillRect(335,30,290,117);c.fillStyle='#e8cd88';c.font='bold 38px system-ui';c.textAlign='center';c.fillText('七千武道',480,86);c.font='11px system-ui';c.fillText('Q I Q I A N   •   R E S P E C T   &   S P I R I T',480,117);
    for(let y=260;y<540;y+=45)line(c,[[0,y],[960,y]],'#976e4538',1.5);
    for(let row=0;row<7;row++){const y=241+row*45;for(let x=(row%2)*85;x<960;x+=170)line(c,[[x,y],[x,y+45]],'#976e4530',1);}
    path(c,q=>{q.moveTo(100,242);q.lineTo(270,242);q.lineTo(520,540);q.lineTo(270,540);q.closePath();},'#fff7d71d',null);
    c.setLineDash([8,10]);c.strokeStyle='#6b665c36';c.lineWidth=2;c.strokeRect(365,300,230,130);c.setLineDash([]);
    c.fillStyle='#635b4965';c.font='12px system-ui';c.fillText('第一关 · 净心道场',480,509);
  }
  class Renderer {
    constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.back=document.createElement('canvas');this.back.width=960;this.back.height=540;background(this.back.getContext('2d'));}
    resize(){const r=this.canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(r.width*d);this.canvas.height=Math.round(r.height*d);}
    draw(world,gender){
      const c=this.ctx,w=this.canvas.width,h=this.canvas.height,scale=Math.min(w/960,h/540);
      c.fillStyle='#203c3b';c.fillRect(0,0,w,h);c.save();c.translate((w-960*scale)/2,(h-540*scale)/2);c.scale(scale,scale);
      if(world.shake>0)c.translate(Math.sin(world.time*85)*world.shake*17,Math.cos(world.time*74)*world.shake*9);
      c.drawImage(this.back,0,0);
      const p=world.player;
      // Subtle ground aiming cone; the character is independently articulated, never rotated as a sprite.
      c.save();c.translate(p.x,p.y+68);const a=(p.attack?p.attack.direction:p.direction)*Math.PI/4;
      c.fillStyle='#f9efc652';c.beginPath();c.moveTo(0,0);c.arc(0,0,p.attack?ATTACKS[p.attack.kind].reach:150,a-.36,a+.36);c.closePath();c.fill();c.restore();
      if(world.obstacle){const o=world.obstacle;
        if(o.warning>0){c.fillStyle='#b8503a';c.font='bold 17px system-ui';c.textAlign='center';c.fillText('⚠ 地面扫杆将至 · 准备跳跃',480,205);c.setLineDash([10,8]);line(c,[[90,252],[90,482]],'#c66748',4);c.setLineDash([]);}
        else{line(c,[[o.x,252],[o.x,482]],'#674c37',15);line(c,[[o.x-2,252],[o.x-2,482]],'#ebc58a',7);for(let y=260;y<480;y+=30)line(c,[[o.x-6,y],[o.x+5,y+8]],'#8e5d3f',3);}
      }
      // Ground depth sort gives the floor real space while preserving readable silhouettes.
      // Nearby rear threats stay in the foreground so a tall character cannot conceal them.
      for(const e of world.enemies)if(e.y<p.y && Math.hypot(e.x-p.x,e.y-p.y)>180)enemy(c,e,world.time);
      fighter(c,world,gender);
      for(const e of world.enemies)if(e.y>=p.y || Math.hypot(e.x-p.x,e.y-p.y)<=180)enemy(c,e,world.time);
      for(const e of world.defeated){c.globalAlpha=Math.min(1,e.life*3);enemy(c,e,world.time,true);}c.globalAlpha=1;
      if(p.attack && attackPhase(p.attack)==='contact'){
        const s=ATTACKS[p.attack.kind],a=p.attack.direction*Math.PI/4;c.strokeStyle=p.attack.connected?'#fff8d5':'#f5dfaa88';c.lineWidth=p.attack.connected?7:3;c.beginPath();c.arc(p.x,p.y+50,s.reach*.8,a-.20,a+.20);c.stroke();
      }
      if(world.combo>=2){c.fillStyle='#416557';c.font='bold 18px system-ui';c.textAlign='right';c.fillText(`${world.combo} 连击 · 好身手！`,921,45);}
      if(world.state==='won'){c.fillStyle='#f8efcf88';c.fillRect(0,0,960,540);}
      c.restore();const jumpPhase=world.player.jump<.12?'takeoff':world.player.jump<.68?'airborne':world.player.jump<.82?'landing':'grounded';
      if(this.canvas.dataset.jumpPhase!==jumpPhase)this.canvas.dataset.jumpPhase=jumpPhase;
    }
  }
  root.QiqianArt={Renderer,poseFor};
})(globalThis);
