/* isekai-playbook7｜world.js：裝備、魔法物品、相剋、藥水、村落、地城、迷宮、敵對據點。依賴 data.js、game.js。不碰網頁。
   用戶 11-11 定：
   - 裝備欄：頭、項鍊、戒指、武器（單手／雙手近戰／單手遠程／雙手遠程）、副手（盾配單手近戰；箭矢袋／石袋配遠程）、衣服、鞋子
   - 遠程武器多一條優勢；近戰打遠程的對手要多付一項才能接近；雙手近戰破壞力＝大成功少付 1 項
   - 下克上：裝備等級比對手低，白字照用但用完就壞；魔法物品比對手低，魔法效果沒用、用了一樣壞
   - 魔法物品一個效果、一天 3 次；當代價一場只能付 1 次，同一場付第 2 次就壞
   - 壞掉、碎掉、用掉、丟失都是永久的，不能修
   - 戰鬥中可以喝藥，敵人照樣打你一下 */

/* ───── 物品 ───── */
const gearOf=it=>it&&GEAR[it.base||it.n];
const eqItems=()=>SLOTS.map(k=>S.eq[k]).filter(Boolean);
const isMagic=it=>!!(it&&it.mg);
const weaponIt=()=>S.eq.武器;
const isRanged=()=>{const g=gearOf(weaponIt());return !!(g&&/遠程/.test(g.wt))};
const isTwoHand=()=>{const g=gearOf(weaponIt());return !!(g&&g.wt==="雙手")};
const mgUses=it=>3-(it.use||0);
/* 這次對手等級（沒有對手＝不檢查） */
const foeIdx=()=>S.enc?(S.enc.king?7:gIdx(S.enc.lv)):-1;
/* 身上（裝備中）魔法效果有效：等級不比對手低 */
function mgOn(t){return eqItems().filter(it=>it.mg&&it.mg.t===t&&gIdx(it.lv)>=Math.min(6,foeIdx()))}
function mkGear(n,lv){const g=GEAR[n];return {n,base:n,k:"gear",lv:lv||S.lv,slot:g.slot,wt:g.wt||null}}
function mkItem(n,k,lv){if(GEAR[n])return mkGear(n,lv);return {n,k:k||"tool",lv:lv||S.lv}}
/* 拿到一件東西：欄位空著就直接穿上，不然進背包（背包滿了回傳 false） */
function gainItem(it,out){
  if(it.slot&&!S.eq[it.slot]&&canEquip(it)===true){S.eq[it.slot]=it;out&&out.gain.push(`${it.n}（穿上）`);return true}
  if(bagFull()){out&&out.lines.push(`背包滿了，${it.n}帶不走。`);return false}
  S.items.push(it);out&&out.gain.push(it.n);return true;
}
function canEquip(it){
  const g=gearOf(it);if(!g)return "這不是裝備";
  if(g.slot==="副手"){const w=gearOf(weaponIt());
    if(!w)return "先拿一把武器";
    if(g.wt==="盾"&&w.wt!=="單手")return "盾只能配單手近戰武器";
    if(g.wt==="袋"&&!/遠程/.test(w.wt))return "箭矢袋、石袋只能配遠程武器";}
  return true;
}
function equip(i){
  const it=S.items[i];if(!it)return {err:"沒有"};const ok=canEquip(it);if(ok!==true)return {err:ok};
  S.items.splice(i,1);const old=S.eq[it.slot];S.eq[it.slot]=it;if(old)S.items.push(old);
  if(it.slot==="武器"){const off=S.eq.副手;if(off&&canEquip(off)!==true){S.eq.副手=null;S.items.push(off);log(`${off.n}跟${it.n}配不起來，收回背包。`)}}
  log(`裝上${it.n}${old?`（換下${old.n}）`:""}。`);return {ok:true};
}
function unequip(slot){const it=S.eq[slot];if(!it)return {err:"沒有"};if(bagFull())return {err:"背包滿了"};
  S.eq[slot]=null;S.items.push(it);if(slot==="武器"&&S.eq.副手){S.items.push(S.eq.副手);S.eq.副手=null}log(`卸下${it.n}。`);return {ok:true}}
/* 永久失去一件（壞掉／碎掉／用掉／丟失，不能修） */
function loseItem(it){
  for(const k of SLOTS)if(S.eq[k]===it){S.eq[k]=null;if(k==="武器")spareWeapon(null);if(k==="武器"&&S.eq.副手&&canEquip(S.eq.副手)!==true){S.items.push(S.eq.副手);S.eq.副手=null}return}
  const j=S.items.indexOf(it);if(j>=0)S.items.splice(j,1);
}
function itemDesc(it){
  const g=gearOf(it);let s=`${it.n}（${it.lv}${g?`・${g.slot}${g.wt?"・"+g.wt:""}`:""}）`;
  if(it.mg)s+=`　✦${it.mg.d}　今天剩 ${mgUses(it)} 次`;
  else if(it.k==="potion"&&POTIONS[it.n])s+="　"+potionWord(it.n);
  return s;
}
const potionWord=n=>{const p=POTIONS[n];return [p.hp&&`HP +${Math.round(p.hp*100)}%`,p.mp&&`MP +${Math.round(p.mp*100)}%`].filter(Boolean).join("、")};

/* ───── 魔法物品 ───── */
function pickW(list){const t=list.reduce((a,x)=>a+(x.w||1),0);let r=rand()*t;for(const x of list){r-=(x.w||1);if(r<0)return x}return list[0]}
function genMagic(lv,base){
  const n=base||pick(Object.keys(GEAR));const it=mkGear(n,lv);const fx=pickW(MAGIC_FX);const mg={t:fx.t};
  if(fx.t==="skill"){const t=pick(COMBOS.concat(START_POOL));mg.v={n:t.n,e:t.e.slice(),c:t.c.slice(),f:t.f||"",d:t.d};mg.d=`附帶技能【${t.n}】（不扣 MP）`;it.n=`${t.n}・${n}`}
  else if(fx.t==="elem"||fx.t==="resist"){mg.v=pick(ELEMS);mg.d=fx.t==="elem"?`攻擊帶「${mg.v}」`:`抗「${mg.v}」：被${mg.v}屬性的對手打傷害減半`;it.n=(fx.t==="elem"?`${mg.v}之`:`抗${mg.v}`)+n}
  else{mg.d=fx.d;it.n=FX_WORD[fx.t]+n}
  it.mg=mg;it.use=0;return it;
}
/* 附帶技能的魔法物品（裝備中、等級夠、今天還有次數），當成一個技能用 */
function itemSkills(){return eqItems().filter(it=>it.mg&&it.mg.t==="skill").map(it=>({n:it.mg.v.n,e:it.mg.v.e,c:it.mg.v.c,f:it.mg.v.f,lv:it.lv,today:it.use||0,used:0,fromItem:it,d:`來自${it.n}`}))}

/* ───── 相剋 ───── */
function foeEss(){const e=S.enc;if(!e)return [];return uniq((e.e||[]).concat(e.t&&e.t.e||[]))}
function counterOf(mine,theirs){
  for(const a of mine)for(const b of (COUNTER[a]||[]))if(theirs.includes(b))return `${a}>${b}`;
  return null;
}
function racialOwned(race){const n=RACES[race].sk.n;return owned(n)||(S.fac||[]).some(f=>f.s&&f.s.n===n)}
/* 這一戰我方帶的屬性：用的技能＋武器／副手的魔法屬性 */
function myEss(sks){
  let e=sks.flatMap(s=>s.e);
  ["武器","副手"].forEach(k=>{const it=S.eq[k];if(it&&it.mg&&it.mg.t==="elem"&&gIdx(it.lv)>=Math.min(6,foeIdx()))e.push(it.mg.v)});
  return uniq(e);
}
/* 判定加成：武器、遠程、相剋、種族專屬技能、鞋子、飛行。回傳要加的 net，並寫進 q.notes */
function gearBonus(q,act,sks){
  let net=0;const en=S.enc;
  const vsEnemy=en&&["fight","combo"].includes(act);
  if(vsEnemy){
    const w=weaponIt();
    if(w){net+=1;q.notes.push(`${w.n} +1`);q.useWeapon=w;
      if(isRanged()){net+=1;q.notes.push("遠程 +1")}
      if(isTwoHand())q.smash=true;}
    const c=counterOf(myEss(sks),foeEss());
    if(c){net+=1;q.notes.push(`相剋：${c.replace(">","剋")}（${COUNTER_WHY[c]||""}）+1`)}
    const army=en.army?ARMIES.find(a=>a.n===en.n||en.n.startsWith(a.n)):null;
    const race=Object.keys(RACES).find(r=>racialOwned(r)&&((army&&RACES[r].vs===army.n)||(r==="矮人"&&en.tag==="構裝")));
    if(race){net+=1;q.notes.push(`${RACES[race].sk.n}剋${army?army.n:"構裝體"} +1`)}
    const ranged=isRanged()||sks.some(s=>s.f==="投射")||(act==="combo"&&q.it.move==="丟出去");
    const close=en.amb||en.brk;   /* 被突襲、或升級戰某一面被突破：對手已經在身邊 */
    if(close&&!en.r&&isRanged()){
      if(uniqOn("noamb")){q.notes.push("月光長弓：先手，不用拉開距離")}
      else{net-=1;q.approach=1;q.notes.push(`${en.brk?"這一面被突破，敵人衝到身邊":"被近身突襲"}：遠程 +1 不算，還要多付 1 項拉開距離`)}}
    else if(en.r&&!ranged&&!close){q.approach=1;q.notes.push("對手在遠處：近戰要多付 1 項才能接近")}
    /* 聚落專屬魔法武器 */
    if(uniqOn("holy")&&foeEss().includes("暗")){net+=1;q.notes.push("曙光長劍：聖光 +1")}
    if(uniqOn("shadow")&&!close&&!en.raid){net+=1;q.notes.push("影子斗篷：你先出手 +1")}
    if(uniqOn("tide")&&placeOf().water){net+=1;q.notes.push("潮汐三叉戟：有水的地方 +1")}
    const lk=uniqOn("luck");if(lk&&mgUses(lk)>0)q.luck=lk;   /* 真的少付才記一次（game.js planOf） */
  }
  if(act==="retreat"){
    if(S.eq.鞋子){net+=1;q.notes.push(`${S.eq.鞋子.n} +1`)}
    if(S.eq.副手&&gearOf(S.eq.副手).wt==="盾"){net+=1;q.notes.push("盾 +1")}
    if(mgOn("fly").length){net+=1;q.notes.push("飛行 +1")}
  }
  return net;
}
/* 身上有效的聚落專屬魔法武器 */
function uniqOn(t){return eqItems().find(it=>it.mg&&it.mg.t===t&&it.mg.race&&gIdx(it.lv)>=Math.min(6,foeIdx()))}
/* 輸一場的傷害倍率：盾 −20%、衣服 −20%、頭 −10%；屬性抗性再減半 */
function dmgMult(){
  let m=1-(S.eq.副手&&gearOf(S.eq.副手).wt==="盾"?.2:0)-(S.eq.衣服?.2:0)-(S.eq.頭?.1:0);
  const fe=foeEss();if(mgOn("resist").some(it=>fe.includes(it.mg.v)))m*=.5;
  return Math.max(.3,m);
}
/* 打完一場：下克上的裝備用完就壞 */
function afterFight(q,out){
  const w=q.useWeapon;if(!w||!S.enc&&!q.foe)return;
  const fi=Math.min(6,q.foe!=null?q.foe:foeIdx());   /* 魔王算 S 級 */
  if(gIdx(w.lv)<fi&&eqItems().includes(w)){loseItem(w);out.paid.push(`${w.n} 撐不住，壞了（${w.lv} 級打 ${GRADES[Math.min(6,fi)]} 級，不能修）`);spareWeapon(out)}
}
/* 武器壞了：背包裡有別的武器就自動換上（同種類優先） */
function spareWeapon(out){
  if(S.eq.武器)return;const prev=S.eq.副手&&gearOf(S.eq.副手).wt;
  const i=S.items.findIndex(it=>it.slot==="武器"&&!it.mg)>=0?S.items.findIndex(it=>it.slot==="武器"&&(prev==="袋"?/遠程/.test(it.wt):prev==="盾"?it.wt==="單手":true)):-1;
  const j=i>=0?i:S.items.findIndex(it=>it.slot==="武器");
  if(j>=0){const it=S.items.splice(j,1)[0];S.eq.武器=it;if(S.eq.副手&&canEquip(S.eq.副手)!==true){S.items.push(S.eq.副手);S.eq.副手=null}out&&out.lines.push(`換上背包裡的${it.n}。`)}
}

/* ───── 代價：玩家自己選付哪一件 ───── */
/* 能付的東西：outside＝材料＋背包＋身上；升級戰＝背包＋身上（不付原料）。魔法物品一天 3 次 */
function payables(q){
  const L=[];
  if(!q.raid)MATS.forEach(m=>{if(S.mats[m]>0)L.push({t:"mat",n:m,label:`${m}（剩 ${S.mats[m]}）`})});
  S.items.forEach(it=>{if(it.mg&&mgUses(it)<1)return;L.push({t:"item",it,label:it.n+(it.mg?"✦":"")})});
  eqItems().forEach(it=>{if(it.mg&&mgUses(it)<1)return;if(q.useWeapon===it&&!it.mg)return;L.push({t:"eq",it,label:`身上的${it.n}${it.mg?"✦":""}`})});
  return L;
}
/* 自動挑（AI 或「＋」按鈕）：材料先，再背包的白字、藥，最後背包的魔法物品；不自動動身上的東西 */
function autoPay(q,n){
  const L=payables(q),out=[];
  const order=[x=>x.t==="mat"&&!["魔核","魔晶","礦石"].includes(x.n),x=>x.t==="mat",x=>x.t==="item"&&!x.it.mg&&x.it.k!=="tool",x=>x.t==="item"&&x.it.mg];
  const left={};MATS.forEach(m=>left[m]=S.mats[m]||0);
  for(const f of order)for(const x of L){if(out.length>=n)return out;if(!f(x))continue;
    if(x.t==="mat"){while(left[x.n]>0&&out.length<n){left[x.n]--;out.push({t:"mat",n:x.n})}}
    else if(!out.some(o=>o.it===x.it))out.push({t:x.t,it:x.it});}
  return out;
}
function payItemList(q,list,out){
  const seen=new Map();const word=q.act==="retreat"?"丟下":"用掉";
  for(const x of list){
    if(x.t==="mat"){if(S.mats[x.n]>0){S.mats[x.n]--;out.paid.push(`${word} ${x.n}`)}continue}
    const it=x.it;if(!it)continue;
    if(it.mg){const k=(seen.get(it)||0)+1;seen.set(it,k);
      if(k>=2){loseItem(it);out.paid.push(`${it.n} 同一場用了兩次，壞了（不能修）`)}
      else{it.use=(it.use||0)+1;out.paid.push(`${it.n} 的魔力（今天第 ${it.use}/3 次）`)}
      continue}
    loseItem(it);out.paid.push(q.act==="retreat"?`丟下 ${it.n}（找不回來）`:it.k==="potion"?`用掉 ${it.n}`:`${it.n} 壞了（不能修）`);
  }
}

/* ───── 藥：戰鬥中喝，敵人照樣打你一下 ───── */
function usePotion(i){
  if(i==null)i=S.items.findIndex(x=>x.k==="potion");
  const it=S.items[i];if(!it||it.k!=="potion")return {err:"沒有藥"};
  const p=POTIONS[it.n]||{hp:.25};S.items.splice(i,1);
  const hp=p.hp?Math.ceil(hpMax()*p.hp):0,mp=p.mp?Math.ceil(mpMax()*p.mp):0;
  S.hp=Math.min(hpMax(),S.hp+hp);S.mp=Math.min(mpMax(),S.mp+mp);
  let msg=`喝了${it.n}，${[hp&&`HP +${hp}`,mp&&`MP +${mp}`].filter(Boolean).join("、")}。`;
  if(S.enc){const d=hpUnit(!!S.enc.raid);S.hp-=d;msg+=`${S.enc.n}趁你喝藥打過來，HP −${d}。`;
    if(S.hp<=0){if(S.raid&&S.raid.kind!=="boss"){S.hp=1;log(msg,"bad");raidFall("你喝藥時被打倒，被大軍拖出了據點。");return {ok:true}}
      log(msg,"bad");die(null,"你倒下了，再也沒有起來。");return {ok:true}}}
  log(msg);return {ok:true};
}
function raidFall(why){const R=S.raid;S.stats.raids.push({day:S.day,lv:R.kind,res:"fail",won:R.won,lost:R.lost});S.raid=null;S.enc=null;log(why+"據點被攻破了。","bad");S.pending={type:"failchoice",boss:R.kind==="boss"}}

/* ───── 傳送 ───── */
function teleport(){const it=mgOn("tele").find(x=>mgUses(x)>0);if(!it)return {err:"沒有能用的傳送物品"};if(!S.base||S.at===S.base)return {err:"你就在據點"};
  if(S.enc||S.raid)return {err:"戰鬥中不能傳送"};it.use=(it.use||0)+1;S.at=S.base;log(`${it.n}一閃，你回到了據點（${S.base}）。`,"act");return {ok:true}}

/* ───── 遭遇：從地點的魔物表抽 ───── */
function rollPlaceEnemy(){
  const P=placeOf();const list=(P&&P.mon||[]).map(n=>MON_BY_NAME[n]).filter(Boolean);
  const r=rand(),d=r<.2?-1:r<.55?0:r<.8?1:r<.93?2:3;
  const want=Math.max(0,Math.min(6,pg()+d)),cap=pg()+3;
  let cand=list.filter(m=>gIdx(m.lv)<=cap);
  if(!cand.length){let i=Math.min(want,6);while(!MONSTERS[GRADES[i]])i--;cand=MONSTERS[GRADES[i]].map(m=>Object.assign({lv:GRADES[i]},m))}
  const best=Math.min(...cand.map(m=>Math.abs(gIdx(m.lv)-want)));
  const m=pick(cand.filter(m=>Math.abs(gIdx(m.lv)-want)===best));
  return {n:m.n,lv:m.lv,e:(m.e||[]).slice(),t:m.t,r:m.r||0,tag:m.tag||""};
}

/* ───── 村落 ───── */
const relOf=race=>S.rel[race]==null?-1:S.rel[race];
const relMult=race=>relOf(race)>=0?1.5:2;
const villageAt=()=>{const P=placeOf();return P&&P.kind==="village"?P:null};
function villageGift(kind){const P=villageAt();if(!P)return {err:"這裡不是村落"};const r=P.race;if(relOf(r)>=0)return {err:"他們最多只願意對你中立，送禮也沒用了"};
  if(kind==="gold"){if(S.gold<VILLAGE_PRICE.gift)return {err:`要 ${VILLAGE_PRICE.gift} 金幣`};S.gold-=VILLAGE_PRICE.gift}
  else{if((S.mats.魔核||0)<2)return {err:"要魔核 ×2"};S.mats.魔核-=2}
  S.rel[r]=relOf(r)+1;log(`你給${P.n}送了禮。${r}的態度變成「${REL_WORD[S.rel[r]]}」，但還是皺著眉頭。`,"act");advance(1);return {ok:true}}
function villageLang(){const P=villageAt();if(!P)return {err:"這裡不是村落"};const R=RACES[P.race];
  if(relOf(P.race)<-1)return {err:"他們敵視你，連話都不跟你說。先送禮"};if(S.langs.includes(R.lang))return {err:"已經會了"};
  const c=Math.ceil(VILLAGE_PRICE.lang*relMult(P.race));if(S.gold<c)return {err:`要 ${c} 金幣`};
  S.gold-=c;S.langs.push(R.lang);log(`花 ${c} 金幣，在${P.n}學會了${R.lang}。`,"good");advance(4);return {ok:true}}
function villageSkill(){const P=villageAt();if(!P)return {err:"這裡不是村落"};const R=RACES[P.race];
  if(relOf(P.race)<-1)return {err:"他們敵視你。先送禮"};if(!S.langs.includes(R.lang))return {err:`要先會${R.lang}`};if(owned(R.sk.n)||racialOwned(P.race))return {err:"已經學過了"};
  const c=Math.ceil(VILLAGE_PRICE.skill*relMult(P.race));if(S.gold<c)return {err:`要 ${c} 金幣`};
  S.gold-=c;const where=learnSkill(Object.assign({race:P.race},R.sk),"F");const s=allSkills().find(x=>x.n===R.sk.n);if(s)s.race=P.race;
  log(`花 ${c} 金幣，${P.race}很不情願地教你【${R.sk.n}】${where==="倉庫"?"（放進倉庫）":""}。放進「${FAC.find(f=>f.race===P.race).n}」效果更好；升級戰遇到${R.vs}多一條優勢。`,"good");gainExist(1);advance(6);return {ok:true}}
/* 村落商店：當天的貨（每天換） */
function villageStock(){const P=villageAt();if(!P)return [];
  const seed=S.day*7+P.n.length;const r=x=>((seed*9301+x*49297)%233280)/233280;
  const base=[{n:"紅藥水",p:14},{n:"藍藥水",p:14},{n:"紫藥水",p:18},{n:"草藥膏",p:6}];
  const gear=RECIPES.filter(r=>r.k==="gear").map(r=>r.n);
  base.push({n:gear[Math.floor(r(1)*gear.length)],p:12},{n:gear[Math.floor(r(2)*gear.length)],p:12});
  base.push({n:"魔法物品",p:40+20*nestIdx(),magic:1});
  if(tradeRel(P.race)&&!S.uniqBought[P.race])base.push({n:RACE_ITEM[P.race].n,p:RACE_ITEM_PRICE,uniq:1});
  return base.map(x=>Object.assign({},x,{p:Math.ceil(x.p*relMult(P.race))}));
}
function villageBuy(k){const P=villageAt();if(!P)return {err:"這裡不是村落"};if(!S.langs.includes(RACES[P.race].lang))return {err:`要先會${RACES[P.race].lang}`};
  if(relOf(P.race)<-1)return {err:"他們敵視你"};
  const x=villageStock()[k];if(!x)return {err:"沒這個"};if(S.gold<x.p)return {err:`要 ${x.p} 金幣`};if(bagFull())return {err:"背包滿了"};
  S.gold-=x.p;const it=x.uniq?mkUnique(P.race):x.magic?genMagic(GRADES[Math.max(0,nestIdx())]):POTIONS[x.n]?mkItem(x.n,"potion"):mkGear(x.n);S.items.push(it);
  S.traded[P.race]=true;if(x.uniq)S.uniqBought[P.race]=true;
  log(`花 ${x.p} 金幣買了${it.n}（對方一臉嫌棄）。`);advance(1);return {ok:true}}
function villageSell(m,n){const P=villageAt();if(!P)return {err:"這裡不是村落"};if(!S.langs.includes(RACES[P.race].lang))return {err:`要先會${RACES[P.race].lang}`};
  n=Math.min(n||1,S.mats[m]||0);if(n<1)return {err:"沒有"};S.mats[m]-=n;const g=n*(SELL[m]||1);S.gold+=g;S.traded[P.race]=true;log(`在${P.n}賣了${m}×${n}，+${g} 金幣。`);return {ok:true}}

/* 貿易關係：會那一族的語言＋態度中立＋在那裡買賣過 */
const tradeRel=race=>S.langs.includes(RACES[race].lang)&&relOf(race)>=0&&!!S.traded[race];
const tradeRaces=()=>Object.keys(RACES).filter(tradeRel);
function mkUnique(race){const u=RACE_ITEM[race];const it=mkGear(u.base,GRADES[Math.max(pg(),nestIdx(),2)]);it.n=u.n;it.mg={t:u.t,race,d:u.d};it.use=0;return it}

/* ───── 鍛造：白字裝備＋魔核 (2＋等級) 或魔晶 1 → 魔法裝備。要在據點、有鍛冶台 ───── */
const forgeCost=()=>2+pg();
function canForge(){if(!S.base||S.at!==S.base)return "要在據點";if(!(S.fac||[]).some(f=>f.n==="鍛冶台"))return "據點要有鍛冶台";if(S.enc||S.raid)return "正在打";return true}
function forgeMagic(i,useCrystal){
  const ok=canForge();if(ok!==true)return {err:ok};const it=S.items[i];if(!it||!it.slot||it.mg)return {err:"要一件白字裝備"};
  if(useCrystal){if((S.mats.魔晶||0)<1)return {err:"沒有魔晶"};S.mats.魔晶--}
  else{const c=forgeCost();if((S.mats.魔核||0)<c)return {err:`要魔核 ×${c}`};S.mats.魔核-=c}
  const m=genMagic(S.lv,it.base||it.n);S.items[i]=m;
  const h=racialOwned("矮人")?Math.ceil(FORGE_HOURS/2):FORGE_HOURS;
  log(`你在鍛冶台把${it.n}打成了${m.n}（${m.lv}）：${m.mg.d}。${h<FORGE_HOURS?"（矮人符文，快一半）":""}`,"good");advance(h);return {ok:true};
}

/* ───── 地城、迷宮、敵對據點：一層（一次）打一場 ───── */
const CONSTRUCTS=[{n:"機關兵",e:["土","硬化"]},{n:"石像守衛",e:["土","硬化"]},{n:"陷阱走廊",e:["硬化"]},{n:"魔像",e:["土","硬化"]}];
function specialHere(){
  const P=placeOf();if(!P)return null;
  if(P.kind==="hostile"&&!S.cleared.includes(P.n))return {k:"assault",label:`突襲${P.n}`};
  if(P.kind==="dungeon"){const d=S.dun[P.n]||{fl:0,max:0};if(!d.max||d.fl<d.max)return {k:"delve",label:`深入${P.n}（第 ${d.fl+1}${d.max?"/"+d.max:""} 層）`}}
  if(P.kind==="maze")return {k:"maze",label:`深入迷宮`};
  return null;
}
function startSpecial(floor){
  const P=placeOf(),out={lines:[],gain:[],paid:[]};if(S.enc||S.raid)return {err:"正在打"};
  let en=null;
  if(P.kind==="hostile"){if(S.cleared.includes(P.n))return {err:"已經打下來了"};const g=P.guard;en={n:g.n,lv:GRADES[P.tier],e:g.e.slice(),t:g.t,r:g.r||0,nest:P.n}}
  else if(P.kind==="dungeon"){const d=S.dun[P.n]=S.dun[P.n]||{fl:0,max:rint(3,5)};if(d.fl>=d.max)return {err:"地城已經空了"};
    const c=pick(CONSTRUCTS);en={n:c.n,lv:GRADES[Math.min(6,(P.tier||2)+d.fl)],e:c.e.slice(),t:{n:"機關",e:["硬化"],part:"拳"},tag:"構裝",dun:P.n}}
  else if(P.kind==="maze"){const best=S.maze.best||0;const f=Math.max(1,Math.min(7,floor||best+1,best+1));const l=MONSTERS[GRADES[f-1]];const m=pick(l);
    en={n:m.n,lv:GRADES[f-1],e:(m.e||[]).slice(),t:m.t,r:m.r||0,tag:m.tag||"",maze:f}}
  else return {err:"這裡沒有可以深入的地方"};
  S.enc=en;S.stats.enc++;count(S.stats.actions,en.nest?"assault":"delve");
  log(en.nest?`你摸進${P.n}。${en.n}（${en.lv} 級）擋在前面。`:en.dun?`你走下${P.n}第 ${S.dun[P.n].fl+1} 層。${en.n}（${en.lv} 級）動了起來。`:`你走進迷宮第 ${en.maze} 層。${en.n}（${en.lv} 級）從轉角出來。`,"bad");
  advance(1);return {ok:true};
}
/* 打贏特殊對手的戰利品 */
function specialWin(en,out,big){
  const lv=en.lv,li=gIdx(lv);
  out.gain.push(`存在值+${gainExist(1+Math.max(0,li-pg())+(big?1:0))}`);
  if(en.nest){S.cleared.push(en.nest);const g=10*(li+1);S.gold+=g;out.gain.push(`金幣 ${g}`);
    const P=placeOf(en.nest);gainItem(mkGear(pick(["石刀","石斧","石矛","投石索","短弓","木盾","皮甲"]),lv),out);
    if(rand()<.4+(big?.3:0))gainItem(genMagic(lv),out);
    out.lines.push(`${en.nest}被你打下來了。這裡可以佔領當據點（搬家時能選）。`);return}
  if(en.dun){const d=S.dun[en.dun];d.fl++;const g=5*(li+1);S.gold+=g;out.gain.push(`金幣 ${g}`);
    if(rand()<.7||big)gainItem(genMagic(lv),out);
    out.lines.push(d.fl>=d.max?`寶箱打開了。${en.dun}最深的一層也清空了，這裡空了。`:`寶箱打開了。往下還有 ${d.max-d.fl} 層。`);return}
  if(en.maze){const f=en.maze;S.maze.best=Math.max(S.maze.best||0,f);addMat("魔核",f);out.gain.push(`魔核×${f}`);
    if(f>=4){addMat("魔晶",f-3);out.gain.push(`魔晶×${f-3}`)}
    if(rand()<.15+.08*f+(big?.2:0))gainItem(genMagic(lv),out);
    out.lines.push(`第 ${f} 層打通了。迷宮的牆慢慢合上，魔物會再長出來。`)}
}

/* ───── 舊存檔：屬性改名、物品改成裝備 ───── */
const ESS_FIX={冷:"水",熱:"火",生長:"木"};
const fixE=a=>uniq((a||[]).map(x=>ESS_FIX[x]||x));
function worldFix(){
  S.eq=S.eq||{};SLOTS.forEach(k=>{if(S.eq[k]===undefined)S.eq[k]=null});
  S.rel=S.rel||{};S.langs=S.langs||[];S.traded=S.traded||{};S.uniqBought=S.uniqBought||{};S.cleared=S.cleared||[];S.dun=S.dun||{};S.maze=S.maze||{best:0};
  S.skills.concat(S.store).forEach(s=>{s.e=fixE(s.e)});(S.fac||[]).forEach(f=>{if(f.n==="望樓")f.n="哨塔";if(f.s)f.s.e=fixE(f.s.e)});
  if(S.facPick)S.facPick=S.facPick.map(n=>n==="望樓"?"哨塔":n);
  S.seen.forEach(x=>x.e=fixE(x.e));S.frags.forEach(f=>f.e=fixE(f.e));
  S.items=S.items.map(it=>{if(it.k==="white"||it.k==="armor"){const g=GEAR[it.n];if(g)return Object.assign(it,{k:"gear",base:it.n,slot:g.slot,wt:g.wt||null})}return it});
  /* 舊的白字：欄位空著就幫你穿上 */
  for(let i=S.items.length-1;i>=0;i--){const it=S.items[i];if(it.slot&&!S.eq[it.slot]&&canEquip(it)===true){S.eq[it.slot]=it;S.items.splice(i,1)}}
  if(S.places)S.places=S.places.filter(n=>placeOf(n));
}
