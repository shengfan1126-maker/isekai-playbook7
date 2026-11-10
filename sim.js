/* sim.js：用 node 跑機器人玩家，看「365 天夠不夠」。用法：node sim.js [局數] */
const fs=require("fs"),vm=require("vm");
const ctx=vm.createContext({console,Math});
vm.runInContext(fs.readFileSync(__dirname+"/game.js","utf8")+"\nthis.G={newGame,planOf,exec,build,canBuild,canEvolve,evolve,sleep,failChoice,usePotion,get S(){return S},bpOf,HP_MAX,GRADES,gIdx,matchRecipe,hpUnit,matCount,MATS};",ctx);
const G=ctx.G;
function payBest(q,want){ // 付到 want 項，優先花 time、item、mp，最後 hp
  const p={hp:0,mp:0,time:0,item:0};let n=want;
  for(const k of ["time","mp","item","hp"]){const t=Math.min(n,q.caps[k]);p[k]=t;n-=t}
  return p;
}
function play(){
  G.newGame();const S=G.S;let guard=0;
  while(!S.over&&guard++<20000){
    if(S.pending){
      const t=S.pending.type;
      if(t==="failchoice"){G.failChoice(true);continue}
      const q=G.planOf(t==="boss"?"boss":"raid",{skill:S.skills.findIndex(s=>s.used<3)});
      const mx=q.caps.hp+q.caps.mp+q.caps.time+q.caps.item;
      G.exec(q,payBest(q,Math.min(q.bigAt,mx)));continue;
    }
    const b=G.canBuild();
    if(S.hp<G.HP_MAX(S.lv)*0.4||S.hour>=21){G.sleep();continue}
    if(G.canEvolve()){G.evolve();continue}
    if(b&&b.ok){G.build();continue}
    const pg=G.gIdx(S.lv);
    const needMat=b&&Object.entries(b.cost).some(([m,n])=>(S.mats[m]||0)<n);
    const gatherable=b&&["木材","石塊","藥草","骨頭"].some(m=>b.cost[m]&&(S.mats[m]||0)<b.cost[m]);
    const doGather=gatherable&&S.exist>=Math.floor(G.gIdx(S.lv)>=0?1:0)&&(S.day%2===0||S.exist>=10*2**pg*0.9);
    let q;
    if(gatherable&&(S.stats.actions.gather||0)<=(S.stats.actions.hunt||0)*1.5+2){q=G.planOf("gather",{skill:S.skills.findIndex(s=>s.used<3&&s.tags.includes("gather"))});}
    else{q=G.planOf("hunt",{g:Math.min(6,pg+1),skill:S.skills.findIndex(s=>s.used<3&&s.tags.includes("hunt"))});if(q.need>q.caps.hp+q.caps.mp+q.caps.time+q.caps.item||q.caps.hp<1&&q.need>1){q=G.planOf("hunt",{g:pg,skill:q.o.skill})}}
    const mx=q.caps.hp+q.caps.mp+q.caps.time+q.caps.item;
    G.exec(q,payBest(q,Math.min(q.need,mx)));
  }
  return S;
}
const N=+process.argv[2]||20;const rows=[];
for(let i=0;i<N;i++){const S=play();rows.push(S)}
const lvs=["F","E","D","C","B","A","S"];
console.log("局數",N);
console.log("結局：",rows.reduce((a,s)=>{const e=s.over?s.over.end:"未完";a[e]=(a[e]||0)+1;return a},{}));
console.log("據點達成天數（中位數）：",lvs.map(l=>{const d=rows.map(s=>s.stats.nestDay[l]).filter(Boolean).sort((a,b)=>a-b);return l+":"+(d.length?d[d.length>>1]:"-")+"("+d.length+"/"+N+")"}).join(" "));
console.log("自身進化天數（中位數）：",lvs.slice(1).map(l=>{const d=rows.map(s=>s.stats.lvDay[l]).filter(Boolean).sort((a,b)=>a-b);return l+":"+(d.length?d[d.length>>1]:"-")+"("+d.length+"/"+N+")"}).join(" "));
console.log("平均襲擊失敗數：",(rows.reduce((a,s)=>a+s.stats.raids.filter(r=>r.res==="fail").length,0)/N).toFixed(2));
console.log("狩獵 成功/大成功/失敗：",["ok","big","fail"].map(k=>rows.reduce((a,s)=>a+s.stats.hunts[k],0)).join("/"));
console.log("結束天數（中位數）：",rows.map(s=>s.day).sort((a,b)=>a-b)[N>>1]);
