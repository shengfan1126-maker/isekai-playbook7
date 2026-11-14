/* isekai-playbook7｜game.js：規則與狀態，不碰網頁元素（sim.js 可以在 node 裡跑）。依賴 data.js。
   第一章：求生（食物、火、水、避難所四項打勾）。第二章：據點（升級被襲擊、365 天魔王）。
   判定比照魔物篇：淨優勢 → 要付幾項代價；付夠成功、再多一項大成功；捨身＝拿傷殘換大成功。 */
const gIdx=g=>Math.max(0,GRADES.indexOf(g||"F"));
const EXIST_TBL=[10,40,90,150,220,300,400];
const EXIST_MAX=lv=>EXIST_TBL[gIdx(lv)];
const BP_FLOOR=[1,16,31,46,61,76,91], BP_W=[14,14,14,14,14,14,8];
const HP_BASE=lv=>20+8*gIdx(lv);
const MP_MAX=6, DAYS=365, WAKE=6;
const MP_BASE=lv=>MP_MAX+2*gIdx(lv);   /* v5.27：MP 跟著等級長（F 6、E 8、D 10、C 12、B 14、A 16、S 18）；HP 照舊 20＋8×級 */
const SKILL_PER_DAY=3, SKILL_SLOTS=9;
const STORE_MAX={F:20,E:25,D:30,C:35,B:40,A:50,S:50};
/* 據點升級要的點數（升到 E D C B A S）；捐物資換點數 */
const NEST_PTS=[0,20,80,250,500,900,1500];
const PTS_OF={獸皮:2,無名魔核:4,礦石:2,魔晶:8};const ITEM_PTS=3;
const FAC_SLOTS=lvIdx=>Math.min(6,lvIdx+1);
const SELL={木材:1,石片:1,草:1,獸皮:2,骨頭:1,生肉:1,熟肉:2,野果:1,無名魔核:5,礦石:3,魔晶:12};
const BUY={木材:3,石片:3,草:2,獸皮:6,骨頭:4,熟肉:5,無名魔核:16,鐵劍:24,紅藥水:14,藍藥水:14};
const HOURS={gather:2,explore:3,hunt:1,fight:1,retreat:1,craft:2,combo:1,shelter:2,rest:2,move:2,fuse:4,raid:0,boss:0};
const ACT_NAME={gather:"採集",explore:"探索",hunt:"狩獵",fight:"戰鬥",retreat:"撤退",craft:"製作",combo:"組合",shelter:"占用岩穴",rest:"休息",move:"移動",sleep:"睡覺",fuse:"整合",raid:"迎擊"};
const ACT_CAT={gather:"生存",explore:"機動",fight:"戰鬥",craft:"製作",retreat:"機動",shelter:"生存"};
const ITEM_E={木材:["木"],石片:["切割","硬化"],草:["木"],獸皮:["包覆"],骨頭:["硬化"],生肉:["木"],熟肉:["火"],野果:["木"],無名魔核:["魔力"],礦石:["土","硬化"],魔晶:["魔力","光"],
  石刀:["切割"],石斧:["切割","重量"],石矛:["切割"],鐵劍:["切割","硬化"],投石索:["移動"],短弓:["木","切割"],木盾:["木","硬化"],石袋:["土"],箭矢袋:["包覆"],
  皮甲:["包覆","硬化"],皮帽:["包覆"],草鞋:["木"],水袋:["水","包覆"],背包:["包覆"],草藥膏:["木"],紅藥水:["木","火"],藍藥水:["水","魔力"],紫藥水:["魔力"]};
const FUSED_NAME={魔法:"雜糅魔法",戰鬥:"亂戰技",生存:"荒野生活術",機動:"野獸直覺",製作:"工匠心得",社交:"話術",天生:"偷學心得"};
/* 捨身：拿一個部位的傷換大成功。同一個部位可以再傷（效果疊加）。據點 S 級後可以開發萬靈藥治好一處 */
const SCAR_PARTS=["眼睛","單手","腿","身體","心靈"];
const SCAR_D={眼睛:"視力受損，探索時間加倍",單手:"製作、組合（施法）時間加倍",腿:"移動時間加倍",身體:"HP 上限 −20%，睡覺也回不滿",心靈:"MP 上限 −1，睡覺也回不滿"};
const OLD_SCAR={左手:"單手",右手:"單手",左腿:"腿",右腿:"腿",左眼:"眼睛",肋骨:"身體",舊傷:"身體"};
const BAD_END_SCARS=3;   /* 打贏魔王時身上還有幾處捨身傷就是壞結局 */

let S=null;
let rand=Math.random;
const rint=(a,b)=>a+Math.floor(rand()*(b-a+1));
const pick=a=>a[Math.floor(rand()*a.length)];
const shuffle=a=>{const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b};
const uniq=a=>[...new Set(a)];
const count=(o,k,n)=>{o[k]=(o[k]||0)+(n==null?1:n)};
const log=(t,type)=>{S.logN=(S.logN||0)+1;S.log.push({day:S.day,hour:S.hour,t,type:type||"",n:S.logN});if(S.log.length>400)S.log.shift()};
const pg=()=>gIdx(S.lv);
const bpOf=()=>{const i=pg();return Math.round(BP_FLOOR[i]+BP_W[i]*S.exist/EXIST_MAX(S.lv))};
const scarN=p=>S.scars.filter(x=>x===p).length;
/* 身上魔法物品的被動效果（HP、MP 上限）不看對手等級 */
const mgCount=t=>S&&S.eq?SLOTS.map(k=>S.eq[k]).filter(it=>it&&it.mg&&it.mg.t===t).length:0;
const hpMax=()=>Math.max(5,Math.round(HP_BASE(S.lv)*Math.max(.2,1-.2*scarN("身體"))*(1+.2*mgCount("hp"))));
const mpMax=()=>Math.max(1,MP_BASE(S.lv)-scarN("心靈")+2*mgCount("mp"));
const hpSleepCap=()=>scarN("身體")?Math.floor(hpMax()*.8):hpMax();
const mpSleepCap=()=>scarN("心靈")?Math.max(1,mpMax()-1):mpMax();
const placeOf=n=>PLACES.find(p=>p.n===(n||S.at));
const allSkills=()=>S.skills.concat(S.store);
const owned=n=>allSkills().some(s=>s.n===n);
const skillBy=n=>S.skills.find(s=>s.n===n)||itemSkills().find(s=>s.n===n);
const usesLeft=s=>SKILL_PER_DAY-s.today;
const matCount=()=>MATS.reduce((a,m)=>a+(S.mats[m]||0),0);
const foodCount=()=>FOODS.reduce((a,m)=>a+(S.mats[m]||0),0);
const addMat=(m,n)=>{if(n>0)S.mats[m]=(S.mats[m]||0)+n};
const hasItem=k=>S.items.some(i=>i.k===k);
const hasWeapon=()=>!!(S.eq&&S.eq.武器);
const hpUnit=key=>Math.max(1,Math.ceil(hpMax()/4*(key&&!(S.eq&&mgOn("fort").length)?1.5:1)*(S.eq?dmgMult():1)));
const nestIdx=()=>S.nest==null?-1:gIdx(S.nest);
const bagMax=()=>Infinity;   /* v5.15：異世界人專屬，背包沒有上限 */
const bagFull=()=>false;
const bagWord=()=>`${S.items.length}/∞`;
/* 存在值滿了自動進化，多出來的帶到下一級；進化當下 HP、MP 回滿 */
const gainExist=n=>{S.exist+=n;autoEvolve();return n};
/* v5.10：玩家等級＝據點到過的最高等級（搬家、被攻破都不掉）；第一章還沒有據點＝F。
   存在值只在同一級裡把 BP 推高；滿了就提示去升據點。 */
const nestMax=()=>S.ch>=2?Math.max(0,...Object.keys((S.stats&&S.stats.nestDay)||{}).map(gIdx),nestIdx()):0;
const lvCap=nestMax;
function autoEvolve(){
  const t=nestMax();
  while(gIdx(S.lv)<t){S.lv=GRADES[gIdx(S.lv)+1];if(S.stats.lvDay[S.lv]==null)S.stats.lvDay[S.lv]=S.day;
    S.hp=hpMax();S.mp=mpMax();S.capNote=0;log(`★ 據點到了 ${S.lv} 級，你也跟著進化：現在是 ${S.lv} 級（BP ${bpOf()}），HP、MP 回滿。`,"good")}
  if(S.exist>=EXIST_MAX(S.lv)){S.exist=EXIST_MAX(S.lv);
    if(!S.capNote&&S.lv!=="S"){S.capNote=1;log(S.ch<2?"存在值滿了。先蓋草棚（或占岩穴）、建立據點，再提升據點等級，你才會變強。":`存在值滿了（BP ${bpOf()}，這一級的頂）。提升據點等級，你才會變強。`,"bad")}}
  if(S.lv==="S")S.exist=Math.min(S.exist,EXIST_MAX("S"));
}

/* ───── 開局 ───── */
function newGame(){
  const sk=shuffle(START_POOL).slice(0,3).map(s=>mkSkill(s,"F"));
  S={ver:VER,ch:1,day:1,hour:WAKE,lv:"F",exist:0,hp:0,mp:MP_MAX,gold:0,
    skills:sk,had:sk.map(s=>s.n),store:[],items:[],mats:{},at:"林邊空地",places:["林邊空地"],
    needs:{食物:false,火:false,水:false,避難所:false},fire:false,shelterAt:null,
    tags:{飢餓:false,會冷:false,疾病:0},scars:[],thirst:0,drank:false,
    seen:[],frags:[],enc:null,pending:null,over:null,nest:null,base:null,log:[],pts:0,fac:[],facPick:null,raid:null,bases:[],
    eq:{},rel:{},langs:[],cleared:[],dun:{},maze:{best:0},traded:{},uniqBought:{},
    stats:{actions:{},skillUse:{},combos:{try:0,learn:0,frag:0},enc:0,ch1Day:null,nestDay:{},lvDay:{},raids:[],ooc:{add:0,remove:0,edit:0}}};
  SLOTS.forEach(k=>S.eq[k]=null);S.hp=hpMax();
  for(let i=0;i<2;i++)S.items.push(mkItem("逃跑粉","escape"));   /* v5.13：開場送 2 包逃跑粉 */
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
/* v5.4：名字用的字一樣（手巧／巧手、岩火彈／火岩彈）就算重複 */
const charKey=n=>[...String(n)].sort().join("");
function nameTaken(n){const k=charKey(n);return S.skills.concat(S.store).some(s=>s.n===n||charKey(s.n)===k)}
function mkSkill(t,lv){return {n:t.n,e:t.e.slice(),c:t.c.slice(),lv:lv||"F",used:0,today:0,d:t.d||""}}
function learnSkill(t,lv){
  if(owned(t.n)||nameTaken(t.n))return "已經會了";
  const s=mkSkill(t,lv);markHad(t.n);
  if(S.skills.length<SKILL_SLOTS){S.skills.push(s);return "技能表"}
  if(S.store.length<STORE_MAX[S.lv]){S.store.push(s);return "倉庫"}
  return "滿了";
}
/* v5.23：學過的技能（整合、捐、賣、忘掉之後也算），實驗、靈光一閃不會再出 */
function markHad(n){S.had=S.had||[];if(!S.had.includes(n))S.had.push(n)}
function hadSkill(n){return (S.had||[]).includes(n)}
function lvUp(s){const cap=Math.min(6,pg()+1);const i=gIdx(s.lv);if(i<cap){s.lv=GRADES[i+1];return true}return false}
function useSkill(s,out){
  if(s.fromItem){s.fromItem.use=(s.fromItem.use||0)+1;return}
  s.today++;s.used++;count(S.stats.skillUse,s.n);
  if(s.used%10===0&&lvUp(s)){const m=`【${s.n}】用了 ${s.used} 次，進化成 ${s.lv}。`;out.lines.push(m);log(m,"good")}
}

/* ───── 求生 ───── */
function tick(need,why,out){
  if(S.needs[need])return;
  S.needs[need]=true;if(need==="避難所"&&!S.shelterAt)S.shelterAt=S.at;if(need==="火")S.fire=true;
  const m=`✔ ${need}：${why}`;out&&out.lines.push(m);log(m,"good");
  checkChapter();
}
function checkChapter(){
  /* v5.6：第一章只要有避難所（草棚或岩穴）就能建立據點；食物、火、水不擋關，只影響身體 */
  if(S.ch===1&&S.needs.避難所&&S.shelterAt&&S.at===S.shelterAt&&!S.pending&&!S.ch1Offered){
    S.ch1Offered=true;log(`你有了能落腳的地方（${S.at}）。按選單「建立據點」，就在這裡建立據點、進入第二章。`,"good");   /* v5.18：不自動過關 */
  }
}
/* 一個成功的效果（本質＋形態）能滿足哪些需求 */
function applyEffect(eff,out){
  if(!eff)return;
  const has=x=>eff.e.includes(x);
  if(eff.g&&eff.g!=="避難所")tick(eff.g,`「${eff.n}」`,out);   /* v5.18：技能不算避難所 */
  if(has("火")||eff.f==="點火")tick("火","你弄出了火",out);
  if(has("水"))tick("水","你有了水",out),S.drank=true;
  /* v5.17：技能堆的土牆不算避難所（不能建立據點）；要蓋草棚或占岩穴 */
}

/* ───── 遭遇 ───── */
function startEncounter(out,amb){
  const en=rollPlaceEnemy();if(amb)en.amb=1;S.enc=en;S.stats.enc++;
  const msg=`${amb?"突襲！":""}遭遇：${en.n}（${en.lv} 級${en.e.length?"・"+en.e.join(""):""}${en.r?"・遠程":""}）。`;out.lines.push(msg);log(msg,"bad");
  /* v5.19：不再記「看過的魔物技巧」（偷學改成拆解拿魔核） */

}

/* ───── 判定 ───── */
/* 不用判定、一定成功的行動（v5.17：探索、占岩穴也是） */
const NOJUDGE=["move","rest","hunt","sleep","explore","shelter"];
/* intent：{act, skills:[名], obj:{t:'place'|'item'|'seen'|'enemy'|'none', n}, move, goal, craft, adv:[], dis:[], weapon} */
function planOf(it){
  it=it||{};
  const act=it.act,q={act,it,notes:[],key:false,boss:false,eIdx:pg(),base:0,mand:{mp:0},err:null};
  const sks=(it.skills||[]).map(skillBy).filter(Boolean);
  q.sks=sks;
  /* v5.1：大賢者拆出來的步驟（只用在一般遭遇；升級戰、魔王戰維持舊規則） */
  if(act==="fight"&&Array.isArray(it.steps)&&it.steps.length&&S.enc&&!S.enc.raid)q.art=artCheck(it.steps);
  if(act==="combo"){
    if(!sks.length)q.err="組合至少要選 1 個技能";
    if(sks.length>3)q.err="一次最多 3 個技能";
    if(sks.some(s=>usesLeft(s)<1))q.err="有技能今天用完了";
    q.mand.mp=sks.filter(s=>!s.fromItem).length;if(S.mp<q.mand.mp)q.err=`MP 不夠（組合要 ${q.mand.mp}）`;
    if(!MOVES.some(m=>m.n===it.move))q.err=q.err||"要選一個手法";
  }
  if(act==="craft"){const r=RECIPES.find(x=>x.n===it.craft);q.recipe=r;
    if(!r)q.err="沒有這個配方";else if(r.sh&&!baseable(S.at))q.err=`${S.at}不能蓋草棚當據點（要在野外，或打下來的敵對據點）`;else if(r.cook&&!S.needs.火)q.err="要先有火（先做出火種）";else if(r.tag&&!hasTag(r.tag))q.err=`要有帶「${r.tag}」的技能`;else if(!["skill","shelter","food"].includes(r.k)&&bagFull()&&!(GEAR[r.n]&&!S.eq[GEAR[r.n].slot]))q.err=`背包滿了（${bagMax()} 件）`;else if(!Object.entries(r.need).every(([m,n])=>(S.mats[m]||0)>=n))q.err="材料不夠";
    q.base=1;}
  if(act==="gather"||act==="explore")q.base=1;
  if(act==="gather"&&!(placeOf().res||[]).length)q.err="這裡沒什麼好採的";
  if(act==="retreat")q.base=1;
  if(act==="shelter"){if(!placeOf().cave)q.err="這裡沒有能占用的岩穴";else if(!baseable(S.at))q.err=`${S.at}不能當據點（敵對據點要先打下來），岩穴占了也沒用`;q.base=0}
  if(["fight","retreat"].includes(act)&&!S.enc)q.err="現在沒有遭遇";
  if(S.enc&&["fight","retreat","combo"].includes(act)){q.eIdx=S.enc.king?7:gIdx(S.enc.lv);if(S.enc.raid)q.key=q.raid=true}
  if(q.raid&&act==="retreat"&&S.raid&&S.raid.kind==="boss")q.err="魔王戰逃不掉";
  let net=q.base;if(q.base)q.notes.push(act==="craft"?"會做的東西 +1":"日常 +1");
  const diff=Math.max(0,q.eIdx-pg());if(diff){net-=diff;q.notes.push("階層差 −"+diff)}
  if(!["combo","hunt","move","rest"].includes(act)&&sks[0]&&!q.art){const s=sks[0];
    if(usesLeft(s)<1||(!s.fromItem&&S.mp<1))q.notes.push(`【${s.n}】今天用完或 MP 不足，無效`);
    else{q.useSkill=s;q.mand.mp=s.fromItem?0:1;
      if(s.fromItem||gIdx(s.lv)>=Math.min(q.eIdx,pg()+1)){net+=1;q.notes.push(`【${s.n}】+1${s.fromItem&&q.eIdx>gIdx(s.lv)&&S.enc?"（物品比對手低：打完會壞）":""}`)}else q.notes.push(`【${s.n}】階層不夠`);
      if(ACT_CAT[act]&&s.c.includes(ACT_CAT[act])){net+=1;q.notes.push("技能對路 +1")}}}
  if(q.raid){const d=S.enc.dis||0,b=Math.min(d,facBlock());
    if(d){net-=d-b;q.notes.push(`多打一 −${d}${b?`（設施擋掉 ${b}）`:""}`)}
    if(S.raid&&S.raid.i<watchN()){net+=1;q.notes.push("哨塔先看到 +1")}}
  if(S.enc&&["fight","combo"].includes(act))q.foe=S.enc.king?7:gIdx(S.enc.lv);
  net+=gearBonus(q,act,q.art?q.art.skills:q.useSkill?[q.useSkill]:sks);
  if(!["move","rest","hunt","sleep"].includes(act))net+=useBonus(q,act);   /* v5.16：鍛冶台打造的用途物品 */
  if(q.art){q.mand.mp=q.art.mp;
    if(q.art.cut){net+=q.art.cut;q.notes.push(`新用法 ${q.art.novel} 步${q.art.novel>q.art.cut?`（放進 ${q.art.nSrc} 樣東西，最多抵 ${q.art.nSrc}）`:""} +${q.art.cut}`)}
    else q.notes.push("組合裡沒有新用法（照本來的用法出手）");}
  const adv=Math.min(2,(it.adv||[]).length),dis=Math.min(2,(it.dis||[]).length);
  if(adv){net+=adv;q.notes.push(`優勢（${it.adv.slice(0,2).join("、")}）+${adv}`)}
  if(dis){net-=dis;q.notes.push(`劣勢（${it.dis.slice(0,2).join("、")}）−${dis}`)}
  const judged=!NOJUDGE.includes(act),B=S.buff||{};
  if(judged&&B.first){net+=1;q.notes.push("睡在木屋，今天第一件事 +1");q.useFirst=1}
  if(q.key)net=Math.min(net,0);
  q.net=net;q.need=Math.max(0,1-net)+(q.approach||0);q.bigAt=q.need+1;
  if(judged&&B.fight&&S.enc&&["fight","retreat","combo"].includes(act)&&q.need>0){q.need--;q.bigAt=q.need+1;q.notes.push("睡在魔晶館：第一場戰鬥少付 1 項");q.useFight=1}
  if(judged&&B.all&&q.need>0){q.need--;q.bigAt=q.need+1;q.notes.push("睡在魔晶殿：今天每件事少付 1 項")}
  if(q.luck&&q.need>0){q.need--;q.bigAt=q.need+1;q.notes.push(`${q.luck.n}：好運，少付 1 項`)}else q.luck=null;
  if(q.useFree&&q.need>0){q.need=0;q.bigAt=1;q.notes.push(`${q.useFree.n}：今天第一次，這件事不用付代價`)}else q.useFree=null;
  if(q.smash&&q.need>=1){q.bigAt=q.need;q.notes.push("雙手破壞力：大成功少付 1 項")}
  q.unit=hpUnit(q.key);
  const mpLeft=S.mp-q.mand.mp;
  const pl=payables(q),units=(q.raid?0:matCount())+pl.filter(x=>x.t!=="mat").length;
  q.caps={hp:Math.max(0,Math.min(3,Math.floor((S.hp-1)/q.unit))),mp:Math.max(0,Math.min(3,Math.floor(mpLeft/2))),time:q.raid?(q.speed?Math.min(3,mgUses(q.speed)):0):3,item:Math.min(q.raid?1:3,units)};
  q.hours=HOURS[act]||0;if(act==="craft"&&q.recipe&&q.recipe.sh)q.hours=4;
  if(act==="move"&&S.eq&&S.eq.鞋子)q.hours=Math.max(1,q.hours-1);
  if((act==="move"||act==="explore")&&mgOn("move").length)q.hours=Math.max(1,Math.ceil(q.hours/2));
  if(act==="explore"&&mgOn("fly").length)q.hours=Math.max(1,q.hours-1);
  if(act==="gather"&&mgOn("gather").length)q.hours=1;
  if(act==="craft"&&mgOn("craft").length)q.hours=Math.max(1,Math.ceil(q.hours/2));
  const slow={explore:"眼睛",craft:"單手",combo:"單手",move:"腿"}[act];
  if(slow&&scarN(slow)){q.hours*=1+scarN(slow);q.notes.push(`${slow}的傷：時間 ×${1+scarN(slow)}`)}
  q.judge=!NOJUDGE.includes(act);
  return q;
}
const sumPick=p=>(p.hp||0)+(p.mp||0)+(p.time||0)+(p.item||0);
function payCosts(q,p,out){
  if(p.hp){if(S.buff&&S.buff.hurt){S.buff.hurt=0;out.paid.push(`受傷（石屋睡飽，這次不扣 HP）`)}else{S.hp-=p.hp*q.unit;out.paid.push(`HP −${p.hp*q.unit}`)}}
  if(p.mp){S.mp-=p.mp*2;out.paid.push(`MP −${p.mp*2}`)}
  if(p.time){q.hours+=p.time*2;out.paid.push(`多花 ${p.time*2} 小時`)}
  if(p.item){const list=(p.items&&p.items.length?p.items:autoPay(q,p.item)).slice(0,p.item);payItemList(q,list,out)}
}

/* ───── 執行 ───── */
function exec(q,p){
  p=p||{};
  const out={act:q.act,res:"ok",lines:[],paid:[],gain:[]};
  if(q.err){out.res="err";out.lines.push(q.err);return out}
  if(p.shesh&&q.raid&&S.raid&&S.raid.shesh){out.res="err";out.lines.push("這場升級戰已經捨身過一次了。");return out}
  if(q.judge){
    if(p.shesh&&q.raid&&S.raid)S.raid.shesh=1;
    if(p.shesh){out.res="big";const part=SCAR_PARTS.includes(p.shesh)?p.shesh:pick(SCAR_PARTS);S.scars.push(part);count(S.stats,"shesh");
      out.paid.push(`捨身：${part}（${SCAR_D[part]}）`);S.hp=Math.min(S.hp,hpMax());S.mp=Math.min(S.mp,mpMax());}
    else if(p.dance&&q.dance){out.res="ok";q.dance.danced=1;out.lines.push(`${q.dance.n}自己飛了出去，替你擋下這一面。`)}
    else{const n=sumPick(p);out.res=n<q.need?"fail":n<q.bigAt?"ok":"big";payCosts(q,p,out);if(q.speed&&p.time)q.speed.use=(q.speed.use||0)+p.time}
  }
  if(q.judge&&S.buff){if(q.useFirst)S.buff.first=0;if(q.useFight)S.buff.fight=0}
  if(q.mand.mp)S.mp-=q.mand.mp;
  if(q.useSkill)useSkill(q.useSkill,out);
  if(q.art){q.art.skills.forEach(s=>useSkill(s,out));q.art.mats.forEach(m=>{S.mats[m]=Math.max(0,(S.mats[m]||0)-1);out.paid.push(`${m} −1（拿來組合）`)});
    out.lines.push("組合："+q.art.res.map(r=>`${r.say||r.head}${r.ok?(r.novel?"（新用法）":""):`（沒用：${r.why}）`}`).join("；")+"。");
    if(q.art.idle.length)out.lines.push(q.art.idle.join("、")+"，沒能發動。");artPick(q,out);}
  if(q.act==="combo")q.sks.forEach(s=>useSkill(s,out));
  count(S.stats.actions,q.act);
  const P=placeOf();
  if(P.water&&out.res!=="fail"){S.drank=true;tick("水","這裡有水",out)}
  const R={gather:doGather,explore:doExplore,hunt:doHunt,fight:doFight,retreat:doRetreat,craft:doCraft,combo:doCombo,shelter:doShelter,rest:doRest,move:doMove}[q.act];
  if(R)R(q,out);
  if(q.foe!=null)afterFight(q,out);
  if(q.luck&&q.judge)q.luck.use=(q.luck.use||0)+1;
  if(q.useFree&&q.judge)q.useFree.free=S.day;
  if(S.hp<=0&&!S.over){die(out,"你倒下了，再也沒有起來。");}
  const T=ACT_NAME[q.act]||q.act;
  const resWord={fail:"失敗",ok:"成功",big:"大成功"}[out.res]||"";
  log(`[${T}${q.judge?"・"+resWord:""}] ${out.lines.join(" ")}${out.gain.length?" 得到："+out.gain.join("、"):""}${out.paid.length?"　代價："+out.paid.join("、"):""}`,"act");
  if(!S.over&&!["raid","boss"].includes(q.act))advance(q.hours);
  return out;
}
function die(out,why,noRevive){
  if(!noRevive&&!S.raid&&!S.over){const h=reviveSpot();if(h){if(h.main)S.baseRev=true;else h.rev=true;
    S.hp=Math.ceil(hpMax()/2);S.at=h.at;S.enc=null;const m=`${why}……你在${h.at}的${houseName(h.lv)}醒了過來（這間只能救你一次）。`;out&&out.lines.push(m);log(m,"good");return}}
  if(S.raid)S.stats.raids.push({day:S.day,lv:S.raid.kind,res:"dead",won:S.raid.won,lost:S.raid.lost});
  S.over={end:"死亡",day:S.day};S.pending=null;S.enc=null;S.raid=null;out&&out.lines.push(why);log(why,"end")}

function doGather(q,out){
  const P=placeOf();
  if(out.res==="fail"){S.hp=Math.max(1,S.hp-Math.ceil(q.unit/2));out.lines.push("找了半天沒什麼收穫，還被劃傷了。");return}
  const n=out.res==="big"?4:2;const g={};
  /* v5.13：第一章還沒有避難所時，第一份一定是草棚還缺、這裡又有的材料（不會卡在第一章） */
  let first=null;if(S.ch===1&&!S.needs.避難所){const sh=RECIPES.find(r=>r.n==="草棚");first=Object.keys(sh.need).find(m=>P.res.includes(m)&&(S.mats[m]||0)<sh.need[m])||null}
  for(let i=0;i<n;i++)count(g,i===0&&first?first:pick(P.res));
  Object.entries(g).forEach(([m,c])=>{addMat(m,c);out.gain.push(`${m}×${c}`)});
  out.lines.push(`在${P.n}採集。`);
  if(q.useSkill)applyEffect({e:q.useSkill.e,f:"感知",n:q.useSkill.n},out);
}
/* 探索：越強走得越遠（F～E 只找得到近的，D～C 中，B 以上遠） */
const KIND_WORD={wild:"",village:"村落",hostile:"敵對據點",dungeon:"地城",maze:"迷宮"};
function doExplore(q,out){   /* v5.17：探索必成功；還有沒去過的地方就一定找到 */
  const ring=pg()<=1?0:pg()<=3?1:2;
  const left=PLACES.filter(p=>!S.places.includes(p.n)&&(p.ring||0)<=ring);
  if(left.length){
    const w=left.find(p=>p.water&&!S.places.some(n=>placeOf(n).water));
    const np=w&&rand()<.7?w:pick(left);S.places.push(np.n);S.at=np.n;out.gain.push(`存在值+${gainExist(1)}`);
    if(np.kind==="village"&&S.rel[np.race]==null)S.rel[np.race]=rand()<.5?-1:-2;
    const kw=KIND_WORD[np.kind]||"";
    out.lines.push(`找到新地點：${np.n}（${kw?kw+"・":""}${np.e.join("・")}${np.water?"，有水":""}${np.cave?"，有岩穴":""}）。你走了過去。`+
      (np.kind==="village"?`${np.race}看到你就皺眉（${REL_WORD[S.rel[np.race]]}）。`:np.kind==="hostile"?"裡面有敵人，可以突襲。":np.kind==="dungeon"||np.kind==="maze"?np.d:""));
  }else out.lines.push(left.length?"走了一圈，沒找到新地方。":ring<2?"附近能走的都走遍了，變強一點才走得更遠。":"能走的地方都走遍了。");
  if(placeOf().kind!=="village"&&rand()<.3)startEncounter(out,true);   /* 探索途中被撞見＝被突襲 */
}
function doHunt(q,out){
  const k=placeOf().kind;if(k==="village"){out.lines.push("村子裡不能打獵。");return}
  out.lines.push(`你在${S.at}附近找獵物。`);startEncounter(out)}
function loot(out,big,extra){   /* extra：獵人、逆轉多拿的那一份，只有東西，不再給存在值 */
  const en=S.enc,ei=gIdx(en.lv),k=big?2:1;
  addMat("生肉",k);addMat("獸皮",1);addMat("骨頭",1);out.gain.push(`生肉×${k}`,"獸皮","骨頭");
  if(rand()<.15+.08*ei){addMat("無名魔核",1);out.gain.push("無名魔核")}
  if(!extra)monGold(en.lv,out);   /* v5.26 */
  if(!extra){queueLoot(en,big?2:1);out.lines.push(`可以拆解${en.n}了（${big?"三選二":"三選一"}）。`)}   /* v5.15 */
  const ex=!extra&&ei>=pg()-1?1+Math.max(0,ei-pg())+(big?1:0):0;
  if(ex)out.gain.push(`存在值+${gainExist(ex)}`);
}
function doFight(q,out){
  const en=S.enc;
  if(out.res==="fail"){const d=takeHit(q.unit,out);out.lines.push(`${en.n}把你打退了。${d?`HP −${d}`:""}`);if(en.raid)return raidStep(false,out);S.enc=null;return}
  if(en.raid){out.lines.push(`擋下了${en.n}。`);return raidStep(true,out)}
  out.lines.push(`打倒了${en.n}。`);
  if(en.nest||en.dun||en.maze)specialWin(en,out,out.res==="big");else{loot(out,out.res==="big");if(out.res==="big"&&mgOn("vorpal").length){out.lines.push("逆轉：一擊收尾，多拿一份。");loot(out,false,true)}
    if(mgOn("hunter").length){out.lines.push("獵人的手法，多剝下一份。");loot(out,false,true)}}S.enc=null;
}
function doRetreat(q,out){
  const en=S.enc;
  if(en.raid){if(out.res==="fail"){const d=Math.min(S.hp-1,Math.ceil(q.unit*1.5));S.hp-=d;out.lines.push(`你逃了，但被${en.n}追上。HP −${d}`)}
    S.stats.raids.push({day:S.day,lv:S.raid.kind,res:"retreat",won:S.raid.won,lost:S.raid.lost});count(S.stats.actions,"flee");
    S.raid=null;S.enc=null;out.lines.push(`你放棄據點逃走。${en.n}佔了據點。`);S.pending={type:"failchoice",why:"retreat"};return}
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
  if(r.sh){S.shelterAt=S.at;tick("避難所",`在${S.at}搭起了草棚`,out);checkChapter();return}
  if(r.cook){addMat("熟肉",1);out.gain.push("熟肉");return}
  gainItem(r.k==="gear"?mkGear(r.n,S.lv):mkItem(r.n,r.k,S.lv),out);
  if(r.water)tick("水","有水袋就能把水帶在身上",out);
  if(out.res==="big"){addMat("石片",1);out.gain.push("石片（省下的）")}
}
function doShelter(q,out){
  out.lines.push("你清空了岩穴，擋得住風雨。");S.shelterAt=S.at;tick("避難所","占用了岩穴",out);checkChapter();
}
function doRest(q,out){const h=Math.ceil(hpMax()*.2);S.hp=Math.min(hpMax(),S.hp+h);out.lines.push(`休息了一下，HP +${h}。`)}
function doMove(q,out){const to=q.it.place;if(to&&S.places.includes(to)){S.at=to;const P=placeOf(to);out.lines.push(`走到${to}${KIND_WORD[P.kind]?`（${KIND_WORD[P.kind]}）`:""}。`)}else out.lines.push("沒有移動。")}

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
const buyMult=()=>mgCount("merchant")?.75:1,sellMult=()=>mgCount("merchant")?1.5:1;
function addFrag(sks,m,all,extraCat){
  const cats=uniq(sks.flatMap(s=>s.c).concat([FORM_CAT[m.f]]).concat(extraCat?[extraCat]:[]));
  S.frags.push({cats,e:all.slice(0,3)});S.stats.combos.frag++;
  return `碎片（${cats.join("・")}）`;
}
function doCombo(q,out){
  const sp=SLOTS.map(k=>S.eq[k]).find(it=>it&&it.mg&&it.mg.t==="spark"&&(it.use||0)<3);
  if(sp){const before=S.frags.length;doCombo0(q,out);if(S.frags.length>before){const f=S.frags[S.frags.length-1];S.frags.push({cats:f.cats.slice(),e:f.e.slice()});sp.use=(sp.use||0)+1;out.gain.push(`靈光：多一片碎片（${f.cats.join("・")}）`)}return}
  doCombo0(q,out);
}
function doCombo0(q,out){
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
    out.gain.push(`【${t.n}】`,`存在值+${gainExist(1)}`);S.stats.combos.learn++;log(`靈光一閃：學會【${t.n}】`,"good");
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
      const en=S.enc,hit=m.f==="威懾"||["投射","附加","領域","強化"].includes(m.f);
      if(en.raid){out.lines.push(hit?`這一招擋下了${en.n}。`:`這一招擋不住${en.n}。`);if(!hit){const d=takeHit(q.unit,out);if(d)out.lines.push(`HP −${d}`)}return raidStep(hit,out)}
      if(m.f==="威懾"){out.lines.push(`${en.n}被嚇跑了。`);S.enc=null}
      else if(hit){out.lines.push(`這一招打倒了${en.n}。`);if(en.nest||en.dun||en.maze)specialWin(en,out,out.res==="big");else loot(out,out.res==="big");S.enc=null}
    }
  }else if(S.enc){const d=takeHit(q.unit,out);out.lines.push(`${S.enc.n}趁機撲上來。${d?`HP −${d}`:""}`);if(S.enc.raid)return raidStep(false,out)}
}
/* ───── v5.2：專心鍛鍊、專心實驗（戰鬥外，不叫 AI） ───── */
function drill(s,n,lines){
  for(let k=0;k<n;k++){s.used++;count(S.stats.skillUse,s.n);
    if(s.used%10===0&&lvUp(s)){const m=`【${s.n}】用了 ${s.used} 次，進化成 ${s.lv}。`;lines.push(m)}}
}
function calmErr(){
  if(S.over)return "遊戲結束了";if(S.enc||S.raid)return "戰鬥中不能專心練";if(S.pending)return "先處理上面的事";
  if(S.hour+1>=24)return "太晚了，先睡吧";return null;
}
/* 專心鍛鍊：一小時練一次，扣今天的一次次數、熟練 +2，練到次數用完（或指定的次數、或快半夜） */
function train(name,max){
  const e=calmErr();if(e)return {err:e};
  const s=S.skills.concat(S.store).find(x=>x.n===name);if(!s)return {err:`技能表和倉庫裡都沒有【${name}】`};
  if(usesLeft(s)<1)return {err:`【${s.n}】今天的次數用完了`};
  const lines=[],u0=s.used,lv0=s.lv;let h=0;
  while(usesLeft(s)>0&&S.hour+h+1<24&&(!max||h<max)){s.today++;h++;drill(s,2,lines)}
  count(S.stats.actions,"train");
  log(`[專心鍛鍊] 【${s.n}】練了 ${h} 小時，熟練 ${u0}→${s.used}${s.lv!==lv0?`，${lv0}→${s.lv}`:`（下次進化在 ${Math.ceil((s.used+1)/10)*10}）`}。${usesLeft(s)<1?"今天的次數用完了。":""}`,"act");
  lines.forEach(m=>log(m,"good"));
  advance(h);return {ok:true,h};
}
/* 碎片兌換：3 片同大類 → 同大類三選一；10 片任意 → 任意三選一 */
function fragCounts(){const c={};S.frags.forEach(f=>f.cats.forEach(x=>count(c,x)));return c}
function canExchange(){const c=fragCounts();return {cats:Object.keys(c).filter(k=>c[k]>=3),any:S.frags.length>=10}}
/* 天生：看過、還沒偷學的魔物技巧，用人類方式替換出來的版本 */
function stealPool(){
  const out=[];
  S.seen.filter(sn=>!sn.used).forEach(sn=>{const subs=PART_SUB[sn.part]||{};
    Object.entries(subs).forEach(([mv,suf])=>{const m=MOVES.find(x=>x.n===mv);const nm=(sn.e[0]||"")+suf;
      if(m&&!owned(nm))out.push({n:nm,e:sn.e.slice(),c:uniq([FORM_CAT[m.f],"天生"]),f:m.f,d:`偷學${sn.from}的「${sn.n}」，用人類的方式做出來。`,steal:sn.n})})});
  return out;
}
function drawChoices(cat){
  const names=[],out=[];
  const add=list=>shuffle(list).forEach(x=>{if(out.length<3&&!names.includes(x.n)&&!owned(x.n)&&!nameTaken(x.n)){names.push(x.n);out.push(x)}});
  if(cat==="天生"||!cat)add(stealPool());
  add(COMBOS.filter(x=>!cat||x.c.includes(cat)));
  if(out.length<3&&cat&&!owned(FUSED_NAME[cat]||cat+"心得")){
    const es=uniq(S.frags.filter(f=>f.cats.includes(cat)).flatMap(f=>f.e)).slice(0,2);
    add([{n:FUSED_NAME[cat]||cat+"心得",c:[cat],e:es.length?es:["生長"],d:"碎片累積下來的心得。"}]);
  }
  if(out.length<3)add(COMBOS.concat(stealPool()));   /* 這一類抽光了：用別類補滿 3 個 */
  return out;
}
function exchange(cat,choice){
  if(cat){let k=0;S.frags=S.frags.filter(f=>{if(k<3&&f.cats.includes(cat)){k++;return false}return true})}
  else S.frags.splice(0,10);
  if(choice.steal){const sn=S.seen.find(x=>x.n===choice.steal);if(sn)sn.used=true}
  const where=learnSkill(choice,"F");gainExist(1);
  log(`碎片兌換：學會【${choice.n}】${where==="倉庫"?"（放進倉庫）":""}`,"good");
  const out={lines:[]};applyEffect({e:choice.e,f:choice.f||"",n:choice.n,g:choice.g},out);
  return where;
}
/* 整合：同大類、同階 3 個 → 高一階 1 個 */
function fuse(idx){   /* v5.20：idx 可以是技能表的編號，或 "skills|i"、"store|i"（倉庫也能勾） */
  const ref=x=>{const [w,i]=String(x).includes("|")?String(x).split("|"):["skills",x];return (w==="store"?S.store:S.skills)[+i]};
  const a=idx.map(ref);
  if(a.length!==3||a.some(x=>!x))return {err:"要選 3 個"};
  const cat=CATS.concat(["天生"]).find(c=>a.every(s=>s.c.includes(c)));
  if(!cat)return {err:"要同大類"};
  if(new Set(a.map(s=>s.lv)).size>1)return {err:"要同階"};
  const lv=GRADES[Math.min(6,gIdx(a[0].lv)+1)];
  let n=FUSED_NAME[cat],k=2;while(owned(n))n=FUSED_NAME[cat]+"・"+(k++);
  const ns={n,e:uniq(a.flatMap(s=>s.e)).slice(0,3),c:[cat],d:`由${a.map(s=>s.n).join("、")}整合而成。`};
  S.skills=S.skills.filter(s=>!a.includes(s));S.store=S.store.filter(s=>!a.includes(s));
  if(S.skills.length<SKILL_SLOTS)S.skills.push(mkSkill(ns,lv));else S.store.push(mkSkill(ns,lv));
  count(S.stats.actions,"fuse");log(`整合：${a.map(s=>s.n).join("＋")} → 【${n}】（${lv}）`,"good");advance(HOURS.fuse);
  return {ok:true,n};
}
function swapSkill(from,i){
  if(from==="skills"){if(!S.skills[i])return;if(S.store.length>=STORE_MAX[S.lv])return {err:"倉庫滿了"};S.store.push(S.skills.splice(i,1)[0])}
  else{if(!S.store[i])return;if(S.skills.length>=SKILL_SLOTS)return {err:"技能表滿了（9 格）"};S.skills.push(S.store.splice(i,1)[0])}
  advance(1);return {ok:true};
}

/* ───── v5.6：吃、烤（背包裡點了就做） ───── */
const FOOD_HP={熟肉:.3,野果:.1,生肉:.1};
function eatFood(m){
  if(!FOOD_HP[m])return {err:"這個不能吃"};if(!(S.mats[m]>0))return {err:`沒有${m}`};
  if(S.enc||S.raid)return {err:"戰鬥中不能吃東西"};
  S.mats[m]--;S.ateToday=true;S.tags.飢餓=false;
  const g=Math.max(1,Math.ceil(hpMax()*FOOD_HP[m])),h0=S.hp;S.hp=Math.min(hpMax(),S.hp+g);
  let t=`吃了${m}，HP ${h0}→${S.hp}。`;
  if(m==="生肉"&&!S.needs.火&&rand()<.5){S.tags.疾病=3;t+="肚子不對勁（疾病）。"}
  log(t);tick("食物","找到吃的了");return {ok:true};
}
function cookMeat(){
  if(!S.needs.火)return {err:"要先有火（先做出火種）"};if(!(S.mats.生肉>0))return {err:"沒有生肉"};
  if(S.enc||S.raid)return {err:"戰鬥中不能烤肉"};if(S.hour+1>=24)return {err:"太晚了，先睡吧"};
  S.mats.生肉--;addMat("熟肉",1);log("烤了一塊肉（生肉 → 熟肉），花了 1 小時。");advance(1);return {ok:true};
}

/* ───── v5.8：房子（據點＝避難所）、移動、直接製作、逃跑粉 ───── */
const houseName=lv=>(HOUSES.find(h=>h.lv===lv)||{}).n||"房子";
const houses=()=>S.houses||(S.houses=[]);
const hasTag=t=>S.skills.concat(S.store).some(s=>s.e.includes(t));
/* 這裡有沒有能睡的房子：主據點（等級＝據點等級）、別處蓋的房子、第一章的草棚或岩穴 */
function houseAt(at){
  if(S.ch>=2&&S.base===at)return {at,lv:S.nest,main:true};
  const h=houses().find(x=>x.at===at);if(h)return h;
  if(S.ch===1&&S.shelterAt===at)return {at,lv:"F",ch1:true};
  return null;
}
function homeAt(){return S.ch>=2?S.base:S.shelterAt}
function wakeBuff(H){
  const L=gIdx(H.lv),got=[];
  if(L>=1){S.buff.first=1;got.push("第一件事 +1")}
  if(L>=2){S.buff.hurt=1;got.push("第一次受傷不扣 HP")}
  if(L>=3){S.mp=mpSleepCap()+2;got.push("MP 多 2")}
  if(L>=4){S.buff.fight=1;got.push("第一場戰鬥少付 1 項")}
  if(L>=6){S.buff.all=1;got.push("今天每件事少付 1 項")}
  return `在${H.at}的${houseName(H.lv)}（${H.lv}）睡飽了${got.length?"："+got.join("、"):""}。`;
}
function reviveSpot(){
  const L=[];if(S.ch>=2&&S.base&&gIdx(S.nest)>=5&&!S.baseRev)L.push({at:S.base,lv:S.nest,main:true});
  houses().filter(h=>gIdx(h.lv)>=5&&!h.rev).forEach(h=>L.push(h));return L[0]||null;
}
/* 別處能蓋到幾級：主據點 −1（主據點 F 級時不能蓋，可以搬家） */
const houseCap=()=>S.ch>=2?nestIdx()-1:-1;
function canHouseHere(){
  if(S.ch<2)return "第二章（建立據點）之後才能在別處蓋房子";
  if(houseCap()<0)return "主據點 F 級時不能在別處蓋房子（可以搬家）；主據點升到 E 級，別處就能蓋草棚";
  if(S.at===S.base)return "這裡是主據點（升級主據點用點數）";
  if(!baseable(S.at))return "這裡不能蓋（要在野外，或打下來的敵對據點）";
  if(S.enc||S.raid)return "戰鬥中不能蓋";
  return true;
}
const halfCost=c=>{const o={};Object.entries(c).forEach(([m,n])=>{const k=Math.floor(n/2);if(k)o[m]=k});return o};
const costWord=c=>Object.entries(c).map(([m,n])=>`${m}×${n}`).join("、");
const lacks=c=>Object.entries(c).filter(([m,n])=>(S.mats[m]||0)<n).map(([m,n])=>`${m}×${n-(S.mats[m]||0)}`);
function buildHouse(lv){
  const ok=canHouseHere();if(ok!==true)return {err:ok};
  const d=HOUSES.find(h=>h.lv===lv);if(!d)return {err:"沒有這一級"};
  if(gIdx(lv)>houseCap())return {err:`別處最高只能蓋 ${GRADES[houseCap()]} 級（主據點 −1）`};
  const old=houses().find(h=>h.at===S.at);if(old&&old.lv===lv)return {err:"這裡已經是這一級了"};
  const miss=lacks(d.cost);if(miss.length)return {err:"還差 "+miss.join("、")};
  const hrs=4+gIdx(lv);if(S.hour+hrs>=24)return {err:`要 ${hrs} 小時，今天來不及了`};
  Object.entries(d.cost).forEach(([m,n])=>S.mats[m]-=n);
  let back="";if(old){const r=halfCost(HOUSES.find(h=>h.lv===old.lv).cost);Object.entries(r).forEach(([m,n])=>addMat(m,n));back=r&&Object.keys(r).length?`，拆掉原本的${houseName(old.lv)}拿回 ${costWord(r)}`:"";old.lv=lv;old.rev=false}
  else houses().push({at:S.at,lv,rev:false});
  count(S.stats.actions,"house");log(`[蓋房子] 在${S.at}蓋了${d.n}（${lv}）${back}。${d.d}`,"act");advance(hrs);return {ok:true};
}
function razeHouse(){
  const i=houses().findIndex(h=>h.at===S.at);if(i<0)return {err:"這裡沒有你蓋的房子"};
  if(S.enc||S.raid)return {err:"戰鬥中不能拆"};
  const h=houses()[i],r=halfCost(HOUSES.find(x=>x.lv===h.lv).cost);houses().splice(i,1);
  Object.entries(r).forEach(([m,n])=>addMat(m,n));log(`[拆房子] 拆了${S.at}的${houseName(h.lv)}，拿回 ${costWord(r)||"一點點東西"}。`,"act");advance(1);return {ok:true};
}
function retire(){
  if(S.ch<2||S.nest!=="S")return {err:"主據點 S 級才能蓋魔晶豪宅"};if(S.at!==S.base)return {err:"要在主據點"};
  if(S.enc||S.raid)return {err:"戰鬥中不行"};const miss=lacks(MANSION.cost);if(miss.length)return {err:"還差 "+miss.join("、")};
  Object.entries(MANSION.cost).forEach(([m,n])=>S.mats[m]-=n);
  log(`你在${S.base}蓋好了魔晶豪宅，住了進去。異世界的日子，到這裡就夠了。（退休結局，第 ${S.day} 天）`,"end");
  S.over={end:"退休",day:S.day};S.pending=null;return {ok:true};
}
/* 快速移動：到自己的房子（主據點、別處的房子、第一章的避難所）只要 1 小時 */
function myHouses(){const L=[];const hm=homeAt();if(hm)L.push(houseAt(hm));houses().forEach(h=>{if(h.at!==hm)L.push(h)});return L.filter(Boolean)}
function travel(to,thenSleep){
  if(S.enc||S.raid)return {err:"戰鬥中不能走"};if(S.pending)return {err:"先處理上面的事"};
  if(!to)return {err:S.ch>=2?"還沒有據點":"還沒有避難所（先蓋草棚或占岩穴）"};
  if(!myHouses().some(h=>h.at===to))return {err:"只能快速移動到自己的房子"};
  if(S.at!==to){const h=1*(1+scarN("腿"));S.at=to;count(S.stats.actions,"move");log(`[快速移動] 回到${to}（${h} 小時）。`,"act");
    if(thenSleep){S.hour+=h;if(S.hour>=24){night(false);return {ok:true}}}else advance(h)}
  else if(!thenSleep)return {err:"你就在這裡"};
  if(thenSleep)sleep();return {ok:true};
}
/* 直接製作：不用選技能、不付代價、一定成功，只花時間 */
const recipeShown=r=>(!r.tag||hasTag(r.tag))&&!(r.ch1&&S.ch>=2);
function craftDirect(n){
  const r=RECIPES.find(x=>x.n===n);if(!r)return {err:"沒有這個配方"};if(!recipeShown(r))return {err:r.tag?`要有帶「${r.tag}」的技能`:"現在不能做"};
  if(S.enc||S.raid)return {err:"戰鬥中不能做東西"};if(S.pending)return {err:"先處理上面的事"};
  const q=planOf({act:"craft",craft:n});if(q.err)return {err:q.err};
  if(S.hour+q.hours>=24)return {err:`要 ${q.hours} 小時，今天來不及了，先睡吧`};
  const out={act:"craft",res:"ok",lines:[],paid:[],gain:[]};doCraft(q,out);count(S.stats.actions,"craft");
  log(`[製作] ${out.lines.join(" ")}${out.gain.length?" 得到："+out.gain.join("、"):""}（${q.hours} 小時）`,"act");advance(q.hours);return {ok:true};
}
/* 逃跑粉：一般遭遇直接脫身 */
function useEscape(){
  const i=S.items.findIndex(x=>x.k==="escape");if(i<0)return {err:"沒有逃跑粉"};
  if(!S.enc)return {err:"現在沒有遭遇"};if(S.enc.raid||S.raid)return {err:"升級戰、魔王戰不能用逃跑粉"};
  const n=S.enc.n;S.items.splice(i,1);S.enc=null;count(S.stats.actions,"escape");log(`[撤退] 撒出逃跑粉，趁${n}看不清楚時脫身了。（沒付代價）`,"act");advance(1);return {ok:true};
}
/* 鍛鍊也能練倉庫裡的技能 */

/* ───── 時間與夜晚 ───── */
function advance(h){if(typeof bagEgg==="function")bagEgg();S.hour+=h;if(S.hour>=24&&!S.over&&!S.raid)night(false)}
function night(voluntary){
  const lines=[];if(!voluntary&&mgCount("calm")){voluntary=true;lines.push("安眠：倒下就睡著了，睡得很好。")}
  /* 吃 */
  const f=["熟肉","野果","生肉"].find(m=>S.mats[m]>0);
  if(S.ateToday){S.tags.飢餓=false}
  else if(mgCount("thrift")&&S.day%2===0){S.tags.飢餓=false;lines.push("節食：今天不用吃。")}
  else if(f){S.mats[f]--;S.tags.飢餓=false;
    if(f==="生肉"){if(S.needs.火)lines.push("烤了肉吃。");else if(rand()<.5){S.tags.疾病=3;lines.push("吃了生肉，肚子不對勁（疾病）。")}else lines.push("硬吞了生肉。")}
    else lines.push(`吃了${f}。`)}
  else{S.tags.飢餓=true;lines.push("沒有東西吃（飢餓）。")}
  /* 喝 */
  if(S.needs.水||S.drank||(S.items.some(i=>i.n==="水袋"))||mgCount("spring")){S.thirst=0}
  else{S.thirst++;lines.push(`今天沒喝到水（口渴 ${S.thirst}/3）。`)}
  if(S.thirst>=3){die(null,"三天沒喝水，你倒下了。",true);return}
  /* 冷 */
  const H=houseAt(S.at);
  S.tags.會冷=!H&&!S.needs.火;
  if(H&&S.tags.疾病>0){S.tags.疾病=0;lines.push("在屋子裡好好休養，病好了。")}
  if(S.tags.會冷){S.hp-=2;lines.push("夜裡很冷（會冷），HP −2。")}
  if(S.tags.疾病>0){S.hp-=1;S.tags.疾病--;lines.push("病還沒好，HP −1。")}
  if(S.hp<=0){die(null,"你在夜裡倒下了。");if(S.over)return}
  /* 睡 */
  let cap=hpSleepCap();if(S.tags.飢餓)cap=Math.min(cap,Math.ceil(hpMax()/2));
  /* v5.8：在房子裡睡才睡得飽；野外只回一半 */
  const gain=voluntary?(H?cap:Math.ceil(hpMax()*.5)):Math.ceil(hpMax()*.3);
  S.hp=Math.max(S.hp,Math.min(cap,S.hp+gain));
  S.mp=voluntary?(H?mpSleepCap():Math.min(mpSleepCap(),S.mp+Math.ceil(mpMax()*.5))):Math.min(mpSleepCap(),S.mp+3);
  if(!voluntary)lines.push("撐到天亮才倒下，睡得很差。");
  else if(!H)lines.push("在野外睡，只睡了半飽（回據點或房子睡才睡得飽）。");
  if(foodCount()>=5)tick("食物","存糧夠吃好幾天了");
  const fl=facDay();if(fl)lines.push(fl);
  S.day++;S.hour=WAKE;S.drank=false;S.ateToday=false;
  S.buff={};if(H){const w=wakeBuff(H);if(w)lines.push(w)}
  S.skills.concat(S.store).forEach(s=>s.today=0);S.expToday=0;S.itemUsed={};
  S.items.concat(SLOTS.map(k=>S.eq[k]).filter(Boolean)).forEach(it=>{if(it.use)it.use=0;if(it.danced)it.danced=0});S.burst=0;
  log(lines.join(" "));
  log(`天亮了，你醒了。這是你異世界一人生存的第 ${S.day} 天。今天要做什麼？`,"day");
  if(S.day>DAYS&&!S.over&&!S.pending)S.pending={type:"boss"};
  checkChapter();
}
function sleep(){count(S.stats.actions,"sleep");log("你睡了。");night(true);return {ok:true}}

/* ───── 第二章：據點 ───── */
const baseable=n=>{const P=placeOf(n);return !!P&&(P.kind==="wild"||(P.kind==="hostile"&&(S.cleared||[]).includes(P.n)))};
function startCh2(here){
  if(here&&S.shelterAt&&S.at!==S.shelterAt){log(`據點要建在你的避難所那裡（${S.shelterAt}）。先回去，或在這裡蓋草棚、占岩穴。`);S.pending=null;return}   /* v5.17 */
  if(here&&!baseable(S.at)){log(`${S.at}不能當據點（要在野外，或打下來的敵對據點）。先走到別的地方再從選單建立據點。`);S.pending=null;return}
  S.pending=null;
  if(!here){log("你決定先不定下來。（隨時可以從選單建立據點）");return}
  S.stats.ch1Day=S.day;gainExist(3);log("第一章完成。存在值 +3。","good");
  S.ch=2;S.nest="F";S.base=S.at;S.bases=[S.at];S.stats.nestDay.F=S.day;S.pts=S.pts||0;S.fac=S.fac||[];
  log(`你在${S.at}建立了 F 級據點。第二章開始。捐物資換點數升級據點；每升一級，你的異香會引來大軍攻城。365 天後魔王（BP 99）復活。`,"good");
  offerFac();autoEvolve();
}
/* 點數 */
const ptsOf=m=>PTS_OF[m]||1;
/* 同一個小時連續捐，合併成一行紀錄 */
function logDonate(what,p){const l=S.log[S.log.length-1];
  if(l&&l.don&&l.day===S.day&&l.hour===S.hour){l.don.p+=p;what.forEach(([n,k])=>l.don.m[n]=(l.don.m[n]||0)+k)}
  else{const d={p,m:{}};what.forEach(([n,k])=>d.m[n]=(d.m[n]||0)+k);log("");S.log[S.log.length-1].don=d}
  const L=S.log[S.log.length-1];L.t=`捐給據點：${Object.entries(L.don.m).map(([n,k])=>`${n}×${k}`).join("、")}，點數 +${L.don.p}（現在 ${S.pts}）。`}
const devoteMult=()=>mgCount("devote")?1.5:1;
function donate(m,n){n=Math.min(n,S.mats[m]||0);if(n<1)return {err:"沒有"};S.mats[m]-=n;const p=Math.ceil(n*ptsOf(m)*devoteMult());S.pts+=p;logDonate([[m,n]],p);return {ok:true}}
function donateItem(i){const it=S.items[i];if(!it)return {err:"沒有"};S.items.splice(i,1);const p=Math.ceil(ITEM_PTS*devoteMult());S.pts+=p;logDonate([[it.n,1]],p);return {ok:true}}
/* 捐到夠升下一級：先捐骨頭、獸皮、無名魔核，再木材、石片、草，最後才是食物（留 5 份） */
function donateToNext(){const b=canBuild();if(!b||S.pts>=b.need)return {err:"已經夠了"};
  const order=["骨頭","獸皮","無名魔核","木材","石片","草",...FOODS];
  for(const m of order){if(S.pts>=b.need)break;const keep=FOODS.includes(m)?Math.max(0,5-(foodCount()-(S.mats[m]||0))):0;
    let have=(S.mats[m]||0)-Math.max(0,keep);if(have<1)continue;const n=Math.min(have,Math.ceil((b.need-S.pts)/ptsOf(m)));if(n>0)donate(m,n)}
  return S.pts>=b.need?{ok:true}:{err:`還差 ${b.need-S.pts} 點`}}
function canBuild(){if(S.ch<2||S.nest==null)return null;const t=nestIdx()+1;if(t>6)return null;
  return {target:GRADES[t],need:NEST_PTS[t],ok:S.pts>=NEST_PTS[t]&&!S.raid&&!S.enc}}
function build(){
  const b=canBuild();if(!b||!b.ok)return {err:"點數不夠"};
  S.pts-=b.need;S.nest=b.target;if(S.stats.nestDay[b.target]==null)S.stats.nestDay[b.target]=S.day;count(S.stats.actions,"upgrade");
  log(`據點升到 ${b.target} 級。你的異香傳得更遠了。`,"act");autoEvolve();
  startRaid(b.target);return {ok:true};
}
/* 設施 */
const facDef=n=>FAC.find(f=>f.n===n);
const facOn=()=>(S.fac||[]).filter(f=>f.s);
const facMatch=f=>!!(f.s&&f.s.c.includes(facDef(f.n).cat));
/* 放了該族專屬技能（例：鍛冶台放矮人符文） */
const facRace=f=>{const d=facDef(f.n);return !!(f.s&&d.race&&RACES[d.race]&&f.s.n===RACES[d.race].sk.n)};
function facBlock(){let b=facOn().length;const fe=facOn().find(f=>f.n==="柵欄");if(fe)b+=(facMatch(fe)?2:1)+(facRace(fe)?1:0);if(S.eq&&uniqOn("block"))b+=1;return b}
function watchN(){const w=facOn().find(f=>f.n==="哨塔");return w?(facMatch(w)?3:2)+(facRace(w)?1:0):0}
function offerFac(){
  if(S.ch<2||S.facPick||(S.fac||[]).length>=FAC_SLOTS(nestIdx()))return;
  const left=FAC.filter(f=>!S.fac.some(x=>x.n===f.n));if(!left.length)return;
  S.facPick=shuffle(left).slice(0,3).map(f=>f.n);
}
function pickFac(n){if(!S.facPick||!S.facPick.includes(n))return {err:"不能選"};S.fac.push({n,s:null,t:0});S.facPick=null;log(`蓋好了【${n}】。放一個技能進去它才會運作。`,"good");offerFac();return {ok:true}}
function facPut(fi,si){const f=S.fac[fi],s=S.skills[si];if(!f||!s)return {err:"沒有"};
  S.skills.splice(si,1);if(f.s)facBack(f.s);f.s=s;f.t=0;log(`把【${s.n}】放進${f.n}${facMatch(f)?"（對口）":""}。`);advance(1);return {ok:true}}
function facOut(fi){const f=S.fac[fi];if(!f||!f.s)return;const s=f.s;f.s=null;facBack(s);log(`把【${s.n}】從${f.n}拿回來。`);advance(1);return {ok:true}}
function facItem(it){if(bagFull()){S.pts+=ITEM_PTS;return `${it.n}（背包滿了，直接捐給據點 +${ITEM_PTS} 點）`}S.items.push(it);return it.n}
function facBack(s){if(S.skills.length<SKILL_SLOTS)S.skills.push(s);else S.store.push(s)}
function facDay(){
  const out=[];
  facOn().forEach(f=>{const k=gIdx(f.s.lv)+1,m=facMatch(f),rc=facRace(f),every=m?2:3;
    if(f.n==="農田"){const n=k*(m?2:1)*(rc?2:1);addMat("野果",n);out.push(`農田 野果×${n}`)}
    else if(f.n==="修練場"){if(++f.t>=(rc?2:every)){f.t=0;   /* v5.13：碎片退場，修練場改成「想通一次」＝三選一 */
      if(S.pick){const v=pickPts();S.pts+=v;out.push(`修練場 心得（三選一還沒選，化成據點點數 +${v}）`)}
      else{openPick("修練場",[f.s],f.s.e.slice());out.push(`修練場 想通了一件事（三選一）`)}}}
    else if(f.n==="鍛冶台"){if(++f.t>=(rc?2:m?3:4)){f.t=0;out.push(`鍛冶台 ${facItem(genMagic(GRADES[Math.max(0,nestIdx())]))}`)}}
    else if(f.n==="藥草園"){if(++f.t>=(m?3:4)){f.t=0;f.k=f.k==="藍藥水"?"紅藥水":"藍藥水";out.push(`藥草園 ${facItem(mkItem(f.k,"potion"))}`);if(rc)out.push(`藥草園 ${facItem(mkItem("紫藥水","potion"))}`)}}});
  {const fo=forgeDay();if(fo)out.push(fo)}
  return out.length?"據點產出："+out.join("、")+"。":"";
}
/* 升級戰：一連串的戰鬥。輸超過上限＝據點被攻破；中途逃走＝放棄據點 */
function startRaid(kind){
  const P=RAID_PLAN[kind],list=[],dirs=shuffle(DIRS);
  if(P.rounds){const m=pick(RAID_MON[P.mon]);for(let i=0;i<P.rounds;i++)list.push({n:m.n,lv:P.mon,t:m.t,dis:0,dir:`第 ${i+1} 回合`})}
  else if(kind==="boss"){/* 六個方位，每個方位一支軍團＋一隻 S 級魔物一起來，最後是魔王 */
    for(let i=0;i<6;i++){const m=pick(RAID_MON.S),a=pick(ARMIES);list.push({n:`${a.n}＋${m.n}`,army:0,lv:"S",e:uniq(a.e.concat(m.e||[])),r:a.r||m.r||0,t:m.t,dis:Math.floor(ARMY_DIS.S)+1,dir:dirs[i]})}
    list.push({n:"魔王",lv:"S",king:1,e:KING.e.slice(),t:{n:"魔王威壓",e:["魔力"]},dis:Math.floor(ARMY_DIS.S)+2,dir:"正面"})}
  else{const tg=kind;
    for(let i=0;i<P.army;i++){const v=ARMY_DIS[tg],d=Math.floor(v+rand()),more=d>Math.floor(v),a=pick(ARMIES);list.push({n:a.n,lv:tg,army:1,e:a.e.slice(),r:a.r||0,t:{n:"人海",e:[]},dis:d,dir:dirs[i%dirs.length]+(more?"（這一面人特別多）":"")})}
    P.mon.forEach(g=>{const m=pick(RAID_MON[g]);list.push({n:m.n,lv:g,e:(m.e||[]).slice(),r:m.r||0,t:m.t,dis:Math.floor(ARMY_DIS[tg])-1,dir:pick(DIRS)})});
}
  /* 某一面被突破：敵人衝到身邊（遠程要付代價拉開距離）。一般升級戰 1 場，魔王戰 2 場；魔王那場不算 */
  const cand=list.map((b,i)=>i).filter(i=>!list[i].king&&!list[i].r);
  shuffle(cand).slice(0,kind==="boss"?2:1).forEach(i=>{list[i].brk=1;list[i].dir+="（這一面被突破，敵人衝進來了）"});
  S.raid={kind,i:0,lost:0,won:0,max:Math.floor((list.length-1)/2),list};  /* 輸掉一半就被攻破 */S.stats.enc++;
  log(kind==="boss"?`第 365 天過去了。魔王復活，帶著大軍朝你來了：一共 ${list.length} 場。`:`襲擊！大軍從各方位朝據點壓過來：一共 ${list.length} 場，輸 ${S.raid.max+1} 場據點就被攻破。`,"bad");
  nextBattle();
}
function nextBattle(){const R=S.raid,b=R.list[R.i];S.enc=Object.assign({raid:true},b);
  log(`第 ${R.i+1}/${R.list.length} 場：${b.dir}，${b.n}（${b.lv}${b.king?"・BP 99":""}）${b.army?"，大軍壓過來":`，牠會「${b.t.n}」（獨特技巧，學不來）`}。`,"bad")}
function raidStep(win,out){
  const R=S.raid,b=R.list[R.i];S.enc=null;
  if(win&&out.res==="big"&&R.lost>0&&mgOn("vorpal").length){R.lost--;out.lines.push("逆轉：這一擊抵銷了之前輸掉的一場。")}
  if(win&&!b.army&&!b.king)monGold(b.lv,out);   /* v5.26：升級戰的魔物也給金幣 */
  if(win&&!b.army&&!b.king&&R.list.slice(R.i+1).every(x=>x.army||x.king)){queueLoot(b,out.res==="big"?2:1);out.lines.push(`打完可以拆解${b.n}。`)}   /* v5.15：升級戰的頭目也能拆解 */
  if(win){R.won++;const ex=1+Math.max(0,(b.king?7:gIdx(b.lv))-pg())+(out.res==="big"?1:0);out.gain.push(`存在值+${gainExist(ex)}`)}
  else{R.lost++;out.lines.push(`這一場輸了（${R.lost}/${R.max}）。`)}
  if(S.hp<=0&&R.kind==="boss")return;            /* 魔王戰倒下＝死 */
  const down=S.hp<=0;if(down){S.hp=1;out.lines.push("你倒下了，被大軍拖出了據點。")}
  if(down||R.lost>R.max||(b.king&&!win)){
    S.stats.raids.push({day:S.day,lv:R.kind,res:"fail",won:R.won,lost:R.lost});S.raid=null;
    out.lines.push(R.kind==="boss"?"你擋不住了。":"據點被攻破了。");S.pending={type:"failchoice",boss:R.kind==="boss"};return}
  R.i++;
  if(R.i<R.list.length){nextBattle();return}
  S.stats.raids.push({day:S.day,lv:R.kind,res:"ok",won:R.won,lost:R.lost});S.raid=null;
  if(R.kind==="boss"){
    /* 三種結局（用戶 11-11）：壞＝捨身傷 3 處以上；好＝和 1 個以上聚落有貿易關係；其他＝普通 */
    const tr=tradeRaces();let msg;
    if(S.scars.length>=BAD_END_SCARS){S.over={end:"壞結局・收藏品",day:S.day};
      msg=`你打倒了魔王。可是你的身體也廢了（${S.scars.join("、")}）。世人很快就忘了是誰救了這個世界。管理員來接你，把你放進他的收藏櫃，給了你一個位置。`}
    else if(tr.length){S.over={end:"好結局・一起守護",day:S.day};
      msg=`你打倒了魔王。${tr.join("、")}的人沒有忘記你。他們捏著鼻子，還是搬到了據點附近，和你一起生活，守著這一帶的和平。${S.scars.length?`你身上還留著${S.scars.join("、")}的傷，但你不是一個人了。`:""}`}
    else{S.over={end:"普通結局・消失",day:S.day};
      msg=`你打倒了魔王。沒有人知道是誰做的。據點的火慢慢熄了，你一個人消失在歷史的長河裡。`}
    out.lines.push(msg);log(msg,"end");
    return}
  const g=gIdx(R.kind),core=g,hide=2*g;addMat("無名魔核",core);addMat("獸皮",hide);
  out.lines.push(`守住了！${R.kind} 級據點站穩了。`);out.gain.push(`無名魔核×${core}`,`獸皮×${hide}`);
  gainItem(genMagic(R.kind,null,R.kind==="S"),out);   /* 頭目掉的魔法物品；A→S 掉傳說級 */
  offerFac();
  if(S.hour>=24)night(false);
}
/* 搬家：只能搬到還沒當過據點的地方（地點只有幾個，搬一次少一個） */
const moveTargets=()=>S.places.filter(p=>!(S.bases||[]).includes(p)&&baseable(p));
function relocate(to,why){
  (S.fac||[]).forEach(f=>{if(f.s)facBack(f.s)});S.fac=[];S.facPick=null;S.raid=null;S.enc=null;S.pts=0;
  Object.keys(S.mats).forEach(m=>S.mats[m]=Math.floor(S.mats[m]/2));
  S.nest="F";S.base=to;S.at=to;(S.bases=S.bases||[]).push(to);
  const left=moveTargets().length;
  log(`${why}你把據點搬到${to}，從 F 級重來。設施和點數歸零，物資只帶走一半。${left?`還能搬的地方：${left} 個。`:"<b>這是最後一個能搬的地方了。</b>"}`,"act");
  offerFac();
}
function moveBase(to){
  if(S.ch<2)return {err:"還沒有據點"};
  if(!moveTargets().includes(to))return {err:"只能搬到還沒當過據點、已經找到的地方"};
  relocate(to,"");advance(6*(1+scarN("腿")));return {ok:true};
}
/* 萬靈藥：據點 S 級後開發，治好一處捨身傷 */
const CURE_COST={無名魔核:5,草:5};
function makeCure(){if(S.nest!=="S")return {err:"據點要 S 級才能開發萬靈藥"};
  if(!Object.entries(CURE_COST).every(([m,n])=>(S.mats[m]||0)>=n))return {err:"材料不夠（無名魔核 5、草 5）"};if(bagFull())return {err:"背包滿了"};
  Object.entries(CURE_COST).forEach(([m,n])=>S.mats[m]-=n);S.items.push({n:"萬靈藥",k:"cure",lv:"S"});log("開發出一瓶萬靈藥。","good");advance(4);return {ok:true}}
function useCure(part){const i=S.items.findIndex(x=>x.k==="cure");if(i<0)return {err:"沒有萬靈藥"};const j=S.scars.indexOf(part);if(j<0)return {err:"這個部位沒有捨身傷"};
  S.items.splice(i,1);S.scars.splice(j,1);log(`喝下萬靈藥，${part}的捨身傷好了。`,"good");return {ok:true}}
function startBoss(){if(!S.pending||S.pending.type!=="boss")return;S.pending=null;startRaid("boss")}
/* 升級戰敗（被攻破、倒下、中途逃走）：選一個沒當過據點的地方搬家，或陣亡。沒地方可搬就只能陣亡 */
function failChoice(to){
  const boss=S.pending&&S.pending.boss;
  if(to===true)to=moveTargets()[0];      /* 舊介面／機器人：搬到第一個能去的地方 */
  if(!boss&&to&&moveTargets().includes(to)){S.pending=null;count(S.stats.actions,"flee");relocate(to,"據點毀了。");if(S.hour>=24)night(false);return}
  S.pending=null;die(null,boss?"魔王的大軍淹沒了你。":"你沒有再逃。據點和你一起倒下了。");
}
function canEvolve(){return false}  /* 改成自動進化（autoEvolve） */
function evolve(){if(!canEvolve())return {err:"存在值還沒滿"};S.lv=GRADES[gIdx(S.lv)+1];S.exist=0;S.hp=hpMax();S.stats.lvDay[S.lv]=S.day;
  log(`你進化了，現在是 ${S.lv} 級（BP ${bpOf()}）。`,"good");advance(2);return {ok:true}}
function trade(kind,item){
  if(nestIdx()<2)return {err:"據點要 D 級以上，才會有商人來"};
  if(kind==="sell"){if(!(S.mats[item]>0))return {err:"你沒有"};S.mats[item]--;const g=Math.ceil((SELL[item]||1)*sellMult());S.gold+=g;log(`賣了${item}，+${g} 金幣。`)}
  else{const c=Math.ceil(BUY[item]*2*buyMult());if(S.gold<c)return {err:`錢不夠（要 ${c}）`};if((GEAR[item]||POTIONS[item])&&bagFull())return {err:"背包滿了"};S.gold-=c;
    if(GEAR[item])S.items.push(mkGear(item));else if(POTIONS[item])S.items.push(mkItem(item,"potion"));else addMat(item,1);
    log(`買了${item}，花 ${c} 金幣（對方一臉厭惡）。`)}
  advance(1);return {ok:true};
}
/* OOC：更正帳目 */
function oocAdd(name,n){n=n||1;if(MATS.includes(name))addMat(name,n);else if(name==="金幣")S.gold+=n;else S.items.push(GEAR[name]?mkGear(name):mkItem(name,POTIONS[name]?"potion":"tool"));S.stats.ooc.add++;log(`[OOC] 補登 ${name}×${n}`,"ooc")}
function oocRemove(name,n){n=n||1;if(MATS.includes(name))S.mats[name]=Math.max(0,(S.mats[name]||0)-n);else if(name==="金幣")S.gold=Math.max(0,S.gold-n);else{const i=S.items.findIndex(x=>x.n===name);if(i>=0)S.items.splice(i,1)}S.stats.ooc.remove++;log(`[OOC] 撤銷 ${name}×${n}`,"ooc")}
function oocSet(field,v){if(field==="hp")S.hp=Math.max(1,Math.min(hpMax(),v));else if(field==="mp")S.mp=Math.max(0,Math.min(mpMax(),v));else if(field==="gold")S.gold=Math.max(0,v);
  else if(NEEDS.includes(field)){S.needs[field]=!!v;checkChapter()}
  S.stats.ooc.edit++;log(`[OOC] ${field} 改成 ${v}`,"ooc")}
