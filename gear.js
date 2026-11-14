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
  const m=String(t).match(/^\s*(?:用|拿|把)(.+?)(?:來|来)?(?:做成|做|作|打造|製作|制作|磨成|削成)(.+)$/);if(!m)return null;
  const key=m[1].replace(/[的了]/g,"");
  const i=S.items.findIndex(it=>isPart(it)&&(it.n.includes(key)||key.includes(it.part)&&(key.includes(it.src)||key.length<=2)||key.includes(it.src)));
  if(i<0)return {err:`背包裡沒有「${m[1]}」這種部位`};
  return craftPart(i,m[2]);
}
