/* 魔物篇｜actions.js：玩家的行動：吃、在場的人、同伴拿東西、吃魔法原料。
   所有 .js 共用同一個全域範圍，載入順序見 index.html；改之前先讀 README.md。 */
/* ═════════ 玩家的行動 ═════════ */
const OOC=/^\s*[（(【\[]?\s*(ooc|OOC|Ooc)\s*[:：）)】\]]?\s*/;
function act(text,free,ch){
  if(busy||S.dead||!text.trim())return;
  text=text.trim();
  if(OOC.test(text)){                                   // OOC：問規則、回報程序漏記的東西，不推進故事、不花時間
    const q=text.replace(OOC,"").trim()||"現在的狀況怎麼樣？";
    const pre=snap(); S.log.push({who:"you",text,pre,ooc:true}); save();
    doJob({kind:"ooc",prompt:q},pre,S.log.length-1); return;
  }
  if(!ch&&EAT.test(text)&&text.length<=24){            // 只說「吃掉某某」：程序直接結算；還有別的事就交給敘事者（它會回報 ate）
    const tg=findFood(text.replace(EAT,""));
    if(tg){
      const nm=tg.type==="c"?S.corpses[tg.i].name:S.items[tg.i];
      const rest=text.replace(EAT,"").replace(nm,"").replace(cleanName(nm),"").replace(/[把將我掉了下去它牠吧的，。,.!！\s]|屍體|乾淨|全部|整隻/g,"");
      if(rest.length<=2){tg.type==="c"?eatCorpse(tg.i,text):eatItem(tg.i,text);return}
    }
  }
  if(!ch&&(text===`回${NEST()}`||text==="回巢穴")&&!inNest())return doMenu("nest");   // 選項「回巢穴」照路程走
  if(ch&&ch.war&&S.war){
    const pre=snap(); S.log.push({who:"you",text,pre,free:true}); S.opts=[]; save();
    doJob({kind:"war",ctx:{stage:S.war.stage,tactic:text}},snap(),S.log.length); return;
  }
  const pre=snap();
  const prompt=ch?`【玩家沒有照判定卡硬上，改做這件事】${text}\n（原本的局面「${ch.what}」還在，對手和危險不會因此消失。）`:text;
  S.log.push({who:"you",text,prompt,time:null,pre,free:!!free});
  S.opts=[]; S.err=null; save();
  doJob({kind:"turn",prompt},pre,S.log.length-1);
}
const MENU_KID=[{k:"scav",t:"搜刮洞裡・1h"},{k:"nest",t:"巢穴・1h"},{k:"rest",t:"休息"}];
const MENU_HOURS_RAID=4;
const MENU_ADULT=[{k:"hunt",t:"狩獵・3h"},{k:"explore",t:"探索・2~3h"},{k:"forage",t:"採集・2h"},{k:"go",t:"移動…"},{k:"nest",t:"巢穴・1h"},{k:"rest",t:"休息"}];
function menuSeed(k,arg){
  const reg=regionOf();
  if(k==="raid"){
    const at=S.at, nd=S.world[at]||{};
    return {label:`突襲${at}`,prompt:`【這段要發生的事（程序抽到的，照這個寫）】你決定突襲${at}（${nd.kind}）。${nd.note?`那裡的情況：${nd.note}`:""}這是一場主動進攻的關鍵戰：一定要出判定卡（check），what 寫「突襲${at}」，foe 填「${at}的守衛」，foeLv 填${GRADES[Math.min(6,gIdx(S.lv)+(/大哥布林|獸人|食人魔|人類|矮人|精靈/.test(at)?2:1))]}級（比你高）；守衛是一整群，對你劣勢 1 層（dis 要寫）；這是關鍵戰，至少要付 2 項代價；不要直接寫結果，也不要讓一次判定就打垮整個營地。`,hours:4};
  }
  if(k==="hunt"){
    const {sp,grp,lv,cls}=pickPrey(reg), many=/群|兩|一隊|一群|幾/.test(grp||"");
    const spot=S.at&&S.world[S.at]&&S.world[S.at].kind!=="地區"?S.at:null, where=spot||reg.n;
    return {label:`在${where}狩獵`,prompt:`【這段要發生的事（程序抽到的，照這個寫）】你在${where}${spot?"附近":"一帶"}狩獵${spot?`（這裡屬於${reg.n}，就在這個地點附近，不要跑到別的地方）`:""}。在${spot?`${spot}附近的`:""}${rnd(reg.terr)}，你發現了${grpW(grp)}${sp}（${lv}級），${/群|兩隻/.test(grp)?"牠們":"牠"}${rnd(ACTIVITY)}。${cls?`牠是帶職業的${cls}，是個小頭目，比一般的${sp.replace(cls,"")}難纏（${CLASSES[cls].act}）。`:""}寫出發現牠的過程，停在要不要動手的那一刻。玩家選擇動手、或牠先撲上來時，給 check（foe 填「${sp}」，foeLv 填「${lv}」${many?"，group 填牠們的數量":""}）。loc 填「${where}」開頭的地名。`};
  }
  if(k==="explore"){
    const hid=hiddenOf(S.at), from=S.at;
    const rg0=(S.world[from]||{}).region; S.expl=S.expl||{};
    if(rg0&&S.sites){S.expl[rg0]=(S.expl[rg0]||0)+1;
      const sd=S.sites.find(x=>!x.found&&x.region===rg0&&S.expl[rg0]>=x.need);
      if(sd){sd.found=true;const nd=S.world[sd.n],h=rint(1,3);nd.links[from]=h;S.world[from].links[sd.n]=h;
        return {label:`探索：${from}附近`,prompt:`【這段要發生的事（程序抽到的，照這個寫）】你在${rg0}一帶探索了很久，終於找到了黑顎提過、但誰也沒去過的地方：${sd.n}（${nd.kind}）。${nd.note?`那裡的情況：${nd.note}`:""}寫出第一次遠遠看到它的樣子（不要寫進去，也不要寫戰鬥；裡面的人怎麼看你，等玩家靠近再說）。loc 填「${sd.n}」。`,hours:Math.max(2,h),node:sd.n,from,reveal:true}}}
    if(hid.length&&Math.random()<0.65){
      const to=rnd(hid), nd=S.world[to], h=nd.links[from]||2, rg=REGIONS.find(r=>r.n===nd.region)||reg;
      const good=Math.random()<0.6, what=good?rnd(rg.find):rnd(rg.danger);
      return {label:`探索：${from}附近`,prompt:`【這段要發生的事（程序抽到的，照這個寫）】你從${from}出發探索，走了 ${h} 個小時，找到了一個新地方：${to}（${nd.kind}）。${nd.note?`那裡的情況：${nd.note}`:""}${good?`路上還發現了：${what}。`:`路上遇到危險：${what}，停在玩家要怎麼應對的那一刻。`}寫出第一次看到${to}的樣子。loc 填「${to}」。`,hours:Math.max(2,h),node:to,from,reveal:true};
    }
    const good=Math.random()<0.6, what=good?rnd(reg.find):rnd(reg.danger);
    return {label:`探索：${from}附近`,prompt:`【這段要發生的事（程序抽到的，照這個寫）】你在${from}附近探索，找到一個還沒有記錄的地方。自己想一個符合${reg.n}這一帶的地方：可以冒險的地點（洞穴、遺跡、廢墟、怪物的巢）、特別的地形（瀑布、溫泉、斷崖、古樹、裂谷）或一個小聚落。${good?`那裡有：${what}。`:`那裡有危險：${what}，停在玩家要怎麼應對的那一刻。`}一定要填 place_new：{"name":"地名","kind":"冒險地點／地形／聚落","note":"一句話說明"}，loc 填那個地名。`,hours:3,explore:true,from};
  }
  if(k==="travel"){
    const h=(S.world[S.at].links[arg])||pathHours(S.at,arg)||2, nd=S.world[arg]||{kind:"",note:""};
    return {label:`前往${arg}`,prompt:`【這段要發生的事（程序抽到的，照這個寫）】你從${S.at}走到${arg}（${nd.kind}），路上花了 ${h} 個小時。${nd.note?`那裡的情況：${nd.note}`:""}寫出路上和抵達時看到的樣子，不要安排戰鬥。loc 填「${arg}」。`,hours:h,node:arg,from:S.at};
  }
  if(k==="forage"){
    const items=[rnd(FORAGE)]; if(Math.random()<0.5)items.push(rnd(FORAGE));
    let give={items:[...new Set(items)]}, extra="";
    if(Math.random()<0.3){const {sp}=pickPrey({F:reg.F.length?reg.F:[["雪雀",""]]});give.corpse={name:`凍死的${sp}`,sp,lv:"F",found:true};extra=`，還有一隻剛凍死的${sp}`}
    const spot2=S.at&&S.world[S.at]&&S.world[S.at].kind!=="地區"?S.at:reg.n;
    return {label:`在${spot2}採集`,prompt:`【這段要發生的事（程序抽到的，照這個寫）】你在${spot2}附近採集。你找到了：${give.items.join("、")}${extra}（程序已經放進你的背包，不要再填 found）。寫出採集的過程，可以順帶一點這一帶的動靜。`,give};
  }
  if(k==="scav"){
    const give={items:[]}; let what=rnd(SCAV);
    if(Math.random()<0.35){give.corpse={name:"剛死的老鼠",sp:"老鼠",lv:"F"};what="一隻剛死的老鼠"}
    else if(what==="牆縫裡的蟲子"){give.corpse={name:"蟲子",sp:"蟲子",lv:"F"}}
    else give.items.push(what);
    return {label:"在洞裡搜刮",prompt:`【這段要發生的事（程序抽到的，照這個寫）】你還是幼體，只能在洞裡翻找。你找到了：${what}（程序已經處理，不要再填 found）。寫出翻找的過程，巢穴裡的誰可能注意到你。`,give};
  }
  if(k==="nest"&&!inNest()){
    const h=pathHours(S.at,NEST())||2;
    return {label:`回${NEST()}`,node:NEST(),from:S.at,hours:h,prompt:`【這段要發生的事（程序抽到的，照這個寫）】你從${S.at}走回${NEST()}，路上花了 ${h} 個小時。到洞口時正好碰上：${nestEvent()}。loc 填「${NEST()}」。`,hours:2,region:"${NEST()}周邊"};
  }
  if(k==="nest"){
    return {label:"在巢穴裡走動",prompt:`【這段要發生的事（程序抽到的，照這個寫）】你在巢穴裡走動。正好碰上：${nestEvent()}。寫出這個場面，讓巢穴裡的人照他們的想要和本能行動。`};
  }
}
function doMenu(k,arg){
  if(busy||S.dead)return;
  if(k==="rest")return doRest();
  if(k==="go"){TRAVEL=!TRAVEL;render();return}
  TRAVEL=false;
  const sd=menuSeed(k,arg), pre=snap();
  S.log.push({who:"you",text:sd.label,prompt:sd.prompt,time:sd.hours||MENU_HOURS[k]||1,give:sd.give||null,node:sd.node||null,from:sd.from||null,reveal:!!sd.reveal,explore:!!sd.explore,pre});
  S.opts=[]; S.err=null; save();
  doJob({kind:"turn",prompt:sd.prompt},pre,S.log.length-1);
}
function doRest(){
  const pre=snap(), notes=[], hungry=hasTag("飢餓"), night=S.hour>=18||S.hour<6;
  S.log.push({who:"you",text:night?"睡覺":"小睡一下",pre});
  const n=night?(S.hour<6?6-S.hour:30-S.hour):3;     // 夜裡睡到 06:00；白天只能小睡 3 小時
  advanceTime(n,notes,true);                          // 睡著時餓肚子不扣 HP
  if(!S.dead){
    const fed=!hasTag("飢餓");
    /* 夜裡：沒餓 HP 回一半、MP 回滿；餓著 HP 不回、MP 回一半。白天小睡：沒餓 HP、MP 各回四分之一。 */
    const hp=fed?Math.ceil(S.hpMax/(night?2:4))+(night?regenLv()*2:0):0;
    const mp=night?(fed?S.mpMax:Math.ceil(S.mpMax/2)):(fed?Math.ceil(S.mpMax/4):0);
    const ah=Math.min(hp,S.hpMax-S.hp), am=Math.min(mp,S.mpMax-S.mp);
    S.hp+=ah; S.mp+=am; checkDeath(notes);
    const cleared=night?S.tags.filter(t=>fed?TEMP(t):/疲|累|酸|僵/.test(t)):S.tags.filter(t=>/疲|累/.test(t));
    S.tags=S.tags.filter(t=>!cleared.includes(t));
    S.party.forEach(p=>{if(night&&fed){p.tags=p.tags.filter(t=>t!=="負傷");if(p.tags.includes("重傷")){p.tags=p.tags.filter(t=>t!=="重傷");p.tags.push("負傷")}}});
    notes.push(`${night?"睡了一覺":"歇了一會"}：HP +${ah}　MP +${am}${cleared.length?`　消除 ${cleared.map(t=>`【${t}】`).join("")}`:""}`);
    if(!fed)notes.push(hungry?"餓著肚子睡不好，身體沒怎麼恢復。":"睡到一半餓醒了，身體沒怎麼恢復。");
  }
  S.tick=0;
  S.log.push(sysEntry([`你縮進角落，閉上眼睛。醒來時是${timeStr()}。`,...notes].join("\n")));
  save(); render();
}
const EAT=/吃|吞|啃食|嚼|咬下|吸收/;
function findFood(name){
  const clean=x=>String(x||"").replace(/的屍體|屍體|（.*?）|\s*[x×]\s*\d+$/g,"").trim();
  const n=clean(name);
  let i=S.corpses.findIndex(c=>name.includes(c.name)||(clean(c.name)&&name.includes(clean(c.name)))||(c.sp&&name.includes(c.sp))||(n&&(clean(c.name).includes(n)||String(c.sp).includes(n))));
  if(i>=0)return {type:"c",i};
  i=S.items.findIndex(it=>name.includes(clean(it))||(n&&clean(it).includes(n)));
  if(i>=0)return {type:"i",i};
  return null;
}
/* 模型回報玩家吃了什麼：死物、不新鮮的先吃，能學技能的只結算一樣 */
async function autoEat(names){
  let learned=false;
  for(const nm of names){
    const tg=findFood(nm); if(!tg)continue;
    if(tg.type==="i"){eatItem(tg.i,`（吃掉${S.items[tg.i]}）`);continue}
    const c=S.corpses[tg.i];
    if(isFresh(c)&&learned){S.log.push(sysEntry(`${c.name}先留著——一次吸收不了那麼多。`));continue}
    if(isFresh(c))learned=true;
    await eatCorpse(tg.i,`（吃掉${c.name}）`);
  }
  save(); render();
}
/* 在場、而且會在意的人：同族的一定在意；人類、精靈、矮人、半身人看到吃任何類人都會在意。哥布林之類的魔物只在意自己的同族。 */
const RACES=["大哥布林","半身人","半獸人","狗頭人","野豬人","牛頭人","蜥蜴人","食人魔","冒險者","人類","精靈","矮人","哥布林","諾姆","獸人"];
const raceOf=t=>{const r=RACES.find(k=>String(t||"").includes(k));return r==="冒險者"?"人類":r||null};
const CIVIL=/人類|精靈|矮人|半身人/;
function witnesses(c){
  const vr=c?raceOf(`${c.sp||""}${c.name||""}`):null;
  const pk=n=>{const p=S.party.find(q=>q.n===n);return p?`${p.kind||""}${p.kind0||""}`:""};
  const here=[...S.npcs.filter(x=>x.where===S.at&&!x.foe).map(x=>({n:x.n,t:`${pk(x.n)}${x.role||""}${x.kind||""}${x.n}`})),
    ...S.party.filter(p=>p.with&&!S.npcs.some(x=>x.n===p.n&&x.where===S.at)).map(p=>({n:p.n,t:`${p.kind||""}${p.kind0||""}`}))];
  const seen=new Set();
  return here.filter(w=>{if(seen.has(w.n))return false;seen.add(w.n);const r=raceOf(w.t)||"哥布林";return !vr||r===vr||CIVIL.test(r||"")}).map(w=>w.n);
}
function eatCorpse(i,label,how){
  if(busy||S.dead)return;
  const c=S.corpses[i]; if(!c)return;
  const pre=snap(), w=isHumanoid(c)?witnesses(c):[];
  if(w.length&&!how)how=/偷偷|私下|拖到|沒人|躲起來/.test(label||"")?"private":"public";
  S.log.push({who:"you",text:label||(how==="private"?`把${c.name}拖到沒人的地方吃掉`:`吃掉${c.name}`),pre});
  if(w.length&&how==="private"){const n=[`你把${c.name}拖到沒人看見的地方。`];advanceTime(1,n);S.log.push(sysEntry(n.join("\n")))}
  if(w.length&&how==="public"){
    const n=[`你當著${w.join("、")}的面吃起了${c.name}。`];
    relChange(S.npcs.filter(x=>w.includes(x.n)).map(x=>({name:x.n,d:-1,why:"看到你當眾吃了"+cleanName(c.name)})),n);
    S.party.filter(p=>w.includes(p.n)&&!S.npcs.some(x=>x.n===p.n)).forEach(p=>n.push(`${p.n}別開了臉，往後縮了一下。`));
    const home=homeOf({role:c.sp,n:c.name});
    if(w.some(x=>{const y=S.npcs.find(z=>z.n===x);return y&&CIVIL.test(raceOf(y.role)||"")}))heatAdd(2,"當眾吃人的事傳出去了",n);
    if(home&&S.world[home]){S.world[home].grudge=(S.world[home].grudge||0)+1;stChange(home,-1,"當眾吃了他們的族人",n);n.push(`${home}的${String(c.sp).replace(/[^一-鿿]/g,"")||"族人"}會記住這件事。`)}
    S.log.push(sysEntry(n.join("\n")));
  }
  if(c.found&&isFresh(c)&&gIdx(c.lv)>gIdx(S.lv)){
    const d=dmgOf(c.lv);
    const ch={what:`硬吞下${c.name}`,foe:null,foeLv:c.lv,adv:[],dis:[],local:{corpse:i},
      costs:[{t:`腹中翻攪（HP -${d}）`,hp:-d},{t:"吞得太急，【中毒】",tag:"中毒"}]};
    const e={who:"gm",kind:"sys",alts:[{text:`${c.name}比你高級。這種肉不是你的胃隨便撐得住的。`,opts:[],check:ch}],i:0};
    S.log.push(e); S.opts=[]; save(); render(); return;
  }
  return devour(i,c.big?"大成功":"成功");
}
async function devour(i,tier){
  const c=S.corpses[i], notes=[];
  S.corpses.splice(i,1);
  const hf=hungerOf().full; feed(c.small?Math.ceil(hf/2):hf); const heal=c.small?1:2; S.hp=Math.min(S.hpMax,S.hp+heal); checkDeath(notes);
  const fresh=isFresh(c);
  if(fresh&&S.stage==="幼體"){S.growth++; if(S.growth>=3)grow(notes)}
  let lines=[`你把${c.name}吃得乾乾淨淨。${c.small?"墊了墊肚子":"肚子填飽了"}（HP +${heal}）。`];
  let cands=[];
  if(c.harvested)lines.push("〈系統〉《大賢者》：「告。原料已經拆走，無可吸收。」");
  else if(!fresh)lines.push("〈系統〉《大賢者》：「告。已經不新鮮，無可吸收。」");
  else if(tier==="失敗")lines.push("〈系統〉《大賢者》：「告。吸收失敗。」");
  else{
    /* 比你低：0~1；同級保底 1；每高一級 +1；大成功再 +1，最多 4 */
    const diff=gIdx(c.lv)-gIdx(S.lv);
    let n=diff<0?rint(0,1):1+diff;
    if(tier==="大成功"&&diff>=0)n++;
    n=Math.min(4,n);
    if(n>0){
      busy=true; render();
      let pool=await poolFor(c);
      const cl=c.cls||classOf(c.name);
      if(cl&&CLASSES[cl]){pool=[...CLASSES[cl].pool,...pool.filter(p=>!CLASSES[cl].pool.some(q=>q.n===p.n))];n=Math.min(4,n+1)}
      busy=false;
      const cand=pool.filter(p=>!S.skills.some(x=>x.n===p.n));   // 已經會的不再出現
      {const cl2=c.cls||classOf(c.name), cp=cl2?cand.filter(p=>CLASSES[cl2].pool.some(q=>q.n===p.n)):[];   // 帶職業的：至少一個職業技能
       const first=cp.length?[rnd(cp)]:[]; cands=[...first,...cand.filter(p=>!first.includes(p)).sort(()=>Math.random()-0.5)].slice(0,n)}
    }
    lines.push(cands.length?`〈系統〉《大賢者》：「告。可吸收：${cands.map(x=>x.n).join("、")}。請選擇一項。」`:"〈系統〉《大賢者》：「告。無可吸收。」");
  }
  {const lg=langOf(`${c.sp||""}${c.name}`);S.langs=S.langs||["哥布林語"];
   if(fresh&&tier!=="失敗"&&!c.harvested&&lg&&!S.langs.includes(lg)){S.langs.push(lg);lines.push(`〈系統〉《大賢者》：「告。習得語言：${lg}。現在聽得懂、也說得出${lg}了。」`)}}
  S.eaten.unshift({day:S.day,what:c.name,got:null});
  npcGone(cleanName(c.name),"被你吃掉",null);
  if(c.evo){S.evoReady={name:c.name,kind:c.kind||c.sp,lv:c.lv};lines.push("〈系統〉《大賢者》：「告。進化戰對手吞噬完成。進化開始。」")}
  S.log.push({who:"gm",kind:"devour",alts:[{text:[...lines,...notes].join("\n"),opts:S.opts.slice(),cands}],i:0});
  save(); render();
  if(c.evo&&!cands.length)evolve();
}
async function poolFor(c){
  const k=poolKey(c.sp)||poolKey(cleanName(c.name)); if(k)return POOLS[k];
  if(S.dex[c.sp])return S.dex[c.sp];
  const have=S.skills.filter(s=>s.sys!=="Unique").map(s=>s.n);
  const msg=[{role:"system",content:"你是文字遊戲的規則助手。只輸出 JSON。"},
    {role:"user",content:`哥布林主角吃下了「${c.name}」（種類：${c.sp}，${c.lv}級）。列出吃下它可能學到的 3~4 個技能，要符合${c.mat?"這種原料的來源或屬性（例如元素精石給那個元素的技能、魔獸的部位給那隻魔獸的本領）":"這種生物的身體特徵或本領"}。\n技能名 2~4 個字；系別只能是：${SYSTEMS.join("、")}。長在身上的能力（牙、爪、皮、感官）歸「天生」。\n如果這種生物確實有主角已有的同一種本領，可以沿用這個名字：${have.join("、")||"（無）"}；沒有就不要硬套。\n只輸出：{"pool":[{"n":"技能名","sys":"系別"}]}`}];
  try{
    const res=await callModel(msg,800,r=>{const o=parseObjs(r.txt).reverse().find(x=>Array.isArray(x.pool));if(!o)throw new Error("沒照格式");return o},null);
    const pool=res.val.pool.filter(p=>p&&p.n).slice(0,4).map(p=>({n:String(p.n).slice(0,6),sys:SYSTEMS.includes(p.sys)?p.sys:"天生"}));
    if(pool.length){S.dex[c.sp]=pool;return pool}
  }catch(e){}
  return [{n:"蠻力",sys:"天生"},{n:"耐寒",sys:"天生"},{n:"嗅覺",sys:"天生"}];
}
function learnFor(j,k){
  const L=S.log, e=L[L.length-1]; if(busy||!e||e.kind!=="devour")return;
  const p=e.alts[0].cands[j], a=S.party[k]; if(!p||!a)return;
  const pre=snap();
  S.log.push({who:"you",text:`把 ${p.n} 給 ${a.n}`,pre});
  let s=a.skills.find(x=>x.n===p.n), line;
  const fit=a.dir&&DIRS[a.dir].sys.test(p.sys)?1:0;
  if(s){const o=s.g;s.g=a.lv;line=`〈系統〉《世界之聲》：「${a.n} 的 ${p.n} ${o}級→${s.g}級。」${fit?"（對路）":""}`}
  else{a.skills.push({n:p.n,sys:p.sys,g:a.lv});line=`〈系統〉《世界之聲》：「${a.n} 習得 ${p.n}（${a.lv}級・${p.sys}）。」${fit?"（對路）":""}`}
  if(S.eaten[0]&&!S.eaten[0].got)S.eaten[0].got=`${p.n}（給${a.n}）`;
  S.log.push(sysEntry(`你把湧上來的力量分了出去。\n${line}`)); save(); render();
  if(S.evoReady)evolve();
}
/* ═════════ 同伴成長（v0.36）═════════
   存在值：留在巢穴打獵每天 +1，跟著你協助一次 +2，滿 20 進化（第一次進化取名選職業；等級 +1，存在值歸零）。
   同伴最高等級＝主角等級 −1（最低 F）；低於這個等級就上不了戰場。上得了戰場的同伴在場就永久減傷 −1（兩個 −2）。
   同伴的能力一天全隊合計 2 次：戰士＝防禦（替你吃這次的 HP 代價，自己【負傷】）、法師＝增傷（多一層優勢）、祭司＝治療（回 50% HP，一天一次）。 */
const EVO_PTS=20;
const allyElig=p=>!!p.with&&!p.tags.includes("重傷")&&gIdx(p.lv)>=gIdx(allyLv());
const allyShield=()=>S&&S.party?Math.min(2,S.party.filter(allyElig).length):0;
const ABIL={"戰士":"防禦","法師":"增傷","祭司":"治療","斥候":"情報","工匠":"交易"};
const CHECK_AB=["增傷","防禦"];
const allyAbOf=p=>p.named&&p.dir&&ABIL[p.dir]||null;
const allyUses=()=>S.allyUsed||0;
function allyAbOn(ch){
  if(!ch||!ch.allyAb||allyUses()>=2)return null;
  const p=S.party.find(x=>x.n===ch.allyAb); return p&&allyElig(p)&&CHECK_AB.includes(allyAbOf(p))?allyAbOf(p):null;
}
/* 主角進化時：同伴的等級上限提高，之前到頂存著的點數結算（不送額外點數：同伴變強要靠狩獵、協助、花時間） */
function allyCatchUp(notes){
  S.party.forEach(p=>{if(p.xp==null)p.xp=0;allyXp(p,0,notes)});
}
function allyXp(p,n,notes){
  if(gIdx(p.lv)>=gIdx(allyLv())&&!p.ready){p.xp=Math.min(EVO_PTS,(p.xp||0)+n);return}   // 已經到頂：點數先存著，主角進化後再用
  p.xp=Math.min(EVO_PTS,(p.xp||0)+n);
  if(p.xp>=EVO_PTS&&gIdx(p.lv)<gIdx(allyLv())){
    if(p.named){p.lv=GRADES[gIdx(p.lv)+1];p.xp=0;notes&&notes.push(`${p.n}進化了：${p.lv} 級，存在值歸零。`)}
    else if(!p.ready){p.ready=true;notes&&notes.push(`${p.n}的存在值湊滿了，可以進化。到主畫面取名、選職業。`)}
  }
}
/* v0.38 同伴代打：狩獵、環境遭遇、討伐戰、小頭目戰（進化戰除外）判定卡上選一位同伴替你上場。
   吃今天 2 次裡的 1 次；同伴等級≥對手＝2 層優勢，否則 1 層；HP 代價由同伴吃（他負傷），你的 MP 技能照常。 */
function allyDoOn(ch){
  if(!ch||!ch.allyDo||ch.war||allyUses()+(allyAbOn(ch)?1:0)>=2)return null;
  const p=S.party.find(x=>x.n===ch.allyDo); return p&&allyElig(p)?p:null;
}
const allyDoBonus=ch=>{const p=allyDoOn(ch);return p?(gIdx(p.lv||"F")>=gIdx(ch.foeLv||"F")?2:1):0};
/* 進化戰前，同伴指出候選對手的弱點：打那一隻時多一層優勢（吃 1 次） */
const WEAK=[[/狼|犬|獅|虎|豹|貓/,"怕火光和被繞到背後"],[/熊/,"動作慢，怕被拖著打"],[/蛛|蟲/,"怕煙和火"],[/蛇|蜥|龍/,"腹部沒有鱗，怕寒冷"],[/鳥|鷹|鴉/,"落地後笨拙，怕被網住"],[/豬|牛|鹿|羊/,"衝起來停不下來，怕陷阱"],[/石|岩|像/,"關節和接縫很脆"],[/哥布林|食人魔|獸人|人類/,"脾氣急，容易被激怒露出破綻"]];
function allyWeak(i){
  const f=S.evo&&S.evo.cands[i]; if(!f||busy||S.dead||f.weak||allyUses()>=2)return;
  const p=S.party.find(allyElig); if(!p)return;
  f.weak=(WEAK.find(([re])=>re.test(`${f.kind}${f.name}`))||[0,"動作有固定的節奏，多看幾次就找得到空檔"])[1]; S.allyUsed=allyUses()+1;
  S.log.push(sysEntry(`${p.n}盯著${f.name}看了很久：「${f.weak}。」打這一隻時多一層優勢。今天同伴能力還剩 ${2-S.allyUsed} 次。`)); save();render();
}
function allyScout(k){
  const p=S.party[k]; if(!p||busy||S.dead||!allyElig(p)||allyAbOf(p)!=="情報"||allyUses()>=2)return;
  const hid=hiddenOf(S.at); if(!hid.length){S.log.push(sysEntry(`${p.n}在${S.at}附近轉了一圈，沒有新的地方可以找了。`));save();render();return}
  const to=rnd(hid); S.world[to].known=true; S.allyUsed=allyUses()+1;
  S.log.push(sysEntry(`${p.n}先去探了路：發現了「${to}」（${S.world[to].kind}）。今天同伴能力還剩 ${2-S.allyUsed} 次。`)); save();render();
}
function allyHeal(k){
  const p=S.party[k]; if(!p||busy||S.dead||!allyElig(p)||allyAbOf(p)!=="治療"||S.healDay===S.day||allyUses()>=2)return;
  const g=Math.min(S.hpMax-S.hp,Math.ceil(S.hpMax/2)); S.healDay=S.day; S.allyUsed=allyUses()+1; S.hp+=g;
  S.log.push(sysEntry(`${p.n}替你治療：HP +${g}（今天同伴能力還剩 ${2-S.allyUsed} 次）。`)); save();render();
}
const maxSk=a=>5;   // v0.32：同伴技能最多 5 個，滿了由主角放棄再學
const allyCan=(a,p)=>{const s=a.skills.find(x=>x.n===p.n);return s?gIdx(s.g)<gIdx(a.lv):a.skills.length<maxSk(a)};
const DIRS={"戰士":{sys:/武技|天生/,skill:{n:"劍術",sys:"武技"}},"斥候":{sys:/暗|風|意圖/,skill:{n:"追蹤",sys:"意圖"}},"法師":{sys:/火|水|風|土|光|暗/,skill:{n:"火花",sys:"火"}},"工匠":{sys:/意圖|土/,skill:{n:"手巧",sys:"意圖"}},"祭司":{sys:/光|水/,skill:{n:"治癒",sys:"光"}}};
/* 同伴拿東西：魔法物品（附帶技能）放 gear，其餘放 hold（最多 3 件） */
function equipAlly(who,item,off,notes){
  const p=S.party.find(x=>x.n===who||(x.alias||[]).includes(who)); if(!p)return;
  p.hold=p.hold||[];
  if(off){const h=p.hold.findIndex(x=>x===item||x.includes(item)||item.includes(x));
    if(h>=0){S.items.push(p.hold[h]);notes.push(`${p.n}把 ${p.hold[h]} 還給你`);p.hold.splice(h,1);return}
    if(p.gear&&(p.gear===item||p.gear.includes(item))){S.items.push(p.gear);S.mat[p.gear]=p.gearMat;notes.push(`${p.n}把 ✦${p.gear} 還給你`);p.gear=null;p.gearMat=null}
    return}
  const i=S.items.findIndex(x=>x===item||x.includes(item)||item.includes(x)); if(i<0)return;
  const it=S.items[i], m=matOf(it);
  if(m&&m.skill){if(p.gear){S.items.push(p.gear);S.mat[p.gear]=p.gearMat}p.gear=it;p.gearMat=m;delete S.mat[it];S.items.splice(i,1);notes.push(`${p.n}拿著 ✦${it}（會用「${m.skill.n}」）`);return}
  if(p.hold.length>=3){S.items.push(p.hold.shift())}
  p.hold.push(it); if(m)p.holdMat=Object.assign(p.holdMat||{},{[it]:m}); delete S.mat[it]; S.items.splice(i,1); notes.push(`${p.n}拿著 ${it}`);
}
function nameEvolve(k,name,dir){
  const p=S.party[k]; if(!p||!DIRS[dir])return;
  const pre=snap(), notes=[];
  S.log.push({who:"you",text:`命名進化：${p.n}${name&&name!==p.n?` → ${name}`:""}（${dir}）`,pre});
  if(name&&name!==p.n)renameChar(p.n,name,notes);
  p.kind0=p.kind0||p.kind; p.kind=`${p.kind0}${dir}`; p.dir=dir; p.named=true;
  const sk=DIRS[dir].skill; if(!p.skills.some(x=>x.n===sk.n))p.skills.push({...sk,g:p.lv});
  notes.push(`〈系統〉《世界之聲》：「${p.n} 進化為 ${p.kind}。」`,`${p.n}習得 ${sk.n}（${p.lv}級・${sk.sys}）。之後給牠「${dir}」對路的技能會長得比較快。`);
  p.lv=GRADES[gIdx(p.lv)+1]||p.lv; p.xp=0; p.ready=false; notes.push(`${p.n}升到 ${p.lv} 級，存在值歸零。`);
  S.log.push(sysEntry(notes.join("\n"))); save(); render();
}
function learn(j){
  const L=S.log, e=L[L.length-1]; if(busy||!e||e.kind!=="devour")return;
  const p=e.alts[0].cands[j]; if(!p)return;
  const pre=snap(), notes=[];
  S.log.push({who:"you",text:`學習：${p.n}`,pre});
  let s=S.skills.find(x=>x.n===p.n), line;
  if(s){line=`〈系統〉《世界之聲》：「${p.n} 你已經會了，沒有學到新東西。」`}
  else{s=addSkill(p);line=`〈系統〉《世界之聲》：「習得 ${p.n}（${s.g}級・${p.sys}）。${s.box==="store"?"可用的位置滿了，先放進倉庫。":""}」`}
  notes.push(line); checkAroma(notes);
  if(boxList("store").length>boxCap(S.lv)[1])notes.push("〈系統〉《大賢者》：「告。倉庫滿了。請到技能頁整合或放棄。」");
  if(S.eaten[0]&&!S.eaten[0].got)S.eaten[0].got=`${p.n}（${s.g}）`;
  S.log.push(sysEntry(notes.join("\n"))); save(); render();
  if(S.evoReady)evolve();
}
/* 新技能：等級＝現在的主角等級；可用的位置還有就進可用，滿了進倉庫（超過上限也先收，到技能頁處理） */
function addSkill(p,g){
  const s={n:p.n,sys:p.sys,g:g||S.lv,box:boxList("act").length<boxCap(S.lv)[0]?"act":"store"};
  S.skills.push(s); return s;
}
/* 可用的位置有空，就把倉庫最前面的補進來（進化、整合、放棄、換技能之後）；補完看要不要覺醒異香 */
function fillAct(notes){
  while(boxList("act").length<boxCap(S.lv)[0]){const s=boxList("store")[0];if(!s)break;s.box="act"}
  checkAroma(notes);
}
const checkAroma=notes=>{if(boxList("act").length>=9)awakenAroma(notes)};
/* 〈異香〉：可用技能第一次滿 9 格時覺醒（升到 E 級才有 9 格，所以通常在打獵吃東西、學到新技能的時候出現） */
function awakenAroma(notes){
  if(S.skills.some(x=>x.n==="異香"))return;
  S.skills.push({n:"異香",sys:"Unique",lv:null,note:"可用技能第一次滿格時覺醒。你越強，聞起來越香。"});
  notes.push("〈系統〉《世界之聲》：「Unique skill『異香』覺醒。」","〈系統〉《世界之聲》（向所有吞噬者）：「第九名吞噬者已入場。」","洞裡所有的哥布林，同時抬起了頭。");
}
function skipLearn(){
  const L=S.log, e=L[L.length-1]; if(busy||!e||e.kind!=="devour")return;
  const pre=snap(); S.log.push({who:"you",text:"不學",pre});
  S.log.push(sysEntry("你把湧上來的感覺壓了下去。")); save(); render();
  if(S.evoReady)evolve();
}
function harvest(i){
  if(busy||S.dead)return;
  const c=S.corpses[i]; if(!c||!isBeast(c))return;
  const pre=snap(), sp=c.sp||cleanName(c.name), nm=`${sp}的${partOf(sp)}`;
  S.log.push({who:"you",text:`從${c.name}身上拆下原料`,pre});
  c.harvested=true; S.items.push(nm); S.mat[nm]={lv:c.lv,sp};
  const notes=[`你花了一個小時，從${c.name}身上剝下最值錢的部分：✦${nm}（魔法原料・${c.lv}級）。`,"剩下的只是肉，吃了能填肚子，學不到東西了。原料不會壞，可以留著做東西，或者哪天吃掉。"];
  advanceTime(1,notes);
  S.log.push(sysEntry(notes.join("\n"))); save(); render();
}
/* 吃魔法原料或魔法物品：原料從來源的技能池抽，成品直接給附帶的技能 */
async function eatMagic(i,label){
  const it=S.items[i], m=matOf(it); if(!m)return;
  const pre=snap();
  S.log.push({who:"you",text:label||`吃掉 ✦${it}`,pre});
  S.items.splice(i,1); delete S.mat[it];
  feed(Math.ceil(hungerOf().full/4));
  const lines=[`你把${it}嚼碎吞了下去。一股不屬於死物的力量在胃裡散開。`]; let cands=[];
  if(m.skill){cands=[m.skill]}
  else{
    const diff=gIdx(m.lv)-gIdx(S.lv); let n=Math.min(4,diff<0?rint(0,1):1+diff);
    if(n>0){busy=true;render();const pool=await poolFor({name:it,sp:m.sp,lv:m.lv,mat:true});busy=false;
      cands=pool.filter(p=>!S.skills.some(x=>x.n===p.n)).sort(()=>Math.random()-0.5).slice(0,n)}
  }
  lines.push(cands.length?`〈系統〉《大賢者》：「告。可吸收：${cands.map(x=>x.n).join("、")}。請選擇一項。」`:"〈系統〉《大賢者》：「告。無可吸收。」");
  S.eaten.unshift({day:S.day,what:it,got:null});
  S.log.push({who:"gm",kind:"devour",alts:[{text:lines.join("\n"),opts:S.opts.slice(),cands}],i:0});
  save(); render();
}
function eatItem(i,label){
  if(busy||S.dead)return;
  if(matOf(S.items[i]))return eatMagic(i,label);
  if(busy||S.dead)return;
  const it=S.items[i]; if(it==null)return;
  const pre=snap(), notes=[];
  S.log.push({who:"you",text:label||`吃掉${it}`,pre});
  S.items.splice(i,1);
  if(EDIBLE_ITEM(it)){feed(Math.ceil(hungerOf().full/3));notes.push(`你把${it}嚼碎吞了下去，稍微填了點肚子。`)}
  else notes.push(`你硬是把${it}吞了下去。肚子不太舒服，也沒填飽什麼。`);
  if(/蘑菇/.test(it)&&Math.random()<0.4){addTag("腹痛");notes.push("沒多久，肚子開始絞痛。【腹痛】")}
  notes.push("〈系統〉《大賢者》：「告。死物無可吸收。」");
  S.eaten.unshift({day:S.day,what:it,got:null});
  S.log.push(sysEntry(notes.join("\n"))); save(); render();
}
function pay(sel,sac){
  const L=S.log, e=L[L.length-1]; if(busy||!e)return;
  const ch=e.alts[e.i].check; if(!ch)return;
  if(!ch.war&&!ch.raid)sac=null;
  const ci=checkInfo(ch); let gUsed=false;
  const chosen=sel.map(i=>ci.costs[i]).filter(c=>c&&(!c.g||!gUsed&&(gUsed=true))), tier=tierOf(chosen.length+(sac?2:0),ci);
  const pre=snap(), notes=[];
  const paidT=[...chosen.map(c=>c.t),...(sac?[`舍身：${sacLabel(sac)}`]:[])];
  if(ch.foe&&!ch.war&&!ch.raid&&!ch.local)S.lastFoe={name:ch.foe,lv:ch.foeLv||"F",cls:ch.multi&&ch.multi.cls||null};
  S.log.push({who:"you",text:`${ch.useSk?`用「${ch.useSk}」，`:""}${paidT.length?`付出：${paidT.join("、")}（${tier}）`:`不付代價，硬上（${tier}）`}`,pre});
  const skMp=skillMp(ch);
  if(ch.useSk&&!skUsed(ch.useSk)&&(!skMp||S.mp>=skMp)){S.usedSk=S.usedSk||[];S.usedSk.push(ch.useSk)}
  if(ch.useItem&&S.items.includes(ch.useItem)){S.items=S.items.filter(x=>x!==ch.useItem);notes.push(`用掉了 ${ch.useItem}（普通武器防具，一次性）：多一層優勢。`)}
  if(weakSk(ch)){const wn=itemOfSk(ch.useSk), wl=matOf(wn).lv;       // 等級不夠硬用：物品壞掉，無法修復
    S.items=S.items.filter(x=>x!==wn);delete S.mat[wn];S.party.forEach(p=>{if(p.gear===wn){p.gear=null;p.gearMat=null}});
    notes.push(`✦${wn}（${wl}級）撐不住 ${ch.foeLv} 級的對手，碎掉了，沒辦法修復。`)}
  if(skMp&&S.mp>=skMp){S.mp-=skMp;notes.push(`用「${ch.useSk}」：MP -${skMp}`)}
  const dp=allyDoOn(ch);
  const ab=allyAbOn(ch), abP=ab&&S.party.find(x=>x.n===ch.allyAb);
  if(dp){S.allyUsed=allyUses()+1;notes.push(`${dp.n}替你上場（代打）：今天同伴能力還剩 ${Math.max(0,2-S.allyUsed)} 次。`)}
  if(abP){S.allyUsed=allyUses()+1;notes.push(`${abP.n}幫忙（${ab}）：今天同伴能力還剩 ${2-S.allyUsed} 次。`)}
  chosen.forEach(c=>{if(dp&&!(ab==="防禦"&&abP)&&c.hp){woundAlly(dp.n,notes);notes.push(`${dp.n}替你吃下這一下（HP 沒扣）。`);const c3={...c};delete c3.hp;applyCost(c3,notes)}else if(ab==="防禦"&&c.hp&&abP){woundAlly(abP.n,notes);notes.push(`${abP.n}替你擋下這一下（HP 沒扣）。`);const c2={...c};delete c2.hp;applyCost(c2,notes)}else applyCost(c,notes)}); if(sac)sacDo(sac,notes);
  if(!ch.local&&!ch.war&&ch.foe)S.party.filter(allyElig).forEach(p=>allyXp(p,2,notes));
  const stall=!!ch.foe&&!ch.war&&!ch.raid&&chosen.some(c=>c.time);
  if(stall)S.fightDelay=ch.foe;
  if(notes.length)S.log.push(sysEntry(notes.join("　")));
  if(S.dead){save();render();return}
  if(ch.local){                              // 硬吞高級屍體：不用模型
    if(tier==="失敗"){
      const n2=[]; const c=S.corpses[ch.local.corpse], d=dmgOf(c.lv);
      S.hp-=d; addTag("中毒"); feed(Math.ceil(hungerOf().full/4)); S.corpses.splice(ch.local.corpse,1); checkDeath(n2);
      S.log.push(sysEntry([`你吐了出來，吐得渾身發抖（HP -${d}，【中毒】）。`,"〈系統〉《大賢者》：「告。吸收失敗。」",...n2].join("\n")));
      save(); render(); return;
    }
    return devour(ch.local.corpse,tier);
  }
  if(ch.raid&&S.raid){
    const r=S.raid; let dmg=0;
    if(tier==="失敗"){dmg=dmgOf(ch.foeLv);S.hp-=dmg;r.fails++;const n=S.nest,n2=[`${r.name}衝破了一段防線：HP -${dmg}`];
      if(n.pop>1){n.pop--;n2.push(`人口：${POP[n.pop-1]}`)} if(n.d>1){n.d--;n2.push(`戰力：${DEF[n.d-1]}`)} checkDeath(n2);S.log.push(sysEntry(n2.join("　")))}
    else r.wins+=tier==="大成功"&&r.of>=5?2:1;
    r.mom=tier==="大成功"?1:tier==="失敗"?-1:0; r.stage++;
    if(S.dead){S.raid=null;save();render();return}
    const half=Math.floor(r.of/2)+1, end=r.fails>=half?"lose":(r.wins>=half||r.stage>r.of)?(r.wins>r.fails?"win":"lose"):null;
    S.opts=[]; save();
    doJob({kind:"raid",ctx:{stage:r.stage,end,prev:{tier,paid:paidT,dmg,skill:ch.useSk||null}}},snap(),S.log.length); return;
  }
  if(ch.war&&S.war){
    let dmg=0;
    if(tier==="失敗"){dmg=dmgOf(ch.foeLv)+1;S.hp-=dmg;const n2=[`${S.war.foe.name}佔了上風：HP -${dmg}`];checkDeath(n2);S.log.push(sysEntry(n2.join("\n")))}
    S.war.mom=tier==="大成功"?1:tier==="失敗"?-1:0; S.war.stage++;
    if(S.dead){save();render();return}
    S.opts=[]; save();
    doJob({kind:"war",ctx:{stage:S.war.stage,prev:{tier,paid:paidT,dmg,skill:ch.useSk||null}}},snap(),S.log.length); return;
  }
  if(ch.multi&&ch.multi.n<ch.multi.of&&tier!=="大成功"){         // 連戰：還有下一階段
    if(ch.multi.group&&tier!=="失敗")ch.multi.won=(ch.multi.won||0)+1;
    let dmg=0;
    if(tier==="失敗"){dmg=dmgOf(ch.foeLv)+1;S.hp-=dmg;const n2=[`${ch.foe}佔了上風：HP -${dmg}`];checkDeath(n2);S.log.push(sysEntry(n2.join("\n")))}
    if(S.dead){save();render();return}
    S.opts=[]; save();
    doJob({kind:"stage",ctx:{foe:ch.foe,foeLv:ch.foeLv,multi:ch.multi,tier,paid:paidT,dmg,skill:ch.useSk||null,mom:tier==="失敗"?-1:0}},snap(),S.log.length); return;
  }
  const ctx={what:ch.what,foe:ch.foe,foeLv:ch.foeLv,tier,paid:chosen.map(c=>c.t),skill:ch.useSk||null,stall,boss:ch.multi&&ch.multi.cls||null,group:ch.multi&&ch.multi.group||0,won:ch.multi&&ch.multi.won||0,rout:!!(ch.multi&&tier==="大成功"&&ch.multi.n<ch.multi.of),fac:stall?Object.keys(S.factions).find(k=>S.factions[k].n>0&&facRe(k).test(ch.foe))||null:null};
  S.opts=[]; save();
  doJob({kind:"resolve",ctx},snap(),S.log.length);
}


/* ═════════ 技能整合與換技能（v0.26）═════════
   整合：5 個同大類（戰鬥／機動／生存）、同等級的技能併成 1 個高一級的，結果不能超過「主角等級＋1」。
   整合、可用↔倉庫互換都花 4 小時，而且有機率出一件小麻煩（程式抽機率，模型寫內容，只扣一點 HP）。 */
let MG=[], MGK="", SWI=[], SWO=[];   // SWI：要換進可用的（倉庫裡勾的）、SWO：要換出去的（可用裡勾的）
function mergeGroups(){
  const m={};
  realSk().forEach(s=>{const k=`${clsOf(s)}:${s.g}`;(m[k]=m[k]||[]).push(s)});
  return Object.entries(m).filter(([,a])=>a.length>=5).map(([k,a])=>{const [fn,g]=k.split(":");
    return {k,fn,g,to:GRADES[gIdx(g)+1]||null,list:a,ok:gIdx(g)<=gIdx(S.lv)&&gIdx(g)<6}});
}
const BAD_FALLBACK=["突然下起冷雨，你縮在角落裡發抖，等到雨停。","洞外傳來腳步聲，你屏住氣等它走遠，什麼都沒做成。","一陣落石滾下來，擦過你的肩膀。","風雪突然變大，你被困住了好一陣子。"];
async function fourHours(what,notes,hours){
  const night=!isDay(S.hour), p=Math.min(0.6,(inNest()?0.10:0.35)+(night?0.10:0));
  advanceTime(hours||4,notes);
  if(Math.random()>=p)return;
  let txt=null;
  try{
    const res=await callModel([{role:"system",content:"你是文字遊戲的規則助手。只輸出 JSON。"},
      {role:"user",content:`哥布林主角在「${S.loc}」（${inNest()?"巢穴裡":"野外"}，${night?"夜裡":"白天"}）花了 ${hours||4} 小時${what}。這段時間出了一件小麻煩：天氣突變、落石、巡邏的獵人經過、同伴出狀況之類，要符合地點，分量輕，沒人會死。用一兩句話寫發生了什麼。只輸出：{"event":""}`}],300,
      r=>{const o=parseObjs(r.txt).reverse().find(x=>x&&typeof x.event==="string"&&x.event.trim());if(!o)throw new Error("沒照格式");return o},null);
    txt=res.val.event.trim().slice(0,120);
  }catch(e){}
  const d=rint(1,3); S.hp=Math.max(1,S.hp-d);
  notes.push(`${txt||rnd(BAD_FALLBACK)}（HP -${d}）`);
}
const skBusy=()=>{if(S.err){TOAST="上一個動作還沒完成（有「重試」或「撤回」沒按），先處理它，再整理技能。";render();return true}return false};
async function mergeSkills(){
  if(busy||S.dead||skBusy())return;
  const picks=MG.map(i=>S.skills[i]).filter(Boolean);
  if(picks.length!==5||new Set(picks.map(s=>`${clsOf(s)}:${s.g}`)).size!==1)return;
  const g0=picks[0].g, g1=GRADES[gIdx(g0)+1], cls=clsOf(picks[0]), fc={}; picks.forEach(s=>fc[fnOf(s)]=(fc[fnOf(s)]||0)+1); const fn=Object.entries(fc).sort((a,b)=>b[1]-a[1])[0][0];
  if(!g1||gIdx(g0)>gIdx(S.lv))return;
  const pre=snap(), names=picks.map(s=>s.n);
  S.log.push({who:"you",text:`整合技能：${names.join("、")}`,pre});
  MG=[]; MGK=""; busy=true; render();
  let nm=null;
  try{
    const res=await callModel([{role:"system",content:"你是文字遊戲的規則助手。只輸出 JSON。"},
      {role:"user",content:`哥布林主角把 5 個「${cls}」類技能整合成一個高一級的技能：${names.join("、")}。取一個新技能名（2~4 個字，要像這幾個技能的上位版）。系別只能是：${SYSTEMS.join("、")}。只輸出：{"n":"技能名","sys":"系別"}`}],300,
      r=>{const o=parseObjs(r.txt).reverse().find(x=>x&&typeof x.n==="string"&&x.n.trim());if(!o)throw new Error("沒照格式");return o},null);
    nm=res.val;
  }catch(e){}
  const cnt={}; picks.forEach(s=>cnt[s.sys]=(cnt[s.sys]||0)+1);
  const sys=nm&&SYSTEMS.includes(nm.sys)?nm.sys:Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
  let n=String((nm&&nm.n)||`${names[0]}・極`).trim().slice(0,6);
  if(S.skills.some(x=>x.n===n&&!picks.includes(x)))n=(n+"・進").slice(0,6);
  S.skills=S.skills.filter(s=>!picks.includes(s));
  const s=addSkill({n,sys},g1); s.fn=fn;
  const notes=[`〈系統〉《大賢者》：「告。技能整合完成：${names.join("、")} → ${n}（${g1}級・${sys}）。」`,`你花了 4 小時，把這幾種力量揉成一個。`];
  await fourHours("整合技能",notes);
  fillAct(notes);
  busy=false; S.log.push(sysEntry(notes.join("\n"))); save(); render();
}
/* 整理技能：倉庫裡勾幾個換進可用、可用裡勾幾個換出去，不管幾個合計 4 小時。換完可用的數量不能超過上限。 */
const swapOk=()=>SWI.length+SWO.length>0&&boxList("act").length+SWI.length-SWO.length<=boxCap(S.lv)[0];
async function swapSkills(){
  if(busy||S.dead||!swapOk()||skBusy())return;
  const ins=SWI.map(i=>S.skills[i]).filter(s=>s&&!isUq(s)&&(s.box||"act")==="store");
  const outs=SWO.map(i=>S.skills[i]).filter(s=>s&&!isUq(s)&&(s.box||"act")==="act");
  if(!ins.length&&!outs.length)return;
  const pre=snap();
  S.log.push({who:"you",text:`整理技能：${ins.length?`換進 ${ins.map(s=>s.n).join("、")}`:""}${ins.length&&outs.length?"，":""}${outs.length?`換出 ${outs.map(s=>s.n).join("、")}`:""}`,pre});
  SWI=[]; SWO=[]; busy=true; render();
  ins.forEach(s=>s.box="act"); outs.forEach(s=>s.box="store");
  const notes=[`你花了 4 小時重新整理力量：${ins.length?`${ins.map(s=>s.n).join("、")} 換進可用`:""}${ins.length&&outs.length?"，":""}${outs.length?`${outs.map(s=>s.n).join("、")} 放回倉庫`:""}。`];
  await fourHours("整理技能",notes);
  const an=[]; checkAroma(an); notes.push(...an);
  busy=false; S.log.push(sysEntry(notes.join("\n"))); save(); render();
}

/* 藥水：紅回 HP、藍回 MP、紫兩個都回；喝掉就沒了，不花時間，也擋不住對手（戰鬥中判定照樣進行） */
/* 藥水給同伴：紅／紫治傷（負傷→好了、重傷→負傷）；藍沒有效果（同伴沒有 MP），不讓喝 */
function potionAlly(i,k){
  const it=S.items[i], c=POTION(it), p=S.party[k]; if(!c||!p||busy||S.dead||c==="藍")return;
  const had=p.tags.includes("重傷")?"重傷":p.tags.includes("負傷")?"負傷":null;
  S.items.splice(i,1);
  if(had==="重傷"){p.tags=p.tags.filter(t=>t!=="重傷");if(!p.tags.includes("負傷"))p.tags.push("負傷")}
  else if(had==="負傷")p.tags=p.tags.filter(t=>t!=="負傷");
  S.log.push(sysEntry(`你把 ${it} 餵給了 ${p.n}：${had==="重傷"?`重傷減輕成負傷`:had==="負傷"?`負傷好了`:"他沒有傷，白用了"}。`));
  save();render();
}
/* 藥水給 NPC／俘虜／想收服的魔物：回復 + 好感 +1（最多到「信賴」），所以也能拿來收服 */
function potionNpc(i,n){
  const it=S.items[i], c=POTION(it), x=S.npcs[n]; if(!c||!x||busy||S.dead)return;
  S.items.splice(i,1);
  const o=relOf(x); let up="";
  if(o<2){x.r=o+1;x.rel=REL[x.r+2];up=`，對你的態度變成「${x.rel}」`}
  S.log.push(sysEntry(`你把 ${it} 給了 ${x.n}：傷勢緩和了${up}。`));
  save();render();
}
function abandonAllySk(k,j){const p=S.party[k]; if(!p||!p.skills[j])return; const n=p.skills[j].n; p.skills.splice(j,1);S.log.push(sysEntry(`${p.n}忘掉了 ${n}。`));save();render()}
function drinkPotion(i){
  const it=S.items[i], c=POTION(it); if(!c||busy||S.dead)return;
  const hp=c!=="藍"?Math.min(S.hpMax-S.hp,Math.ceil(S.hpMax*0.4)):0, mp=c!=="紅"?Math.min(S.mpMax-S.mp,Math.ceil(S.mpMax*0.5)):0;
  S.items.splice(i,1);S.hp+=hp;S.mp+=mp;
  S.log.push(sysEntry(`你喝掉了 ${it}：${[hp?`HP +${hp}`:"",mp?`MP +${mp}`:""].filter(Boolean).join("、")||"沒有需要回復的地方，白喝了"}。`));
  save();render();
}

/* ═════════ 鍛造（v0.30）═════════
   白字武器＋魔法原料 → 魔法武器（等級＝原料等級，受物品等級上限限制；附帶技能從原料來源的技能池抽一個）。
   魔法武器＋更高級的魔法原料 → 升到原料的等級（附帶技能不變）。
   有工匠（同伴或族人的本事／名字帶「匠、鍛、鐵、鑄」）時比較快：魔化 2 小時（自己 6）、升級 4 小時（自己 12）。 */
let FGW=-1, FGM=-1;
const hasSmith=()=>(S.nest&&S.nest.lv&&facOn("鍛冶台"))||S.party.some(p=>/匠|鍛|鐵|鑄/.test(`${p.n||""}${p.knack||""}${p.role||""}${p.kind||""}`))||(S.npcs||[]).some(x=>x.where==="巢穴"&&/匠|鍛|鐵|鑄/.test(`${x.n||""}${x.role||""}${x.knack||""}`));
const forgeWeapons=()=>S.items.map((n,i)=>({n,i,m:matOf(n)})).filter(x=>(!x.m&&GEAR_RE.test(x.n)&&!POTION(x.n))||(x.m&&x.m.skill));
const forgeMats=()=>S.items.map((n,i)=>({n,i,m:matOf(n)})).filter(x=>x.m);   // 魔法原料或魔法物品都可以當原料（魔法物品會被消耗）
function forgePlan(wi,mi){
  const wn=S.items[wi], mn=S.items[mi];
  if(wn==null||mn==null)return {ok:false,text:"先選好裝備和原料，結果會顯示在這裡。"};
  if(wi===mi)return {ok:false,text:"裝備和原料不能是同一件。"};
  const wm=matOf(wn), mm=matOf(mn), tg=capItemLv(mm.lv), sm=hasSmith();
  if(!wm)return {ok:true,hours:sm?2:6,tg,text:`「${wn}」＋「${mn}」→ 魔法武器 ${tg} 級，附帶技能從${cleanName(mm.sp)}的技能池抽一個。${sm?"有工匠幫忙，2 小時。":"沒有工匠，自己來要 6 小時。"}`};
  if(gIdx(tg)<=gIdx(wm.lv))return {ok:false,text:`原料（${mm.lv} 級${gIdx(tg)<gIdx(mm.lv)?`，受等級上限只能算 ${tg} 級`:""}）沒有比「${wn}」（${wm.lv} 級）高，升不了級。`};
  return {ok:true,hours:sm?4:12,tg,text:`「${wn}」${wm.lv} 級＋「${mn}」→ ${tg} 級，附帶「${wm.skill.n}」不變。${sm?"有工匠幫忙，4 小時。":"沒有工匠，自己來要 12 小時。"}`};
}
const forgeHTML=()=>{
  const ws=forgeWeapons(), ms=forgeMats();
  if(!ws.some(x=>x.i===FGW))FGW=-1; if(!ms.some(x=>x.i===FGM))FGM=-1;
  const plan=forgePlan(FGW,FGM), ready=plan.ok&&FGW>=0&&FGM>=0;
  return `<div class="sacbox" style="margin:8px 0"><label>鍛造：三步——選裝備、選原料、確認組合</label>
    <div style="display:grid;grid-template-columns:1fr;gap:6px">
    <div><div class="k" style="font-size:12px">① 裝備（白字武器防具，或要升級的魔法武器）</div><select id="fgw"><option value="">${ws.length?"選裝備…":"（沒有可用的裝備）"}</option>${ws.map(x=>`<option value="${x.i}"${x.i===FGW?" selected":""}>${esc(x.n)}${x.m?`（✦${x.m.lv}級${x.m.skill?"・"+esc(x.m.skill.n):""}）`:"（普通）"}</option>`).join("")}</select></div>
    <div><div class="k" style="font-size:12px">② 原料（魔法原料，或拿一件魔法物品來拆）</div><select id="fgm"><option value="">${ms.length?"選原料…":"（沒有魔法原料或魔法物品）"}</option>${ms.map(x=>`<option value="${x.i}"${x.i===FGM?" selected":""}>${esc(x.n)}（${x.m.lv}級${x.m.skill?"・"+esc(x.m.skill.n):""}）</option>`).join("")}</select></div>
    <div><div class="k" style="font-size:12px">③ 結果</div><div class="note" style="margin:0">${esc(plan.text)}</div></div></div>
    <button class="paybtn" id="fgdo"${ready?"":" disabled"}>${ready?`確認組合・開始鍛造（${plan.hours} 小時）`:"確認組合（先選好裝備和原料）"}</button></div>`;
};
async function forge(){
  if(busy||S.dead||skBusy())return;
  const plan=forgePlan(FGW,FGM); if(!plan.ok)return;
  const wn=S.items[FGW], mn=S.items[FGM], mm=matOf(mn), wm=matOf(wn), pre=snap();
  S.log.push({who:"you",text:`鍛造：${wn}＋${mn}`,pre});
  busy=true; render();
  let sk=wm?wm.skill:null;
  if(!wm){
    let pool=[]; try{pool=await poolFor({name:mn,sp:mm.sp,lv:mm.lv,mat:true})||[]}catch(e){}
    const c=pool.length?rnd(pool):null; sk=c?{n:c.n,sys:c.sys}:{n:"蠻力",sys:"天生"};
  }
  let name=wm?wn:`${cleanName(mm.sp)}・${wn}`.slice(0,16);
  if(!wm&&S.items.includes(name))name=(name+"改").slice(0,16);
  S.items=S.items.filter(x=>x!==mn&&(wm?true:x!==wn));
  S.party.forEach(p=>{p.hold=(p.hold||[]).filter(x=>x!==mn&&(wm?true:x!==wn))});
  delete S.mat[mn]; if(!wm)delete S.mat[wn];
  if(!S.items.includes(name))S.items.push(name);
  S.mat[name]={lv:plan.tg,sp:wm?wm.sp:mm.sp,skill:sk};
  S.party.forEach(p=>{if(wm&&p.gear===wn)p.gearMat=S.mat[name]});
  FGW=-1; FGM=-1;
  const notes=[`你把${mn}做進了${wn}裡，花了 ${plan.hours} 小時。`,`〈系統〉《大賢者》：「告。${wm?`${name} 升到 ${plan.tg} 級，附帶「${sk.n}」不變`:`得到魔法武器 ✦${name}（${plan.tg} 級），附帶「${sk.n}」`}。」`];
  await fourHours("鍛造",notes,plan.hours);
  busy=false; S.log.push(sysEntry(notes.join("\n"))); save(); render();
}
