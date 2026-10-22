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
