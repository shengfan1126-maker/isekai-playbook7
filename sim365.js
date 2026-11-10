/* sim365.js：機器人從第 1 天打到 365 天魔王戰。
   用法：node sim365.js [局數] [shesh] [dbg]
   shesh：升級戰快被攻破、付不起代價時用捨身（不加＝打不過就放棄據點逃走）
   dbg：印出第一局每一場升級戰的判定 */
const fs=require("fs"),vm=require("vm");
const ctx=vm.createContext({console,Math});
vm.runInContext(["data.js","game.js"].map(f=>fs.readFileSync(__dirname+"/"+f,"utf8")).join("\n")+
  "\nthis.G={newGame,planOf,exec,sleep,startCh2,failChoice,get S(){return S},hpMax,placeOf,gIdx,canExchange,drawChoices,exchange,RECIPES,MOVES,PLACES,canBuild,build,canEvolve,evolve,usePotion,bpOf,hasItem,MP_MAX,pickFac,facPut,startBoss,donate,donateItem,FAC,GRADES,facBlock};",ctx);
const G=ctx.G;
const SHESH=process.argv.includes("shesh"),DBG=process.argv.includes("dbg");
let dbgOn=false;
function pay(q,want){const p={hp:0,mp:0,time:0,item:0};let n=want;for(const k of ["time","item","mp","hp"]){const t=Math.min(n,q.caps[k]);p[k]=t;n-=t}return p}
const maxPay=q=>q.caps.hp+q.caps.mp+q.caps.time+q.caps.item;
function act(it,want){const q=G.planOf(it);if(q.err)return null;return G.exec(q,pay(q,want==null?q.need:want))}
const has=need=>Object.entries(need).every(([m,n])=>(G.S.mats[m]||0)>=n);
function bestFight(){const S=G.S;return S.skills.filter(s=>s.today<3).sort((a,b)=>(b.c.includes("戰鬥")-a.c.includes("戰鬥"))||(G.gIdx(b.lv)-G.gIdx(a.lv)))[0]}
const W={raidBattles:0,paid:0,takeLoss:0,shesh:0,flee:0,potion:0};
/* 升級戰的一場 */
function raidBattle(){
  const S=G.S,R=S.raid,s=bestFight();
  if(S.hp<G.hpMax()*.5&&G.hasItem("potion")){W.potion++;G.usePotion();}
  const it={act:"fight",skills:s&&S.mp>=1?[s.n]:[],weapon:G.hasItem("white")};
  const q=G.planOf(it);W.raidBattles++;
  if(DBG&&dbgOn)console.log(`  第${S.day}天 ${R.kind}戰 ${R.i+1}/${R.list.length} 你${S.lv} vs ${S.enc.n}${S.enc.lv}｜net ${q.net} need ${q.need}｜caps ${JSON.stringify(q.caps)} HP ${S.hp}/${G.hpMax()} MP ${S.mp} 物品${S.items.length}｜輸${R.lost}/${R.max}｜${q.notes.join("；")}`);
  const safeHp=S.hp-q.unit;           // 輸了還活著嗎
  const lastChance=R.lost>=R.max||S.enc.king;
  if(q.need<=maxPay(q)){
    const p=pay(q,q.need);
    if(S.hp-p.hp*q.unit>0){W.paid++;return G.exec(q,p)}
  }
  if(!lastChance&&safeHp>0){W.takeLoss++;return G.exec(q,{})}      // 這場認輸，留著資源
  if((SHESH||R.kind==="boss")&&!R.shesh){W.shesh++;return G.exec(q,{shesh:true})}
  if(R.kind==="boss"){W.takeLoss++;return G.exec(q,{})}
  W.flee++;return act({act:"retreat"},null);
}
function goGather(mat){
  const S=G.S;
  const best=S.places.map(G.placeOf).filter(p=>p.res.includes(mat)).sort((a,b)=>b.res.filter(x=>x===mat).length-a.res.filter(x=>x===mat).length)[0];
  if(best&&best.n!==S.at)return act({act:"move",place:best.n});
  if(!best)return act({act:"explore"});
  const s=S.skills.find(x=>x.today<3&&x.c.includes("生存"))||S.skills.find(x=>x.today<3);
  return act({act:"gather",skills:s&&S.mp>=1?[s.n]:[]});
}
const FAC_PREF=["柵欄","望樓","藥草園","鍛冶台","修練場","農田"];
const KEEP={生肉:3,野果:3,熟肉:0,石片:3,木材:4,草:4,獸皮:2,骨頭:0,魔核:0};
function baseChores(){
  const S=G.S;
  if(S.facPick){const n=FAC_PREF.find(x=>S.facPick.includes(x))||S.facPick[0];G.pickFac(n);return true}
  const fi=S.fac.findIndex(f=>!f.s);
  if(fi>=0){ // 拿最不會用來打架的技能放進去，至少留 3 個戰鬥用
    const cand=S.skills.map((s,i)=>({s,i})).filter(x=>!x.s.c.includes("戰鬥")).sort((a,b)=>G.gIdx(a.s.lv)-G.gIdx(b.s.lv));
    const pref=G.FAC.find(f=>f.n===S.fac[fi].n).cat;
    const m=cand.find(x=>x.s.c.includes(pref))||cand[0];
    if(m&&S.skills.length>3){G.facPut(fi,m.i);return true}
  }
  let did=false;
  for(const m of Object.keys(S.mats)){const n=(S.mats[m]||0)-(KEEP[m]||0);if(n>0){G.donate(m,n);did=true}}
  const ti=S.items.findIndex(i=>i.k==="tool"&&i.n!=="背包");if(ti>=0){G.donateItem(ti);did=true}
  return did;
}
function readyToBuild(){const S=G.S;return S.hp>=G.hpMax()*.9&&S.mp>=G.MP_MAX-1&&S.hour<=9&&S.items.filter(i=>i.k==="white").length>=2&&G.hasItem("potion")}
function play(idx){
  G.newGame();const S=G.S;let guard=0;dbgOn=idx===0;
  while(!S.over&&guard++<60000){
    if(S.pending){const t=S.pending.type;
      if(t==="ch2"){G.startCh2(true);continue}
      if(t==="failchoice"){G.failChoice(true);continue}
      if(t==="boss"){G.startBoss();continue}
    }
    if(S.raid&&S.enc){raidBattle();continue}
    if(S.enc){const d=G.gIdx(S.enc.lv)-G.gIdx(S.lv);const s=bestFight();const q=G.planOf({act:"fight",skills:s&&S.mp>=1?[s.n]:[]});
      if(d<=1&&q.need<=maxPay(q)&&S.hp>q.unit*2)G.exec(q,pay(q,q.need));else act({act:"retreat"},null);continue}
    if(S.hp<G.hpMax()*.4&&G.hasItem("potion")){G.usePotion();continue}
    if(S.hour>=20||S.hp<G.hpMax()*.4){G.sleep();continue}
    if(G.canEvolve()){G.evolve();continue}
    const ex=G.canExchange();if(ex.cats.length){const c=ex.cats[0];const ch=G.drawChoices(c);if(ch.length){G.exchange(c,ch[0]);continue}}
    if(S.ch===1){
      const water=S.places.find(n=>G.placeOf(n).water);
      if(!S.needs.水){if(water&&S.at!==water){act({act:"move",place:water});continue}if(!water){act({act:"explore"});continue}}
      if(!S.needs.火){if(has({木材:2,石片:1})){act({act:"craft",craft:"火種"},1);continue}if(!S.mats.石片){goGather("石片");continue}}
      if(!S.needs.避難所){if(has({木材:3,草:3})){act({act:"craft",craft:"草棚"});continue}goGather((S.mats.木材||0)<3?"木材":"草");continue}
      if(!S.needs.食物){if(Math.random()<.4)act({act:"hunt"});else goGather("野果");continue}
    }
    if(S.ch===2&&baseChores())continue;
    if(Math.random()<.15&&S.mp>=3){const sk=S.skills.filter(s=>s.today<3);if(sk.length){
      const k=Math.min(sk.length,1+Math.floor(Math.random()*2));const ss=sk.slice(0,k).map(s=>s.n);
      const objs=[{t:"place",n:S.at},...S.seen.filter(x=>!x.used).map(x=>({t:"seen",n:x.n}))];
      if(act({act:"combo",skills:ss,obj:objs[Math.floor(Math.random()*objs.length)],move:G.MOVES[Math.floor(Math.random()*G.MOVES.length)].n},1))continue}}
    const full=S.items.length>=8+(S.items.some(i=>i.n==="背包")?4:0);
    if(!full&&!S.items.some(i=>i.n==="背包")&&has({獸皮:1,草:2})){act({act:"craft",craft:"背包"});continue}
    if(full){}else if(!G.hasItem("armor")&&has({獸皮:2})){act({act:"craft",craft:"皮甲"});continue}
    else if(S.items.filter(i=>i.k==="potion").length<2&&has({草:3})){act({act:"craft",craft:"草藥膏"});continue}
    else if(S.items.filter(i=>i.k==="white").length<6&&has({石片:1,木材:2})){act({act:"craft",craft:"石矛"});continue}
    if(S.places.length<G.PLACES.length&&Math.random()<.15){act({act:"explore"});continue}
    const b=G.canBuild();
    if(b&&b.ok&&readyToBuild()){G.build();continue}
    const r=Math.random();
    if(r<.35){act({act:"hunt"});continue}
    if((S.mats.草||0)<4){goGather("草");continue}
    goGather(r<.6?"石片":"木材");
  }
  if(!S.over&&guard>=60000&&!globalThis.stuckShown){globalThis.stuckShown=1;console.log("卡住：",JSON.stringify({day:S.day,hour:S.hour,ch:S.ch,nest:S.nest,pending:S.pending,enc:S.enc,raid:!!S.raid,facPick:S.facPick,fac:S.fac.map(f=>f.n+(f.s?"✔":"")),skills:S.skills.length,hp:S.hp,mp:S.mp,items:S.items.length,mats:S.mats,last:S.log.slice(-4).map(l=>l.t)}))}
  return S;
}
const N=+process.argv[2]||30,rows=[];for(let i=0;i<N;i++)rows.push(play(i));
const med=a=>{a=a.filter(x=>x!=null).sort((x,y)=>x-y);return a.length?a[a.length>>1]:"-"};
const ends={};rows.forEach(s=>{const k=s.over?s.over.end:"沒結束";ends[k]=(ends[k]||0)+1});
console.log(`局數 ${N}（${SHESH?"快被攻破就捨身":"快被攻破就逃"}）結局：`,JSON.stringify(ends));
const deaths=rows.filter(s=>s.over&&s.over.end==="死亡").map(s=>s.over.day);
console.log("死亡天數：",deaths.sort((a,b)=>a-b).join(",")||"無");
console.log("第一章完成（中位數）第",med(rows.map(s=>s.stats.ch1Day)),"天");
console.log("自己升級（中位數天數）："+["E","D","C","B","A","S"].map(g=>{const a=rows.map(s=>s.stats.lvDay[g]).filter(x=>x!=null);return `${g} ${a.length}局 第${med(a)}天`}).join("｜"));
console.log("據點第一次到（中位數天數）："+["E","D","C","B","A","S"].map(g=>{const a=rows.map(s=>s.stats.nestDay[g]).filter(x=>x!=null);return `${g} ${a.length}局 第${med(a)}天`}).join("｜"));
const R=rows.flatMap(s=>s.stats.raids);
console.log("升級戰（升到哪一級：守住/攻破/逃）："+["E","D","C","B","A","S","boss"].map(k=>{const a=R.filter(r=>r.lv===k);const c=x=>a.filter(r=>r.res===x).length;return `${k} ${c("ok")}/${c("fail")}/${c("retreat")}`}).join("｜"));
console.log("最後據點：",JSON.stringify(rows.reduce((o,s)=>(o[s.nest]=(o[s.nest]||0)+1,o),{})),"；最後等級：",JSON.stringify(rows.reduce((o,s)=>(o[s.lv]=(o[s.lv]||0)+1,o),{})),"；傷殘中位數",med(rows.map(s=>s.scars.length)));
console.log("機器人：",JSON.stringify(W));
