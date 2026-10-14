(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NeonCampaign=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const SAVE_KEY='neon-break-campaign-v1';
const levels=[
{id:1,name:'啟動反射艦',goal:'清除全部寶石磚',hint:'接球位置決定反彈方向。用擋板兩端瞄準！',time:120,rows:3,cols:8},
{id:2,name:'補給航道',goal:'打通兩段補給航道',hint:'擊破 ↔ 補給磚，接住道具讓擋板加長。',time:150,rows:4,cols:8},
{id:3,name:'護罩測試',goal:'清場，學會使用緊急護盾',hint:'⚡ 磚額外補充能量。能量達 50 時按 E，護盾可救回一次掉球。',time:150,rows:4,cols:8,skill:true},
{id:4,name:'裂隙入口',goal:'沿左右通道擊破兩個核心',hint:'金屬障壁無法破壞。用斜角從兩側進入，瞄準 ◆ 核心。',time:180,core:true},
{id:5,name:'星核回收',goal:'擊破三個分散的核心',hint:'接住 ③ 三重球道具。只有所有球掉落才會扣命。',time:180,core:true},
{id:6,name:'守門者',goal:'拆除左右鎖扣，再攻擊中央核心',hint:'兩個鎖扣各需命中 2 次。全部拆除後，中央核心才會受到傷害。',time:240,boss:true,skill:true}
];
function makeBricks(id){const level=levels[id-1],result=[];const add=(x,y,type='gem',hp=1,color=0,drop=null)=>result.push({x,y,w:66,h:20,type,hp,maxHp:hp,color,drop,alive:true});
if(id<=3){for(let r=0;r<level.rows;r++)for(let c=0;c<level.cols;c++){let type='gem',drop=null;if(id===2&&r===2&&(c===1||c===6)){type='supply';drop='wide';}if(id===3&&r===1&&c%2===0)type='energy';add(83+c*72,65+r*36+(id===2&&c>=4?28:0),type,1,r,drop);}}
else if(id===4){[170,564].forEach(x=>add(x,65,'core',4,3));for(let c=0;c<4;c++)add(260+c*72,155,'wall',Infinity,4);for(let c=0;c<8;c++)add(83+c*72,220,'gem',1,c%6);add(83,256,'supply',1,3,'slow');add(587,256,'supply',1,3,'floor');}
else if(id===5){[120,367,614].forEach(x=>add(x,65,'core',4,5));for(let r=0;r<3;r++)for(let c=0;c<8;c++)add(83+c*72,125+r*36,r===2&&c===3?'supply':'gem',1,r+2,r===2&&c===3?'multi':null);}
else{add(238,97,'lock',2,0);result.at(-1).w=58;result.at(-1).h=52;add(504,97,'lock',2,0);result.at(-1).w=58;result.at(-1).h=52;add(357,88,'boss-core',8,3);result.at(-1).w=86;result.at(-1).h=86;for(let c=0;c<8;c++)add(83+c*72,225,c===1||c===6?'supply':'energy',1,4,c===1?'floor':c===6?'slow':null);}
return result;}
function freshSave(){return{version:1,records:{},settings:{volume:.35,music:true,assist:false,reduced:false},skillUnlocked:false,research:0};}
function cleanSave(raw){const save=freshSave();if(!raw||raw.version!==1)return save;for(let id=1;id<=6;id++){const r=raw.records?.[id];if(r&&Number.isInteger(r.stars)&&r.stars>=1&&r.stars<=3&&Number.isFinite(r.score)&&r.score>=0)save.records[id]={stars:r.stars,score:Math.min(1e8,Math.floor(r.score)),time:Number.isFinite(r.time)&&r.time>=0?r.time:0};}
let gap=false;for(let id=1;id<=6;id++){if(!save.records[id])gap=true;if(gap)delete save.records[id];}const s=raw.settings||{};if(Number.isFinite(s.volume))save.settings.volume=Math.max(0,Math.min(1,s.volume));for(const k of ['music','assist','reduced'])if(typeof s[k]==='boolean')save.settings[k]=s[k];save.skillUnlocked=Boolean(save.records[3]);save.research=Object.values(save.records).reduce((n,r)=>n+2+(r.stars>=2?1:0)+(r.stars>=3?1:0),0);return save;}
function unlocked(save,id){return id===1||Boolean(save.records[id-1]);}
function nextLevel(save){for(let id=1;id<=6;id++)if(!save.records[id])return id;return 6;}
function award(save,id,score,time,losses){const stars=losses===0&&time<=levels[id-1].time?3:losses<=1?2:1,old=save.records[id],oldStars=old?.stars||0;const points=(old?0:2)+(oldStars<2&&stars>=2?1:0)+(oldStars<3&&stars>=3?1:0);save.records[id]={stars:Math.max(oldStars,stars),score:Math.max(old?.score||0,score),time:old?Math.min(old.time,time):time};save.research+=points;if(id===3)save.skillUnlocked=true;return{stars,points,newRecord:!old||score>old.score};}
function reflect(ball,b){const nx=Math.max(b.x,Math.min(ball.x,b.x+b.w)),ny=Math.max(b.y,Math.min(ball.y,b.y+b.h));if((ball.x-nx)**2+(ball.y-ny)**2>ball.r**2)return false;const l=ball.x+ball.r-b.x,r=b.x+b.w-ball.x+ball.r,t=ball.y+ball.r-b.y,bt=b.y+b.h-ball.y+ball.r,m=Math.min(l,r,t,bt);if(m===l){ball.x=b.x-ball.r-.1;ball.vx=-Math.abs(ball.vx);}else if(m===r){ball.x=b.x+b.w+ball.r+.1;ball.vx=Math.abs(ball.vx);}else if(m===t){ball.y=b.y-ball.r-.1;ball.vy=-Math.abs(ball.vy);}else{ball.y=b.y+b.h+ball.r+.1;ball.vy=Math.abs(ball.vy);}return true;}
return{SAVE_KEY,levels,makeBricks,freshSave,cleanSave,unlocked,nextLevel,award,reflect};
});
