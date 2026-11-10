/* 魔物篇｜nest.js：巢穴、存糧、派工、俘虜、聚落、注目度、搬家、討伐戰、關係、邀請入隊、打倒對手。
   所有 .js 共用同一個全域範圍，載入順序見 index.html；改之前先讀 README.md。 */
/* 巢穴：存糧是實際的份數。每天吃掉「人口格數」份；吃光人口掉一格，連吃飽 3 天人口漲一格。 */
const SHARE={F:1,E:3,D:6,C:10,B:15,A:20,S:30};
const needOf=()=>S.nest.pop+(S.npcs?kept().length:0);
const daysOf=()=>Math.floor((S.nest.food||0)/needOf());
const pOfDays=d=>d<=0?1:d<=2?2:d<=6?3:d<=13?4:5;
function nestSync(){
  const n=S.nest; if(n.d>dCap())n.d=dCap(); n.food=Math.max(0,Math.round(n.food||0)); n.p=pOfDays(daysOf());
  const need=n.tags.find(t=>t.t==="需求（食物）");
  if(daysOf()>=3&&need)n.tags=n.tags.filter(t=>t!==need);
  if(daysOf()<1&&!need)n.tags.push({t:"需求（食物）",c:"bad"});
}
function dayChange(notes){
  notes.push(`—— 第 ${S.day} 天 ——`);
  if((S.usedSk||[]).length){S.usedSk=[];notes.push("技能和魔法物品的力量都恢復了。")}
  S.allyUsed=0; S.healDay=null;
  const n=S.nest; dayJobs(notes); facDay(notes); nestHeatDay(notes); raidDay(notes); const need=needOf(), hungry=(n.food||0)<need;
  dayCaptives(notes,hungry);
  if(!hungry){n.food-=need;n.fed=(n.fed||0)+1;
    if(n.fed>=3&&n.pop<POP.length){n.pop++;n.fed=0;notes.push(`${NEST()}連著三天都吃飽了，聚過來的同類變多了。人口：${POP[n.pop-1]}。`)}}
  else{n.food=0;n.fed=0;
    if(n.pop>1){n.pop--;notes.push(`${NEST()}的存糧吃光了，有幾隻餓死或跑了。人口：${POP[n.pop-1]}。`+(n.pop===1?`${NEST()}快散了。`:""))}
    else notes.push(`${NEST()}的存糧吃光了。剩下的同類只能自己找吃的。`)}
  nestSync();
}
const shareOfCorpse=c=>c.small?0:(SHARE[c.lv]||1)*(c.harvested?1:1);
const shareOfItem=n=>EDIBLE_ITEM(n)||/肉/.test(n)?(/精肉|大塊|整/.test(n)?2:1):0;
/* 交給巢穴：屍體或能吃的東西入庫 */
function toNest(names,notes){
  let got=0; const done=[];
  names.forEach(x=>{
    const k=String(x).replace(/的?屍體|殘骸/g,"").trim();
    const j=S.corpses.findIndex(c=>!c.evo&&(c.name===x||cleanName(c.name)===k||(k&&cleanName(c.name).includes(k))));
    if(j>=0){const c=S.corpses[j],v=shareOfCorpse(c);if(!v)return;got+=v;done.push(c.name);S.corpses.splice(j,1);return}
    const i=S.items.findIndex(it=>it===x||it.includes(k)||k.includes(it));
    if(i>=0){const v=shareOfItem(S.items[i]);if(!v)return;got+=v;done.push(S.items[i]);delete S.mat[S.items[i]];S.items.splice(i,1)}
  });
  if(got){S.nest.food=(S.nest.food||0)+got;nestSync();notes.push(`交給巢穴：${done.join("、")}，存糧 +${got} 份（現在 ${S.nest.food} 份，夠吃 ${daysOf()} 天）`)}
  return got;
}
function giveNest(kind,i){
  if(busy||S.dead)return;
  const pre=snap(), notes=[], nm=kind==="c"?S.corpses[i]&&S.corpses[i].name:S.items[i];
  if(!nm)return;
  S.log.push({who:"you",text:`把${nm}交給巢穴`,pre});
  toNest([nm],notes);
  S.log.push(sysEntry(notes.join("\n"))); save(); render();
}
/* 模型回報巢穴變化 */
const dCap=()=>Math.min(DEF.length,S.nest.pop+2);
function nestChange(c,notes){
  if(!c)return; const n=S.nest;
  if(c.pop){const v=Math.max(-1,Math.min(1,c.pop|0));if(v&&n.pop+v>=1&&n.pop+v<=POP.length){n.pop+=v;notes.push(`巢穴人口：${POP[n.pop-1]}`)}}
  if(c.d){const v=Math.max(-1,Math.min(1,c.d|0));
    if(v>0&&n.d>=dCap())notes.push(`巢穴戰力到頂了（人口${POP[n.pop-1]}，最多「${DEF[dCap()-1]}」）`);
    else if(v>0&&n.dDay===S.day){}
    else if(v&&n.d+v>=1&&n.d+v<=DEF.length){n.d+=v;if(v>0)n.dDay=S.day;notes.push(`巢穴戰力：${DEF[n.d-1]}`)}}
  (c.del||[]).forEach(x=>{const t=n.tags.find(y=>y.t===x||y.t.includes(String(x).replace(/[〔〕]/g,"")));if(t){n.tags=n.tags.filter(y=>y!==t);notes.push(`巢穴標籤〔${t.t}〕拿掉了`)}});
  (c.add||[]).forEach(x=>{const t=typeof x==="string"?{t:x,c:""}:x;if(t&&t.t&&!n.tags.some(y=>y.t===t.t)){n.tags.push({t:String(t.t).replace(/[〔〕]/g,"").slice(0,14),c:t.c==="good"||t.c==="bad"?t.c:""});notes.push(`巢穴多了標籤〔${t.t}〕`)}});
  nestSync();
}
function applyCost(c,notes){
  if(c.hp){S.hp+=c.hp; notes.push(`HP ${c.hp}`)}
  if(c.mp){S.mp=Math.max(0,S.mp+c.mp); notes.push(`MP ${c.mp}`)}
  if(c.tag){addTag(c.tag); notes.push(`【${c.tag}】`)}
  if(c.item){const i=S.items.indexOf(c.item); if(i>=0){delete S.mat[c.item];S.items.splice(i,1);notes.push(`失去 ${c.item}`)}}
  if(c.ally)woundAlly(c.ally,notes);
  if(c.time)advanceTime(c.time,notes);
  checkDeath(notes);
}
const allyLv=()=>GRADES[Math.max(0,gIdx(S.lv)-1)];
/* 角色死了、被趕走、離開：從名單拿掉，記在「不在的人」，敘事者就不會再寫他出場 */
function facHit(d,notes){
  if(S.party.some(p=>p.n===d.name))return;
  for(const [k,f] of Object.entries(S.factions||{})){
    if(f.n>0&&facRe(k).test(d.name+(d.kind||""))){f.n--;
      if(f.n<=0){notes.push(`〈系統〉《大賢者》：「告。${k}已經被你打散了。」`);if(f.tag)S.nest.tags=S.nest.tags.filter(t=>t.t!==f.tag)}
      else if(f.n<=Math.ceil(f.max/3))notes.push(`${k}只剩不多了（約 ${f.n}）。`);
      break}}
}
/* 改名：同伴、巢穴的人、所有記錄一起換，舊名留作別名 */
function renameChar(from,to,notes){
  from=String(from||"").trim(); to=String(to||"").trim().slice(0,10);
  if(!from||!to||from===to||from===S.name)return false;
  const hit=[...S.npcs,...S.party].filter(x=>x.n===from||(x.alias||[]).includes(from));
  if(!hit.length)return false;
  hit.forEach(x=>{const old=x.n;x.alias=[...new Set([...(x.alias||[]),old])].filter(a=>a!==to);x.n=to});
  if(S.fightDelay===from)S.fightDelay=to;
  notes&&notes.push(`〈系統〉《世界之聲》：「${from} 從此叫做 ${to}。」`);
  return true;
}
function npcGone(name,why,notes,force){
  const n=String(name||"").trim(); if(!n||n===S.name)return;
  const had=S.npcs.some(x=>x.n===n)||S.party.some(x=>x.n===n);
  if(!had&&!force)return;
  S.npcs=S.npcs.filter(x=>x.n!==n); S.party=S.party.filter(x=>x.n!==n);
  const g=S.gone.find(x=>x.n===n);
  if(!g)S.gone.push({n,why:String(why||"不在了").slice(0,20),day:S.day});
  else if(force&&why)g.why=String(why).slice(0,20);        // 玩家或敘事者更正原因
  if(had&&notes)notes.push(`${n}${why?`（${why}）`:""}從此不在這裡了。`);
}
/* 聚落／勢力對主角：-2 敵對、-1 警戒、0 中立、1 交易、2 友好、3 同盟 */
const SREL=["敵對","警戒","中立","交易","友好","同盟"];
const SETTLE_KIND=/聚落|營地|城鎮|巢穴|村|商隊/;
const isSettle=n=>{const x=S.world[n];return !!x&&n!==NEST()&&SETTLE_KIND.test(x.kind||"")};
const stOf=n=>{const x=S.world[n];return !x||x.st==null?-1:x.st};
const findSettle=name=>{name=String(name||"");return Object.keys(S.world).find(n=>isSettle(n)&&(n===name||name.includes(n)||n.includes(name)))||null};
function stChange(n,d,why,notes){
  const x=S.world[n]; if(!x)return; d=Math.max(-1,Math.min(1,d|0)); if(!d)return;
  const was=stOf(n), now=Math.max(-2,Math.min(3,was+d)); if(now===was)return;
  x.st=now; notes&&notes.push(`${n}對你：${SREL[was+2]} → ${SREL[now+2]}${why?`（${why}）`:""}`);
}
function addDeal(d,notes){
  const n=findSettle(d.place)||(S.npcs.find(x=>x.n===d.place)||{}).where; const x=n&&S.world[n]; if(!x)return;
  x.deals=x.deals||[];
  if(d.end){const i=x.deals.findIndex(t=>t.includes(d.what)||d.what.includes(t));if(i>=0){notes.push(`和${n}的約定結束了：${x.deals[i]}`);x.deals.splice(i,1)}return}
  if(x.deals.some(t=>t===d.what))return;
  x.deals.push(d.what); if(x.deals.length>5)x.deals.shift(); notes.push(`和${n}約定：${d.what}`);
}
/* 俘虜與約定。俘虜每天吃巢穴一份；餓著或還在戒備的，沒人看守可能逃走。關係到「服從」就達成約定，留下來幫忙。 */
const TECH={"鐵匠":{tag:"工坊",d:1,txt:"可以修補、打造武器和工具"},"機關師":{tag:"陷阱",d:1,txt:"洞口裝了陷阱"},"祭司":{tag:"治療所",txt:"受傷的同伴每天好一級"},"薩滿":{tag:"治療所",txt:"受傷的同伴每天好一級"},
  "盜賊":{tag:"獵手",txt:"每天多 1 份存糧"},"遊俠":{tag:"獵手",txt:"每天多 1 份存糧"},"獵人":{tag:"獵手",txt:"每天多 1 份存糧"},"法師":{tag:"知識",txt:"能教大家認字、幫忙鑑定魔法物品"},
  "商人":{tag:"商路",txt:"交易時對方多給一點"},"戰士":{d:1,txt:"教大家怎麼打"},"野蠻人":{d:1,txt:"教大家怎麼打"}};
const kept=()=>S.npcs.filter(x=>x.where===NEST()&&(x.captive||x.contract)&&!S.party.some(p=>p.n===x.n));
function capture(c,notes){
  if(!c||!c.name||c.name===S.name||S.party.some(p=>p.n===c.name))return;
  let x=S.npcs.find(y=>y.n===c.name);
  if(!x){x={n:c.name,role:c.kind||"人類",lv:c.lv||"F",want:"活下去",knack:c.knack||"",face:c.face||"",secret:"",inst:"",rel:"警戒",r:-1};S.npcs.push(x)}
  x.where=NEST(); x.captive=true; x.contract=false; x.foe=false; if(relOf(x)>0){x.r=0;x.rel="無視"}
  x.cls=c.cls||classOf(c.name)||classOf(x.role)||null; x.since=S.day;
  S.gone=S.gone.filter(g=>g.n!==x.n);
  if(CIVIL_RACE.test(x.role+x.n))heatAdd(1,`有${raceOf(x.role)||"人"}失蹤了`,notes);
  notes.push(`你把${x.n}帶回${NEST()}看管起來（俘虜・每天吃巢穴 1 份存糧）。對你：${REL[relOf(x)+2]}。`);
}
function contract(x,notes){
  if(!x.captive)return; x.captive=false; x.contract=true;
  const t=TECH[x.cls||classOf(x.role)||""];
  notes.push(`${x.n}答應留下來幫忙，換吃住和安全。`);
  if(t){if(t.tag&&!S.nest.tags.some(y=>y.t===t.tag))S.nest.tags.push({t:t.tag,c:"good"});
    if(t.d&&S.nest.d<DEF.length)S.nest.d++;
    notes.push(`${NEST()}${t.tag?`多了〔${t.tag}〕`:""}${t.d?`${t.tag?"，":""}戰力：${DEF[S.nest.d-1]}`:""}（${t.txt}）。`)}
}
/* 注目度：巢穴越大、越常殺人類或當眾吃人，越會被盯上。風聲 → 偵察 → 討伐（討伐隊，倒數）→ 討伐軍。 */
const HEAT=[{n:"沒人注意",at:0},{n:"風聲",at:6},{n:"偵察",at:14},{n:"討伐",at:24},{n:"討伐軍",at:38}];
const HUMAN_TXT=/人類|冒險者|獵人|商隊|商人|騎士|衛兵|村|鎮|公會|旅人|樵夫|礦工|精靈|矮人|半身人/;
const heatLv=()=>{let k=0;HEAT.forEach((h,i)=>{if((S.heat||0)>=h.at)k=i});return k};
const CIVIL_RACE=/人類|冒險者|精靈|矮人|半身人|騎士|衛兵|商人/;
const patrol=()=>S.party.some(p=>!p.with&&p.job==="巡邏"&&!p.tags.includes("重傷"));
function heatAdd(d,why,notes){
  if(!d||S.dead)return; const was=heatLv();
  let cap=60; if(S.raidCool&&S.day<S.raidCool)cap=HEAT[3].at-1;          // 剛打退討伐：一陣子不會再來
  S.heat=Math.max(0,Math.min(cap,(S.heat||0)+d)); if(d>0)S.heatDay=S.day;
  const now=heatLv(); if(notes&&d>0&&why)notes.push(`注目度 +${d}（${why}）`);
  if(now>was){
    const t={1:"山外開始流傳：山裡有一窩不太一樣的哥布林。",2:"〈系統〉《大賢者》：「告。有人在打聽巢穴的位置。之後可能會遇到偵察的冒險者。」",
      3:"〈系統〉《大賢者》：「警告。人類組了討伐隊，正朝巢穴過來。」",4:"〈系統〉《大賢者》：「警告。來的不是討伐隊，是討伐軍。」"}[now];
    notes&&notes.push(t);
    if(now>=3)raidSet(now>=4);
  }
}
function raidSet(army){
  const lv=GRADES[Math.min(GRADES.length-1,gIdx(S.lv)+(army?1:0))];
  const early=patrol()?0:48;
  if(S.raid&&S.raid.army)return;
  if(S.raid&&army){S.raid.army=true;S.raid.lv=lv;S.raid.name="人類的討伐軍";S.raid.size="上百人";S.raid.due=Math.max(S.raid.due,nowH()+7*24-early);return}
  S.raid={name:army?"人類的討伐軍":"冒險者討伐隊",army,lv,size:army?"上百人":"六、七個冒險者",due:nowH()+(army?7:5)*24-early,seen:patrol(),prep:[]}; raidComp(S.raid);
}
function restoreWith(r){const keep=r&&r.withBefore||[];S.party.forEach(p=>p.with=keep.includes(p.n));}
function raidAdv(){
  const a=[...(S.raid&&S.raid.prep||[]).map(k=>RAID_PREP[k].adv),...raidCounters()], n=S.nest;
  if(n.d>=4)a.push(`巢穴戰力：${DEF[n.d-1]}`);
  if(n.lv&&facOn("陷阱"))a.push("〔陷阱〕設施");
  ["陷阱","天然屏障","工坊"].forEach(t=>{if(n.tags.some(x=>x.t===t))a.push(t==="工坊"?"〔工坊〕打的武器":`〔${t}〕`)});
  Object.keys(S.world).filter(k=>isSettle(k)&&stOf(k)>=3).forEach(k=>a.push(`${k}的盟友來幫忙`));
  if(S.party.filter(p=>!p.tags.includes("重傷")).length>=2)a.push("同伴們一起守");
  if(S.raid&&S.raid.seen)a.push("巡邏的提早發現，準備好了");
  return a;
}
function raidDay(notes){
  if(patrol()&&S.raid&&!S.raid.seen){S.raid.seen=true;S.raid.due+=24;notes.push(`巡邏的同伴發現了${S.raid.name}的行蹤：大約 ${Math.ceil((S.raid.due-nowH())/24)} 天後到。`)}
  const n=S.nest; if(n.pop>=4)heatAdd(n.pop>=5?2:1,null,notes);
  if(n.lv&&S.day%30===25&&!S.raid){raidSet(true);S.raid.big=true;S.raid.name=`第 ${S.day+5} 天的大討伐軍`;S.raid.due=nowH()+5*24;S.raid.seen=true;notes.push(`〈系統〉《大賢者》：「警告。人類每隔一陣子就會清剿一次魔物的巢穴：${S.raid.name}約 5 天後到（第 ${S.day+5} 天）。」`)}
  if(!S.raid&&heatLv()<3&&S.day-(S.heatDay||0)>=2&&S.heat>0){S.heat=Math.max(0,S.heat-2);S.heatDay=S.day-1}
}
/* 搬家：整窩搬到一個已知的地點。討伐隊會撲空。 */
function moveNest(dest,flee){
  if(busy||dest===NEST())return;
  if(!S.world[dest]&&/的新營地$/.test(dest)){                // 在某個地區裡自己找塊地方：搬過去時才建立
    const r=dest.replace(/的新營地$/,""), rw=S.world[r];
    if(rw&&rw.known&&rw.kind==="地區"){S.world[dest]={kind:"營地",region:r,note:`你們在${r}裡自己找的落腳處。`,links:{[r]:1},known:true,custom:true};rw.links=rw.links||{};rw.links[dest]=1}}
  if(!S.world[dest]&&/外圍營地$/.test(dest)){               // 中立以上聚落旁邊的外圍營地：搬過去時才建立
    const b=dest.replace(/外圍營地$/,""), bw=S.world[b];
    if(bw&&bw.known&&(bw.st||0)>=0){S.world[dest]={kind:"營地",region:bw.region,note:`${b}外圍的空地，聚落的人准你們在這裡落腳。`,links:{[b]:1},known:true,custom:true,st:bw.st};
      bw.links=bw.links||{};bw.links[dest]=1}}
  if(!S.world[dest])return;
  const pre=snap(), old=NEST(), notes=[], n=S.nest, h=flee?0:(pathHours(S.at,old)||0)+(pathHours(old,dest)||2);
  S.log.push({who:"you",text:flee?`放棄${old}，帶著大家往${dest}逃`:`把巢穴從${old}搬到${dest}`,pre});
  if(h)advanceTime(h,notes);
  const ow=S.world[old], nw=S.world[dest];
  ow.kind=(ow.region===old||ow.was==="地區")?"地區":"廢棄的巢穴"; ow.note=`以前的巢穴，${flee?"被討伐隊踏平了":"已經搬空了"}。`;
  nw.note=`你們的新巢穴。${nw.kind&&nw.kind!=="巢穴"?`（原本是${nw.kind}：${nw.note||""}）`:""}`.slice(0,60); if(nw.kind==="地區")nw.was="地區"; nw.kind="巢穴"; nw.known=true;
  S.nestAt=dest; n.name=dest; S.at=dest; S.loc=dest;
  n.tags=n.tags.filter(t=>!/天然屏障|禍患|陷阱/.test(t.t));
  if(flee){n.food=0;n.pop=1;n.d=Math.max(1,n.d-2);
    S.npcs.filter(x=>x.where===old&&x.captive).forEach(x=>npcGone(x.n,"在混亂中走散了",notes));
    notes.push(`你們丟下了幾乎所有東西逃出來。存糧沒了，人口：${POP[0]}，戰力：${DEF[n.d-1]}。`)}
  else{const lost=Math.floor((n.food||0)/2);n.food-=lost;if(n.pop>2){n.pop--;notes.push("有幾隻不肯走，留在了老地方。")}
    notes.push(`搬家花了 ${h} 小時。路上帶不動的存糧丟了 ${lost} 份。`)}
  S.npcs.forEach(x=>{if(x.where===old)x.where=dest});
  if(n.lv){n.lv="F";n.pts=0;n.fac=[];n.facT={};n.pick=null;S.party.forEach(p=>{p.fac=null});notes.push("新巢穴從 F 級重新開始：物資點數和設施都要重來。")}
  nestSync();
  if(S.raid){notes.push(`${S.raid.name}撲了個空。他們暫時找不到你們了。`);S.raid=null;S.heat=Math.min(S.heat||0,HEAT[1].at);}
  if((S.chap||1)<4){S.chap=4;notes.push(`〈系統〉《世界之聲》：「第4章・${chapOf().name}」`)}
  S.opts=["看看新巢穴","安頓大家","出去找吃的"]; MV="";
  S.log.push(sysEntry(notes.join("\n"))); save(); render();
}
let MV="";
/* 討伐戰：在巢穴迎戰，討伐隊 3 階段、討伐軍 5 階段。輸掉過半＝巢穴全滅（遊戲結束，可以撤回）。 */
function startRaid(){
  if(busy||!S.raid)return; const pre=snap(), r=S.raid;
  S.log.push({who:"you",text:`迎戰${r.name}`,pre});
  const notes=[]; if(!inNest()){notes.push(`你聽到消息，拚命趕回${NEST()}。`);S.at=NEST();S.loc=NEST()}
  r.on=true; r.stage=1; r.of=Math.max(1,(r.army?5:3)-((r.prep||[]).length>=3?2:0)); r.wins=0; r.fails=0; r.mom=0;
  r.withBefore=S.party.filter(p=>p.with).map(p=>p.n);
  S.party.forEach(p=>{if(!p.tags.includes("重傷"))p.with=true});
  if(notes.length)S.log.push(sysEntry(notes.join("\n")));
  S.opts=[]; save(); doJob({kind:"raid",ctx:{stage:1}},snap(),S.log.length);
}
const RAID_STEPS={1:["埋伏好的一擊"],3:["前哨和陷阱","洞口攻防","對上帶頭的強者"],5:["遠處的火把和偵察","陷阱與伏擊","洞口攻防","洞裡的混戰","對上統帥"]};
/* 派工：留在巢穴的同伴每天做一件事 */
const JOBS={"":"（沒事）","狩獵":"每天帶回存糧","採集":"有時帶回草藥、燧石之類","看守":"俘虜不會逃走","照顧":"俘虜兩天好一級（最多到服從）","巡邏":"討伐的動向會先知道"};
const GATHER=["草藥","燧石","乾柴","野果","樹脂","獸骨"];
function dayJobs(notes){
  const out=[], n=S.nest, home=S.party.filter(p=>!p.with);
  home.forEach(p=>{if(p.with||!p.job)return; const hurt=p.tags.includes("重傷");
    if(p.job==="狩獵"){if(hurt)return;const g=1+gIdx(p.lv)+(p.tags.includes("負傷")?-1:0);if(g>0){n.food=(n.food||0)+g;out.push(`${p.n}打獵帶回 ${g} 份`)} allyXp(p,1,out)}
    if(p.job==="採集"&&!hurt&&Math.random()<0.5){const it=rnd(GATHER);receive(it,null);out.push(`${p.n}採回了${it}`)}
  });
  const hunters=kept().filter(x=>x.contract&&TECH[x.cls||""]&&TECH[x.cls||""].tag==="獵手").length;
  if(hunters){n.food=(n.food||0)+hunters;out.push(`〔獵手〕多 ${hunters} 份`)}
  if(n.tags.some(t=>t.t==="治療所"))S.party.forEach(p=>{if(p.tags.includes("負傷")){p.tags=p.tags.filter(t=>t!=="負傷");out.push(`${p.n}的傷在〔治療所〕好了`)}
    else if(p.tags.includes("重傷")){p.tags=p.tags.filter(t=>t!=="重傷");p.tags.push("負傷")}});
  if(out.length)notes.push("巢穴："+out.join("；"));
}
function dayCaptives(notes,hungry){
  const guard=S.party.some(p=>!p.with&&p.job==="看守"&&!p.tags.includes("重傷"));
  const care=S.party.some(p=>!p.with&&p.job==="照顧"&&!p.tags.includes("重傷"));
  S.npcs.filter(x=>x.captive&&x.where===NEST()).forEach(x=>{
    if(hungry){relChange([{name:x.n,d:-1,why:"餓著肚子"}],notes)}
    else if(care){x.care=(x.care||0)+1;if(x.care>=2&&relOf(x)<1){x.care=0;relChange([{name:x.n,d:1,why:"有人照顧他"}],notes)}}
    if(!x.captive)return;
    const r=relOf(x), p=guard?0:r<=-2?0.5:r<=-1?0.25:0;
    if(p&&Math.random()<p)npcGone(x.n,"趁夜逃走了",notes);
  });
}
/* 以物易物的價值 */
const VALUE={F:1,E:2,D:5,C:15,B:50,A:200,S:800};
const valItem=n=>{const m=matOf(n);return m?VALUE[m.lv]||1:1};
const valCorpse=c=>c.small?0:VALUE[c.lv]||1;
/* 關係：-2 敵意、-1 警戒、0 無視、1 服從、2 信賴、3 追隨（到追隨就成為同伴） */
const REL=["敵意","警戒","無視","服從","信賴","追隨"];
const relOf=x=>x.r==null?(x.rel==="追隨"?3:x.rel==="信賴"?2:/服從/.test(x.rel)?1:/警戒/.test(x.rel)?-1:/敵意|輕蔑|記恨/.test(x.rel)?-2:0):x.r;
function relChange(list,notes,force){               // force：OOC 更正，不受一天一級限制
  const seen=new Set();
  (list||[]).filter(c=>c&&c.name&&!seen.has(c.name)&&seen.add(c.name)).forEach(c=>{
    const x=S.npcs.find(y=>y.n===c.name||(y.alias||[]).includes(c.name)); if(!x){const st=findSettle(c.name);if(st)stChange(st,c.d,c.why,notes);return}
    const d=Math.max(-1,Math.min(1,c.d|0)); if(!d)return;
    if(d>0&&x.upDay===S.day&&!c.big&&!force){           // 今天已經好過一級了：慢慢來，但要說出來
      if(relOf(x)<(x.cap==null?3:x.cap))notes.push(`${x.n}今天已經跟你親近過一級了，關係明天才會再變好（現在：${REL[relOf(x)+2]}）。`);return}
    const was=relOf(x), cap=x.cap==null?3:x.cap, now=Math.max(-2,Math.min(cap,was+d));
    if(now===was){if(d>0&&was>=cap)notes.push(`${x.n}對你的態度不會再更好了。`);return}
    x.r=now; x.rel=REL[now+2]; if(d>0)x.upDay=S.day;
    notes.push(`${x.n}對你：${REL[was+2]} → ${x.rel}${c.why?`（${c.why}）`:""}`);
    if(x.captive&&now>=1)contract(x,notes);
    if(now>=3&&!S.party.some(p=>p.n===x.n))recruit({name:x.n,kind:raceOf(x.role)||"哥布林",knack:x.knack,note:x.face},notes);
  });
}
function recruit(r,notes){
  if(!r||!r.name||r.name===S.name||S.party.some(p=>p.n===r.name))return;
  const npc=S.npcs.find(x=>x.n===r.name);
  const p={n:r.name,kind:r.kind||"哥布林",lv:(npc&&gIdx(npc.lv||"F")<gIdx(allyLv())?npc.lv:allyLv()),xp:0,knack:r.knack||(npc&&npc.knack)||"",note:r.note||(npc&&npc.face)||"",skills:[],tags:[],with:S.party.filter(x=>x.with).length<2};
  S.party.push(p); if(npc)npc.rel="追隨";
  notes&&notes.push(`〈系統〉《世界之聲》：「${p.n} 成為你的同伴。」${p.with?"":`（同行已滿兩名，牠先留在${NEST()}）`}`);
}
function woundAlly(n,notes){
  const p=S.party.find(x=>x.n===n); if(!p)return;
  if(p.tags.includes("負傷")||p.tags.includes("重傷")){p.tags=p.tags.filter(t=>t!=="負傷");if(!p.tags.includes("重傷"))p.tags.push("重傷");p.with=false;notes.push(`${n}傷得太重，退出了這次行動（【重傷】，回${NEST()}養傷）`)}
  else{p.tags.push("負傷");notes.push(`${n}【負傷】`)}
}
/* 邀請入隊：玩家點名邀請、對方信賴以上就加入；還不夠就說出來 */
const INVITE=/同伴|夥伴|伙伴|跟我走|跟著我|跟着我|加入|一起走|跟我來|跟我来|追隨|追随|跟隨|跟随/;
function invite(text,notes){
  text=String(text||""); if(!INVITE.test(text))return;
  S.npcs.filter(x=>!S.party.some(p=>p.n===x.n)&&(!x.where||x.where===S.at)&&[x.n,...(x.alias||[])].some(n=>text.includes(n))).slice(0,2).forEach(x=>{
    if(x.foe){notes.push(`${x.n}是你的對手，不會成為同伴。`);return}
    if(x.captive||relOf(x)<2){notes.push(`${x.n}對你還只是「${REL[relOf(x)+2]}」，要到「信賴」才會答應跟你走。`);return}
    {const k=notes.findIndex(t=>t.startsWith(`${x.n}今天已經跟你親近過`));if(k>=0)notes.splice(k,1)}
    x.r=3; x.rel="追隨"; recruit({name:x.n,kind:raceOf(x.role)||"哥布林",knack:x.knack,note:x.face},notes);
  });
}
const FIGHT=/打倒|擊倒|擊殺|殺|攻擊|偷襲|突襲|撲|獵|戰|刺|咬|砍|砸|打|揍|宰|捕|制伏|壓制/;
const sameFoe=(a,b)=>{a=cleanName(a);b=cleanName(b);return !!a&&!!b&&(a===b||a.includes(b)||b.includes(a))};
/* 打倒對手：留屍體（或沒死）、存在值、勢力、注目度 */
function applyDefeat(d,notes,big,won){
  if(d.dead!==false){S.corpses.push({name:d.name,sp:speciesOf(d.name,d.kind),lv:d.lv,t:nowH(),big:!!big,cls:d.cls||classOf(d.name)||null});
    notes.push(`${d.name}倒下了，屍體還是熱的。`); gainExist(d.lv,notes,d.cls?1:0);
    {const k=Math.min(3,(won||0)+(big&&/群|隊|團|們/.test(d.name+(d.kind||""))?2:0)), sp=speciesOf(d.name,d.kind);for(let j=0;j<k;j++)S.corpses.push({name:sp,sp,lv:d.lv,t:nowH()});if(k)notes.push(`前面打倒的 ${k} 隻${sp}也在地上。`)}
    npcGone(d.name,"被你殺死",null); facHit(d,notes); if(CIVIL_RACE.test(d.name+(d.kind||"")))heatAdd(2,`殺了${cleanName(d.name)}`,notes)}
  else{notes.push(`你打敗了${d.name}。牠還活著。`); gainExist(d.lv,notes,d.cls?1:0); facHit(d,notes)}
  S.lastFoe=null;
}
function gainExist(lv,notes,bonus,why){
  if(S.exist>=existMax(S.lv)){notes.push(`存在值已滿（${S.exist}/${existMax(S.lv)}），不會再增加——先去打進化戰。`);return}
  const g=existGain(lv)+(bonus||0);
  if(!g){notes.push("對手比你弱，存在值沒有增加。");return}
  S.exist=Math.min(existMax(S.lv),S.exist+g);
  notes.push(`存在值 +${g}${bonus?`（${why||"小頭目"} +${bonus}）`:""}（${S.exist}/${existMax(S.lv)}）`);
  if(S.exist>=existMax(S.lv)&&!S.evo&&!S.war){S.evo=newEvo();evoAnnounce(notes)}
}
const nextLv=()=>GRADES[Math.min(GRADES.length-1,gIdx(S.lv)+1)];
const hStr=h=>`第${Math.floor(h/24)}天 ${pad2(h%24)}:00`;
function newEvo(){
  const tgt=nextLv(), list=(FOES[tgt]||FOES.C).filter(f=>!(S.beaten||[]).includes(f.name)&&!(f.nest&&(S.chief||S.gone.some(g=>g.n===f.name))));
  const nest=list.filter(f=>f.nest), rest=list.filter(f=>!f.nest).sort(()=>Math.random()-0.5);
  return {cands:[...nest.slice(0,1),...rest].slice(0,3).map(f=>({...f,lv:tgt})),due:nowH()+48,forced:null};
}
function evoAnnounce(notes){
  notes.push("〈系統〉《大賢者》：「告。存在值已滿。需進行進化戰。」");
  notes.push(`〈系統〉《大賢者》：「附近的候選對手：${S.evo.cands.map(f=>`${f.name}（${f.kind}・${f.lv}級・${f.where}）`).join("、")}。期限：${hStr(S.evo.due)}。逾期，其中一名會主動找上門。」`);
}

/* ═════════ 巢穴等級與設施（v0.33）═════════
   當上巢穴之主＝E 級；搬家＝F 級重來。物資點數：捐物品（會消失）；升級花點數（E 20、D 30、C 60、B 120、A 240），
   升級必引來一次討伐；每升到 E/D/C/B/A 從沒出現過的設施裡隨機抽 3 個選 1（最多 5 個）。設施效果跟巢穴等級走，
   要有人手（對口同伴 1＋族人最多 2）才運作，被排進設施的命名同伴不能同行。 */
const NEST_UP={E:20,D:30,C:60,B:120,A:240};
const nLv=()=>S.nest&&S.nest.lv||null;
const nStr=()=>Math.max(0,gIdx(nLv()||"F"));            // F0 E1 D2 C3 B4 A5
const FAC={
  "農田":{cls:null,txt:"每天自己長出存糧"},
  "獵場":{cls:"斥候",txt:"每天帶回獵物（有斥候同伴看著更多）"},
  "鍛冶台":{cls:"工匠",txt:"每隔幾天打出一件白字武器防具；有人看著，鍛造也比較快"},
  "宿舍":{cls:null,txt:"每隔幾天有同類聚過來（人口 +1，要有存糧）"},
  "陷阱":{cls:"斥候",txt:"討伐戰多一層優勢"},
  "治療所":{cls:"祭司",txt:"同伴每天好一級傷"}};
const FOOD_B=[0,3,4,6,8,10], WPN=["骨矛","粗石斧","木盾","皮甲","鐵匕首","粗鐵短刀"];
function rollFac(n){const left=Object.keys(FAC).filter(f=>!(n.fac||[]).includes(f)); if((n.fac||[]).length>=5||!left.length)return null;
  return left.sort(()=>Math.random()-0.5).slice(0,3)}
function nestFix(o){
  if(!o||!o.nest||!o.chief)return;
  const n=o.nest; if(n.lv)return;
  n.lv="E"; n.pts=0; n.fac=[]; n.facT={}; n.pick=rollFac(n);
}
const facWorkers=f=>{
  const n=S.nest, c=FAC[f].cls, pop=Math.max(0,n.pop-1);
  const ally=c?S.party.find(p=>p.fac===f):null;
  return c?(ally?1:0)+Math.min(2,pop):Math.min(3,n.pop);
};
function facAssign(){
  const n=S.nest, fs=n.fac||[];
  S.party.forEach(p=>{if(p.fac&&(!fs.includes(p.fac)||p.with||p.tags.includes("重傷")))p.fac=null});
  fs.forEach(f=>{const c=FAC[f].cls; if(!c||S.party.some(p=>p.fac===f))return;
    const a=S.party.find(p=>!p.with&&!p.fac&&p.dir===c&&!p.noFac&&!p.tags.includes("重傷")); if(a)a.fac=f});
}
const facOn=f=>(S.nest.fac||[]).includes(f)&&facWorkers(f)>0;
function facDay(notes){
  const n=S.nest; if(!n.lv||!(n.fac||[]).length)return;
  n.facT=n.facT||{}; facAssign(); const out=[], s=nStr();
  (n.fac||[]).forEach(f=>{
    const w=facWorkers(f); if(w<=0)return; const m=w/3;
    if(f==="農田"){const g=Math.max(1,Math.round(FOOD_B[s]*m));n.food=(n.food||0)+g;out.push(`〔農田〕+${g} 份存糧`)}
    if(f==="獵場"){const g=Math.max(1,Math.round((FOOD_B[s]-1)*m));n.food=(n.food||0)+g;out.push(`〔獵場〕帶回 ${g} 份獵物`)}
    if(f==="鍛冶台"){n.facT[f]=(n.facT[f]||0)+1;if(n.facT[f]>=7-w){n.facT[f]=0;const it=rnd(WPN);receive(it,null);out.push(`〔鍛冶台〕打出了「${it}」（白字）`)}}
    if(f==="宿舍"){n.facT[f]=(n.facT[f]||0)+1;if(n.facT[f]>=6-w&&(n.food||0)>=needOf()){n.facT[f]=0;if(n.pop<POP.length){n.pop++;out.push(`〔宿舍〕又有同類聚過來。人口：${POP[n.pop-1]}`)}}}
    if(f==="治療所")S.party.forEach(p=>{if(p.tags.includes("負傷")){p.tags=p.tags.filter(t=>t!=="負傷");out.push(`${p.n}的傷在〔治療所〕好了`)}
      else if(p.tags.includes("重傷")){p.tags=p.tags.filter(t=>t!=="重傷");p.tags.push("負傷")}});
  });
  if(out.length)notes.push("設施："+out.join("；"));
}
/* 注目度的被動累積：從 D 級起很慢，而且只到「風聲／偵察」為止，光靠巢穴大不會直接引來討伐 */
function nestHeatDay(notes){
  const iv={D:4,C:3,B:2,A:2}[nLv()]; if(!iv||S.raid)return;
  const cap={D:HEAT[1].at-1,C:HEAT[2].at-1,B:HEAT[2].at-1,A:HEAT[2].at-1}[nLv()];
  if(S.day%iv===0&&(S.heat||0)<cap)heatAdd(1,"巢穴越來越大",notes);
}
const ptsOfItem=n=>{const m=matOf(n);if(!m)return 1;const i=gIdx(m.lv);return i>=5?10:i>=3?5:2};
const donatable=()=>S.items.map((n,i)=>({n,i,v:ptsOfItem(n)})).filter(x=>!shareOfItem(x.n));
function donateItem(i){
  const n=S.nest, it=S.items[i]; if(busy||S.dead||it==null||!n.lv)return;
  const v=ptsOfItem(it), pre=snap();
  S.log.push({who:"you",text:`把${it}捐給巢穴`,pre});
  delete S.mat[it]; S.items.splice(i,1); n.pts=(n.pts||0)+v;
  S.log.push(sysEntry(`捐給巢穴：${it}，物資點數 +${v}（現在 ${n.pts} 點）`)); save(); render();
}
const nextNLv=()=>GRADES[gIdx(nLv())+1];
function upgradeNest(){
  const n=S.nest, to=nextNLv(), cost=NEST_UP[to];
  if(busy||S.dead||!n.lv||!to||!cost||n.pick||S.raid||(n.pts||0)<cost||to==="S")return;
  const pre=snap(); S.log.push({who:"you",text:`把巢穴升到 ${to} 級`,pre});
  n.pts-=cost; n.lv=to; n.pick=rollFac(n);
  const notes=[`〈系統〉《世界之聲》：「${NEST()}升到 ${to} 級。」`];
  if(n.pick)notes.push("巢穴多一個設施的位置，從三個裡選一個。");
  raidSet(false); S.raid.up=true; S.raid.name="聞風而來的冒險者討伐隊";
  notes.push(`〈系統〉《大賢者》：「警告。巢穴變大的消息傳出去了，討伐隊大約 ${Math.ceil((S.raid.due-nowH())/24)} 天後到。」`);
  S.log.push(sysEntry(notes.join("\n"))); save(); render();
}
function pickFac(j){
  const n=S.nest; if(busy||!n.pick||!n.pick[j])return; const f=n.pick[j], pre=snap();
  S.log.push({who:"you",text:`選了設施：${f}`,pre});
  n.fac.push(f); n.pick=null; facAssign();
  S.log.push(sysEntry(`〈系統〉《世界之聲》：「〔${f}〕蓋好了。${FAC[f].txt}。」${FAC[f].cls?`\n（排一個${FAC[f].cls}同伴留在巢穴，他會自動去顧；被排進去的同伴不能同行。）`:""}`)); save(); render();
}
function nestLvHTML(){
  const n=S.nest; if(!n.lv)return `<div class="note" style="margin-top:8px">成為巢穴之主後，巢穴才有等級。</div>`;
  const to=nextNLv(), cost=to&&NEST_UP[to], can=cost&&!n.pick&&!S.raid&&(n.pts||0)>=cost&&to!=="S";
  const fac=(n.fac||[]).map(f=>{const w=facWorkers(f), a=S.party.find(p=>p.fac===f);
    return `<div class="row"><span class="k">〔${esc(f)}〕</span><span>人手 ${w}／3${FAC[f].cls?`・${a?esc(a.n)+"在顧":"缺"+FAC[f].cls}`:""}<br><span class="note">${esc(FAC[f].txt)}</span></span></div>`}).join("");
  const dn=donatable();
  return `<div style="margin-top:10px;border-top:1px solid var(--line);padding-top:8px"><div class="row"><span class="k">巢穴等級</span><span><b>${n.lv}</b> 級・物資點數 <b>${n.pts||0}</b>${to&&cost&&to!=="S"?`（升 ${to} 要 ${cost}）`:""}</span></div>
    ${to&&cost&&to!=="S"?`<button class="paybtn" id="nup" style="margin:6px 0"${can?"":" disabled"}>升到 ${to} 級${can?"（會引來一次討伐）":n.pick?"（先選設施）":S.raid?"（先處理討伐）":"（點數不夠）"}</button>`:`<div class="note">已經是一般升級的最高級。</div>`}
    ${n.pick?`<div class="note" style="margin:6px 0"><b>選一個設施：</b></div><div class="tags">${n.pick.map((f,j)=>`<button class="tag ut" data-nf="${j}">${esc(f)}：${esc(FAC[f].txt)}</button>`).join("")}</div>`:""}
    ${fac||`<div class="note">還沒有設施（最多 5 個，每升一級多一個）。</div>`}
    <div class="note" style="margin-top:6px">捐物品換點數（物品會消失）：普通 1、魔法物品 2、C～B 級 5、A 級以上 10。${dn.length?"":"（沒有可以捐的）"}</div>
    ${dn.map(x=>`<div class="crow">${esc(x.n)}（+${x.v}）<button class="tl" data-nd="${x.i}">捐給巢穴</button></div>`).join("")}</div>`;
}

/* v0.38 掠奪戰利品：突襲營地／據點成功時，魔法物品由程序抽（不再靠模型自己填）。
   成功 1 件、大成功 2 件；同一天打同一個對手第二次只有 30% 機率；另外 40% 多一瓶藥水。 */
let RAIDNOW=false;
const RAID_RE=/突襲|襲擊|掠奪|掠夺|洗劫|劫掠|搶|抢|劫營|劫营|奪取|夺取|端掉/;
const RAID_FOE=/哥布林|獸人|野豬人|狗頭人|諾姆|地精|食人魔|人類|冒險者|士兵|商隊|盜|戰團|部落|營地|巢穴|據點/;
const LOOT_GEAR=["長矛","短刀","戰斧","皮甲","小圓盾","骨飾","護腕","彎刀","頭盔"];
const LOOT_POOL=[{n:"蠻力",sys:"天生"},{n:"堅守",sys:"意圖"},{n:"劍術",sys:"武技"},{n:"耐痛",sys:"天生"},{n:"警戒",sys:"意圖"},{n:"撕裂",sys:"天生"}];
function raidLoot(c,notes){
  if(!c||c.tier==="失敗"||!c.foeLv||!RAID_RE.test(c.what||"")||!RAID_FOE.test((c.foe||"")+(c.what||"")))return [];
  facHit({name:c.foe||"",kind:c.what||""},notes); if(c.tier==="大成功")facHit({name:c.foe||"",kind:c.what||""},notes);
  S.lootDay=S.lootDay||{}; const key=cleanName(c.foe||"營地"), again=S.lootDay[key]===S.day; S.lootDay[key]=S.day;
  const n=again?(Math.random()<0.3?1:0):(c.tier==="大成功"?2:1), got=[];
  const sp=cleanName(c.foe||"戰團").replace(/戰團|部落|巡邏隊|營地|巢穴|戰士/g,"")||"戰團";
  for(let i=0;i<n;i++){
    const lv=capItemLv(c.foeLv), gear=LOOT_GEAR[rint(0,LOOT_GEAR.length-1)];
    const pool=(poolKey(sp)&&POOLS[poolKey(sp)])||LOOT_POOL, sk=pool[rint(0,pool.length-1)];
    let nm=`${sp}的${gear}`; while(S.items.includes(nm))nm+="・改";
    S.items.push(nm); S.mat[nm]={lv,sp,skill:{n:sk.n,sys:sk.sys}}; got.push(nm);
    notes.push(`戰利品：✦${nm}（魔法物品，附帶「${sk.n}」・${lv}級）`)}
  if(!again&&Math.random()<0.4){const p=["紅色藥水","藍色藥水"][rint(0,1)];S.items.push(p);got.push(p);notes.push(`戰利品：${p}`)}
  if(!got.length)notes.push("這次沒搶到值錢的東西（同一個對手今天已經被你搜刮過了）。");
  return got}

/* ═════════ v0.38 討伐戰補完 ═════════
   組成與兵種相剋、戰前備戰、第一次只逼退、整批俘虜、處置俘虜、固定日子大討伐、全滅轉生 */
const RAID_CLS=["戰士","斥候","法師","祭司","工匠"];
const COUNTER={戰士:"斥候",斥候:"法師",法師:"戰士",祭司:"工匠",工匠:"祭司"};   // 戰士壓制斥候、斥候繞後打法師、法師火力壓戰士、祭司和工匠互相剋
const raidComp=r=>{if(!r.comp)r.comp=[...RAID_CLS].sort(()=>Math.random()-0.5).slice(0,r.army?4:3);return r.comp};
const RAID_PREP={陷阱:{h:4,adv:"事先在洞口設好的陷阱",txt:"花 4 小時"},埋伏:{h:2,adv:"埋伏在洞口兩側",txt:"花 2 小時"},備戰:{food:3,adv:"族人削尖木矛、備好石塊",txt:"用 3 份存糧"}};
function raidCounters(){
  const r=S.raid; if(!r)return [];
  const comp=raidComp(r), out=[];
  S.party.filter(p=>p.named&&COUNTER[p.dir]&&!p.tags.includes("重傷")&&comp.includes(COUNTER[p.dir])).forEach(p=>{if(out.length<2)out.push(`${p.dir}的專長克制對方的${COUNTER[p.dir]}`)});
  return out;
}
function raidPrep(k){
  const r=S.raid, P=RAID_PREP[k]; if(busy||S.dead||!r||r.on||!P||(r.prep||[]).includes(k))return;
  if(!inNest()){S.log.push(sysEntry("要先回到巢穴才能備戰。"));save();render();return}
  if(P.food&&(S.nest.food||0)<P.food){S.log.push(sysEntry(`存糧不夠（要 ${P.food} 份）。`));save();render();return}
  const pre=snap(), notes=[]; S.log.push({who:"you",text:`備戰：${k}`,pre});
  if(P.food)S.nest.food-=P.food; if(P.h)advanceTime(P.h,notes);
  if(!S.raid){S.log.push(sysEntry(notes.join("\n")));save();render();return}
  (S.raid.prep=S.raid.prep||[]).push(k);
  notes.push(`${k}做好了：討伐戰多一層優勢（${P.adv}）。${S.raid.prep.length>=3?"三樣都備齊了：這場只要打一個階段。":""}`);
  S.log.push(sysEntry(notes.join("\n"))); save(); render();
}
/* 打贏討伐：第一次（或準備不足、贏得不漂亮）只是逼退，過幾天帶更多人再來；漂亮贏了才有俘虜和稱號 */
function raidWin(r,notes){
  const decisive=!!S.pushed||(r.wins-r.fails>=2)||(r.prep||[]).length>=2||r.big;
  S.pushed=true;
  const cs=`${r.army?"討伐軍":"討伐隊"}的冒險者`;
  if(!decisive){
    notes.push(`${r.name}撤退了。但這只是撤退，不是打垮：他們會帶更多人回來。`); gainExist(r.lv,notes,1,"逼退");
    toCorpses(cs,"人類",r.lv).forEach(c=>{c.small=false;S.corpses.push(c)});
    S.raid=null; restoreWith(r); S.heat=Math.max(S.heat||0,HEAT[2].at);
    raidSet(true); S.raid.due=nowH()+6*24; S.raid.name="捲土重來的討伐軍"; S.raid.seen=true;
    notes.push(`〈系統〉《大賢者》：「警告。大約 6 天後，更大的討伐軍會到。這幾天可以備戰（巢穴頁）。」`);
    return false;
  }
  notes.push(`${r.name}被擊退了。`); gainExist(r.lv,notes,r.army?3:2,"守住巢穴");
  toCorpses(cs,"人類",r.lv).concat(toCorpses(cs,"人類",r.lv)).forEach(c=>{c.small=false;S.corpses.push(c)});
  const ti=r.army?"擊退討伐軍":"擊退討伐隊"; if(!S.titles.includes(ti)){S.titles.push(ti);notes.push(`〈系統〉《世界之聲》：「獲得稱號『${ti}』。」`)}
  Object.keys(S.world).filter(k=>isSettle(k)&&/人類|城鎮/.test(k+S.world[k].kind)).forEach(k=>stChange(k,-1,"打退了他們派來的人",notes));
  const comp=raidComp(r), k=r.army?5:3;
  for(let i=0;i<k;i++){const c=comp[i%comp.length];capture({name:`討伐隊的${c}${S.day}-${i+1}`,kind:"人類",lv:r.lv,cls:c},[])}
  notes.push(`${k} 個討伐隊員被活捉，關在${NEST()}（俘虜，每天吃 1 份存糧）。吃掉、讓同伴單挑練手、或收為己用，到巢穴頁決定。`);
  S.raid=null; S.heat=HEAT[1].at; S.raidCool=S.day+10; restoreWith(r);
  notes.push("注目度降到「風聲」。他們吃了大虧，十天內不會再派人來討伐。");
  return true;
}
/* 處置俘虜 */
function eatCaptive(n){
  const x=S.npcs.find(y=>y.n===n&&y.captive); if(!x||busy||S.dead)return;
  const pre=snap(); S.log.push({who:"you",text:`處置俘虜：把${n}交給大家吃掉`,pre});
  S.corpses.push({name:n,sp:"人類",lv:x.lv||"F",t:nowH(),cls:x.cls||null});
  npcGone(n,"被你吃掉",null);
  S.log.push(sysEntry(`${n}成了屍體，放在身邊（要吃的話，到屍體清單去吃，才學得到技能）。`)); save(); render();
}
function duelCaptive(n){
  const x=S.npcs.find(y=>y.n===n&&y.captive); if(!x||busy||S.dead)return;
  const p=S.party.filter(q=>!q.tags.includes("重傷")).sort((a,b)=>gIdx(b.lv||"F")-gIdx(a.lv||"F"))[0];
  if(!p){S.log.push(sysEntry("沒有能打的同伴。"));save();render();return}
  const pre=snap(); S.log.push({who:"you",text:`處置俘虜：讓${p.n}和${n}單挑`,pre});
  const diff=gIdx(p.lv||"F")-gIdx(x.lv||"F"), win=Math.random()<Math.min(0.95,Math.max(0.1,0.5+0.25*diff)), notes=[];
  if(win){allyXp(p,3,notes);S.corpses.push({name:n,sp:"人類",lv:x.lv||"F",t:nowH(),cls:x.cls||null});npcGone(n,"死於單挑",null);
    notes.push(`${p.n}贏了。${n}倒下了，屍體還是熱的。`)}
  else{woundAlly(p.n,notes);notes.push(`${p.n}輸了這一場，${n}還活著。`)}
  S.log.push(sysEntry(notes.join("　"))); save(); render();
}
function useContract(n){
  const x=S.npcs.find(y=>y.n===n&&y.captive); if(!x||busy||S.dead)return;
  const pre=snap(), notes=[]; S.log.push({who:"you",text:`處置俘虜：讓${n}留下來幫忙`,pre});
  if(relOf(x)<1){notes.push(`${n}還不肯：關係至少要到「友善」（照顧幾天、給藥水或食物）。`)}else contract(x,notes);
  S.log.push(sysEntry(notes.join("\n"))); save(); render();
}
/* 全滅轉生：帶 1 個技能（維持等級）從頭開始 */
function reborn(sn){
  const old=S, sk=old.skills.find(s=>s.n===sn&&s.sys!=="Unique"); const ng=newGame(old.name);
  if(sk)ng.skills.push({n:sk.n,sys:sk.sys,g:sk.g||"F",box:"act"});
  ng.rebirths=(old.rebirths||0)+1; ng.langs=["哥布林語"];
  S=ng; heal(); S.log.push({who:"gm",kind:"sys",alts:[{text:`${OPENING}${sk?`\n\n〈系統〉《大賢者》：「告。前世的記憶殘留了一項本領：${sk.n}（${sk.g||"F"}級）。」`:""}`,opts:OPEN_OPTS.slice()}],i:0}); S.opts=OPEN_OPTS.slice(); TAB="story"; save(); render();
}
