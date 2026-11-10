/* sim365.js：機器人從第 1 天打到 365 天魔王戰。用法：node sim365.js [局數] [shesh]
   shesh：關鍵戰付不起代價時用捨身（不加這個參數＝打不過就逃）。 */
const fs=require("fs"),vm=require("vm");
const ctx=vm.createContext({console,Math});
vm.runInContext(["data.js","game.js"].map(f=>fs.readFileSync(__dirname+"/"+f,"utf8")).join("\n")+
  "\nthis.G={newGame,planOf,exec,sleep,startCh2,failChoice,get S(){return S},hpMax,placeOf,gIdx,canExchange,drawChoices,exchange,RECIPES,MOVES,PLACES,canBuild,build,canEvolve,evolve,usePotion,bpOf,hasItem,EXIST_MAX,MONSTERS};",ctx);
const G=ctx.G;
const SHESH=process.argv.includes("shesh");
/* 試驗：關鍵戰（襲擊、魔王）不准付「多花時間」「用掉材料」 */
if(process.argv.includes("strict")){const pq=G.planOf;G.planOf=it=>{const q=pq(it);if(q.key){q.caps.time=0;q.caps.item=0}return q}}
function pay(q,want){const p={hp:0,mp:0,time:0,item:0};let n=want;for(const k of ["time","item","mp","hp"]){const t=Math.min(n,q.caps[k]);p[k]=t;n-=t}return p}
const maxPay=q=>q.caps.hp+q.caps.mp+q.caps.time+q.caps.item;
function act(it,want){const q=G.planOf(it);if(q.err)return null;return G.exec(q,pay(q,want==null?q.need:want))}
const has=need=>Object.entries(need).every(([m,n])=>(G.S.mats[m]||0)>=n);
function bestFight(){const S=G.S;return S.skills.filter(s=>s.today<3).sort((a,b)=>(b.c.includes("戰鬥")-a.c.includes("戰鬥"))||(G.gIdx(b.lv)-G.gIdx(a.lv)))[0]}
const W={combo:0,keyPaid:0,shesh:0,flee:0,keyLose:0};
function fight(){
  const S=G.S,en=S.enc,s=bestFight();
  const it={act:"fight",skills:s&&S.mp>=1?[s.n]:[],weapon:G.hasItem("white")};
  const q=G.planOf(it);
  const d=G.gIdx(en.lv)-G.gIdx(S.lv);
  if(!en.raid){ if(d<=1&&q.need<=maxPay(q))return G.exec(q,pay(q,q.need)); return act({act:"retreat"},null) }
  if(process.argv.includes("dbg"))console.log(`第${S.day}天 你${S.lv} 據點${S.nest} vs ${en.n}${en.lv}｜net ${q.net} need ${q.need} big ${q.bigAt}｜caps ${JSON.stringify(q.caps)} unit ${q.unit} HP ${S.hp}/${G.hpMax()}｜${q.notes.join("；")}`);
  if(q.need<=maxPay(q)){W.keyPaid++;return G.exec(q,pay(q,Math.min(maxPay(q),q.bigAt)))}
  if(SHESH){W.shesh++;return G.exec(q,{shesh:true})}
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
function play(){
  G.newGame();const S=G.S;let guard=0;
  while(!S.over&&guard++<40000){
    if(S.pending){const t=S.pending.type;
      if(t==="ch2"){G.startCh2(true);continue}
      if(t==="failchoice"){W.keyLose++;G.failChoice(true);continue}
      if(t==="boss"){const s=bestFight();const q=G.planOf({act:"boss",skills:s?[s.n]:[],weapon:G.hasItem("white")});
        if(q.need<=maxPay(q))G.exec(q,pay(q,q.need));else G.exec(q,SHESH?{shesh:true}:pay(q,maxPay(q)));continue}
      if(t==="raid"){G.exec(G.planOf({act:"raid"}),{});continue}
    }
    if(S.enc){fight();continue}
    if(S.hp<G.hpMax()*.4&&G.hasItem("potion")){G.usePotion();continue}
    if(S.hour>=20||S.hp<G.hpMax()*.4){G.sleep();continue}
    if(G.canEvolve()){G.evolve();continue}
    const ex=G.canExchange();if(ex.cats.length){const c=ex.cats[0];const ch=G.drawChoices(c);if(ch.length){G.exchange(c,ch[0]);continue}}
    /* 第一章 */
    if(S.ch===1){
      const water=S.places.find(n=>G.placeOf(n).water);
      if(!S.needs.水){if(water&&S.at!==water){act({act:"move",place:water});continue}if(!water){act({act:"explore"});continue}}
      if(!S.needs.火){if(has({木材:2,石片:1})){act({act:"craft",craft:"火種"},1);continue}if(!S.mats.石片){goGather("石片");continue}}
      if(!S.needs.避難所){if(has({木材:3,草:3})){act({act:"craft",craft:"草棚"});continue}goGather((S.mats.木材||0)<3?"木材":"草");continue}
      if(!S.needs.食物){if(Math.random()<.4)act({act:"hunt"});else goGather("野果");continue}
    }
    /* 小東西 */
    if(Math.random()<.2&&S.mp>=2){const sk=S.skills.filter(s=>s.today<3);if(sk.length){W.combo++;
      const k=Math.min(sk.length,1+Math.floor(Math.random()*2));const ss=sk.slice(0,k).map(s=>s.n);
      const objs=[{t:"place",n:S.at},...S.seen.filter(x=>!x.used).map(x=>({t:"seen",n:x.n}))];
      if(act({act:"combo",skills:ss,obj:objs[Math.floor(Math.random()*objs.length)],move:G.MOVES[Math.floor(Math.random()*G.MOVES.length)].n},1))continue}}
    if(!G.hasItem("armor")&&has({獸皮:2})){act({act:"craft",craft:"皮甲"});continue}
    if(!G.hasItem("potion")&&has({草:3})){act({act:"craft",craft:"草藥膏"});continue}
    if(S.items.filter(i=>i.k==="white").length<2&&has({石片:1,木材:2})&&(S.mats.石片||0)>3){act({act:"craft",craft:"石矛"});continue}
    if(S.places.length<G.PLACES.length&&Math.random()<.15){act({act:"explore"});continue}
    /* 第二章：升級據點 */
    const b=G.canBuild();
    if(b&&b.ok&&S.hp>=G.hpMax()*.8&&S.hour<=12){G.build();continue}
    if(b&&!b.ok){
      const miss=Object.entries(b.cost).filter(([m,n])=>(S.mats[m]||0)<n).map(([m])=>m);
      const m=miss[0];
      if(m==="獸皮"||(m==="魔核"&&!S.places.includes("魔力泉"))){act({act:"hunt"});continue}
      goGather(m);continue;
    }
    if(Math.random()<.3){act({act:"hunt"});continue}
    goGather(["木材","石片","野果"][Math.floor(Math.random()*3)]);
  }
  return S;
}
const N=+process.argv[2]||30,rows=[];for(let i=0;i<N;i++)rows.push(play());
const med=a=>{a=a.filter(x=>x!=null).sort((x,y)=>x-y);return a.length?a[a.length>>1]:"-"};
const ends={};rows.forEach(s=>{const k=s.over?s.over.end:"沒結束";ends[k]=(ends[k]||0)+1});
console.log(`局數 ${N}（${SHESH?"打不過就捨身":"打不過就逃"}${process.argv.includes("strict")?"，關鍵戰不准付時間和材料":""}）結局：`,JSON.stringify(ends));
const deaths=rows.filter(s=>s.over&&s.over.end==="死亡").map(s=>s.over.day);
console.log("死亡天數：",deaths.sort((a,b)=>a-b).join(",")||"無");
console.log("第一章完成（中位數）第",med(rows.map(s=>s.stats.ch1Day)),"天");
for(const g of ["E","D","C","B","A","S"]){const a=rows.map(s=>s.stats.nestDay[g]).filter(x=>x!=null);console.log(`據點到 ${g}：${a.length}/${N} 局，中位數第 ${med(a)} 天`)}
for(const g of ["E","D","C","B","A","S"]){const a=rows.map(s=>s.stats.lvDay[g]).filter(x=>x!=null);console.log(`自己到 ${g}：${a.length}/${N} 局，中位數第 ${med(a)} 天`)}
const R=rows.flatMap(s=>s.stats.raids);const rc={};R.forEach(r=>{rc[r.res]=(rc[r.res]||0)+1});
console.log("襲擊結果：",JSON.stringify(rc),"每局",(R.length/N).toFixed(1),"次");
console.log("最後：據點",JSON.stringify(rows.reduce((o,s)=>(o[s.nest]=(o[s.nest]||0)+1,o),{})),"；自己",JSON.stringify(rows.reduce((o,s)=>(o[s.lv]=(o[s.lv]||0)+1,o),{})),"；BP 中位數",med(rows.map(s=>{G.S;return null})));
console.log("傷殘數中位數",med(rows.map(s=>s.scars.length)),"；機器人計數",JSON.stringify(W));
const s0=rows[0];console.log("第一局：",s0.over&&s0.over.end,"第",s0.day,"天；據點",s0.nest,"；",s0.lv,"級；材料",JSON.stringify(s0.mats),"；襲擊",JSON.stringify(s0.stats.raids.slice(0,12)));
