/* 魔物篇｜rules.js：規則：時間、飢餓、成長、生死；判定；進化戰與進化。
   所有 .js 共用同一個全域範圍，載入順序見 index.html；改之前先讀 README.md。 */
/* ═════════ 規則：時間、飢餓、成長、生死 ═════════ */
const hasTag=t=>S.tags.includes(t);
const addTag=t=>{if(t&&!hasTag(t))S.tags.push(t)};
const delTag=t=>{S.tags=S.tags.filter(x=>x!==t)};
const inNest=()=>S.at?S.at===NEST():String(S.loc||"").includes(NEST());
/* 暫時狀態：睡一晚會好的 */
const TEMP=t=>!/殘缺|幼體|飢餓|瀕死|（/.test(t)&&/疲|累|傷|痛|麻|凍|挫|擦|瘀|腫|流血|中毒|喘|虛|眩|酸|僵/.test(t);
const regenLv=()=>{const r=S.skills.find(x=>x.n==="再生");return r?Math.min(5,gIdx(r.g||S.lv)+1):0};   // 再生：F 回 1、E 回 2、D 回 3…最多 5
function grow(notes){
  S.stage="成體"; const old=S.hpMax; S.hpMax=20; S.hp=Math.min(S.hpMax,S.hp+10); delTag("幼體");
  notes.push(`〈系統〉《大賢者》：「告。個體成長完成。」`);
  notes.push(`你長大了：HP 上限 ${old}→${S.hpMax}。可以出巢狩獵、探索、採集了。`);
  chapCheck(notes);
}
function checkDeath(notes){
  if(S.hp>0){delTag("瀕死");return}
  if(hasTag("瀕死")||S.hp<0){S.hp=0;S.dead=true;notes.push("你的意識沉進黑暗裡。你死了。");return}
  S.hp=0; addTag("瀕死"); notes.push("〈系統〉《大賢者》：「警告。生命活動瀕臨停止。」你倒在地上，再受一點傷就會死。");
}
function advanceTime(h,notes,sleep){
  let starve=0, rhp=0, rmp=0, bleed=0;
  for(let i=0;i<h&&!S.dead;i++){
    S.min=0; S.hour++; if(S.hour>=24){S.hour=0;S.day++;dayChange(notes)}
    const hg=hungerOf();
    if(hasTag("飢餓")&&!sleep){S.starve=(S.starve||0)+1; if(S.starve>=hg.every){S.starve=0;S.hp-=1;starve++}}
    else if(S.full>0){S.full--; if(S.full<=0){S.full=0;addTag("飢餓");S.starve=0;notes.push("肚子又餓了。")}}
    if(S.stage==="幼體"&&S.day>=3)grow(notes);
    /* 醒著、沒餓：每 3 小時 HP +1（有再生就 +再生等級）、MP +1 */
    if(!sleep&&!hasTag("飢餓")&&!S.dead){S.tick=(S.tick||0)+1;
      if(S.tick>=3){S.tick=0;
        const ah=Math.min(S.hpMax-S.hp,Math.max(1,regenLv())), am=Math.min(S.mpMax-S.mp,1);
        if(S.hp>0&&ah>0){S.hp+=ah;rhp+=ah} if(am>0){S.mp+=am;rmp+=am}}}
    if(!sleep&&S.tags.some(t=>/流血/.test(t))&&S.hp>0){S.hp-=1;bleed++}
    if(S.hp<=0)checkDeath(notes);
    const rot=S.corpses.filter(c=>!c.evo&&ageOf(c)>=72);
    if(rot.length){S.corpses=S.corpses.filter(c=>!rot.includes(c));notes.push(`${rot.map(c=>c.name).join("、")}放太久，爛掉了。`)}
    if(S.raid&&!S.raid.on&&!S.raid.now&&nowH()>=S.raid.due){S.raid.now=true;notes.push(`〈系統〉《大賢者》：「警告。${S.raid.name}到了${NEST()}外面。」`)}
    if(S.evo&&!S.war&&S.evo.forced==null&&nowH()>=S.evo.due){
      S.evo.forced=rint(0,S.evo.cands.length-1); const f=S.evo.cands[S.evo.forced];
      notes.push(`〈系統〉《大賢者》：「警告。期限已過。${f.name}主動找上門了。」`);
    }
  }
  if(starve)notes.push(`飢餓：HP -${starve}`);
  if(bleed)notes.push(`【流血】：HP -${bleed}（包紮或睡一覺才會停）`);
  if(rhp||rmp)notes.push(`慢慢緩過來：${rhp?`HP +${rhp}`:""}${rhp&&rmp?"　":""}${rmp?`MP +${rmp}`:""}`);
}
function feed(h){delTag("飢餓");S.full=Math.max(S.full||0,h);S.starve=0}
/* 把食材變成「屍體」清單裡的東西：可以吃、新鮮的能學技能 */
function toCorpses(name,kind,lv,extra){
  const m=String(name).match(/\s*[x×＊*]\s*(\d+)\s*$/), q=Math.min(3,m?parseInt(m[1],10):1);
  const base=String(name).replace(/\s*[x×＊*]\s*\d+\s*$/,"").trim();
  const small=!kind||isFreshFood(base);
  return Array.from({length:q},()=>({name:base,sp:speciesOf(base,kind),lv:GRADES.includes(lv)?lv:"F",t:nowH(),small,...(extra||{})}));
}
function receive(name,notes){
  if(isFreshFood(name)){toCorpses(name).forEach(c=>S.corpses.push(c));if(notes)notes.push(`得到 ${name}（新鮮，可以吃）`)}
  else{S.items.push(name);if(notes)notes.push(`得到 ${name}`)}
}

/* ═════════ 判定 ═════════ */
function normCheck(c){
  if(!c||typeof c!=="object"||!Array.isArray(c.costs))return null;
  const num=(v,lo,hi)=>{v=parseInt(v,10);return isNaN(v)?0:Math.max(lo,Math.min(hi,v))};
  const costs=c.costs.filter(x=>x&&typeof x.t==="string"&&x.t.trim()).slice(0,4).map(x=>{
    const o={t:x.t.trim().slice(0,40)};
    if(x.hp)o.hp=-Math.abs(num(x.hp,-12,12)); if(x.mp)o.mp=-Math.abs(num(x.mp,-6,6));
    if(x.time)o.time=Math.max(1,Math.abs(num(x.time,-3,3)));
    if(typeof x.tag==="string"&&x.tag.trim())o.tag=x.tag.trim().replace(/[【】]/g,"").slice(0,12);
    if(typeof x.item==="string"&&x.item.trim())o.item=x.item.trim();
    if(typeof x.ally==="string"&&S.party.some(p=>p.n===x.ally.trim()&&p.with))o.ally=x.ally.trim();
    return o;
  }).filter(o=>!o.item||S.items.includes(o.item));
  const arr=a=>(Array.isArray(a)?a:[]).filter(x=>typeof x==="string"&&x.trim()).slice(0,3);
  const skn=boxList("act").filter(x=>!skUsed(x.n)).map(x=>x.n);
  const noSk=x=>!/Lv\s*\d|技能/.test(x)&&!skn.some(n=>x.includes(n));        // 技能由玩家選，不讓模型重複算
  const sug=typeof c.skill==="string"?skn.find(n=>c.skill.includes(n)||n===c.skill.trim()):null;
  const group=Math.max(1,Math.min(8,parseInt(c.group,10)||1));
  return {group,what:String(c.what||"這件事").slice(0,40),foe:c.foe?String(c.foe).slice(0,20):null,
    foeLv:GRADES.includes(c.foeLv)?c.foeLv:null,useSk:sug||null,adv:arr(c.adv).filter(noSk),dis:arr(c.dis).filter(x=>!/技能.*(低|不足|不夠)|等級.*(低|差)/.test(x)),costs};
}
/* 用技能扣 MP：自己的技能 1 點；魔法物品附帶的技能不用 */
/* 魔法物品的技能：物品等級低於對手 → 視同白字，沒有魔法效果（不算優勢），硬用物品會壞掉 */
const itemOfSk=k=>{const m=/（(.+)）$/.exec(k||"");return m&&S.items.includes(m[1])?m[1]:null};
const weakSk=ch=>{const n=ch&&itemOfSk(ch.useSk),m=n&&matOf(n);return !!(m&&ch.foeLv&&gIdx(m.lv)<gIdx(ch.foeLv))};
const skillMp=ch=>ch&&ch.useSk&&!/（.+）$/.test(ch.useSk)?1:0;
/* 同伴幫忙算的優勢最多 1 條（同伴再多也一樣），其他優勢照算 */
const isAllyAdv=x=>S.party.some(p=>p.n&&String(x).includes(p.n))||/同伴|夥伴|隊友|幫手|協助|聯手/.test(String(x));
const advList=ch=>(ch.adv||[]).filter(x=>!isAllyAdv(x));   // v0.36：同伴的幫忙不再算優勢，改成在場減傷＋能力（見 actions.js「同伴成長」）
/* 程序加的劣勢（v0.34）：幼體空手一打一；同行的同伴空手（逼玩家替同伴裝備）。只在有對手的判定算 */
const allyArmed=p=>!!p.gear||(p.hold||[]).some(h=>GEAR_RE.test(h));
const meArmed=()=>S.items.some(n=>GEAR_RE.test(n)&&!POTION(n));
function autoDis(ch){
  if(!ch||!ch.foe)return [];
  const out=[], withs=S.party.filter(p=>p.with);
  if(S.stage==="幼體"&&!meArmed()&&!withs.length)out.push("你還是幼體、手上沒有武器，一打一連同級的也打不過");
  withs.forEach(p=>{if(!allyArmed(p))out.push(`${p.n}空著手：容易被圍毆、陷入困境（給牠一把武器）`)});
  return out;
}
function checkInfo(ch){
  const lvDiff=ch.foeLv?Math.max(0,gIdx(ch.foeLv)-gIdx(S.lv)):0;
  const crit=!!(ch.war||ch.raid);                          // 關鍵戰（進化戰、討伐戰）：至少要付 1 項代價、傷害 ×1.5
  const net0=advList(ch).length+(ch.useSk&&!skUsed(ch.useSk)&&!weakSk(ch)&&S.mp>=skillMp(ch)?1:0)+(ch.useItem&&S.items.includes(ch.useItem)?1:0)+(allyAbOn(ch)==="增傷"?1:0)+allyDoBonus(ch)+(ch.war&&S.war&&S.war.foe&&S.war.foe.weak?1:0)-ch.dis.length-autoDis(ch).length-lvDiff, net=crit?Math.min(net0,0):net0;
  const need=Math.max(0,1-net), big=need+1;
  const d=Math.ceil(dmgOf(ch.foeLv)*(crit?1.5:1)), fight=!!ch.foe, stalled=fight&&S.fightDelay&&S.fightDelay===ch.foe;
  const half=Math.ceil(S.mpMax/2), skMp=skillMp(ch);
  const gen=[{t:`HP -${d}（硬吃一下）`,hp:-d,g:1}];
  if(S.mp-skMp>=half)gen.push({t:`MP -${half}（拼盡全力）`,mp:-half,g:1});
  if(!ch.war&&!ch.raid&&!stalled&&!ch.costs.some(c=>c.time))gen.push({t:fight?"多花兩小時（拖久了，會出新麻煩）":"多花兩小時",time:2,g:1});
  const costs=ch.costs.filter(c=>!(stalled&&c.time));            // 這場已經拖過一次：不能再拖
  return {lvDiff,net,need,big,costs:[...costs,...gen],stalled};
}
const tierOf=(n,ci)=>n<ci.need?"失敗":n>=ci.big?"大成功":"成功";


/* ═════════ 進化戰 ═════════ */
function startWar(i){
  if(busy||S.dead||!S.evo)return;
  const f=S.evo.cands[i]; if(!f)return;
  const pre=snap();
  const came=pre.evo&&pre.evo.forced!=null, notes=[];          // 逾期找上門：就在你現在的地方打；自己去挑戰：要走過去
  let foe=f;
  if(came)foe={...f,where:S.loc};
  S.war={foe,stage:1,mom:0,cands:S.evo.cands,sac:0}; S.evo=null; RETREAT=false;
  S.log.push({who:"you",text:`進化戰：${S.war.cands.length>1&&!came?"挑戰":"迎戰"} ${f.name}`,pre});
  if(!came){
    const rg=regionByLoc(f.where), rn=rg?(rg.n==="灰岩洞周邊"?"灰岩洞":rg.n):null;
    const node=nodeByLoc(f.where)||(rn&&S.world[rn]?rn:null);
    if(node&&node!==S.at){S.world[node].known=true;const h=pathHours(S.at,node)||2;
      notes.push(`你花了 ${h} 小時，從${S.at}走到${node}去找${f.name}。`);advanceTime(h,notes);S.at=node;S.loc=node}
  }else notes.push(`${f.name}找到了你，就在${S.at}。`);
  if(notes.length)S.log.push(sysEntry(notes.join("\n")));
  if(S.dead){S.war=null;save();render();return}
  S.opts=[]; S.err=null; save();
  doJob({kind:"war",ctx:{stage:1}},snap(),S.log.length);
}
function contWar(){
  if(busy||!S.war)return;
  doJob({kind:"war",ctx:{stage:S.war.stage}},snap(),S.log.length);
}
const SAC={hp:"HP 上限 -5",maim:"留下【殘缺】"};
function sacDo(v,notes){
  if(v==="hp"){S.hpMax-=5;S.hp=Math.min(S.hp,S.hpMax);notes.push(`舍身：HP 上限永久 -5（${S.hpMax}）`)}
  else if(v==="maim"){addTag("殘缺");notes.push("舍身：留下永久的【殘缺】")}
  else if(v&&v.startsWith("sk:")){const n=v.slice(3);S.skills=S.skills.filter(x=>x.n!==n);notes.push(`舍身：永遠失去了技能「${n}」`)}
}
const sacLabel=v=>v&&v.startsWith("sk:")?`失去技能「${v.slice(3)}」`:SAC[v]||"";
function retreat(k,arg){
  const w=S.war; if(!w||busy)return;
  const pre=snap(), notes=[]; let txt="撤退";
  if(k==="ally"){const p=S.party[arg];if(!p)return;S.party.splice(arg,1);txt=`撤退：讓 ${p.n} 斷後`;notes.push(`${p.n}擋在${w.foe.name}面前，替你爭取了逃走的時間。你再也沒見過牠。`)}
  else if(k==="item"){const it=S.items[arg];if(it==null)return;S.items.splice(arg,1);txt=`撤退：丟下 ${it}`;notes.push(`你把${it}丟在身後引開了牠。那是再也拿不回來的東西了。`)}
  else{txt=`撤退：${SAC[k]}`;sacDo(k,notes);notes.push("你拖著再也好不了的傷逃了出來。")}
  S.log.push({who:"you",text:txt,pre});
  S.war=null; S.evo={cands:w.cands,due:nowH()+48,forced:null}; RETREAT=false;
  notes.push(`〈系統〉《大賢者》：「告。進化戰中斷。存在值依然是滿的。新的期限：${hStr(S.evo.due)}。」`);
  advanceTime(1,notes);
  S.log.push(sysEntry(notes.join("\n"))); S.opts=["找個地方躲起來喘口氣",`回${NEST()}`,"想想下一次要怎麼打"]; S.log[S.log.length-1].alts[0].opts=S.opts.slice();
  save(); render();
}
/* 進化：吃掉進化戰對手之後 */
async function evolve(){
  const f=S.evoReady; if(!f||busy)return;
  busy=true; render();
  const next=nextLv(); let subs=null;
  try{
    const innate=S.skills.filter(x=>x.sys==="天生").sort((a,b)=>gIdx(b.g)-gIdx(a.g)).map(x=>`${x.n}（${x.g}）`);
    const msg=[{role:"system",content:"你是文字遊戲的規則助手。只輸出 JSON。西式黑暗奇幻，禁止武俠、修仙詞彙。"},
      {role:"user",content:`哥布林「${S.name}」吃掉了進化戰的對手 ${f.name}（${f.kind}，${f.lv}級），要從 ${S.lv} 級進化成 ${next} 級。\n天生技能：${innate.join("、")||"無"}\n全部技能：${S.skills.filter(x=>x.sys!=="Unique").map(x=>x.n).join("、")}\n${S.sub?`目前的種族：${S.sub.name}（${S.sub.essence}）\n`:""}給 3 個不同方向的亞種。名字是「○○哥布林」（○○是 2~3 字）。三個方向分別來自：吃掉的${f.kind}、主角等級最高的天生技能、主角目前的打法。\n每個鎖定一個本質（一句話：擅長什麼、身體怎麼變），再加一句外觀。\n只輸出：{"subs":[{"name":"","essence":"","look":""}]}`}];
    const res=await callModel(msg,900,r=>{const o=parseObjs(r.txt).reverse().find(x=>Array.isArray(x.subs));if(!o)throw new Error("沒照格式");return o},null);
    subs=res.val.subs.filter(x=>x&&x.name).slice(0,3).map(x=>({name:clean(String(x.name)).slice(0,10),essence:clean(String(x.essence||"")).slice(0,60),look:clean(String(x.look||"")).slice(0,60)}));
  }catch(e){}
  if(!subs||!subs.length){const k=String(f.kind).slice(0,2);
    subs=[{name:`${k}紋哥布林`,essence:`吃下的${f.kind}留在了身體裡，繼承了牠最擅長的本領。`,look:`身上浮出${f.kind}似的紋路。`},
          {name:"岩膚哥布林",essence:"皮膚變得又厚又硬，挨打的本事比誰都強。",look:"灰褐色的皮膚上長滿石頭般的鱗片。"},
          {name:"夜行哥布林",essence:"在黑暗裡看得更清、走得更靜，擅長偷襲。",look:"眼睛變大，瞳孔像貓一樣細長。"}]}
  busy=false;
  S.log.push({who:"gm",kind:"evo",alts:[{text:"〈系統〉《世界之聲》：「進化條件達成。請選擇進化方向。」",opts:[],subs}],i:0});
  save(); render();
}
function pendingSubs(){const e=S.log[S.log.length-1];return e&&e.kind==="evo"?e.alts[0].subs:null}
function pickSub(j){
  const e=S.log[S.log.length-1]; if(busy||!e||e.kind!=="evo")return;
  const sb=e.alts[0].subs[j]; if(!sb)return;
  const pre=snap(), old=S.lv, oh=S.hpMax, om=S.mpMax;
  S.log.push({who:"you",text:`進化方向：${sb.name}`,pre});
  const hn=[]; heatAdd(2,"巢穴之主又變強了",hn);
  S.lv=nextLv(); S.hpMax+=10; S.mpMax+=5; S.hp=S.hpMax; S.mp=S.mpMax; S.exist=0; S.sub=sb; S.evoReady=null; S.evo=null; S.war=null;
  S.tags=S.tags.filter(t=>!TEMP(t)); 
  const an=[]; fillAct(an); const cu=[]; allyCatchUp(cu);   // 可用位置變多：倉庫的技能自動補上來
  S.log.push(sysEntry([`〈系統〉《世界之聲》：「個體『${S.name}』進化完成：${old}→${S.lv}。種族：${sb.name}。」`,
    `身體在一陣劇痛裡重新長了一遍。${sb.look}`,`HP 上限 ${oh}→${S.hpMax}、MP 上限 ${om}→${S.mpMax}，全部回滿。可用技能 ${boxCap(S.lv)[0]} 個、倉庫 ${boxCap(S.lv)[1]} 個。存在值歸零，下一次進化需要 ${existMax(S.lv)}。`,...an,
    `本質：${sb.essence}`,...(S.party.length?[`同伴的等級上限提高到 ${allyLv()} 級。同伴要靠狩獵和協助慢慢累積存在值才能跟上。`,...cu]:[]),...hn].join("\n")));
  {const n=[];chapCheck(n);if(n.length)S.log[S.log.length-1].alts[0].text+="\n"+n.join("\n")}
  S.opts=["感受一下新的身體",inNest()?"在巢穴裡走一圈":`回${NEST()}`,S.party.some(p=>p.with)||inNest()&&S.party.length?"讓同伴看看你的樣子":"看看四周"]; S.log[S.log.length-1].alts[0].opts=S.opts.slice();
  save(); render();
}

