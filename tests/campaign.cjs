const assert=require('node:assert/strict'),C=require('../campaign.js');
const save=C.freshSave();
assert.equal(C.nextLevel(save),1);assert.equal(C.unlocked(save,2),false);
for(let id=1;id<=6;id++){
  const bricks=C.makeBricks(id);assert(bricks.length>0);
  for(const b of bricks){assert(b.x>=0&&b.x+b.w<=800&&b.y>=0&&b.y+b.h<500);assert(b.hp>0);}
  const result=C.award(save,id,1000,60,0);assert.equal(result.stars,3);assert.equal(result.points,4);
  assert.equal(C.award(save,id,500,80,1).points,0);
}
assert.equal(save.research,24);assert.equal(save.skillUnlocked,true);
assert.deepEqual(C.cleanSave(JSON.parse(JSON.stringify(save))),save);
assert.deepEqual(C.cleanSave({version:999}),C.freshSave());
assert.equal(Object.keys(C.cleanSave({version:1,records:{2:{stars:3,score:1,time:1}}}).records).length,0);
assert.equal(C.cleanSave({version:1,settings:{volume:99}}).settings.volume,1);
const partial=C.freshSave();assert.equal(C.award(partial,1,10,200,2).stars,1);
assert.equal(C.award(partial,1,20,150,0).points,1);assert.equal(C.award(partial,1,30,60,0).points,1);assert.equal(partial.research,4);
const brick={x:100,y:100,w:66,h:20},ball={x:110,y:94,r:8,vx:20,vy:50};
assert(C.reflect(ball,brick));assert(ball.vy<0);assert(ball.y<92);
assert.equal(C.reflect({x:0,y:0,r:8,vx:1,vy:1},brick),false);
console.log('PASS: six level layouts, mission objects, unlocks, stars, reward deduplication, save validation and collision reflection.');
