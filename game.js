(() => {
  'use strict';
  const C=window.NeonCampaign, $=id=>document.getElementById(id);
  const canvas=$('game'),ctx=canvas.getContext('2d'),W=800,H=560;
  const names=['brick-pink','brick-orange','brick-yellow','brick-cyan','brick-blue','brick-purple','paddle','ball','spark','arena','guardian'];
  const art={},keys=new Set(),powerNames={wide:'↔ 加長擋板',multi:'③ 三重球',slow:'◷ 緩速',floor:'▰ 底部護罩'};
  let save=C.freshSave(),loaded=false,state='loading',levelId=1,bricks=[],balls=[],drops=[],particles=[];
  let score=0,lives=3,losses=0,elapsed=0,energy=0,shield=0,floorCharges=0,combo=0,lastHit=-99,noticeTime=0;
  let effects={wide:0,slow:0},paddle={x:340,y:520,w:120,h:12},last=0,accumulator=0,hudClock=0,rngState=1,assistUsed=false;
  let audio=null,musicClock=0,musicStep=0;
  try{const raw=localStorage.getItem(C.SAVE_KEY);if(raw)save=C.cleanSave(JSON.parse(raw));}
  catch{ $('saveNotice').textContent='存檔無法讀取，已使用新的進度。此瀏覽器可能限制儲存功能。';}
  function persist(){try{localStorage.setItem(C.SAVE_KEY,JSON.stringify(save));}catch{$('saveNotice').textContent='瀏覽器無法儲存進度；目前仍可遊玩，關閉後可能遺失紀錄。';}}
  function audioStart(){try{const Audio=window.AudioContext||window.webkitAudioContext;if(Audio){audio??=new Audio();audio.resume()?.catch(()=>{});}}catch{}}
  function tone(freq=440,duration=.08,volume=.15,type='sine'){
    if(!audio||audio.state!=='running'||!save.settings.volume)return;
    const now=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,now);g.gain.setValueAtTime(volume*save.settings.volume,now);
    g.gain.exponentialRampToValueAtTime(.001,now+duration);o.connect(g);g.connect(audio.destination);o.start(now);o.stop(now+duration);
    o.onended=()=>{o.disconnect();g.disconnect();};
  }
  function rng(){rngState=(Math.imul(rngState,1664525)+1013904223)>>>0;return rngState/4294967296;}
  function say(text){$('notice').textContent=text;noticeTime=5;}
  function showScreen(id){for(const name of ['home','map','play','result'])$(name).hidden=name!==id;keys.clear();}
  function home(){state='home';showScreen('home');const n=Object.keys(save.records).length;
    $('continueButton').textContent=n===6?'重戰守門者 →':n?'繼續冒險 →':'開始冒險 →';
    $('homeProgress').textContent=n===6?'前哨基地已解放。重玩關卡，挑戰三星與個人紀錄。':'已完成 '+n+' / 6 關 · 首次獎勵研究點 '+save.research;
  }
  function map(){state='map';showScreen('map');$('levelGrid').replaceChildren();
    C.levels.forEach(level=>{
      const record=save.records[level.id],open=C.unlocked(save,level.id),button=document.createElement('button');
      button.className='level-card'+(level.boss?' boss':'');button.disabled=!open;
      button.innerHTML='<span class="number">'+(level.boss?'BOSS / ':'MISSION / ')+String(level.id).padStart(2,'0')+'</span><strong>'+level.name+'</strong><p>'+level.goal+'</p><span class="rating">'+(record?'★'.repeat(record.stars)+'☆'.repeat(3-record.stars):open?'開始挑戰 →':'完成上一關解鎖')+'</span>';
      button.setAttribute('aria-label','第 '+level.id+' 關 '+level.name+(open?'':'，未解鎖'));
      button.onclick=()=>start(level.id);$('levelGrid').append(button);
    });
    $('mapProgress').textContent='星等 '+Object.values(save.records).reduce((n,r)=>n+r.stars,0)+' / 18 · 首次星等獎勵研究點 '+save.research;
  }
  function leave(destination){if(['playing','paused','ready'].includes(state)&&bricks.some(b=>b.hp<b.maxHp)&&!window.confirm('離開會重置本關進度，已通關的紀錄會保留。確定離開？'))return;destination();}
  function clampPaddle(){paddle.x=Math.max(0,Math.min(W-paddle.w,paddle.x));}
  function setWidth(){const center=paddle.x+paddle.w/2;paddle.w=120*(effects.wide>0?1.35:1)*(save.settings.assist?1.15:1);paddle.x=center-paddle.w/2;clampPaddle();}
  function dock(){balls=[{x:paddle.x+paddle.w/2,y:paddle.y-10,r:8,vx:0,vy:0}];}
  function overlay(title,text,action,paused=false){
    $('gameOverlay').hidden=false;$('gameOverlay').classList.toggle('ready',!paused);
    $('overlayTitle').textContent=title;$('overlayText').textContent=text;$('overlayAction').textContent=action;
    $('retryButton').hidden=!paused;$('leaveButton').hidden=!paused;
  }
  function start(id){
    if(!loaded||!C.unlocked(save,id))return;audioStart();levelId=id;state='ready';showScreen('play');
    bricks=C.makeBricks(id);score=0;lives=3;losses=0;elapsed=0;combo=0;lastHit=-99;energy=id===3?50:0;
    effects={wide:0,slow:0};shield=0;floorCharges=0;drops=[];particles=[];assistUsed=save.settings.assist;
    rngState=id*1234567;musicClock=0;musicStep=0;paddle={x:340,y:520,w:120,h:12};setWidth();dock();
    $('pauseButton').textContent='暫停 · P';$('levelLabel').textContent='第一章 · 第 '+id+' / 6 關';$('levelName').textContent=C.levels[id-1].name;
    $('objective').textContent=C.levels[id-1].goal;overlay('第 '+id+' 關',C.levels[id-1].hint,'開始發球 →');
    say('拖曳或移動擋板選擇位置，按空白鍵或發球按鈕開始。');hud();draw();
  }
  function launch(){
    if(state!=='ready')return;audioStart();state='playing';$('gameOverlay').hidden=true;
    const ball=balls[0],intent=((paddle.x+paddle.w/2)/W-.5)*1.5,angle=Math.abs(intent)<.12?.12:intent,speed=330+(levelId-1)*16;
    ball.vx=Math.sin(angle)*speed;ball.vy=-Math.cos(angle)*speed;canvas.focus({preventScroll:true});tone(550,.1);
  }
  function pause(){
    if(state==='playing'){state='paused';keys.clear();overlay('暫停','進度、技能與道具倒數已暫停。','繼續遊戲 →',true);$('pauseButton').textContent='繼續 · P';}
    else if(state==='paused'){state='playing';$('gameOverlay').hidden=true;$('pauseButton').textContent='暫停 · P';audioStart();}
    else if(state==='ready'){state='paused-ready';keys.clear();overlay('關卡準備','可以重試本關或返回章節地圖。','返回準備',true);$('pauseButton').textContent='返回準備 · P';}
    else if(state==='paused-ready'){state='ready';overlay('準備發球',C.levels[levelId-1].hint,'發球 →');$('pauseButton').textContent='暫停 · P';}
  }
  function skillAvailable(){return levelId>=3&&(save.skillUnlocked||levelId===3);}
  function skill(){if(state!=='playing'||!skillAvailable()||energy<50||shield>0)return;energy-=50;shield=3;say('緊急護盾啟動：3 秒內救回一次掉球。');tone(740,.2);hud();}
  function target(b){return C.levels[levelId-1].boss?b.type==='boss-core':C.levels[levelId-1].core?b.type==='core':b.type!=='wall';}
  function completed(){return bricks.filter(target).every(b=>!b.alive);}
  function hud(){
    $('score').textContent=score;$('lives').textContent=lives;const targets=bricks.filter(target);
    $('progress').textContent=targets.filter(b=>!b.alive).length+' / '+targets.length;
    $('timer').textContent=Math.floor(elapsed/60)+':'+String(Math.floor(elapsed%60)).padStart(2,'0');
    $('energyText').textContent=Math.floor(energy)+' / 100';
    $('skillButton').disabled=state!=='playing'||!skillAvailable()||energy<50||shield>0;
    $('skillButton').title=skillAvailable()?'消耗 50 能量，救回一次掉球':'第 3 關教學後解鎖';
    $('launchButton').disabled=state!=='ready';
    const active=[];if(effects.wide>0)active.push('↔ 加長 '+Math.ceil(effects.wide)+'s');if(effects.slow>0)active.push('◷ 緩速 '+Math.ceil(effects.slow)+'s');if(balls.length>1)active.push('③ '+balls.length+' 球');if(floorCharges)active.push('▰ 護罩 ×'+floorCharges);if(shield>0)active.push('護盾 '+shield.toFixed(1)+'s');
    $('powerStatus').textContent=active.join(' · ');
  }
  function particlesAt(b){if(save.settings.reduced)return;for(let i=0;i<7;i++)particles.push({x:b.x+b.w/2,y:b.y+b.h/2,vx:(rng()-.5)*180,vy:(rng()-.5)*180,t:.4});}
  function spawnDrop(b){if(drops.length>=2)return;const types=['wide','multi','slow','floor'];if(b.drop||rng()<.12)drops.push({x:b.x+b.w/2,y:b.y+b.h/2,type:b.drop||types[Math.floor(rng()*types.length)]});}
  function collect(type){
    if(type==='wide'){effects.wide=15;setWidth();}
    if(type==='slow')effects.slow=10;
    if(type==='floor')floorCharges=Math.min(2,floorCharges+1);
    if(type==='multi'&&balls.length){const source=balls[0],speed=Math.hypot(source.vx,source.vy);for(const angle of [-.55,.55]){if(balls.length>=5)break;const a=Math.atan2(source.vy,source.vx)+angle;balls.push({...source,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed});}}
    say('取得 '+powerNames[type]);tone(880,.15);
  }
  function hit(b){
    if(b.type==='wall')return;
    if(b.type==='boss-core'&&bricks.some(x=>x.type==='lock'&&x.alive))return;
    b.hp--;energy=Math.min(100,energy+(b.type==='boss-core'?5:0));
    tone(280+b.color*70,.04,.12,'triangle');
    if(b.hp>0)return;
    b.alive=false;combo=elapsed-lastHit<=3?combo+1:1;lastHit=elapsed;
    const base=['core','boss-core'].includes(b.type)?100:b.type==='lock'?40:10;
    score+=Math.round(base*Math.min(3,1+Math.floor(combo/5)*.5));energy=Math.min(100,energy+4+(b.type==='energy'?10:0));
    particlesAt(b);spawnDrop(b);
    if(b.type==='lock'&&!bricks.some(x=>x.type==='lock'&&x.alive)){say('鎖扣已解除！中央核心暴露，命中 8 次即可擊破。');tone(1000,.25);}
  }
  function loseLife(){
    lives--;losses++;effects={wide:0,slow:0};shield=0;floorCharges=0;combo=0;drops=[];setWidth();
    tone(130,.22,.2,'triangle');
    if(lives===0){finish(false);return;}
    state='ready';dock();overlay('球掉出場外','已破壞的目標保留，還有 '+lives+' 次生命。選好位置再發球。','重新發球 →');say('接球太晚或球離開擋板範圍。用擋板兩端調整下一次球路。');hud();
  }
  function finish(win){
    state='result';showScreen('result');keys.clear();
    if(win)score+=lives*100+(levelId===6?500:0);
    const result=win?C.award(save,levelId,score,elapsed,losses):null;if(win)persist();
    $('resultLabel').textContent='第一章 · '+C.levels[levelId-1].name;
    $('resultTitle').textContent=win?(levelId===6?'前哨基地已解放！':'任務完成'):'反射艦失去訊號';
    $('resultStars').textContent=win?'★'.repeat(result.stars)+'☆'.repeat(3-result.stars):'再試一次';
    $('resultText').textContent=win?(levelId===6?'守門者核心崩解，星核重新啟動。第一章冒險完成！':result.newRecord?'寫下新的個人紀錄。下一段航道已解鎖！':'下一段航道已解鎖，繼續奪回星核。'):'所有球掉出場外，生命已用完。重試會恢復 3 次生命。';
    $('resultStats').innerHTML='<div><strong>'+score+'</strong><span>分數</span></div><div><strong>'+Math.floor(elapsed)+'s</strong><span>遊玩時間</span></div><div><strong>'+losses+'</strong><span>掉命次數</span></div>';
    $('rewardText').textContent=(win?'首次星等獎勵 +'+result.points+' 研究點 · 累計 '+save.research+' · 三星時間目標 '+C.levels[levelId-1].time+' 秒':'提示：接道具前先判斷球是否即將落下。')+(assistUsed?' · 使用接球輔助':'')+(win&&levelId===3?' · 緊急護盾已永久解鎖':'');
    $('nextButton').hidden=!win;$('nextButton').textContent=levelId===6?'返回章節地圖':'下一關 →';
    tone(win?1046:180,.3,.18);
  }
  function step(dt){
    if(state==='ready'){const dir=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0);paddle.x+=dir*560*dt;clampPaddle();dock();return;}
    if(state!=='playing')return;
    elapsed+=dt;if(noticeTime>0){noticeTime-=dt;if(noticeTime<=0)$('notice').textContent='';}
    shield=Math.max(0,shield-dt);
    const wasWide=effects.wide>0;effects.wide=Math.max(0,effects.wide-dt);effects.slow=Math.max(0,effects.slow-dt);if(wasWide&&effects.wide===0)setWidth();
    const dir=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0);paddle.x+=dir*560*dt;clampPaddle();
    const scale=effects.slow>=1?.75:1-.25*effects.slow;
    for(const ball of balls){
      ball.x+=ball.vx*dt*scale;ball.y+=ball.vy*dt*scale;
      if(ball.x<ball.r){ball.x=ball.r;ball.vx=Math.abs(ball.vx);}if(ball.x>W-ball.r){ball.x=W-ball.r;ball.vx=-Math.abs(ball.vx);}if(ball.y<ball.r){ball.y=ball.r;ball.vy=Math.abs(ball.vy);}
      if(ball.vy>0&&ball.y+ball.r>=paddle.y&&ball.y-ball.r<=paddle.y+paddle.h&&ball.x+ball.r>=paddle.x&&ball.x-ball.r<=paddle.x+paddle.w){
        const offset=Math.max(-1,Math.min(1,(ball.x-paddle.x-paddle.w/2)/(paddle.w/2))),speed=Math.hypot(ball.vx,ball.vy);
        ball.vx=Math.sin(offset*Math.PI/3)*speed;ball.vy=-Math.cos(offset*Math.PI/3)*speed;ball.y=paddle.y-ball.r-.1;tone(500+offset*100,.04,.07);
      }
      for(const b of bricks){if(b.alive&&C.reflect(ball,b)){hit(b);break;}}
      if(ball.vy>0&&ball.y+ball.r>=H-8&&(shield>0||floorCharges>0)){ball.y=H-8-ball.r;ball.vy=-Math.abs(ball.vy);if(shield>0)shield=0;else floorCharges--;say('護罩救回了一顆球！');tone(680,.1);}
    }
    balls=balls.filter(b=>b.y-b.r<=H);
    if(completed()){finish(true);return;}
    if(!balls.length){loseLife();return;}
    drops=drops.filter(drop=>{drop.y+=115*dt;if(drop.y+12>=paddle.y&&drop.y-12<=paddle.y+paddle.h&&drop.x+12>=paddle.x&&drop.x-12<=paddle.x+paddle.w){collect(drop.type);return false;}return drop.y< H+20;});
    particles=particles.filter(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.t-=dt;return p.t>0;});
    if(save.settings.music){musicClock+=dt;if(musicClock>=.45){musicClock-=.45;const notes=[130.81,164.81,196,261.63,196,164.81,146.83,196];tone(notes[musicStep++%notes.length],.22,.035,'triangle');}}
  }
  function label(text,x,y,color='#fff',size=13){ctx.font='bold '+size+'px system-ui';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(text,x,y);}
  function draw(){
    if(!loaded||$('play').hidden)return;ctx.clearRect(0,0,W,H);ctx.drawImage(art.arena,0,0,W,H);ctx.imageSmoothingEnabled=true;
    if(levelId===6){ctx.drawImage(art.guardian,220,65,360,130);const core=bricks.find(b=>b.type==='boss-core');label('守門者 · '+(bricks.some(b=>b.type==='lock'&&b.alive)?'先拆兩側鎖扣':'核心已暴露')+' · '+core.hp+' / 8',400,34,'#bdece9',16);}
    for(const b of bricks){
      if(!b.alive)continue;
      if(b.type==='lock'||b.type==='boss-core'){
        ctx.globalAlpha=b.type==='boss-core'&&bricks.some(x=>x.type==='lock'&&x.alive)?.3:1;
        ctx.drawImage(art[b.type==='lock'?'brick-pink':'ball'],b.x,b.y,b.w,b.h);ctx.globalAlpha=1;
        label(b.type==='lock'?'鎖扣 '+b.hp:'核心 '+b.hp,b.x+b.w/2,b.y+b.h+17,'#ffdca4',12);continue;
      }
      ctx.globalAlpha=b.type==='wall'?.5:1;
      ctx.drawImage(art[names[b.color%6]],b.x,b.y,b.w,b.h);ctx.globalAlpha=1;
      const symbol=b.type==='wall'?'▰':b.type==='core'?'◆ '+b.hp:b.type==='energy'?'⚡':b.type==='supply'?{wide:'↔',multi:'③',slow:'◷',floor:'▰'}[b.drop]:null;
      if(symbol){ctx.fillStyle='#061322cc';ctx.fillRect(b.x+18,b.y,30,b.h);label(symbol,b.x+b.w/2,b.y+15,'#fff',13);}
    }
    for(const drop of drops){ctx.drawImage(art['brick-cyan'],drop.x-20,drop.y-13,40,26);label({wide:'↔',multi:'③',slow:'◷',floor:'▰'}[drop.type],drop.x,drop.y+5,'#061827',18);}
    for(const p of particles){ctx.globalAlpha=p.t/.4;ctx.drawImage(art.spark,p.x-7,p.y-7,14,14);}ctx.globalAlpha=1;
    if(floorCharges||shield>0){ctx.strokeStyle=shield>0?'#ffdf8b':'#63f2d5';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(20,H-8);ctx.lineTo(W-20,H-8);ctx.stroke();}
    ctx.drawImage(art.paddle,paddle.x,paddle.y,paddle.w,paddle.h);
    for(const b of balls)ctx.drawImage(art.ball,b.x-b.r,b.y-b.r,b.r*2,b.r*2);
    if(state==='ready'){ctx.setLineDash([4,5]);ctx.strokeStyle='#ffffff70';ctx.lineWidth=1;const angle=((paddle.x+paddle.w/2)/W-.5)*1.5,b=balls[0];ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x+Math.sin(angle)*85,b.y-Math.cos(angle)*85);ctx.stroke();ctx.setLineDash([]);}
    if(combo>=5&&elapsed-lastHit<=3)label('COMBO '+combo+' · ×'+Math.min(3,1+Math.floor(combo/5)*.5),400,310,'#ffdf83',18);
  }
  function frame(time){
    const dt=last?Math.min((time-last)/1000,.05):0;last=time;accumulator+=dt;
    while(accumulator>=1/240){step(1/240);accumulator-=1/240;}
    hudClock+=dt;if(hudClock>=.1){hudClock=0;if(!$('play').hidden)hud();}
    draw();requestAnimationFrame(frame);
  }
  function move(e){if(!['playing','ready'].includes(state))return;const rect=canvas.getBoundingClientRect();paddle.x=(e.clientX-rect.left)*W/rect.width-paddle.w/2;clampPaddle();if(state==='ready')dock();}
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);move(e);});
  canvas.addEventListener('pointermove',move);
  window.addEventListener('keydown',e=>{
    if($('settingsDialog').open||e.target instanceof HTMLInputElement)return;
    if(['ArrowLeft','ArrowRight','Space'].includes(e.code)&&['playing','ready','paused'].includes(state))e.preventDefault();
    if(e.repeat&&['Space','KeyE','KeyP','Escape'].includes(e.code))return;
    if(e.code==='Space'){if(e.target instanceof HTMLButtonElement)return;launch();}
    else if(e.code==='KeyE')skill();else if(e.code==='KeyP'||e.code==='Escape')pause();else keys.add(e.code);
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));
  function backgroundPause(){keys.clear();if(state==='playing')pause();if(audio?.state==='running')audio.suspend()?.catch(()=>{});}
  window.addEventListener('blur',backgroundPause);document.addEventListener('visibilitychange',()=>{if(document.hidden)backgroundPause();});
  window.addEventListener('resize',()=>{if(state==='playing')pause();});
  $('continueButton').onclick=()=>loaded?start(C.nextLevel(save)):loadArt();
  $('mapButton').onclick=map;$('homeButton').onclick=home;
  $('brand').onclick=e=>{e.preventDefault();if(loaded)leave(home);};
  $('launchButton').onclick=launch;$('skillButton').onclick=skill;$('pauseButton').onclick=pause;
  $('overlayAction').onclick=()=>state==='ready'?launch():pause();
  $('retryButton').onclick=()=>start(levelId);$('leaveButton').onclick=()=>leave(map);
  $('resultRetry').onclick=()=>start(levelId);$('resultMap').onclick=map;
  $('nextButton').onclick=()=>levelId===6?map():start(levelId+1);
  $('settingsButton').onclick=()=>{if(state==='playing')pause();$('volumeInput').value=save.settings.volume*100;for(const k of ['music','assist','reduced'])$(k+'Input').checked=save.settings[k];$('settingsDialog').showModal();};
  $('volumeInput').oninput=e=>{save.settings.volume=Number(e.target.value)/100;persist();};
  for(const k of ['music','assist','reduced'])$(k+'Input').onchange=e=>{save.settings[k]=e.target.checked;if(k==='assist'){setWidth();assistUsed||=save.settings.assist;if(state==='ready')dock();}persist();};
  async function loadArt(){
    state='loading';$('continueButton').disabled=true;$('continueButton').textContent='素材載入中…';
    try{await Promise.all(names.map(async name=>{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error(name));img.src='assets/'+name+(name==='arena'?'.webp':'.png');});art[name]=img;}));loaded=true;$('continueButton').disabled=false;$('mapButton').disabled=false;home();}
    catch{$('continueButton').disabled=false;$('continueButton').textContent='重新載入素材';$('homeProgress').textContent='圖片無法載入，請確認網路連線後重試。';}
  }
  loadArt();requestAnimationFrame(frame);
})();
