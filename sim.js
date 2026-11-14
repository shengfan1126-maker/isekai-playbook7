/* sim.js：用 node 跑機器人玩家，看第一章（求生四項打勾）要幾天、會不會死。用法：node sim.js [局數] */
const fs=require("fs"),vm=require("vm");
const ctx=vm.createContext({console,Math});
vm.runInContext(["data.js","game.js","world.js","combo.js","gear.js"].map(f=>fs.readFileSync(__dirname+"/"+f,"utf8")).join("\n")+
  "\nthis.G={newGame,planOf,exec,sleep,startCh2,failChoice,get S(){return S},hpMax,placeOf,gIdx,canExchange,drawChoices,exchange,RECIPES,MOVES,PLACES,travel,homeAt,useEscape,baseable};",ctx);
const G=ctx.G;let powder=0;
function pay(q,want){const p={hp:0,mp:0,time:0,item:0};let n=want;for(const k of ["time","mp","item","hp"]){const t=Math.min(n,q.caps[k]);p[k]=t;n-=t}return p}
const maxPay=q=>q.caps.hp+q.caps.mp+q.caps.time+q.caps.item;
function act(it,want){const q=G.planOf(it);if(q.err)return null;return G.exec(q,pay(q,want==null?q.need:want))}
function has(r){const S=G.S;return Object.entries(r.need).every(([m,n])=>(S.mats[m]||0)>=n)}
function play(maxDay){
  G.newGame();const S=G.S;let guard=0;
  while(!S.over&&S.day<=maxDay&&guard++<5000){
    if(S.ch1Offered&&S.ch===1&&!S.pending&&!S.enc){if(S.at===S.shelterAt){G.startCh2(true);break}act({act:"move",place:S.shelterAt});continue}   /* v5.18：自己回避難所按建立據點 */
    if(S.pending){if(S.pending.type==="ch2"){G.startCh2(true);break}if(S.pending.type==="failchoice"){G.failChoice(true);continue}}
    const sk=S.skills.filter(s=>s.today<3);
    if(S.enc){const d=G.gIdx(S.enc.lv)-G.gIdx(S.lv);const q=G.planOf({act:"fight",weapon:true,skills:sk[0]?[sk[0].n]:[]});
      if(d<=1&&q.need<=maxPay(q))G.exec(q,pay(q,q.need));else if(S.items.some(i=>i.k==="escape")){powder++;G.useEscape()}else act({act:"retreat"},null);continue}
    if(S.hour>=21||S.hp<G.hpMax()*.4){const h=G.homeAt();if(h&&S.at!==h)G.travel(h,true);else G.sleep();continue}
    const P=G.placeOf();
    if(Math.random()<.25&&sk.length&&S.mp>=1){const k=Math.min(sk.length,1+Math.floor(Math.random()*Math.min(3,S.mp)));
      const ss=sk.slice(0,k).map(s=>s.n);const objs=[{t:"place",n:S.at},{t:"none"},...S.seen.map(x=>({t:"seen",n:x.n}))];
      const r=act({act:"combo",skills:ss,obj:objs[Math.floor(Math.random()*objs.length)],move:G.MOVES[Math.floor(Math.random()*G.MOVES.length)].n},1);
      if(r)continue}
    const ex=G.canExchange();if(ex.cats.length){const c=ex.cats[0];const ch=G.drawChoices(c);if(ch.length){G.exchange(c,ch[0]);continue}}
    const water=S.places.find(n=>G.placeOf(n).water);
    if(!S.needs.水){if(water&&S.at!==water){act({act:"move",place:water});continue}if(!water){act({act:"explore"});continue}}
    if(!S.needs.火){const r=G.RECIPES.find(x=>x.n==="火種");if(has(r)){act({act:"craft",craft:"火種"},1);continue}}
    if(!S.needs.避難所){const cave=S.places.find(n=>G.placeOf(n).cave&&G.placeOf(n).kind==="wild");
      if(cave){if(S.at!==cave){act({act:"move",place:cave});continue}act({act:"shelter"},1);continue}
      const r=G.RECIPES.find(x=>x.n==="草棚");if(has(r)){if(!G.baseable(S.at)){act({act:"move",place:S.places.find(n=>G.baseable(n))});continue}act({act:"craft",craft:"草棚"});continue}}
    if(Math.random()<.2){act({act:"explore"});continue}
    if(Math.random()<.25){act({act:"hunt"});continue}
    if(!P.res.includes("木材")&&!P.res.includes("石片")){const t=S.places.find(n=>G.placeOf(n).res.includes("木材"));if(t&&t!==S.at){act({act:"move",place:t});continue}}
    act({act:"gather",skills:sk[0]?[sk[0].n]:[]});
  }
  return S;
}
const N=+process.argv[2]||50,rows=[];for(let i=0;i<N;i++)rows.push(play(60));
const done=rows.filter(s=>s.stats.ch1Day),dead=rows.filter(s=>s.over&&s.over.end==="死亡");
const med=a=>{a=a.slice().sort((x,y)=>x-y);return a.length?a[a.length>>1]:"-"};
console.log("局數",N,"；第一章完成",done.length,"；死亡",dead.length,"（中位數第",med(dead.map(s=>s.over.day)),"天）");
console.log("第一章完成天數（中位數）",med(done.map(s=>s.stats.ch1Day)),"；最快",Math.min(...done.map(s=>s.stats.ch1Day)),"；最慢",Math.max(...done.map(s=>s.stats.ch1Day)));
const sum=k=>rows.reduce((a,s)=>a+s.stats.combos[k],0)/N;
console.log("每局組合",sum("try").toFixed(1),"次；學會",sum("learn").toFixed(1),"；碎片",sum("frag").toFixed(1),"；遭遇",(rows.reduce((a,s)=>a+s.stats.enc,0)/N).toFixed(1));
const firstTick={};rows.forEach(s=>Object.keys(s.needs).forEach(k=>{if(s.needs[k])count2(firstTick,k)}));function count2(o,k){o[k]=(o[k]||0)+1}
console.log("四項打勾的局數：",JSON.stringify(firstTick),"；撒逃跑粉（每局）",(powder/N).toFixed(1));
