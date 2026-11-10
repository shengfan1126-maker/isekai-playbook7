/* isekai-playbook7｜game.js：規則與狀態，不碰網頁元素（sim.js 可以在 node 裡跑）。依賴 data.js。
   第一章：求生（食物、火、水、避難所四項打勾）。第二章：據點（升級被襲擊、365 天魔王）。
   判定比照魔物篇：淨優勢 → 要付幾項代價；付夠成功、再多一項大成功；捨身＝拿傷殘換大成功。 */
const gIdx=g=>Math.max(0,GRADES.indexOf(g||"F"));
const EXIST_MAX=lv=>20*2**gIdx(lv);
const BP_FLOOR=[1,16,31,46,61,76,91], BP_W=[14,14,14,14,14,14,8];
const HP_BASE=lv=>20+8*gIdx(lv);
const MP_MAX=6, DAYS=365, WAKE=6;
const SKILL_PER_DAY=3, SKILL_SLOTS=9;
const STORE_MAX={F:20,E:25,D:30,C:35,B:40,A:50,S:50};
const NEST_COST=[{},{木材:12,石片:10,魔核:2},{木材:22,石片:22,獸皮:8,魔核:4},{木材:36,石片:36,獸皮:16,魔核:8},
  {木材:54,石片:54,獸皮:26,魔核:14},{木材:76,石片:76,獸皮:40,魔核:22},{木材:104,石片:104,獸皮:58,魔核:34}];
const SELL={木材:1,石片:1,草:1,獸皮:2,骨頭:1,生肉:1,熟肉:2,野果:1,魔核:5};
const BUY={木材:3,石片:3,草:2,獸皮:6,骨頭:4,熟肉:5,魔核:16,鐵劍:24,草藥膏:12};
const HOURS={gather:2,explore:3,hunt:1,fight:1,retreat:1,craft:2,combo:1,shelter:2,rest:2,move:1,fuse:4,raid:0,boss:0};
const ACT_NAME={gather:"採集",explore:"探索",hunt:"狩獵",fight:"戰鬥",retreat:"撤退",craft:"製作",combo:"組合",shelter:"占用岩穴",rest:"休息",move:"移動",sleep:"睡覺",fuse:"整合",raid:"迎擊",boss:"魔王戰"};
const ACT_CAT={gather:"生存",explore:"機動",fight:"戰鬥",craft:"製作",retreat:"機動",shelter:"生存"};
const ITEM_E={木材:["生長"],石片:["切割","硬化"],草:["生長"],獸皮:["包覆"],骨頭:["硬化"],生肉:["生長"],熟肉:["熱"],野果:["生長"],魔核:["魔力"],
  石刀:["切割"],石斧:["切割","重量"],石矛:["切割"],鐵劍:["切割","硬化"],皮甲:["包覆","硬化"],水袋:["水","包覆"],背包:["包覆"],草藥膏:["生長"]};
const FUSED_NAME={魔法:"雜糅魔法",戰鬥:"亂戰技",生存:"荒野生活術",機動:"野獸直覺",製作:"巧手",社交:"話術",天生:"偷學心得"};
const SCARS=["左手","右手","左腿","右腿","左眼","肋骨"];
const BOSS="魔王（BP 99）";

let S=null;
let rand=Math.random;
const rint=(a,b)=>a+Math.floor(rand()*(b-a+1));
const pick=a=>a[Math.floor(rand()*a.length)];
const shuffle=a=>{const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b};
const uniq=a=>[...new Set(a)];
const count=(o,k,n)=>{o[k]=(o[k]||0)+(n==null?1:n)};
const log=(t,type)=>{S.log.push({day:S.day,hour:S.hour,t,type:type||""});if(S.log.length>400)S.log.shift()};
const pg=()=>gIdx(S.lv);
const bpOf=()=>{const i=pg();return Math.round(BP_FLOOR[i]+BP_W[i]*S.exist/EXIST_MAX(S.lv))};
const hpMax=()=>Math.max(5,HP_BASE(S.lv)-2*S.scars.length);
const placeOf=n=>PLACES.find(p=>p.n===(n||S.at));
const allSkills=()=>S.skills.concat(S.store);
const owned=n=>allSkills().some(s=>s.n===n);
const skillBy=n=>S.skills.find(s=>s.n===n);
const usesLeft=s=>SKILL_PER_DAY-s.today;
const matCount=()=>MATS.reduce((a,m)=>a+(S.mats[m]||0),0);
const foodCount=()=>FOODS.reduce((a,m)=>a+(S.mats[m]||0),0);
const addMat=(m,n)=>{if(n>0)S.mats[m]=(S.mats[m]||0)+n};
const hasItem=k=>S.items.some(i=>i.k===k);
const hpUnit=key=>Math.max(1,Math.ceil(hpMax()/4*(key?1.5:1))-(hasItem("armor")?1:0));
const nestIdx=()=>S.nest==null?-1:gIdx(S.nest);

/* ───── 開局 ───── */
function newGame(){
  const sk=shuffle(START_POOL).slice(0,3).map(s=>mkSkill(s,"F"));
  S={ver:VER,ch:1,day:1,hour:WAKE,lv:"F",exist:0,hp:0,mp:MP_MAX,gold:0,
    skills:sk,store:[],items:[],mats:{},at:"林邊空地",places:["林邊空地"],
    needs:{食物:false,火:false,水:false,避難所:false},fire:false,shelterAt:null,
    tags:{飢餓:false,會冷:false,疾病:0},scars:[],thirst:0,drank:false,
    seen:[],frags:[],enc:null,pending:null,over:null,nest:null,base:null,log:[],
    stats:{actions:{},skillUse:{},combos:{try:0,learn:0,frag:0},enc:0,ch1Day:null,nestDay:{},lvDay:{},raids:[],ooc:{add:0,remove:0,edit:0}}};
  S.hp=hpMax();
  log(OPENING,"letter");
  log(`你的技能：${sk.map(s=>`【${s.n}】${s.d}`).join(" ")}`);
  return S;
}
/* 開局換技能：第 1 天還沒做任何事之前，可以一直換 */
function canReroll(){return S.day===1&&!Object.keys(S.stats.actions).length&&!S.frags.length&&!S.seen.length}
function rerollStart(i){
  if(!canReroll()||!S.skills[i])return;
  const pool=START_POOL.filter(t=>!S.skills.some(s=>s.n===t.n));
  S.skills[i]=mkSkill(pick(pool),"F");
  const l=S.log.find(x=>x.t.startsWith("你的技能："));
  if(l)l.t=`你的技能：${S.skills.map(s=>`【${s.n}】${s.d}`).join(" ")}`;
}
function mkSkill(t,lv){return {n:t.n,e:t.e.slice(),c:t.c.slice(),lv:lv||"F",used:0,today:0,d:t.d||""}}
function learnSkill(t,lv){
  if(owned(t.n))return "已經會了";
  const s=mkSkill(t,lv);
  if(S.skills.length<SKILL_SLOTS){S.skills.push(s);return "技能表"}
  if(S.store.length<STORE_MAX[S.lv]){S.store.push(s);return "倉庫"}
  return "滿了";
}
function lvUp(s){const cap=Math.min(6,pg()+1);const i=gIdx(s.lv);if(i<cap){s.lv=GRADES[i+1];return true}return false}
function useSkill(s,out){
  s.today++;s.used++;count(S.stats.skillUse,s.n);
  if(s.used%10===0&&lvUp(s)){const m=`【${s.n}】用了 ${s.used} 次，進化成 ${s.lv}。`;out.lines.push(m);log(m,"good")}
}

/* ───── 求生 ───── */
function tick(need,why,out){
  if(S.needs[need])return;
  S.needs[need]=true;if(need==="避難所")S.shelterAt=S.at;if(need==="火")S.fire=true;
  const m=`✔ ${need}：${why}`;out&&out.lines.push(m);log(m,"good");
  checkChapter();
}
function checkChapter(){
  if(S.ch===1&&NEEDS.every(k=>S.needs[k])&&!S.pending&&!S.ch1Offered){
    S.ch1Offered=true;S.stats.ch1Day=S.day;S.pending={type:"ch2"};log("食物、火、水、避難所都打勾了。第一章完成。","good");
  }
}
/* 一個成功的效果（本質＋形態）能滿足哪些需求 */
function applyEffect(eff,out){
  if(!eff)return;
  const has=x=>eff.e.includes(x);
  if(eff.g)tick(eff.g,`「${eff.n}」`,out);
  if(has("火")||eff.f==="點火")tick("火","你弄出了火",out);
  if(has("水"))tick("水","你有了水",out),S.drank=true;
  if(eff.f==="領域"&&has("土"))tick("避難所",`用「${eff.n||"這一招"}」把土堆成能擋風雨的牆`,out);
}

/* ───── 遭遇 ───── */
function rollEnemy(){
  const r=rand(),d=r<.2?-1:r<.55?0:r<.8?1:r<.93?2:3;
  let i=Math.max(0,Math.min(6,pg()+d));
  while(!MONSTERS[GRADES[i]])i--;
  const m=pick(MONSTERS[GRADES[i]]);
  return {n:m.n,lv:GRADES[i],t:m.t};
}
function startEncounter(out){
  const en=rollEnemy();S.enc=en;S.stats.enc++;
  const msg=`遭遇：${en.n}（${en.lv} 級）。`;out.lines.push(msg);log(msg,"bad");
  if(!S.seen.some(x=>x.n===en.t.n)){
    S.seen.push({n:en.t.n,e:en.t.e.slice(),part:en.t.part,from:en.n,lv:en.lv,used:false});
    const s=`你看見牠使出「${en.t.n}」。（記下來了，可以拿來組合偷學）`;out.lines.push(s);log(s);
  }
}

/* ───── 判定 ───── */
/* intent：{act, skills:[名], obj:{t:'place'|'item'|'seen'|'enemy'|'none', n}, move, goal, craft, adv:[], dis:[], weapon} */
function planOf(it){
  it=it||{};
  const act=it.act,q={act,it,notes:[],key:false,boss:false,eIdx:pg(),base:0,mand:{mp:0},err:null};
  const sks=(it.skills||[]).map(skillBy).filter(Boolean);
  q.sks=sks;
  if(act==="combo"){
    if(!sks.length)q.err="組合至少要選 1 個技能";
    if(sks.length>3)q.err="一次最多 3 個技能";
    if(sks.some(s=>usesLeft(s)<1))q.err="有技能今天用完了";
    q.mand.mp=sks.length;if(S.mp<q.mand.mp)q.err=`MP 不夠（組合要 ${sks.length}）`;
    if(!MOVES.some(m=>m.n===it.move))q.err=q.err||"要選一個手法";
  }
  if(act==="craft"){const r=RECIPES.find(x=>x.n===it.craft);q.recipe=r;
    if(!r)q.err="沒有這個配方";else if(!Object.entries(r.need).every(([m,n])=>(S.mats[m]||0)>=n))q.err="材料不夠";
    q.base=r&&r.hard?0:1;}
  if(act==="gather"||act==="explore")q.base=1;
  if(act==="retreat")q.base=1;
  if(act==="shelter"){if(!placeOf().cave)q.err="這裡沒有能占用的岩穴";q.base=0}
  if(["fight","retreat"].includes(act)&&!S.enc)q.err="現在沒有遭遇";
  if(S.enc&&["fight","retreat","combo"].includes(act)){q.eIdx=gIdx(S.enc.lv);if(S.enc.raid)q.key=true}
  if(act==="raid"){q.key=true;q.eIdx=gIdx(S.pending.lv)}
  if(act==="boss"){q.key=true;q.boss=true;q.eIdx=7}
  let net=q.base;if(q.base)q.notes.push(act==="craft"?"會做的東西 +1":"日常 +1");
  const diff=Math.max(0,q.eIdx-pg());if(diff){net-=diff;q.notes.push("階層差 −"+diff)}
  if(!["combo","hunt","move","rest"].includes(act)&&sks[0]){const s=sks[0];
    if(usesLeft(s)<1||S.mp<1)q.notes.push(`【${s.n}】今天用完或 MP 不足，無效`);
    else{q.useSkill=s;q.mand.mp=1;
      if(gIdx(s.lv)>=Math.min(q.eIdx,pg()+1)){net+=1;q.notes.push(`【${s.n}】+1`)}else q.notes.push(`【${s.n}】階層不夠`);
      if(ACT_CAT[act]&&s.c.includes(ACT_CAT[act])){net+=1;q.notes.push("技能對路 +1")}}}
  const adv=Math.min(2,(it.adv||[]).length),dis=Math.min(2,(it.dis||[]).length);
  if(adv){net+=adv;q.notes.push(`優勢（${it.adv.slice(0,2).join("、")}）+${adv}`)}
  if(dis){net-=dis;q.notes.push(`劣勢（${it.dis.slice(0,2).join("、")}）−${dis}`)}
  if(it.weapon&&hasItem("white")&&["fight","combo","raid","boss","hunt"].includes(act)){net+=1;q.useWeapon=true;q.notes.push("用掉一件武器 +1")}
  if(q.key)net=Math.min(net,0);
  if(q.boss){const ex=2-(nestIdx()===6?1:0)-(S.lv==="S"&&bpOf()>=99?1:0);net-=ex;q.notes.push("魔王威壓 −"+ex)}
  q.net=net;q.need=Math.max(0,1-net);q.bigAt=q.need+1;
  q.unit=hpUnit(q.key);
  const mpLeft=S.mp-q.mand.mp;
  q.caps={hp:Math.max(0,Math.min(3,Math.floor((S.hp-1)/q.unit))),mp:Math.max(0,Math.min(3,Math.floor(mpLeft/2))),time:3,item:Math.min(3,matCount())};
  q.hours=HOURS[act]||0;if(act==="craft"&&q.recipe&&q.recipe.sh)q.hours=4;
  q.judge=!["move","rest","hunt","sleep"].includes(act);
  return q;
}
const sumPick=p=>(p.hp||0)+(p.mp||0)+(p.time||0)+(p.item||0);
function payCosts(q,p,out){
  if(p.hp){S.hp-=p.hp*q.unit;out.paid.push(`HP −${p.hp*q.unit}`)}
  if(p.mp){S.mp-=p.mp*2;out.paid.push(`MP −${p.mp*2}`)}
  if(p.time){q.hours+=p.time*2;out.paid.push(`多花 ${p.time*2} 小時`)}
  for(let i=0;i<(p.item||0);i++){const m=["草","木材","石片","骨頭","野果","生肉","獸皮","熟肉","魔核"].find(m=>S.mats[m]>0);if(m){S.mats[m]--;out.paid.push(`${q.act==="retreat"?"丟下":"用掉"} ${m}`)}}
}

/* ───── 執行 ───── */
function exec(q,p){
  p=p||{};
  const out={act:q.act,res:"ok",lines:[],paid:[],gain:[]};
  if(q.err){out.res="err";out.lines.push(q.err);return out}
  if(q.judge){
    if(p.shesh){out.res="big";const part=pick(SCARS.filter(x=>!S.scars.includes(x)).concat(["舊傷"]));S.scars.push(part);
      out.paid.push(`捨身：傷殘（${part}），HP 上限 −2`);S.hp=Math.min(S.hp,hpMax());}
    else{const n=sumPick(p);out.res=n<q.need?"fail":n<q.bigAt?"ok":"big";payCosts(q,p,out)}
  }
  if(q.mand.mp)S.mp-=q.mand.mp;
  if(q.useSkill)useSkill(q.useSkill,out);
  if(q.act==="combo")q.sks.forEach(s=>useSkill(s,out));
  if(q.useWeapon){const i=S.items.findIndex(i=>i.k==="white");const it=S.items.splice(i,1)[0];out.paid.push(`${it.n} 碎了`)}
  count(S.stats.actions,q.act);
  const P=placeOf();
  if(P.water&&out.res!=="fail"){S.drank=true;tick("水","這裡有水",out)}
  const R={gather:doGather,explore:doExplore,hunt:doHunt,fight:doFight,retreat:doRetreat,craft:doCraft,combo:doCombo,shelter:doShelter,rest:doRest,move:doMove,raid:doRaid,boss:doRaid}[q.act];
  if(R)R(q,out);
  if(S.hp<=0&&!S.over){die(out,"你倒下了，再也沒有起來。");}
  const T=ACT_NAME[q.act]||q.act;
  const resWord={fail:"失敗",ok:"成功",big:"大成功"}[out.res]||"";
  log(`[${T}${q.judge?"・"+resWord:""}] ${out.lines.join(" ")}${out.gain.length?" 得到："+out.gain.join("、"):""}${out.paid.length?"　代價："+out.paid.join("、"):""}`,"act");
  if(!S.over&&!["raid","boss"].includes(q.act))advance(q.hours);
  return out;
}
function die(out,why){S.over={end:"死亡",day:S.day};S.pending=null;S.enc=null;out&&out.lines.push(why);log(why,"end")}

function doGather(q,out){
  const P=placeOf();
  if(out.res==="fail"){S.hp=Math.max(1,S.hp-Math.ceil(q.unit/2));out.lines.push("找了半天沒什麼收穫，還被劃傷了。");return}
  const n=out.res==="big"?4:2;const g={};for(let i=0;i<n;i++)count(g,pick(P.res));
  Object.entries(g).forEach(([m,c])=>{addMat(m,c);out.gain.push(`${m}×${c}`)});
  out.lines.push(`在${P.n}採集。`);
  if(q.useSkill)applyEffect({e:q.useSkill.e,f:"感知",n:q.useSkill.n},out);
}
function doExplore(q,out){
  if(out.res==="fail"){S.hp=Math.max(1,S.hp-Math.ceil(q.unit/2));out.lines.push("繞了一圈，迷路又摔了一跤。");return}
  const left=PLACES.filter(p=>!S.places.includes(p.n));
  if(left.length&&(out.res==="big"||rand()<.6)){
    const w=left.find(p=>p.water&&!S.places.some(n=>placeOf(n).water));
    const np=w&&rand()<.7?w:pick(left);S.places.push(np.n);S.at=np.n;
    out.lines.push(`找到新地點：${np.n}（${np.e.join("・")}${np.water?"，有水":""}${np.cave?"，有岩穴":""}）。你走了過去。`);
  }else out.lines.push(left.length?"走了一圈，沒找到新地方。":"附近都走遍了。");
  if(rand()<.3)startEncounter(out);
}
function doHunt(q,out){out.lines.push(`你在${S.at}附近找獵物。`);startEncounter(out)}
function loot(out,big){
  const en=S.enc,ei=gIdx(en.lv),k=big?2:1;
  addMat("生肉",k);addMat("獸皮",1);addMat("骨頭",1);out.gain.push(`生肉×${k}`,"獸皮","骨頭");
  if(rand()<.15+.08*ei){addMat("魔核",1);out.gain.push("魔核")}
  const ex=ei>=pg()-1?1+Math.max(0,ei-pg())+(big?1:0):0;
  if(ex){S.exist=Math.min(EXIST_MAX(S.lv),S.exist+ex);out.gain.push(`存在值+${ex}`)}
}
function doFight(q,out){
  const en=S.enc;
  if(out.res==="fail"){S.hp-=q.unit;out.lines.push(`${en.n}把你打退了。HP −${q.unit}`);S.enc=null;if(en.raid)raidLost(out);return}
  out.lines.push(`打倒了${en.n}。`);loot(out,out.res==="big");S.enc=null;if(en.raid)raidWon(q,out,en);
}
/* 據點襲擊：升級一次，引來一隻真的魔物（據點新等級），在據點打一架 */
function raidMonster(lv){
  let i=gIdx(lv);while(i>0&&!MONSTERS[GRADES[i]])i--;
  const m=pick(MONSTERS[GRADES[i]]);return {n:m.n,lv:GRADES[i],t:m.t,raid:true};
}
function raidWon(q,out,en){
  const big=out.res==="big",ex=2+Math.max(0,gIdx(en.lv)-pg());
  S.exist=Math.min(EXIST_MAX(S.lv),S.exist+ex);addMat("獸皮",2);addMat("魔核",big?2:1);
  out.gain.push(`守住據點：存在值+${ex}`,"獸皮×2",big?"魔核×2":"魔核");out.lines.push("據點守住了。");
  S.stats.raids.push({day:S.day,lv:S.nest,mon:en.n,res:out.res});
}
function raidLost(out){
  S.stats.raids.push({day:S.day,lv:S.nest,mon:"",res:"fail"});out.lines.push("據點被攻破了。");S.pending={type:"failchoice"};
}
function doRetreat(q,out){
  const en=S.enc;
  if(en.raid){if(out.res==="fail"){const d=Math.ceil(q.unit*1.5);S.hp-=d;out.lines.push(`你逃了，但被${en.n}追上咬了一口。HP −${d}`)}
    S.enc=null;S.nest="F";Object.keys(S.mats).forEach(m=>S.mats[m]=Math.floor(S.mats[m]/2));
    S.stats.raids.push({day:S.day,lv:"逃",mon:en.n,res:"retreat"});count(S.stats.actions,"flee");
    out.lines.push(`你放棄據點逃走。${en.n}佔了那裡，你帶著一半的東西，據點從 F 重來。`);return}
  if(out.res==="fail"){const d=Math.ceil(q.unit*1.5);S.hp-=d;out.lines.push(`你逃了，但被${en.n}追上咬了一口。HP −${d}`)}
  else out.lines.push(`你甩開了${en.n}。`);
  S.enc=null;
}
function doCraft(q,out){
  const r=q.recipe;
  if(out.res==="fail"){const m=Object.keys(r.need)[0];S.mats[m]--;out.lines.push(`做${r.n}失敗了，浪費了一份${m}。`);return}
  Object.entries(r.need).forEach(([m,n])=>S.mats[m]-=n);
  out.lines.push(`做出了${r.n}。`);
  if(r.fire){S.fire=true;tick("火","你學會生火了",out);return}
  if(r.sh){tick("避難所",`在${S.at}搭起了草棚`,out);return}
  S.items.push({n:r.n,k:r.k,lv:S.lv});out.gain.push(r.n);
  if(r.water)tick("水","有水袋就能把水帶在身上",out);
  if(out.res==="big"){addMat("石片",1);out.gain.push("石片（省下的）")}
}
function doShelter(q,out){
  if(out.res==="fail"){S.hp-=q.unit;out.lines.push(`岩穴裡有東西，把你趕了出來。HP −${q.unit}`);return}
  out.lines.push("你清空了岩穴，擋得住風雨。");tick("避難所","占用了岩穴",out);
}
function doRest(q,out){const h=Math.ceil(hpMax()*.2);S.hp=Math.min(hpMax(),S.hp+h);out.lines.push(`休息了一下，HP +${h}。`)}
function doMove(q,out){const to=q.it.place;if(to&&S.places.includes(to)){S.at=to;out.lines.push(`走到${to}。`)}else out.lines.push("沒有移動。")}

/* ───── 組合（靈光一閃） ───── */
function objEss(o){
  if(!o||o.t==="none")return [];
  if(o.t==="place"){const p=placeOf(o.n);return p?p.e.slice():[]}
  if(o.t==="item")return (ITEM_E[o.n]||[]).slice();
  if(o.t==="seen"){const s=S.seen.find(x=>x.n===o.n);return s?s.e.slice():[]}
  if(o.t==="enemy"&&S.enc)return S.enc.t.e.slice();
  return [];
}
function comboResult(sks,o,m){
  const se=uniq(sks.flatMap(s=>s.e)),oe=objEss(o),all=uniq(se.concat(oe));
  const pairs=[];
  for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
    const a=all[i],b=all[j];if(se.includes(a)||se.includes(b))pairs.push([a,b].sort().join("+"));
  }
  const lv=GRADES[Math.min(Math.min(...sks.map(s=>gIdx(s.lv))),pg()+1)];
  /* 偷學：天生替換 */
  if(o&&o.t==="seen"){const sn=S.seen.find(x=>x.n===o.n);const suf=sn&&PART_SUB[sn.part]&&PART_SUB[sn.part][m.n];
    if(sn&&suf&&!sn.used){const nm=(sn.e[0]||"")+suf;
      if(!owned(nm))return {correct:{n:nm,e:uniq(sn.e.concat(se.slice(0,1))),c:uniq([FORM_CAT[m.f],"天生"]),f:m.f,d:`偷學${sn.from}的「${sn.n}」，用人類的方式做出來。`,steal:sn.n},lv,all}}}
  const hit=COMBOS.find(c=>pairs.includes(c.p.slice().sort().join("+"))&&c.f===m.f&&!owned(c.n));
  return {correct:hit||null,lv,all};
}
function addFrag(sks,m,all,extraCat){
  const cats=uniq(sks.flatMap(s=>s.c).concat([FORM_CAT[m.f]]).concat(extraCat?[extraCat]:[]));
  S.frags.push({cats,e:all.slice(0,3)});S.stats.combos.frag++;
  return `碎片（${cats.join("・")}）`;
}
function doCombo(q,out){
  const it=q.it,m=MOVES.find(x=>x.n===it.move),sks=q.sks;
  S.stats.combos.try++;
  const r=comboResult(sks,it.obj,m);
  const steal=it.obj&&it.obj.t==="seen";
  const label=`${sks.map(s=>s.n).join("＋")}${it.obj&&it.obj.t!=="none"?"＋"+it.obj.n:""}＋${m.n}`;
  out.lines.push(label+"。");
  let eff=null;
  if(out.res==="fail"){out.lines.push("沒成。");out.gain.push(addFrag(sks,m,r.all,steal?"天生":null))}
  else if(r.correct){
    const t=r.correct,where=learnSkill(t,r.lv);
    if(t.steal){const sn=S.seen.find(x=>x.n===t.steal);if(sn)sn.used=true}
    out.lines.push(`靈光一閃！領悟了【${t.n}】（${r.lv}）${where==="倉庫"?"，技能表滿了，放進倉庫":""}。${t.d}`);
    out.gain.push(`【${t.n}】`);S.stats.combos.learn++;log(`靈光一閃：學會【${t.n}】`,"good");
    eff={e:t.e,f:t.f,n:t.n,g:t.g};
    if(out.res==="big")out.gain.push(addFrag(sks,m,r.all,steal?"天生":null));
  }else{
    out.lines.push("有效果，但沒抓到要領。");
    out.gain.push(addFrag(sks,m,r.all,steal?"天生":null));
    if(out.res==="big")out.gain.push(addFrag(sks,m,r.all,steal?"天生":null));
    eff={e:r.all,f:m.f,n:"這一招"};
  }
  if(eff){applyEffect(eff,out);
    if(S.enc){
      const en=S.enc;
      if(m.f==="威懾"){out.lines.push(`${en.n}被嚇跑了。`);S.enc=null;if(en.raid)raidWon(q,out,en)}
      else if(["投射","附加","領域","強化"].includes(m.f)){out.lines.push(`這一招打倒了${en.n}。`);loot(out,out.res==="big");S.enc=null;if(en.raid)raidWon(q,out,en)}
    }
  }else if(S.enc){S.hp-=q.unit;out.lines.push(`${S.enc.n}趁機撲上來。HP −${q.unit}`)}
}
/* 碎片兌換：3 片同大類 → 同大類三選一；10 片任意 → 任意三選一 */
function fragCounts(){const c={};S.frags.forEach(f=>f.cats.forEach(x=>count(c,x)));return c}
function canExchange(){const c=fragCounts();return {cats:Object.keys(c).filter(k=>c[k]>=3),any:S.frags.length>=10}}
function drawChoices(cat){
  let pool=COMBOS.filter(x=>!owned(x.n)&&(!cat||x.c.includes(cat)));
  const names=[];pool=shuffle(pool).filter(x=>!names.includes(x.n)&&names.push(x.n));
  const out=pool.slice(0,3);
  if(out.length<3&&cat&&!owned(FUSED_NAME[cat]||cat+"心得")){
    const es=uniq(S.frags.filter(f=>f.cats.includes(cat)).flatMap(f=>f.e)).slice(0,2);
    out.push({n:FUSED_NAME[cat]||cat+"心得",c:[cat],e:es.length?es:["生長"],d:"碎片累積下來的心得。"});
  }
  return out;
}
function exchange(cat,choice){
  if(cat){let k=0;S.frags=S.frags.filter(f=>{if(k<3&&f.cats.includes(cat)){k++;return false}return true})}
  else S.frags.splice(0,10);
  const where=learnSkill(choice,"F");
  log(`碎片兌換：學會【${choice.n}】${where==="倉庫"?"（放進倉庫）":""}`,"good");
  const out={lines:[]};applyEffect({e:choice.e,f:choice.f||"",n:choice.n,g:choice.g},out);
  return where;
}
/* 整合：同大類、同階 3 個 → 高一階 1 個 */
function fuse(idx){
  const a=idx.map(i=>S.skills[i]);
  if(a.length!==3||a.some(x=>!x))return {err:"要選 3 個"};
  const cat=CATS.concat(["天生"]).find(c=>a.every(s=>s.c.includes(c)));
  if(!cat)return {err:"要同大類"};
  if(new Set(a.map(s=>s.lv)).size>1)return {err:"要同階"};
  const lv=GRADES[Math.min(6,gIdx(a[0].lv)+1)];
  let n=FUSED_NAME[cat],k=2;while(owned(n))n=FUSED_NAME[cat]+"・"+(k++);
  const ns={n,e:uniq(a.flatMap(s=>s.e)).slice(0,3),c:[cat],d:`由${a.map(s=>s.n).join("、")}整合而成。`};
  S.skills=S.skills.filter((_,i)=>!idx.includes(i));S.skills.push(mkSkill(ns,lv));
  count(S.stats.actions,"fuse");log(`整合：${a.map(s=>s.n).join("＋")} → 【${n}】（${lv}）`,"good");advance(HOURS.fuse);
  return {ok:true,n};
}
function swapSkill(from,i){
  if(from==="skills"){if(!S.skills[i])return;if(S.store.length>=STORE_MAX[S.lv])return {err:"倉庫滿了"};S.store.push(S.skills.splice(i,1)[0])}
  else{if(!S.store[i])return;if(S.skills.length>=SKILL_SLOTS)return {err:"技能表滿了（9 格）"};S.skills.push(S.store.splice(i,1)[0])}
  advance(1);return {ok:true};
}

/* ───── 時間與夜晚 ───── */
function advance(h){S.hour+=h;if(S.hour>=24&&!S.over)night(false)}
function night(voluntary){
  const lines=[];
  /* 吃 */
  const f=["熟肉","野果","生肉"].find(m=>S.mats[m]>0);
  if(f){S.mats[f]--;S.tags.飢餓=false;
    if(f==="生肉"){if(S.needs.火)lines.push("烤了肉吃。");else if(rand()<.5){S.tags.疾病=3;lines.push("吃了生肉，肚子不對勁（疾病）。")}else lines.push("硬吞了生肉。")}
    else lines.push(`吃了${f}。`)}
  else{S.tags.飢餓=true;lines.push("沒有東西吃（飢餓）。")}
  /* 喝 */
  if(S.needs.水||S.drank||(S.items.some(i=>i.n==="水袋"))){S.thirst=0}
  else{S.thirst++;lines.push(`今天沒喝到水（口渴 ${S.thirst}/3）。`)}
  if(S.thirst>=3){die(null,"三天沒喝水，你倒下了。");return}
  /* 冷 */
  S.tags.會冷=!S.needs.火&&!S.needs.避難所;
  if(S.tags.會冷){S.hp-=2;lines.push("夜裡很冷（會冷），HP −2。")}
  if(S.tags.疾病>0){S.hp-=1;S.tags.疾病--;lines.push("病還沒好，HP −1。")}
  if(S.hp<=0){die(null,"你在夜裡倒下了。");return}
  /* 睡 */
  let cap=hpMax();if(S.tags.飢餓)cap=Math.ceil(hpMax()/2);
  const gain=voluntary?cap:Math.ceil(hpMax()*.3);
  S.hp=Math.max(S.hp,Math.min(cap,S.hp+gain));
  S.mp=voluntary?MP_MAX:Math.min(MP_MAX,S.mp+3);
  if(!voluntary)lines.push("撐到天亮才倒下，睡得很差。");
  if(foodCount()>=5)tick("食物","存糧夠吃好幾天了");
  S.day++;S.hour=WAKE;S.drank=false;
  S.skills.concat(S.store).forEach(s=>s.today=0);S.itemUsed={};
  log(lines.join(" "));
  log(`天亮了，你醒了。這是你異世界一人生存的第 ${S.day} 天。今天要做什麼？`,"day");
  if(S.day>DAYS&&!S.over&&!S.pending)S.pending={type:"boss"};
  checkChapter();
}
function sleep(){count(S.stats.actions,"sleep");log("你睡了。");night(true);return {ok:true}}

/* ───── 第二章：據點 ───── */
function startCh2(here){
  S.pending=null;
  if(!here){log("你決定先不定下來。（隨時可以從選單建立據點）");return}
  S.ch=2;S.nest="F";S.base=S.at;S.stats.nestDay.F=S.day;
  log(`你在${S.at}建立了 F 級據點。第二章開始。升級據點會引來魔物；365 天後魔王（BP 99）復活。`,"good");
}
function canBuild(){if(S.ch<2||S.nest==null)return null;const t=nestIdx()+1;if(t>6)return null;const c=NEST_COST[t];
  return {target:GRADES[t],cost:c,ok:Object.entries(c).every(([m,n])=>(S.mats[m]||0)>=n)}}
function build(){
  const b=canBuild();if(!b||!b.ok)return {err:"材料不夠"};
  Object.entries(b.cost).forEach(([m,n])=>S.mats[m]-=n);
  S.nest=b.target;S.stats.nestDay[b.target]=S.day;count(S.stats.actions,"upgrade");
  log(`據點升到 ${b.target} 級。`,"act");advance(4);
  if(S.over)return {ok:true};
  const en=raidMonster(b.target);S.enc=en;S.stats.enc++;
  log(`襲擊！${en.n}（${en.lv} 級）被據點引過來了。`,"bad");
  if(!S.seen.some(x=>x.n===en.t.n)){S.seen.push({n:en.t.n,e:en.t.e.slice(),part:en.t.part,from:en.n,lv:en.lv,used:false});log(`你看見牠使出「${en.t.n}」。（記下來了，可以拿來組合偷學）`)}
  return {ok:true};
}
function moveBase(){
  if(S.ch<2)return {err:"還沒有據點"};
  Object.keys(S.mats).forEach(m=>S.mats[m]=Math.floor(S.mats[m]/2));
  S.nest="F";S.base=S.at;log(`你把據點搬到${S.at}。據點變回 F 級，物資只帶走一半。`,"act");advance(6);return {ok:true};
}
function doRaid(q,out){
  const boss=q.boss,eg=boss?7:q.eIdx;
  out.lines.push(boss?`${BOSS}來了。`:`${pick(MONSTERS[GRADES[Math.min(6,eg)]]||MONSTERS.F).n}（${GRADES[Math.min(6,eg)]}）來襲。`);
  if(out.res==="fail"){out.lines.push(boss?"魔王一擊就把你消滅了。":"據點被攻破了。");S.stats.raids.push({day:S.day,lv:S.pending.lv||"魔王",res:"fail"});S.pending={type:"failchoice",boss};return}
  S.hp=Math.max(1,S.hp-Math.ceil(q.unit/2));
  if(boss){S.over={end:"退休",day:S.day};out.lines.push("你打倒了魔王。世界安靜了。你有一間房子可以退休。");S.pending=null;return}
  const ex=2*(1+Math.max(0,q.eIdx-pg()))+(out.res==="big"?1:0);
  S.exist=Math.min(EXIST_MAX(S.lv),S.exist+ex);addMat("獸皮",2);addMat("魔核",out.res==="big"?2:1);
  out.gain.push(`存在值+${ex}`,"獸皮×2","魔核");S.stats.raids.push({day:S.day,lv:S.pending.lv,res:out.res});out.lines.push("擊退了。");S.pending=null;
}
function failChoice(flee){
  const boss=S.pending&&S.pending.boss;
  if(!flee||boss){die(null,"你死了。");return}
  S.nest="F";Object.keys(S.mats).forEach(m=>S.mats[m]=Math.floor(S.mats[m]/2));S.pending=null;
  count(S.stats.actions,"flee");log("據點毀了，你帶著一半的東西逃了出去，據點從 F 級重來。","end");advance(6);
}
function canEvolve(){return S.lv!=="S"&&S.exist>=EXIST_MAX(S.lv)}
function evolve(){if(!canEvolve())return {err:"存在值還沒滿"};S.lv=GRADES[gIdx(S.lv)+1];S.exist=0;S.hp=hpMax();S.stats.lvDay[S.lv]=S.day;
  log(`你進化了，現在是 ${S.lv} 級（BP ${bpOf()}）。`,"good");advance(2);return {ok:true}}
function usePotion(){const i=S.items.findIndex(x=>x.k==="potion");if(i<0)return {err:"沒有藥"};const it=S.items.splice(i,1)[0];
  S.hp=Math.min(hpMax(),S.hp+Math.ceil(hpMax()/2));log(`用了${it.n}，HP 回了一半。`);return {ok:true}}
function trade(kind,item){
  if(nestIdx()<2)return {err:"據點要 D 級以上，才會有商人來"};
  if(kind==="sell"){if(!(S.mats[item]>0))return {err:"你沒有"};S.mats[item]--;S.gold+=SELL[item]||1;log(`賣了${item}，+${SELL[item]||1} 金幣。`)}
  else{const c=BUY[item]*2;if(S.gold<c)return {err:`錢不夠（要 ${c}）`};S.gold-=c;
    if(item==="鐵劍")S.items.push({n:"鐵劍",k:"white",lv:S.lv});else if(item==="草藥膏")S.items.push({n:"草藥膏",k:"potion",lv:S.lv});else addMat(item,1);
    log(`買了${item}，花 ${c} 金幣（對方一臉厭惡）。`)}
  advance(1);return {ok:true};
}
/* OOC：更正帳目 */
function oocAdd(name,n){n=n||1;if(MATS.includes(name))addMat(name,n);else if(name==="金幣")S.gold+=n;else S.items.push({n:name,k:"white",lv:S.lv});S.stats.ooc.add++;log(`[OOC] 補登 ${name}×${n}`,"ooc")}
function oocRemove(name,n){n=n||1;if(MATS.includes(name))S.mats[name]=Math.max(0,(S.mats[name]||0)-n);else if(name==="金幣")S.gold=Math.max(0,S.gold-n);else{const i=S.items.findIndex(x=>x.n===name);if(i>=0)S.items.splice(i,1)}S.stats.ooc.remove++;log(`[OOC] 撤銷 ${name}×${n}`,"ooc")}
function oocSet(field,v){if(field==="hp")S.hp=Math.max(1,Math.min(hpMax(),v));else if(field==="mp")S.mp=Math.max(0,Math.min(MP_MAX,v));else if(field==="gold")S.gold=Math.max(0,v);
  else if(NEEDS.includes(field)){S.needs[field]=!!v;checkChapter()}
  S.stats.ooc.edit++;log(`[OOC] ${field} 改成 ${v}`,"ooc")}
