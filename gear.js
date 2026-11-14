/* isekai-playbook7｜gear.js（v5.15）：拆解三選一、魔核、部位、無限背包。依賴 data、game、world、combo。不碰網頁。
   用戶 11-14 08:18～09:59 定（Project《異世界RPG_魔法裝備_隨手組合_討論_1114》）：
   - 拆解＝打贏之後拿戰利品，三選一（大成功三選二）：那隻魔物的部位（白字材料）／X魔核（顯示技能）／白字裝備或耗材。肉、皮、骨照舊固定給。
   - 魔核：白字裝備＋魔核 → 魔法裝備（帶魔核的技能），在哪都能做；或鍛鍊 1 次學會它的技能（等級＝魔核等級），魔核消失。
   - 主角不能吞魔核學技能（跟魔物篇不同）。
   - 背包沒有上限（異世界人專屬，彩蛋）。
   - 物品等級比對手低：主動拿來用照樣有效，打完會壞（world.js afterFight）。 */

/* 部位、字眼 → 白字底子 */
const BASE_KW=[[/匕首|小刀|短刀|刀|劍|鐮|爪刃/,"石刀"],[/斧|錘|槌|棍|棒/,"石斧"],[/矛|槍|叉|戟/,"石矛"],[/弓/,"短弓"],[/投石|彈弓|索/,"投石索"],
  [/盾/,"木盾"],[/帽|盔|頭/,"皮帽"],[/甲|衣|袍|斗篷|披風|背心/,"皮甲"],[/鞋|靴/,"草鞋"],[/項鍊|項链|護符|墜|鍊/,"骨項鍊"],[/戒|環/,"魔核戒指"]];
const PART_BASE={角:"石矛",牙:"石刀",爪:"石刀",骨:"石刀",針:"石刀",手:"石斧",拳:"石斧",殼:"木盾",身:"皮甲",絲:"皮甲",根:"皮甲",翼:"皮甲",尾:"投石索",足:"草鞋",吼:"骨項鍊",舌:"骨項鍊",口:"骨項鍊",眼:"魔核戒指"};
const BASE_WORD={石刀:"短刀",石斧:"斧",石矛:"矛",短弓:"弓",投石索:"投石索",木盾:"盾",皮帽:"盔",皮甲:"甲",草鞋:"靴",骨項鍊:"項鍊",魔核戒指:"戒指"};
const WHITE_BASES=Object.keys(BASE_WORD);
const TAG_CAT=t=>["移動","感知"].includes(t)?"機動":["切割","重量","硬化","包覆","聲音"].includes(t)?"戰鬥":"魔法";
const COMBINE_H=3,COMBINE_H_FORGE=1,PART_CRAFT_H=2,CORE_TRAIN_H=1,CORE_MERGE_H=2;

const isCore=it=>it&&it.k==="core",isPart=it=>it&&it.k==="part";
const isWhiteGear=it=>it&&it.slot&&!it.mg;
/* 魔物（含升級戰頭目）：從名字找回資料 */
function monOf(en){const nm=String(en.n).split("＋").pop();const m=MON_BY_NAME[nm]||(RAID_MON[en.lv]||[]).find(x=>x.n===nm)||{};
  return {n:nm,lv:en.lv,e:(en.e||m.e||[]).slice(),t:en.t||m.t||{n:"",e:[]},part:(en.t&&en.t.part)||(m.t&&m.t.part)||"核",atk:en.atk||m.atk||""}}
/* 魔核的技能：一半是那隻魔物的技巧，一半是同標籤的技能（隨機，拿到就看得到） */
function coreSkill(m){
  const te=uniq((m.t.e||[]).map(normTag)).filter(x=>ART_TAGS.includes(x));
  const own={n:m.t.n||`${m.n}之力`,e:te.length?te:(m.e.length?m.e.slice(0,2):["魔力"]),c:[TAG_CAT((te[0]||m.e[0]||"魔力"))],d:`從${m.n}魔核學來的「${m.t.n||"本事"}」。`};
  const tags=uniq(m.e.concat(te).concat(m.atk?[m.atk]:[]));
  const pool=COMBOS.filter(t=>t.e.some(x=>tags.includes(x)));
  if(!m.t.n||(pool.length&&rand()<.5)){const t=pick(pool.length?pool:COMBOS);return {n:t.n,e:t.e.slice(),c:t.c.slice(),f:t.f||"",d:t.d||""}}
  return own;
}
function mkPart(m){return {n:`${m.n}的${m.part}`,k:"part",lv:m.lv,src:m.n,part:m.part}}
function mkCore(m){return {n:`${m.n}魔核`,k:"core",lv:m.lv,src:m.n,sk:coreSkill(m)}}
const coreWord=c=>`【${c.sk.n}】${(c.sk.e||[]).join("・")}`;
/* 第三樣：白字裝備、藥水、逃跑粉、肉（隨機） */
function lootMisc(m){const r=rand();
  if(r<.4)return {k:"item",it:mkGear(pick(WHITE_BASES),m.lv)};
  if(r<.65)return {k:"item",it:mkItem(pick(["紅藥水","藍藥水","草藥膏"]),"potion",m.lv)};
  if(r<.85)return {k:"item",it:mkItem("逃跑粉","escape",m.lv)};
  return {k:"mat",m:"熟肉",n:2}}
const lootLabel=o=>o.k==="mat"?`${o.m}×${o.n}`:isCore(o.it)?`${o.it.n}（${o.it.lv}・技能 ${coreWord(o.it)}）`:isPart(o.it)?`${o.it.n}（${o.it.lv}・白字材料：能做裝備、捐、賣）`:`${o.it.n}（${o.it.lv}${o.it.slot?"・白字裝備":""}）`;
/* 打贏 → 排一個拆解三選一（k＝能拿幾樣） */
function queueLoot(en,k){const m=monOf(en);(S.lootQ=S.lootQ||[]).push({from:m.n,lv:m.lv,k:k||1,got:0,ch:shuffle([{k:"item",it:mkPart(m)},{k:"item",it:mkCore(m)},lootMisc(m)])})}
function takeLoot(i){
  const L=S.lootQ&&S.lootQ[0];if(!L)return {err:"沒有戰利品"};const o=L.ch[i];if(!o)return {err:"沒有這個"};
  if(o.k==="mat"){addMat(o.m,o.n)}else S.items.push(o.it);
  L.ch.splice(i,1);L.got++;log(`[拆解] ${L.from}：拿了 ${lootLabel(o)}。`,"good");bagEgg();
  if(L.got>=L.k||!L.ch.length)S.lootQ.shift();return {ok:true};
}
function skipLoot(){const L=S.lootQ&&S.lootQ[0];if(!L)return {err:"沒有戰利品"};S.lootQ.shift();log(`[拆解] ${L.from}：剩下的不要了。`);return {ok:true}}

/* 無限背包：第一次放超過 8 件時的彩蛋 */
function bagEgg(){if(!S.bagEgg&&S.items.length>8){S.bagEgg=1;log("背包怎麼塞都塞不滿。……這好像是異世界人才有的。","good")}}

function busyErr(){if(S.over)return "遊戲結束了";if(S.enc||S.raid)return "戰鬥中不行";if(S.pending)return "先處理上面的事";return null}
const atForge=()=>canForge()===true;
/* 找白字裝備：背包 "i:3" 或身上 "eq:武器" */
function gearRef(ref){const [w,x]=String(ref).split(":");if(w==="eq")return {it:S.eq[x],eq:x};const it=S.items[+x];return {it,i:+x}}
function whiteRefs(){const L=[];S.items.forEach((it,i)=>{if(isWhiteGear(it))L.push({ref:"i:"+i,it})});SLOTS.forEach(k=>{if(isWhiteGear(S.eq[k]))L.push({ref:"eq:"+k,it:S.eq[k]})});return L}

/* 組合：白字裝備＋魔核 → 魔法裝備（帶魔核的技能），等級＝魔核等級，不設上限 */
function combineCore(ci,ref){
  const e=busyErr();if(e)return {err:e};const c=S.items[ci];if(!isCore(c))return {err:"要一顆魔核"};
  const g=gearRef(ref);if(!isWhiteGear(g.it))return {err:"要一件白字裝備"};
  const h=atForge()?COMBINE_H_FORGE:COMBINE_H;if(S.hour+h>=24)return {err:`要 ${h} 小時，今天來不及了`};
  const it=g.it,old=it.n;it.lv=c.lv;it.mg={t:"skill",v:{n:c.sk.n,e:c.sk.e.slice(),c:c.sk.c.slice(),f:c.sk.f||"",d:c.sk.d||""}};it.mg.d=mgDesc(it.mg);it.use=0;
  it.n=`${c.sk.n}・${it.base||old}`;S.items.splice(S.items.indexOf(c),1);count(S.stats.actions,"combine");
  log(`[組合] ${old}＋${c.n} → ✦${it.n}（${it.lv}）：${mgDesc(it.mg)}。（${h} 小時${h<COMBINE_H?"，鍛冶台幫忙":""}）`,"good");advance(h);return {ok:true,it};
}
/* 鍛鍊魔核：1 次學會它的技能（等級＝魔核等級），魔核消失。已經會了：等級比較低就升上去 */
function trainCore(ci){
  const e=busyErr()||calmErr();if(e)return {err:e};const c=S.items[ci];if(!isCore(c))return {err:"要一顆魔核"};
  const have=allSkills().find(s=>s.n===c.sk.n);
  if(have){if(gIdx(have.lv)>=gIdx(c.lv))return {err:`你已經會【${have.n}】（${have.lv}），這顆魔核沒有更高`};have.lv=c.lv;S.items.splice(ci,1);
    log(`[鍛鍊] 用${c.n}練【${have.n}】，升到 ${c.lv}。魔核化掉了。`,"good");advance(CORE_TRAIN_H);return {ok:true}}
  const where=learnSkill(c.sk,c.lv);if(where==="滿了")return {err:"技能表和倉庫都滿了：先整合、捐掉或賣掉幾個"};
  S.items.splice(ci,1);count(S.stats.actions,"coreTrain");gainExist(1);
  log(`[鍛鍊] 照著${c.n}練了一次，把【${c.sk.n}】（${c.lv}）化為己用${where==="倉庫"?"（放進倉庫）":""}。魔核化掉了。${c.sk.d||""}`,"good");
  const out={lines:[]};applyEffect({e:c.sk.e,f:c.sk.f||"",n:c.sk.n,g:c.sk.g},out);advance(CORE_TRAIN_H);return {ok:true};
}
/* 合成：同等級兩顆魔核 → 高一級的一顆（技能從兩顆裡抽一個） */
function mergeCores(i,j){
  const e=busyErr();if(e)return {err:e};const a=S.items[i],b=S.items[j];
  if(!isCore(a)||!isCore(b)||i===j)return {err:"要兩顆魔核"};if(a.lv!==b.lv)return {err:"要同一級的兩顆"};if(a.lv==="S")return {err:"S 級已經最高了"};
  if(S.hour+CORE_MERGE_H>=24)return {err:"今天來不及了"};
  const lv=GRADES[gIdx(a.lv)+1],src=rand()<.5?a:b,c={n:`${a.src===b.src?a.src:"混合"}魔核`,k:"core",lv,src:src.src,sk:src.sk};
  S.items=S.items.filter(x=>x!==a&&x!==b);S.items.push(c);count(S.stats.actions,"coreMerge");
  log(`[合成] ${a.n}＋${b.n} → ${c.n}（${lv}・技能 ${coreWord(c)}）。`,"good");advance(CORE_MERGE_H);return {ok:true,c};
}
/* 部位做白字裝備：「用鹿角做匕首」。名字照玩家說的；底子從字眼猜，猜不到看部位 */
function craftPart(pi,want){
  const e=busyErr();if(e)return {err:e};const p=S.items[pi];if(!isPart(p))return {err:"要一個部位"};
  if(S.hour+PART_CRAFT_H>=24)return {err:"今天來不及了"};
  want=String(want||"").trim().replace(/^(一|1)?[把件個雙頂條枚只副]/,"").slice(0,10);
  const kw=BASE_KW.find(([re])=>re.test(want)),base=kw?kw[1]:(GEAR[want]?want:PART_BASE[p.part]||"石刀");
  const it=mkGear(base,p.lv);it.n=want&&!GEAR[want]?want:`${p.src}${p.part}${BASE_WORD[base]}`;
  S.items.splice(pi,1);S.items.push(it);count(S.stats.actions,"partCraft");
  log(`[製作] 用${p.n}做了${it.n}（${p.lv}・${gearOf(it).slot}${gearOf(it).wt?"・"+gearOf(it).wt:""}）。（${PART_CRAFT_H} 小時）`,"act");advance(PART_CRAFT_H);return {ok:true,it};
}
/* 打字：「用鹿角做匕首」 */
function localPartCraft(t){
  t=toTrad(t);const m=String(t).match(/^\s*(?:用|拿|把)(.+?)(?:來|来)?(?:做成|做|作|打造|製作|制作|磨成|削成)(.+)$/);if(!m)return null;
  const key=m[1].replace(/[的了]/g,"");
  const i=S.items.findIndex(it=>isPart(it)&&(it.n.includes(key)||key.includes(it.part)&&(key.includes(it.src)||key.length<=2)||key.includes(it.src)));
  if(i<0)return {err:`背包裡沒有「${m[1]}」這種部位`};
  return craftPart(i,m[2]);
}

/* ───── v5.16：鍛冶台（用戶 08:52、09:48、09:56）─────
   ①省時間：組合 1 小時（上面 combineCore）；每 4 天送一件照舊。
   ②改變外形：魔法裝備換底子（長矛 → 弓），等級、效果不變。
   ③特定打造：玩家說要做什麼（「隱形皮甲」「吸血斧頭」「抗火頭盔」），拆成 底子＋標籤＋用途（＋看字眼帶一個被動效果），
     程式檢查標籤做不做得到那個用途；等級＝據點等級，一件 7 天，一次一件。
   用途 +N：做那種事時多 N 條優勢（F～E +1；D～C +1、升級戰也算；B～A +2；S +2、一天一次那件事不用付代價）。
   全身的用途加成最多 +2（S 的免代價另算）。物品比對手低：用途、被動都不生效（不是主動選的，所以也不會壞）。 */
const FORGE_DAYS=7,RESHAPE_H=2,USE_CAP=2;
const USE_KW=[
  [/隱形|隱身|潛行|無聲|消音|暗影|幻影|匿蹤/,{p:"隱匿",tags:["暗","包覆"]}],
  [/看穿|鷹眼|洞察|真視|透視|弱點/,{p:"破綻",tags:["感知","光"]}],
  [/束縛|鎖|纏|捕/,{p:"控制",k:"束縛",tags:["包覆"]}],
  [/閃光|致盲|眩目/,{p:"控制",k:"致盲",tags:["光"]}],
  [/恐懼|威嚇|咆哮|震懾/,{p:"控制",k:"威嚇",tags:["聲音"]}],
  [/毒/,{p:"控制",k:"中毒",tags:["暗"]}],
  [/擊退|震盪|衝擊/,{p:"控制",k:"擊退",tags:["重量"]}],
  [/加速|疾風|迅捷|飛毛|輕盈|疾行|神速/,{p:"位移",tags:["風","移動"],x:{t:"move"}}],
  [/飛行|浮空|翅膀|飛翔/,{p:"位移",tags:["風"],x:{t:"fly"}}],
  [/吸血|嗜血/,{p:"傷害",tags:["暗"],x:{t:"regen"}}],
  [/豐收|採集|園丁/,{p:"環境",tags:["木"],x:{t:"gather"}}],
  [/歸巢|傳送|回家/,{p:"位移",tags:["魔力"],x:{t:"tele"}}],
  [/守護|堅固|鐵壁|不破|護身/,{p:"防護",tags:["硬化"],x:{t:"defend"}}],
  [/火焰|烈焰|燃燒|炎|火/,{p:"傷害",tags:["火"]}],[/冰|霜|寒|水/,{p:"傷害",tags:["水"]}],[/雷|電|風/,{p:"傷害",tags:["風"]}],
  [/大地|岩|石/,{p:"防護",tags:["土"]}],[/聖|光|曙/,{p:"傷害",tags:["光"]}],[/暗|影|夜/,{p:"隱匿",tags:["暗"]}],[/重|巨|破/,{p:"傷害",tags:["重量"]}],[/利|銳|斬|裂/,{p:"傷害",tags:["切割"]}]];
const ANTI_RE=/(?:抗|避|防|耐)(火|水|土|風|木|光|暗|冰|雷|毒)/;
const useLv=lv=>{const g=gIdx(lv);return g>=6?{n:2,raid:1,free:1}:g>=4?{n:2,raid:1}:g>=2?{n:1,raid:1}:{n:1}};
const useWord=u=>`${u.p}${u.k?"・"+u.k:""}`;
/* 本地拆解：看字眼。拆不出來回傳 null（再請大賢者） */
function parseForgeLocal(text){
  const t=String(text||"").trim().slice(0,12);if(!t)return null;
  const kw=BASE_KW.find(([re])=>re.test(t));const base=kw?kw[1]:null;
  let use=null,x=null;const anti=t.match(ANTI_RE);
  if(anti){const v=normTag(anti[1]);use={p:"防護",tags:uniq([v,"包覆"])};x={t:"resist",v}}
  else{const k=USE_KW.find(([re])=>re.test(t));if(k){use={p:k[1].p,k:k[1].k||"",tags:k[1].tags.slice()};x=k[1].x?Object.assign({},k[1].x):null}}
  if(!use)return null;return {n:t,base,use,x};
}
/* 檢查：標籤做不做得到那個用途（組合解析器那張表） */
function forgeCheck(f){
  if(!f||!f.use)return "看不出要什麼效果。名字裡加上「隱形」「吸血」「抗火」「加速」「看穿」這種字試試";
  if(!f.base||!GEAR[f.base])return "看不出是哪種裝備。名字裡加上「劍、斧、矛、弓、盾、盔、甲、靴、項鍊、戒指」其中一個";
  const need=f.use.p==="控制"?ART_CTRL[f.use.k]||[]:ART_PRIM[f.use.p]||[];
  if(!need.length)return `「${useWord(f.use)}」不是能打造的用途`;
  if(!f.use.tags.some(t=>need.includes(t)))return `${useWord(f.use)}要有${need.join("、")}其中之一，「${f.use.tags.join("、")}」做不到`;
  return null;
}
const orderCost=lv=>{const g=gIdx(lv);const c={礦石:1+g};if(g>=1)c.無名魔核=g;if(g>=3)c.魔晶=g-2;return c};
function forgeOrder(f){
  const e=busyErr();if(e)return {err:e};if(!atForge())return {err:"要在據點，而且有鍛冶台"};if(S.forgeOrder)return {err:`鍛冶台正在打造${S.forgeOrder.n}（還要 ${S.forgeOrder.left} 天）`};
  const bad=forgeCheck(f);if(bad)return {err:bad};const lv=S.nest||"F",c=orderCost(lv),miss=lacks(c);if(miss.length)return {err:`材料不夠：還差 ${miss.join("、")}`};
  Object.entries(c).forEach(([m,n])=>S.mats[m]-=n);
  S.forgeOrder={n:f.n,base:f.base,lv,use:f.use,x:f.x||null,left:FORGE_DAYS};count(S.stats.actions,"forgeOrder");
  log(`[鍛冶台] 開始打造「${f.n}」（${lv}・${gearOf({n:f.base}).slot}・${useWord(f.use)} +${useLv(lv).n}${f.x?"・"+fxName(f.x):""}），${FORGE_DAYS} 天後做好。材料：${costWord(c)}。`,"act");advance(1);return {ok:true};
}
const fxName=x=>x.t==="resist"?`避${x.v}`:FX_WORD[x.t]||x.t;
/* 每天：打造進度（facDay 呼叫） */
function forgeDay(){const o=S.forgeOrder;if(!o||!(S.fac||[]).some(f=>f.n==="鍛冶台"))return "";if(--o.left>0)return "";
  const it=mkGear(o.base,o.lv);it.n=o.n;it.mg={t:o.x?o.x.t:"use",use:o.use};if(o.x&&o.x.v)it.mg.v=o.x.v;it.mg.d=mgDesc(it.mg);it.use=0;S.forgeOrder=null;S.items.push(it);
  return `鍛冶台 ✦${it.n}（${it.lv}）做好了`}
/* 改變外形：等級、效果不變，換底子 */
function reshape(ref,base){
  const e=busyErr();if(e)return {err:e};if(!atForge())return {err:"要在據點，而且有鍛冶台"};const g=gearRef(ref),it=g.it;
  if(!it||!it.mg)return {err:"要一件魔法裝備"};if(!GEAR[base]||!BASE_WORD[base])return {err:"不能換成這個"};if((it.base||it.n)===base)return {err:"已經是這個樣子"};
  if(g.eq){S.eq[g.eq]=null;S.items.push(it)}
  const old=it.n,ob=it.base;it.base=base;const gd=GEAR[base];it.slot=gd.slot;it.wt=gd.wt||null;
  if(ob&&it.n.includes(ob))it.n=it.n.replace(ob,base);else if(BASE_WORD[ob]&&it.n.includes(BASE_WORD[ob]))it.n=it.n.replace(BASE_WORD[ob],BASE_WORD[base]);
  count(S.stats.actions,"reshape");log(`[鍛冶台] ${old} 改成 ${it.n}（${gd.slot}${gd.wt?"・"+gd.wt:""}），等級、效果不變。（放回背包，${RESHAPE_H} 小時）`,"act");advance(RESHAPE_H);return {ok:true,it};
}
/* 身上（等級夠）的用途物品 */
function useItems(){const fi=foeIdx();return eqItems().filter(it=>it.mg&&it.mg.use&&(fi<0||gIdx(it.lv)>=Math.min(6,fi)))}
/* 這個行動對到哪些用途（打字組合：看成立的步驟） */
function actUses(q,act){
  if(q.art)return q.art.res.filter(r=>r.ok).map(r=>r.prim);
  return {retreat:["隱匿","位移"],explore:["隱匿"],fight:["傷害","破綻","控制"],combo:["傷害","破綻","控制"],gather:["環境"],shelter:["環境"],craft:["環境"]}[act]||[];
}
function useBonus(q,act){
  const want=actUses(q,act);if(!want.length)return 0;let n=0,free=null;const names=[];
  useItems().forEach(it=>{const u=it.mg.use,L=useLv(it.lv);if(!want.includes(u.p))return;if(q.raid&&!L.raid)return;n+=L.n;names.push(`${it.n}（${useWord(u)}）+${L.n}`);if(L.free&&it.free!==S.day)free=it});
  const v=Math.min(USE_CAP,n);if(v)q.notes.push(names.join("、")+(n>USE_CAP?`（全身最多 +${USE_CAP}）`:""));
  if(free)q.useFree=free;return v;
}

/* ───── v5.18：打字的魔核、部位指令（不經過 AI，程式自己認）─────
   用戶 11:06：打「山鼠群魔核跟石矛組合」只有旁白、沒做出東西 → 程式先認，認得出來就直接做。簡體字也認。 */
const S2T={头:"頭",兽:"獸",鸟:"鳥",猪:"豬",尸:"屍",龙:"龍",树:"樹",灵:"靈",骑:"騎",双:"雙",飞:"飛",剑:"劍",锤:"錘",项:"項",链:"鍊",髅:"髏",战:"戰",杀:"殺",风:"風",壳:"殼",灾:"災",雾:"霧",组:"組",锻:"鍛",炼:"鍊",练:"練",学:"學",结:"結",镶:"鑲",进:"進",装:"裝",盔:"盔",帽:"帽",鞋:"鞋",戒:"戒",矛:"矛",弓:"弓",盾:"盾",斧:"斧",刀:"刀",甲:"甲",僵:"殭",蝎:"蠍",虫:"蟲",蚁:"蟻",鱼:"魚",绳:"繩",带:"帶",铁:"鐵",铠:"鎧",护:"護",冻:"凍",岩:"岩",爪:"爪",角:"角",牙:"牙",鳞:"鱗",翅:"翅",尾:"尾"};
const toTrad=t=>[...String(t||"")].map(c=>S2T[c]||c).join("");
function findCores(t){return S.items.map((it,i)=>({it,i})).filter(x=>isCore(x.it)&&(t.includes(x.it.n)||t.includes(x.it.src)))}
function findWhite(t){const L=whiteRefs();return L.find(x=>t.includes(x.it.n))||L.find(x=>t.includes(x.it.base||""))||L.find(x=>BASE_WORD[x.it.base]&&t.includes(BASE_WORD[x.it.base]))||null}
function localGearCmd(raw){
  const t=toTrad(raw);if(!/魔核|核/.test(t))return null;
  if(/無名魔核/.test(t)&&!findCores(t.replace(/無名魔核/g,"")).length)return {err:"無名魔核沒有技能，不能組合或鍛鍊；可以做藥水、捐給據點、送禮。有技能的是打倒魔物拆解拿到的「○○魔核」"};
  const cs=findCores(t);if(!cs.length)return /魔核/.test(t)?{err:"背包裡沒有這顆魔核（看一下背包裡魔核的名字）"}:null;
  if(/合成|融合/.test(t)&&cs.length>=2)return mergeCores(cs[0].i,cs[1].i);
  if(/組合|結合|合成|融合|鑲|嵌|注入|裝進|放進|做成|合在一起|打進|灌進|加到|加進/.test(t)){
    const g=findWhite(t);if(!g)return {err:"要跟哪一件白字裝備組合？（例：「山鼠群魔核跟石矛組合」；裝備要是白字的）"};
    return combineCore(cs[0].i,g.ref);
  }
  if(/鍛鍊|鍛煉|鍛鍊|練|學|吸收|化為己用/.test(t))return trainCore(cs[0].i);
  return null;
}
