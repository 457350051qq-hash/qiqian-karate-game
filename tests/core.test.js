const {test} = require('node:test');
const assert = require('node:assert/strict');
const {directionIndex, canHit} = require('../game.js');
test('all eight joystick/keyboard directions map clockwise', () => {
  [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]].forEach(([x,y],i)=>assert.equal(directionIndex(x,y),i));
});
test('only the aimed germ inside the timing ring can be hit', () => {
  for(let d=0;d<8;d++) {
    assert.equal(canHit({distance:100,direction:d},d),true);
    assert.equal(canHit({distance:100,direction:d},(d+1)%8),false);
    for(const distance of [0,58,63,153,350])assert.equal(canHit({distance,direction:d},d),false);
    for(const distance of [64,152])assert.equal(canHit({distance,direction:d},d),true);
  }
});

const {joystickVector, jumpPose, createShakeDetector, JUMP_DURATION, SHAKE_COOLDOWN_MS} = require('../game.js');
test('analog stick moves freely, clamps to its circle and respects a central dead zone', () => {
  assert.deepEqual(joystickVector(0,0,40),{x:0,y:0,direction:null});
  assert.equal(joystickVector(4,4,40).direction,null);
  const v=joystickVector(13,17,40);
  assert.equal(v.x,13); assert.equal(v.y,17); assert.equal(v.direction,1);
  const outside=joystickVector(-100,100,40);
  assert.ok(Math.abs(Math.hypot(outside.x,outside.y)-40)<1e-10);
  assert.equal(outside.direction,3);
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4;
    for(const offset of [-.38,.38]) assert.equal(directionIndex(Math.cos(a+offset),Math.sin(a+offset)),i);
  }
});
test('jump has anticipation, apex, landing and a finite grounded endpoint', () => {
  assert.equal(jumpPose(.06).phase,'takeoff'); assert.ok(jumpPose(.06).squash<1);
  assert.equal(jumpPose(.4).phase,'airborne'); assert.ok(jumpPose(.4).height>80);
  assert.equal(jumpPose(.74).phase,'landing'); assert.ok(jumpPose(.74).squash<1);
  assert.deepEqual(jumpPose(JUMP_DURATION),{height:0,squash:1,phase:'grounded'});
});
test('shake threshold and cooldown suppress noise and repeated sensor samples', () => {
  const d=createShakeDetector();
  assert.equal(d.sample(null,false,0,16),false);
  assert.equal(d.sample({x:null,y:0,z:0},false,0,16),false);
  assert.equal(d.sample({x:15,y:0,z:0},false,0,16),false);
  assert.equal(d.sample({x:16,y:0,z:0},false,1,16),true);
  assert.equal(d.sample({x:30,y:0,z:0},false,100,16),false);
  assert.equal(d.sample({x:16,y:0,z:0},false,1+SHAKE_COOLDOWN_MS,16),true);
  d.reset(); assert.equal(d.sample({x:16,y:0,z:0},false,0,16),true);
});
test('gravity-only sensors ignore stationary gravity and detect acceleration changes', () => {
  const d=createShakeDetector();
  assert.equal(d.sample({x:0,y:0,z:9.8},true,0,16),false);
  assert.equal(d.sample({x:0,y:0,z:9.8},true,100,16),false);
  assert.equal(d.sample({x:20,y:0,z:9.8},true,200,16),true);
});
