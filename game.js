/* isekai-playbook7｜game.js：規則與狀態，不碰網頁元素（方便用 sim.js 在 node 裡跑）。
   所有 .js 共用同一個全域範圍；不用 import/export。 */
const VER="0.1";
const GRADES=["F","E","D","C","B","A","S"];
const gIdx=g=>Math.max(0,GRADES.indexOf(g||"F"));
const EXIST_MAX=lv=>20*2**gIdx(lv);
const BP_FLOOR=[1,16,31,46,61,76,91], BP_W=[14,14,14,14,14,14,8];
const HP_MAX=lv=>20+8*gIdx(lv);
const MP_MAX=6;
const DAYS=365, WAKE=6;
const SKILL_PER_DAY=3;
/* 蓋／升據點要的材料（索引＝目標據點等級 F..S） */
const NEST_COST=[{木材:5,石塊:4},{木材:12,石塊:10,魔核:2},{木材:22,石塊:22,獸皮:8,魔核:4},
  {木材:36,石塊:36,獸皮:16,魔核:8},{木材:54,石塊:54,獸皮:26,魔核:14},{木材:76,石塊:76,獸皮:40,魔核:22},{木材:104,石塊:104,獸皮:58,魔核:34}];
const MATS=["木材","石塊","獸皮","藥草","骨頭","魔核"];
const GATHERABLE=["木材","石塊","藥草","骨頭"];
const SELL={木材:1,石塊:1,獸皮:2,藥草:1,骨頭:1,魔核:5};
const BUY={木材:3,石塊:3,獸皮:6,藥草:4,骨頭:4,魔核:16,鐵劍:24,紅藥水:12};
const HOURS={gather:2,hunt:3,craft:2,build:3,upgrade:4,evolve:2,trade:1,fuse:4,potion:0,raid:0,boss:0};
const TAGOF={gather:"gather",hunt:"hunt",craft:"craft",fuse:"craft",build:"build",upgrade:"build",raid:"defense",boss:"defense"};
const ENEMY={F:["山鼠群","野狼","巨蜘蛛"],E:["狼群頭領","野豬人","食人魔幼體"],D:["石像鬼","半獸人戰團","巨熊"],
  C:["地獄犬群","巨魔","惡魔祭司"],B:["雙足飛龍","魔像","吸血鬼騎士"],A:["古龍幼體","巫妖","巨像"],S:["災厄巨龍","深淵君主","天使殘黨"]};
const BOSS="魔王（BP 99）";
const POOL=[
 {n:"撿拾",cls:"生存",tags:["gather"]},{n:"手巧",cls:"生存",tags:["craft"]},
 {n:"裝死",cls:"機動",tags:["defense"]},{n:"鈍感",cls:"生存",tags:["defense"]},
 {n:"夜視",cls:"機動",tags:["gather","hunt"]},{n:"耐餓",cls:"生存",tags:["gather"]},
 {n:"躲藏",cls:"機動",tags:["hunt","defense"]},{n:"敲敲打打",cls:"生存",tags:["craft","build"]},
 {n:"看天氣",cls:"機動",tags:["gather","defense"]},{n:"嗓門大",cls:"戰鬥",tags:["hunt","defense"]},
 {n:"蠻力",cls:"戰鬥",tags:["hunt"]},{n:"亂揮",cls:"戰鬥",tags:["hunt","defense"]}];
const FUSED={戰鬥:"亂戰本能",機動:"野獸直覺",生存:"荒野生活術"};
const RECIPES=[
 {id:"axe",need:["木材","石塊"],out:{n:"石斧",kind:"white"}},
 {id:"spear",need:["骨頭","木材"],out:{n:"骨矛",kind:"white"}},
 {id:"armor",need:["獸皮","獸皮"],out:{n:"皮甲",kind:"armor"}},
 {id:"potion",need:["藥草","藥草"],out:{n:"紅藥水",kind:"potion"}},
 {id:"amulet",need:["魔核","獸皮","石塊"],out:{n:"魔核護符",kind:"magic",tag:"defense"},nest:0},
 {id:"wand",need:["魔核","木材","骨頭"],out:{n:"魔核短杖",kind:"magic",tag:"hunt"},nest:0},
 {id:"lamp",need:["魔核","藥草"],out:{n:"魔核燈",kind:"magic",tag:"gather"},nest:0}];
const LETTER=`【管理員的信】
你好。我是這個世界的管理員。
這裡有七個階層：F、E、D、C、B、A、S。請努力把你的據點升到 S，也把你自己升到 BP 99。
365 天後，魔王會復活。到時候，沒準備好的人會被消滅。
我幫不了你。這個世界不會有人幫你，大部分人看到你就會厭惡你。對不起。
……祝你好運。`;
const TRAIT="孤獨：不得組隊、沒有人幫你、別人看到你就是厭惡（交易價格 ×2）。";

let S=null;
let rand=Math.random;
const rint=(a,b)=>a+Math.floor(rand()*(b-a+1));
const pick=a=>a[Math.floor(rand()*a.length)];
const bpOf=()=>{const i=gIdx(S.lv);return Math.round(BP_FLOOR[i]+BP_W[i]*S.exist/EXIST_MAX(S.lv))};
const nestIdx=()=>S.nest==null?-1:gIdx(S.nest);
const hpUnit=key=>Math.ceil(HP_MAX(S.lv)/4*(key?1.5:1))-(S.items.some(i=>i.kind==="armor")?1:0);
const matCount=()=>MATS.reduce((a,m)=>a+(S.mats[m]||0),0);
const log=(t,type)=>{S.log.push({day:S.day,hour:S.hour,t,type:type||""});if(S.log.length>300)S.log.shift()};
const count=(o,k,n)=>{o[k]=(o[k]||0)+(n==null?1:n)};

function newGame(){
  const pool=POOL.slice(), sk=[];
  for(let i=0;i<3;i++){const s=pool.splice(Math.floor(rand()*pool.length),1)[0];sk.push({n:s.n,cls:s.cls,tags:s.tags.slice(),lv:"F",used:0})}
  S={ver:VER,day:1,hour:WAKE,lv:"F",exist:0,hp:HP_MAX("F"),mp:MP_MAX,gold:0,
    skills:sk,items:[],mats:{},nest:null,pending:null,over:null,
    recipes:["axe","potion"],tried:[],log:[],
    stats:{nestDay:{},lvDay:{},actions:{},skillUse:{},itemUse:{},raids:[],hunts:{ok:0,big:0,fail:0},ooc:{add:0,remove:0,edit:0},crafted:{}}};
  log(LETTER,"letter"); log("你在一片荒野醒來。身上只有 3 個不起眼的技能。"+TRAIT);
  return S;
}

/* ───── 時間 ───── */
function dayRoll(voluntary){
  S.day++; S.hour=WAKE;
  S.skills.forEach(s=>s.used=0); S.itemUsed={};
  if(voluntary){S.hp=HP_MAX(S.lv);S.mp=MP_MAX}
  else{S.hp=Math.min(HP_MAX(S.lv),S.hp+Math.ceil(HP_MAX(S.lv)*0.3));S.mp=Math.min(MP_MAX,S.mp+3);log("你撐到天亮才倒下，睡得很差。")}
  log(`第 ${S.day} 天開始。`);
  if(S.day>DAYS&&!S.over&&!S.pending)S.pending={type:"boss"};
}
function advance(h){
  S.hour+=h;
  if(S.hour>=24)dayRoll(false);
}

/* ───── 判定（比照魔物篇：淨優勢→需要幾項代價） ───── */
function planOf(type,o){
  o=o||{};
  const pg=gIdx(S.lv);
  const q={type,o,hours:HOURS[type]||0,key:false,boss:false,eIdx:pg,base:0,notes:[],tag:TAGOF[type]};
  if(type==="gather"||type==="craft"){q.base=1;q.notes.push("日常工作 +1")}
  if(type==="craft"){const r=matchRecipe(o.mats||[]);q.recipe=r;q.base=r&&S.recipes.includes(r.id)?1:0;q.notes=[q.base?"已知配方 +1":"實驗，沒把握"];}
  if(type==="hunt"){q.eIdx=Math.max(0,Math.min(6,o.g==null?pg:o.g));const low=Math.min(2,Math.max(0,pg-q.eIdx));q.base=low;if(low)q.notes.push("對手較弱 +"+low)}
  if(type==="fuse"){q.eIdx=Math.min(6,gIdx(o.newLv||S.lv))}
  if(type==="raid"){q.key=true;q.eIdx=gIdx(S.pending.lv)}
  if(type==="boss"){q.key=true;q.boss=true;q.eIdx=7}
  let net=q.base;
  const diff=Math.max(0,q.eIdx-pg); if(diff){net-=diff;q.notes.push("階層差 −"+diff)}
  if(o.skill!=null){const sk=S.skills[o.skill];
    if(sk&&sk.used<SKILL_PER_DAY&&S.mp>=1){
      if(gIdx(sk.lv)>=Math.min(q.eIdx,pg+1)){net+=1;q.notes.push(sk.n+" +1")}else q.notes.push(sk.n+" 階層不夠，無效");
      if(sk.tags.includes(q.tag)){net+=1;q.notes.push("技能對路 +1")}
      q.useSkill=true;
    }else q.notes.push("技能今天用完或 MP 不足");
  }
  if(o.weapon&&S.items.some(i=>i.kind==="white")){net+=1;q.useWeapon=true;q.notes.push("消耗白色武器 +1")}
  if(o.magic!=null){const it=S.items[o.magic];
    if(it&&it.kind==="magic"&&!(S.itemUsed||{})[it.n]){net+=it.tag===q.tag?2:1;q.useMagic=it;q.notes.push(it.n+" +"+(it.tag===q.tag?2:1))}}
  if(q.key)net=Math.min(net,0);
  if(q.boss){const ex=2-(nestIdx()===6?1:0)-(S.lv==="S"&&bpOf()>=99?1:0);net-=ex;q.notes.push("魔王威壓 −"+ex)}
  q.net=net; q.need=Math.max(0,1-net); q.bigAt=q.need+1;
  const unit=hpUnit(q.key); q.unit=unit;
  q.caps={hp:Math.max(0,Math.min(3,Math.floor((S.hp-1)/unit))),
          mp:Math.max(0,Math.min(3,Math.floor((S.mp-(q.useSkill?1:0))/2))),
          time:3, item:Math.min(3,matCount())};
  return q;
}
function matchRecipe(ms){
  const a=ms.slice().sort().join();
  return RECIPES.find(r=>r.need.slice().sort().join()===a&&(r.nest==null||nestIdx()>=r.nest))||null;
}
/* 材料組合對得上、但還沒有據點，這種配方要先蓋據點才做得出來 */
function gatedRecipe(ms){
  const a=ms.slice().sort().join();
  return RECIPES.find(r=>r.need.slice().sort().join()===a&&r.nest!=null&&nestIdx()<r.nest)||null;
}
function sumPick(p){return (p.hp||0)+(p.mp||0)+(p.time||0)+(p.item||0)}

function payCosts(q,p,key){
  let note=[];
  if(p.hp){S.hp-=p.hp*q.unit;note.push(`HP −${p.hp*q.unit}`)}
  if(p.mp){S.mp-=p.mp*2;note.push(`MP −${p.mp*2}`)}
  if(p.time){q.hours+=p.time*2;note.push(`多花 ${p.time*2} 小時`)}
  for(let i=0;i<(p.item||0);i++){const m=["木材","石塊","藥草","骨頭","獸皮","魔核"].find(m=>S.mats[m]>0);if(m){S.mats[m]--;note.push("用掉 "+m)}}
  return note;
}
function addMat(m,n){if(n>0){S.mats[m]=(S.mats[m]||0)+n}}
function randMats(pool,n){const g={};for(let i=0;i<n;i++)count(g,pick(pool));return g}

/* 執行一個需要判定的行動，回傳 {res:'fail'|'ok'|'big', ...} */
function exec(q,p){
  p=p||{};
  const n=sumPick(p);
  const res=n<q.need?"fail":n<q.bigAt?"ok":"big";
  const out={type:q.type,res,n,need:q.need,big:q.bigAt,paid:[],gain:[],text:""};
  out.paid=payCosts(q,p);
  if(q.useSkill){const sk=S.skills[q.o.skill];S.mp-=1;sk.used++;count(S.stats.skillUse,sk.n)}
  if(q.useWeapon){const i=S.items.findIndex(i=>i.kind==="white");const it=S.items.splice(i,1)[0];out.paid.push("武器碎了："+it.n);count(S.stats.itemUse,it.n)}
  if(q.useMagic){S.itemUsed=S.itemUsed||{};S.itemUsed[q.useMagic.n]=1;count(S.stats.itemUse,q.useMagic.n)}
  count(S.stats.actions,q.type);
  const T={gather:"採集",hunt:"狩獵",craft:"製作",fuse:"整合",raid:"襲擊",boss:"魔王戰"}[q.type];
  const hp0=S.hp;
  if(q.type==="gather"){
    if(res==="fail"){S.hp=Math.max(1,S.hp-Math.ceil(q.unit/2));out.text="找了半天一無所獲，還被東西劃傷。"}
    else{const g=randMats(GATHERABLE,res==="big"?4:2);Object.entries(g).forEach(([m,c])=>{addMat(m,c);out.gain.push(m+"×"+c)});out.text="採集到了："+out.gain.join("、")}
  }else if(q.type==="hunt"){
    const en=pick(ENEMY[GRADES[q.eIdx]]);out.enemy=en+"（"+GRADES[q.eIdx]+"）";
    if(res==="fail"){S.hp=Math.max(1,S.hp-q.unit);S.stats.hunts.fail++;out.text=`${out.enemy}把你打退了。`}
    else{
      S.stats.hunts[res==="big"?"big":"ok"]++;
      const k=res==="big"?2:1;
      addMat("獸皮",rint(1,2)*k);out.gain.push("獸皮");addMat("骨頭",k);out.gain.push("骨頭");
      if(rand()<0.25+0.08*q.eIdx){addMat("魔核",k);out.gain.push("魔核")}
      const g=(1+2*q.eIdx)*k;S.gold+=g;out.gain.push("金幣"+g);
      const ex=q.eIdx>=gIdx(S.lv)-1?1+Math.max(0,q.eIdx-gIdx(S.lv))+(res==="big"?1:0):0;
      if(ex){S.exist=Math.min(EXIST_MAX(S.lv),S.exist+ex);out.gain.push("存在值+"+ex)}
      out.text=`打倒了${out.enemy}。`;
    }
  }else if(q.type==="craft"){
    const r=q.recipe, ms=q.o.mats||[];
    const known=!!(r&&S.recipes.includes(r.id));
    if(!known){const key=ms.slice().sort().join("＋");if(!S.tried.includes(key))S.tried.push(key)}
    if(res==="fail"){
      const f=ms.find(m=>S.mats[m]>0);if(f)S.mats[f]--;
      out.text="沒做成，浪費了一份材料。";
    }else if(!r){
      out.text="這幾樣湊不出東西。材料還在，你記下了這個組合。";
    }else{
      ms.forEach(m=>{S.mats[m]--});
      const it=Object.assign({lv:S.lv},r.out);S.items.push(it);count(S.stats.crafted,it.n);
      if(!S.recipes.includes(r.id)){S.recipes.push(r.id);out.text="第一次成功！"}
      out.gain.push(it.n);out.text+=`做出了${it.n}。`;
      if(res==="big"){const x=pick(["木材","石塊","藥草"]);addMat(x,1);out.gain.push(x+"（省下的）")}
    }
  }else if(q.type==="fuse"){
    if(res==="fail"){out.text="整合失敗，什麼也沒發生。"}
    else{
      const ids=q.o.fuse,old=ids.map(i=>S.skills[i]);
      const lv=GRADES[Math.min(6,gIdx(old[0].lv)+1)];
      const tags=[...new Set(old.flatMap(s=>s.tags))].slice(0,3);
      const ns={n:FUSED[old[0].cls],cls:old[0].cls,tags,lv,used:0};
      S.skills=S.skills.filter((_,i)=>!ids.includes(i));S.skills.push(ns);
      out.gain.push(`${ns.n}（${lv}）`);out.text=`三個技能合成了「${ns.n}」。`;
    }
  }else if(q.type==="raid"||q.type==="boss"){
    const eg=q.boss?7:q.eIdx;
    out.enemy=q.boss?BOSS:pick(ENEMY[GRADES[eg]])+"（"+GRADES[eg]+"）";
    if(res==="fail"){out.text=q.boss?"魔王一擊就把你消滅了。":`${out.enemy}攻破了你的據點。`;S.stats.raids.push({day:S.day,lv:S.pending.lv||"魔王",res:"fail"});S.pending={type:"failchoice",boss:q.boss}}
    else{
      S.hp=Math.max(1,S.hp-Math.ceil(q.unit/2));
      if(q.boss){S.over={end:"退休",day:S.day};out.text="你打倒了魔王。世界安靜了。你有一間房子可以退休。";S.pending=null}
      else{
        const ex=2*(1+Math.max(0,q.eIdx-gIdx(S.lv)))+(res==="big"?1:0);
        S.exist=Math.min(EXIST_MAX(S.lv),S.exist+ex);out.gain.push("存在值+"+ex);
        addMat("獸皮",2);addMat("魔核",res==="big"?2:1);out.gain.push("獸皮×2","魔核");
        S.stats.raids.push({day:S.day,lv:S.pending.lv,res});out.text=`擊退了${out.enemy}。`;S.pending=null;
      }
    }
  }
  out.hpLost=Math.max(0,hp0-S.hp)+ (p.hp||0)*q.unit;
  log(`[${T}] ${out.text}`+(out.gain.length?" 得到："+out.gain.join("、"):"")+(out.paid.length?"　代價："+out.paid.join("、"):""),"act");
  if(!S.over&&!(q.type==="raid"&&res==="fail")&&!(q.type==="boss"))advance(q.hours);
  else if(q.type==="boss"&&res==="fail"){}
  return out;
}

/* ───── 不需判定的行動 ───── */
function canBuild(){const t=S.nest==null?0:nestIdx()+1;if(t>6)return null;const c=NEST_COST[t];return {target:GRADES[t],cost:c,ok:Object.entries(c).every(([m,n])=>(S.mats[m]||0)>=n)}}
function build(){
  const b=canBuild();if(!b||!b.ok)return {err:"材料不夠"};
  Object.entries(b.cost).forEach(([m,n])=>S.mats[m]-=n);
  const first=S.nest==null;S.nest=b.target;count(S.stats.actions,first?"build":"upgrade");
  S.stats.nestDay[b.target]=S.day;
  log(`${first?"你在荒野蓋起了據點":"據點升級了"}：${b.target} 級。馬上有東西盯上了它。`,"act");
  S.pending={type:"raid",lv:b.target};
  advance(HOURS[first?"build":"upgrade"]);
  if(S.over)S.pending=null;
  return {ok:true};
}
function canEvolve(){return S.lv!=="S"&&S.exist>=EXIST_MAX(S.lv)}
function evolve(){
  if(!canEvolve())return {err:"存在值還沒滿"};
  S.lv=GRADES[gIdx(S.lv)+1];S.exist=0;S.hp=HP_MAX(S.lv);S.stats.lvDay[S.lv]=S.day;
  count(S.stats.actions,"evolve");log(`你進化了，現在是 ${S.lv} 級（BP ${bpOf()}）。`,"act");advance(HOURS.evolve);return {ok:true};
}
function sleep(){count(S.stats.actions,"sleep");log("你睡了一覺。");dayRoll(true);return {ok:true}}
function usePotion(i){
  const it=S.items[i];if(!it||it.kind!=="potion")return {err:"沒有藥水"};
  S.items.splice(i,1);S.hp=Math.min(HP_MAX(S.lv),S.hp+Math.ceil(HP_MAX(S.lv)/2));count(S.stats.itemUse,it.n);log("喝了紅藥水，傷好了一半。");return {ok:true}
}
const price=(item,sell)=>sell?SELL[item]:BUY[item]*2;   // 孤獨：別人看到你就是厭惡，買要貴一倍
function trade(kind,item,n){
  if(nestIdx()<2)return {err:"據點要 D 級以上才會有人肯跟你做生意"};
  n=n||1;
  if(kind==="sell"){if((S.mats[item]||0)<n)return {err:"你沒有那麼多"};S.mats[item]-=n;S.gold+=SELL[item]*n;log(`賣了 ${item}×${n}，得 ${SELL[item]*n} 金幣。`)}
  else{const c=BUY[item]*2*n;if(S.gold<c)return {err:"錢不夠（要 "+c+"）"};S.gold-=c;
    if(item==="鐵劍")S.items.push({n:"鐵劍",kind:"white",lv:S.lv});else if(item==="紅藥水")S.items.push({n:"紅藥水",kind:"potion",lv:S.lv});else addMat(item,n);
    log(`買了 ${item}×${n}，花 ${c} 金幣（對方一臉厭惡）。`)}
  count(S.stats.actions,"trade");advance(HOURS.trade);return {ok:true}
}
function failChoice(flee){
  const boss=S.pending&&S.pending.boss;
  if(!flee||boss){S.over={end:"死亡",day:S.day};S.pending=null;log("你死了。","end");return}
  S.nest=null;S.lv="F";S.exist=0;S.hp=HP_MAX("F");S.mp=MP_MAX;S.items=[];S.mats={};S.pending=null;
  count(S.stats.actions,"flee");log("據點毀了，你逃了出去，一切從 F 級重新開始。","end");advance(6);
}
/* OOC：更正 AI 的帳 */
function oocAdd(name,n){n=n||1;if(MATS.includes(name))addMat(name,n);else if(name==="金幣")S.gold+=n;else S.items.push({n:name,kind:"white",lv:S.lv});S.stats.ooc.add++;log(`[OOC] 補登 ${name}×${n}`,"ooc")}
function oocRemove(name,n){n=n||1;if(MATS.includes(name))S.mats[name]=Math.max(0,(S.mats[name]||0)-n);else if(name==="金幣")S.gold=Math.max(0,S.gold-n);else{const i=S.items.findIndex(x=>x.n===name);if(i>=0)S.items.splice(i,1)}S.stats.ooc.remove++;log(`[OOC] 撤銷 ${name}×${n}`,"ooc")}
function oocSet(field,v){if(field==="hp")S.hp=Math.max(1,Math.min(HP_MAX(S.lv),v));else if(field==="mp")S.mp=Math.max(0,Math.min(MP_MAX,v));else if(field==="gold")S.gold=Math.max(0,v);S.stats.ooc.edit++;log(`[OOC] ${field} 改成 ${v}`,"ooc")}
