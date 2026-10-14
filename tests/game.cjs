const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),C=require('../campaign.js');
const root=path.resolve(__dirname,'..'),elements={},listeners={};let failImages=false,storageBlocked=false;
function element(id){return elements[id]??={id,hidden:['map','play','result'].includes(id),disabled:false,textContent:'',innerHTML:'',value:0,checked:false,open:false,children:[],classList:{toggle(){}},append(e){this.children.push(e);},replaceChildren(){this.children=[];},setAttribute(){},addEventListener(){},focus(){},showModal(){this.open=true;},getContext:()=>drawing,getBoundingClientRect:()=>({left:0,width:800}),setPointerCapture(){}};}
const drawing=new Proxy({},{get:(obj,key)=>obj[key]??(()=>{}),set:(obj,key,value)=>(obj[key]=value,true)});
class Image{set src(src){assert(fs.existsSync(path.join(root,src)),src);queueMicrotask(()=>failImages?this.onerror():this.onload());}}
const local={};const sandbox={NeonCampaign:C,Image,HTMLInputElement:class{},HTMLButtonElement:class{},localStorage:{getItem:k=>local[k]||null,setItem:(k,v)=>{if(storageBlocked)throw new Error('blocked');local[k]=v;}},document:{getElementById:element,createElement:()=>element('card'+Math.random()),addEventListener:(k,fn)=>listeners[k]=fn,hidden:false},requestAnimationFrame(){},console};
sandbox.window=sandbox;sandbox.addEventListener=(k,fn)=>listeners[k]=fn;sandbox.confirm=()=>true;
vm.createContext(sandbox);
let source=fs.readFileSync(path.join(root,'game.js'),'utf8');
// Expose internals only in this test's instrumented copy, never in production.
source=source.replace('loadArt();requestAnimationFrame(frame);','globalThis.test={start,launch,step,hit,collect,skill,pause,draw,map,home,loadArt,finish,save,get:()=>({state,balls,bricks,lives,energy,shield,score,elapsed,effects,floorCharges,paddle}),set:(key,value)=>{if(key==="balls")balls=value;if(key==="energy")energy=value;}};loadArt();requestAnimationFrame(frame);');
vm.runInContext(source,sandbox);const T=sandbox.test;
(async()=>{
 await new Promise(setImmediate);assert.equal(T.get().state,'home');T.map();assert.equal(elements.levelGrid.children.length,6);
 for(let id=1;id<=6;id++){
   T.start(id);assert.equal(T.get().state,'ready');assert.equal(T.get().lives,3);T.launch();T.draw();
   if(id===1){
     T.collect('multi');assert.equal(T.get().balls.length,3);
     T.set('balls',T.get().balls.slice(0,1));T.step(1/240);assert.equal(T.get().lives,3);
     T.collect('wide');T.collect('slow');T.collect('floor');assert(T.get().paddle.w>120);
     const time=T.get().elapsed,effect=T.get().effects.slow;T.pause();T.step(1);assert.equal(T.get().elapsed,time);assert.equal(T.get().effects.slow,effect);T.pause();
   }
   if(id===3){T.set('energy',50);T.skill();assert.equal(T.get().shield,3);assert.equal(T.get().energy,0);T.get().balls[0].y=545;T.get().balls[0].vy=200;T.step(.05);assert.equal(T.get().lives,3);assert.equal(T.get().shield,0);}
   if(id===6){const core=T.get().bricks.find(b=>b.type==='boss-core');T.hit(core);assert.equal(core.hp,8);for(const b of T.get().bricks.filter(b=>b.type==='lock')){T.hit(b);T.hit(b);}T.hit(core);assert.equal(core.hp,7);}
   for(const b of T.get().bricks.filter(b=>b.alive&&b.type!=='wall'))while(b.alive)T.hit(b);
   T.step(1/240);assert.equal(T.get().state,'result');assert(T.save.records[id]);
 }
 assert.equal(T.save.research,24);assert.equal(T.save.skillUnlocked,true);
 // Drive the real physics with an automated paddle, without destroying bricks.
 for(let id=1;id<=6;id++){
   T.start(id);T.launch();
   for(let tick=0;tick<240*600&&T.get().state!=='result';tick++){
     const g=T.get();
     if(g.state==='ready'){T.launch();continue;}
     const ball=g.balls.find(b=>b.vy>0)||g.balls[0];
     if(ball&&ball.vy>0){
       const travel=Math.max(0,(g.paddle.y-ball.r-ball.y)/ball.vy);
       let x=ball.x+ball.vx*travel-ball.r,span=800-2*ball.r;
       x=((x%(2*span))+2*span)%(2*span);x=(x>span?2*span-x:x)+ball.r;
       let candidates=g.bricks.filter(b=>b.alive&&b.type!=='wall');
       if(id===6&&candidates.some(b=>b.type==='lock'))candidates=candidates.filter(b=>b.type==='lock');
       else if(id===4||id===5||id===6)candidates=candidates.filter(b=>b.type==='core'||b.type==='boss-core');
       const target=candidates[Math.floor(tick/2400)%candidates.length];
       const angle=target?Math.max(-Math.PI/3,Math.min(Math.PI/3,Math.atan2(target.x+target.w/2-x,g.paddle.y-target.y))):0;
       const center=x-angle/(Math.PI/3)*g.paddle.w/2;
       g.paddle.x=Math.max(0,Math.min(800-g.paddle.w,center-g.paddle.w/2));
     }
     T.step(1/240);
   }
   assert.equal(T.get().state,'result','physics playthrough timeout: level '+id);
   assert.match(elements.resultTitle.textContent,/任務完成|已解放/,'physics playthrough failed: level '+id);
   console.log('Physics playthrough level '+id+': '+Math.round(T.get().elapsed)+' seconds, '+T.get().lives+' lives.');
 }
 T.start(1);T.launch();T.set('balls',[]);T.step(1/240);assert.equal(T.get().lives,2);assert.equal(T.get().state,'ready');
 for(let i=0;i<2;i++){T.launch();T.set('balls',[]);T.step(1/240);}assert.equal(T.get().state,'result');assert.match(elements.resultTitle.textContent,/失去/);
 storageBlocked=true;T.start(1);T.finish(true);assert.match(elements.saveNotice.textContent,/無法儲存/);
 failImages=true;await T.loadArt();assert.equal(elements.continueButton.disabled,false);assert.match(elements.continueButton.textContent,/重新載入/);
 failImages=false;await T.loadArt();assert.equal(T.get().state,'home');
 console.log('PASS: all six mission transitions, boss lock gate, four powerups, shield interception, pause timers, life loss, results, storage errors and image retry.');
})().catch(e=>{console.error(e);process.exitCode=1;});
