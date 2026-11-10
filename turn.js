/* 魔物篇｜turn.js：模型工作：把模型回的結果套進狀態（連戰、交易、版本、撤回、規則助手）。
   所有 .js 共用同一個全域範圍，載入順序見 index.html；改之前先讀 README.md。 */
/* ═════════ 模型工作 ═════════ */
const CJK=t=>(t.match(/[一-鿿]/g)||[]).length;
const unq=x=>{try{return JSON.parse('"'+x+'"')}catch(e){return x.replace(/\\n/g,"\n").replace(/\\"/g,'"')}};
function salvage(t){
  const m=t.match(/"narration"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if(!m)return null;
  const narration=unq(m[1]); if(CJK(narration)<20)return null;
  const opts=[]; const om=t.match(/"options"\s*:\s*\[([\s\S]*)/);
  if(om){const re=/"((?:[^"\\]|\\.)*)"\s*(?=[,\]])/g;let x;while((x=re.exec(om[1]))&&opts.length<3)opts.push(unq(x[1]))}
  const lm=t.match(/"loc"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  return {narration,options:opts,loc:lm?unq(lm[1]):null};
}
function liveNarr(t){
  const m=t.match(/"narration"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if(!m)return "";
  return m[1].replace(/\\$/,"").replace(/\\n/g,"\n").replace(/\\"/g,'"').replace(/\\\\/g,"\\");
}
function validateTurn(res){
  const o=parseObjs(res.txt).reverse().find(x=>typeof x.narration==="string"&&x.narration.trim());
  if(o)return o;
  const sv=salvage(res.txt); if(sv)return sv;
  const e=new Error(res.cut?"回應被截斷":"沒照格式回傳");
  e.raw=res.txt.slice(0,800);
  const prose=res.txt.replace(/```[\s\S]*?```/g,"").replace(/^\s*[{\[][\s\S]*$/,"").trim();
  if(!res.cut&&CJK(prose)>=40)e.prose={narration:prose,options:[],loc:null};
  throw e;
}
function showLive(t){
  const el=document.getElementById("live"); if(!el)return;
  const n=liveNarr(t);
  el.innerHTML=n?paras(n):`<div class="wait">故事正在展開</div>`;
  if(n&&el.getBoundingClientRect().bottom>innerHeight)el.scrollIntoView({block:"end"});
}
function getGains(o,a){
    if(o.chapter!=null&&!isNaN(parseInt(o.chapter,10)))a.setChap=Math.max(1,Math.min(8,parseInt(o.chapter,10)));
    a.rename=(Array.isArray(o.rename)?o.rename:o.rename?[o.rename]:[]).filter(x=>x&&x.from&&x.to).slice(0,3).map(x=>({from:String(x.from),to:String(x.to)}));
    a.skillUsed=(Array.isArray(o.skill_used)?o.skill_used:typeof o.skill_used==="string"?[o.skill_used]:[]).filter(x=>typeof x==="string"&&x.trim()).slice(0,2);
    a.rel=(Array.isArray(o.rel)?o.rel:o.rel?[o.rel]:[]).filter(x=>x&&x.name).slice(0,3).map(x=>({name:String(x.name).trim(),d:parseInt(x.d,10)||0,why:String(x.why||"").slice(0,16),big:x.big===true}));
    a.fac=(Array.isArray(o.faction)?o.faction:o.faction?[o.faction]:[]).filter(x=>x&&x.name).slice(0,3).map(x=>({name:String(x.name),n:Math.max(-8,Math.min(8,parseInt(x.n,10)||0))}));
    a.toNest=(Array.isArray(o.to_nest)?o.to_nest:typeof o.to_nest==="string"?[o.to_nest]:[]).filter(x=>typeof x==="string"&&x.trim()).slice(0,5);
    if(o.nest&&typeof o.nest==="object")a.nest={pop:o.nest.pop|0,d:o.nest.d|0,add:Array.isArray(o.nest.add)?o.nest.add.slice(0,2):[],del:Array.isArray(o.nest.del)?o.nest.del.slice(0,3):[]};
    a.gone=(Array.isArray(o.npc_gone)?o.npc_gone:o.npc_gone?[o.npc_gone]:[]).map(x=>typeof x==="string"?{name:x}:x).filter(x=>x&&x.name).slice(0,3).map(x=>({name:String(x.name).trim().slice(0,10),why:String(x.why||"").slice(0,20)}));
    a.untag=(Array.isArray(o.untag)?o.untag:typeof o.untag==="string"?[o.untag]:[]).filter(x=>typeof x==="string"&&x.trim()).slice(0,3).map(x=>x.replace(/[【】]/g,"").trim());
    const one=v=>Array.isArray(v)?v[0]:v;
    const rc=one(o.recruit); if(rc&&typeof rc==="object"&&rc.name)a.recruit={name:String(rc.name).slice(0,10),kind:String(rc.kind||"哥布林").slice(0,10),knack:String(rc.knack||"").slice(0,10),note:String(rc.note||"").slice(0,40)};
    const pn=one(o.place_new); if(pn&&typeof pn==="object"&&pn.name)a.placeNew={name:String(pn.name),kind:pn.kind,note:pn.note,region:pn.region};
    const nn=one(o.npc_new); if(nn&&typeof nn==="object"&&nn.name)a.npcNew={where:String(nn.where||"").slice(0,12),name:String(nn.name).slice(0,10),kind:String(nn.kind||"哥布林").slice(0,10),lv:GRADES.includes(nn.lv)?nn.lv:"F",want:String(nn.want||"").slice(0,20),face:String(nn.face||"").slice(0,20)};
    a.lost=(Array.isArray(o.lost)?o.lost:[]).filter(x=>typeof x==="string"&&x.trim()).slice(0,3).map(x=>x.trim());
    const cp=one(o.capture); if(cp&&typeof cp==="object"&&cp.name)a.capture={name:String(cp.name).trim().slice(0,10),kind:String(cp.kind||"人類").slice(0,10),lv:GRADES.includes(cp.lv)?cp.lv:"F",face:String(cp.face||"").slice(0,20)};
    a.deal=(Array.isArray(o.deal)?o.deal:o.deal?[o.deal]:[]).filter(x=>x&&x.place&&x.what).slice(0,2).map(x=>({place:String(x.place).slice(0,12),what:String(x.what).slice(0,30),end:!!x.end}));
    a.tradeOk=o.trade_ok===true||o.trade_ok==="true";
    a.chief=o.chief===true||o.chief==="true";
    a.equip=(Array.isArray(o.equip)?o.equip:o.equip?[o.equip]:[]).filter(x=>x&&x.who&&x.item).slice(0,4).map(x=>({who:String(x.who).trim(),item:String(x.item).trim(),off:!!x.off}));
    {const h=one(o.heat);if(h&&typeof h==="object"&&h.d)a.heat={d:Math.max(-2,Math.min(2,parseInt(h.d,10)||0)),why:String(h.why||"").slice(0,16)}}
    a.mats={};
    a.found=(Array.isArray(o.found)?o.found:[]).map(x=>{
      if(x&&typeof x==="object"&&x.name){const n=cleanItemName(x.name).slice(0,16), m=x.magic;
        if(m&&typeof m==="object"){a.mats[n]={lv:GRADES.includes(m.lv)?m.lv:"E",sp:String(m.kind||n).slice(0,12),...(m.skill?{skill:{n:String(m.skill).slice(0,6),sys:SYSTEMS.includes(m.sys)?m.sys:"天生"}}:{})}}
        return n}
      if(typeof x==="string"){const mm=x.trim().match(/^(.+?)\s*[（(]\s*(魔法原料|魔法物品)?[・·、,，\s]*([FEDCBAS])\s*級?\s*[）)]\s*$/);
        if(mm){const n=cleanItemName(mm[1]).slice(0,16);a.mats[n]={lv:mm[3],sp:n};return n}
        return cleanItemName(x.trim().replace(/\s*[（(][^）)]*[）)]\s*$/,"")).slice(0,16)}
      return ""}).filter(Boolean).slice(0,2);
    a.caught=(Array.isArray(o.caught)?o.caught:[]).filter(x=>x&&x.name).slice(0,3).map(x=>({name:String(x.name).slice(0,16),kind:String(x.kind||x.name).replace(/\s*[x×]\s*\d+$/,"").slice(0,12),lv:GRADES.includes(x.lv)?x.lv:"F"}));
}
const normAte=v=>(Array.isArray(v)?v:(typeof v==="string"&&v.trim()?[v]:[])).filter(x=>typeof x==="string"&&x.trim()).slice(0,3);
const BAN=[[/元神/g,"意識"],[/靈石/g,"魔石"],[/法寶/g,"寶物"],[/真氣|(?<!體)內力|內勁/g,"力氣"],[/魔素|魔力迴路|靈氣/g,"力氣"],[/經脈|筋絡|經絡/g,"血管"],[/丹田|氣海/g,"小腹"],[/一個時辰/g,"兩個小時"],[/半個時辰/g,"一個小時"],[/時辰/g,"小時"],[/一炷香(的時間|的功夫)?/g,"一會兒"],[/修為/g,"實力"],[/魂質/g,"本能"]];
const clean=t=>BAN.reduce((x,[re,to])=>x.replace(re,to),t);
function baseAlt(o,res){
  return {text:clean(String(o.narration).replace(/\\n/g,"\n").trim()),
    opts:(Array.isArray(o.options)?o.options:[]).filter(x=>typeof x==="string"&&x.trim()).slice(0,3),
    loc:typeof o.loc==="string"&&o.loc.trim()?o.loc.trim().slice(0,30):null,
    by:res.used,fb:res.fellBack&&res.fellBack.length?res.fellBack.length:0,loose:!!res.loose};
}
async function runJob(job,ctx){
  if(job.kind==="turn"){
    const res=await callModel(buildMessages(`【玩家這回合】（現在 ${timeStr()}，${PERIOD(S.hour)}）\n${job.prompt}`,ctx),3000,validateTurn,showLive);
    const o=res.val, a=baseAlt(o,res);
    const t=parseInt(o.time,10); a.time=isNaN(t)?0:Math.max(0,Math.min(3,t));
    a.ate=normAte(o.ate);
    a.check=normCheck(o.check);
    if(a.check)setMulti(a.check);
    getGains(o,a);
    {const d=o.defeated;if(!a.check&&d&&typeof d==="object"&&d.name)a.tdef={name:String(d.name).slice(0,16),kind:String(d.kind||d.name).slice(0,12),lv:GRADES.includes(d.lv)?d.lv:"F",dead:d.dead!==false&&d.dead!=="false"}}
    if(a.check){a.caught=[];a.lost=[]}                    // 判定前不能先殺死東西或弄丟東西
    if(a.check)a.opts=[];
    return a;
  }
  if(job.kind==="ooc"){
    const msg=[{role:"system",content:OOC_SYS},{role:"user",content:`【目前狀態】\n${JSON.stringify(stateBrief(),null,1)}\n\n【最近發生】\n${recentLog(ctx,8)}\n\n【玩家的 OOC 問題】\n${job.prompt}`}];
    const res=await callModel(msg,1500,r=>{const o=parseObjs(r.txt).reverse().find(x=>typeof x.answer==="string"&&x.answer.trim());if(o)return o;
      const t=r.txt.replace(/```[\s\S]*?```/g,"").trim();if(CJK(t)>=10)return {answer:t};throw new Error("沒照格式")},showLive);
    const o=res.val, fx=o.fix&&typeof o.fix==="object"?o.fix:{};
    const a={text:"〈OOC〉"+clean(String(o.answer).trim()),opts:S.opts.slice(),loc:null,by:res.used,fb:0,loose:false,time:0,check:null,ooc:true};
    getGains(fx,a);
    if(typeof fx.narr==="string"&&fx.narr.trim())a.onarr=fx.narr.trim().slice(0,80);
    if(typeof fx.lang==="string"&&/語$/.test(fx.lang.trim()))a.olang=fx.lang.trim().slice(0,8);
    if(typeof fx.loc==="string"&&fx.loc.trim())a.oloc=fx.loc.trim().slice(0,30);
    {const d=fx.defeated;if(d&&typeof d==="object"&&d.name)a.odef={name:String(d.name).slice(0,16),kind:String(d.kind||d.name).slice(0,12),dead:d.dead!==false&&d.dead!=="false",lv:GRADES.includes(d.lv)?d.lv:null,n:Math.min(3,Math.max(1,parseInt(d.n,10)||1))}}
    return a;
  }
  if(job.kind==="war"){
    const w=S.war, f=w.foe, c=job.ctx;
    const t=[`【進化戰】（現在 ${timeStr()}，${PERIOD(S.hour)}，地點：${f.where}）`,`對手：${f.name}（${f.kind}，${f.lv}級）。${f.note}`,
      "這是一對一的單挑，同伴不能插手，只能在旁邊看。主角比對手低一級，每一招都很吃力。"];
    if(c.prev)t.push(`上一階段（第 ${c.stage-1}/5 階段）的結果：${c.prev.tier}。${c.prev.skill?`主角用了技能「${c.prev.skill}」。`:""}玩家付出：${c.prev.paid.length?c.prev.paid.join("；"):"沒有付"}。${c.prev.tier==="失敗"?`對手佔了上風，主角重重挨了一下（HP -${c.prev.dmg}）。`:c.prev.tier==="大成功"?"主角搶到了上風。":""}先照這個結果寫上一階段怎麼收場。`);
    else if(c.stage===1)t.push(`先寫主角找到${f.name}、兩邊對上眼的那一刻。`);
    if(c.tactic)t.push(`玩家這一階段想這樣打：${c.tactic}`);
    if(c.stage<=5)t.push(`然後寫第 ${c.stage}/5 階段：對手${c.stage===1?"出的第一招":c.stage===5?"最後的拚命一擊":"換了一招，跟前面不一樣"}，停在交手前的一刻，不要寫勝負。必須給 check（foe 填「${f.name}」，foeLv 填「${f.lv}」），costs 給 2~4 項，要是這一招真的會讓主角失去的東西；options 給空陣列。`);
    else t.push(`這是結局：${f.name}倒下了，主角贏了進化戰。寫出牠倒下的樣子和主角的狀態，不要寫吃掉牠。check 給 null，options 給 3 個（第一個是吃掉${f.name}）。`);
    const res=await callModel(buildMessages(t.join("\n"),ctx),3000,validateTurn,showLive);
    const o=res.val, a=baseAlt(o,res);
    a.time=0; a.loc=f.where;
    if(c.stage<=5){
      const ch=normCheck(o.check)||{what:`擋下${f.name}的攻擊`,adv:[],dis:[],costs:[{t:"被逼得連連後退，傷口裂開",hp:-dmgOf(f.lv)}]};
      ch.foe=f.name; ch.foeLv=f.lv; ch.war={stage:c.stage}; ch.adv=ch.adv.slice(0,2); ch.dis=[];   // 進化戰的劣勢就是高一級（加上一階段被壓著打），模型列的不算
      if(w.mom>0)ch.adv.push("上一階段搶到了上風"); if(w.mom<0)ch.dis.push("上一階段被壓著打");
      a.check=ch; a.opts=[];
    } else {a.win=true; if(!a.opts.length)a.opts=[`吃掉${f.name}`,"先喘口氣","看看四周"]}
    return a;
  }
  if(job.kind==="raid"){
    const r=S.raid, c=job.ctx, steps=RAID_STEPS[r.of];
    const t=[`【討伐戰】（現在 ${timeStr()}，${PERIOD(S.hour)}，地點：${NEST()}）`,`來的是${r.name}（${r.size}，${r.lv}級；組成：${raidComp(r).join("、")}）。他們是來把整窩哥布林清掉的。主角和同伴、族人一起守巢穴。`];
    if(c.prev)t.push(`上一階段（第 ${c.stage-1}/${r.of} 階段・${steps[c.stage-2]}）的結果：${c.prev.tier}。${c.prev.skill?`主角用了技能「${c.prev.skill}」。`:""}玩家付出：${c.prev.paid.length?c.prev.paid.join("；"):"沒有付"}。${c.prev.tier==="失敗"?`這一段守不住，主角挨了一下（HP -${c.prev.dmg}），巢穴也有損失。`:c.prev.tier==="大成功"?"打得漂亮，敵人退了一大截。":"守住了。"}先照這個結果寫上一階段怎麼收場，除了玩家付的代價不要讓主角多失去東西。`);
    if(c.end==="win")t.push(`這是結局：${r.name}撤退了（或被打垮了）。寫出敵人退走、巢穴裡的大家鬆了一口氣的樣子。found 可以給一兩件敵人丟下的裝備。check 給 null，options 給 3 個。`);
    else if(c.end==="lose")t.push(`這是結局：巢穴守不住了。用安靜、不血腥的方式寫出灰飛煙滅的結局：火光、倒下的同伴、主角最後看見的東西。check 給 null，options 給空陣列。`);
    else t.push(`然後寫第 ${c.stage}/${r.of} 階段：${steps[c.stage-1]}。停在交手前的一刻，不要寫勝負。必須給 check（foe 填「${r.name}」，foeLv 填「${r.lv}」），costs 給 2~4 項，可以是主角的傷、同伴受傷（ally）、物品，也可以是巢穴的損失（例如「讓出外洞」）；options 給空陣列。`);
    const res=await callModel(buildMessages(t.join("\n"),ctx),3000,validateTurn,showLive);
    const o=res.val, a=baseAlt(o,res); a.time=0; a.loc=NEST();
    getGains(o,a); a.lost=[]; a.caught=[]; a.capture=null;
    if(c.end){a.raidEnd=c.end; if(c.end==="win"&&!a.opts.length)a.opts=["清點損失","照顧受傷的同伴","把敵人丟下的東西撿回來"]; if(c.end==="lose")a.opts=[]}
    else{
      const ch=normCheck(o.check)||{what:steps[c.stage-1],adv:[],dis:[],costs:[{t:"硬擋下來，傷口裂開",hp:-dmgOf(r.lv)}]};
      ch.foe=r.name; ch.foeLv=r.lv; ch.raid={stage:c.stage,of:r.of}; ch.adv=raidAdv().slice(0,4); ch.dis=[];
      ch.dis.push(r.army?"對方人多勢眾":"對方人多，配合得好"); if(r.mom>0)ch.adv.push("上一階段打得漂亮"); if(r.mom<0)ch.dis.push("上一階段沒守住");
      a.check=ch; a.opts=[];
    }
    return a;
  }
  if(job.kind==="stage"){
    const c=job.ctx, m=c.multi, nx=m.n+1;
    const who=`${c.foe}（${c.foeLv}級${m.cls?`，帶職業的${m.cls}，小頭目`:""}${m.group?`，一共 ${m.group} 個`:""}）`;
    const t=[`【連戰】（現在 ${timeStr()}，${PERIOD(S.hour)}）對手：${who}`,
      `上一階段（第 ${m.n}/${m.of} 階段）的結果：${c.tier}。${c.skill?`主角用了技能「${c.skill}」。`:""}玩家付出：${c.paid.length?c.paid.join("；"):"沒有付"}。${c.tier==="失敗"?`對手佔了上風，主角挨了重重一下（HP -${c.dmg}）。`:m.group?"打倒或打跑了其中一個。":"對手吃了虧。"}先照這個結果寫上一階段怎麼收場，除了玩家付的代價不要讓主角多失去東西。`,
      `然後寫第 ${nx}/${m.of} 階段：${m.group?"剩下的成員配合出招":`對手換了一招（${m.cls?CLASSES[m.cls].act:"拚命反撲"}）`}，停在交手前的一刻，不要寫勝負。必須給 check（foe 填「${c.foe}」，foeLv 填「${c.foeLv}」），costs 給 2~4 項；options 給空陣列。`];
    const res=await callModel(buildMessages(t.join("\n"),ctx),3000,validateTurn,showLive);
    const o=res.val, a=baseAlt(o,res);
    const ch=normCheck(o.check)||{what:`擋下${c.foe}的攻勢`,adv:[],dis:[],costs:[{t:"被逼得連連後退",hp:-dmgOf(c.foeLv)}],group:1};
    ch.foe=c.foe; ch.foeLv=c.foeLv; ch.group=m.group||1; ch.multi={...m,n:nx};
    if(m.group&&!ch.dis.some(x=>/成群|人多/.test(x))&&nx<m.of)ch.dis.push("對方還有人");
    if(c.mom>0)ch.adv.push("上一階段搶到了上風"); if(c.mom<0)ch.dis.push("上一階段被壓著打");
    a.check=ch; a.opts=[]; a.time=0;
    return a;
  }
  if(job.kind==="resolve"){
    const c=job.ctx;
    const tail=`【判定結果】（現在 ${timeStr()}，${PERIOD(S.hour)}）\n事情：${c.what}\n對手：${c.foe||"無"}${c.foeLv?`（${c.foeLv}級）`:""}\n結果：${c.tier}\n${c.skill?`主角用了技能：${c.skill}（照這個技能的樣子寫出它怎麼起作用）\n`:""}玩家付出的代價：${c.paid.length?c.paid.join("；"):"沒有付"}\n${c.boss&&c.tier!=="失敗"?`對手是帶職業的${c.boss}（小頭目）：打倒時填 defeated，並在 found 給一件他的職業裝備（例如「${CLASSES[c.boss].gear}」）。\n`:""}${c.group&&c.tier!=="失敗"?`對手是一群（${c.group} 個）：${c.rout?"主角打倒了帶頭的，其餘的潰散逃走。":"這是最後一個階段，剩下的被打倒或逃走。"}defeated 填帶頭的那一個；一口氣打倒好幾個時，用 faction 扣勢力數量。\n`:""}${c.foe&&c.tier!=="失敗"&&FIGHT.test(c.what)?`這是跟${c.foe}的交手，結果是${c.tier}：${c.foe}要倒下、逃走或投降，一定要填 defeated（活著的 dead 填 false），不能寫成只是刺中、對手還站著。\n`:""}${c.stall?`主角把這場拖久了：照結果寫完之後，一定要加一個新麻煩——${c.fac?`${c.fac}的援軍趕到、`:"對手的同伴趕來、"}對手逃走去叫人、血腥味引來別的掠食者、或天色和天氣變壞，挑一個最合理的。新麻煩出現在這次結果之後，不改變這次的結果。\n`:""}照這個結果寫，然後給 3 個選項。`;
    const res=await callModel(buildMessages(tail,ctx),3000,validateTurn,showLive);
    const o=res.val, a=baseAlt(o,res);
    const d=o.defeated;
    if(d&&typeof d==="object"&&d.name&&c.tier!=="失敗")a.defeated={name:String(d.name).slice(0,16),kind:String(d.kind||d.name).slice(0,12),lv:GRADES.includes(d.lv)?d.lv:(c.foeLv||"F"),dead:d.dead!==false&&d.dead!=="false"};
    if(c.tier==="失敗"&&typeof o.tag==="string"&&o.tag.trim())a.tag=o.tag.trim().replace(/[【】]/g,"").slice(0,12);
    a.ate=normAte(o.ate);
    getGains(o,a);
    if(c.boss&&a.defeated){a.defeated.cls=c.boss; if(!(a.found||[]).length)a.found=[CLASSES[c.boss].gear]}
    return a;
  }
}
/* 連戰：帶職業的小頭目打兩個階段；一群（同級以上）照人數打兩到三個階段。大成功＝打倒帶頭的，其餘潰散。 */
function setMulti(ch){
  if(!ch||ch.war||!ch.foe||ch.multi)return;
  const cls=classOf(ch.foe), strong=gIdx(ch.foeLv||"F")>=gIdx(S.lv);
  let of=1;
  if(ch.group>=2&&strong)of=ch.group>=3?3:2;
  else if(cls)of=2;
  if(of<2)return;
  ch.multi={n:1,of,cls,group:ch.group>=2?ch.group:0};
  if(ch.group>=2&&!ch.dis.some(x=>/成群|人多|數量/.test(x)))ch.dis.push("對方成群");
}
/* 交易：能在「交易」以上的聚落、或願意做生意的商人面前提出 */
function tradeTarget(){
  if(isSettle(S.at)&&stOf(S.at)>=1)return hasLang(S.at)?S.at:null;
  const m=S.npcs.find(x=>x.where===S.at&&!x.foe&&!x.captive&&relOf(x)>=0&&hasLang(`${x.role}${x.n}`)&&/商|鐵匠|商隊|傭兵/.test(`${x.role}${x.n}`));
  return m?m.n:null;
}
let TRD={sel:{},want:""};
function doTrade(){
  if(busy||S.dead)return; const who=tradeTarget(); if(!who)return;
  const items=Object.keys(TRD.sel).filter(k=>TRD.sel[k]&&k[0]==="i").map(k=>S.items[+k.slice(2)]).filter(Boolean);
  const corpses=Object.keys(TRD.sel).filter(k=>TRD.sel[k]&&k[0]==="c").map(k=>S.corpses[+k.slice(2)]).filter(Boolean);
  if(!items.length&&!corpses.length)return;
  const v=items.reduce((t,n)=>t+valItem(n),0)+corpses.reduce((t,c)=>t+valCorpse(c),0), want=TRD.want.trim()||"對方覺得等值的東西";
  const pre=snap(), list=[...items.map(n=>`${n}（值 ${valItem(n)}）`),...corpses.map(c=>`${c.name}（值 ${valCorpse(c)}）`)];
  S.log.push({who:"you",text:`和${who}交易：用 ${[...items,...corpses.map(c=>c.name)].join("、")} 換 ${want}`,pre,time:1,
    trade:{place:who,items,corpses:corpses.map(c=>c.name),v}});
  const sm=S.party.find(p=>allyElig(p)&&allyAbOf(p)==="交易"); let smN="";
  if(sm&&allyUses()<2){S.allyUsed=allyUses()+1;smN=`\n工匠同伴${sm.n}在旁邊幫忙議價：成交的話，對方多拿出一件魔法物品當添頭（等級最多比主角高一級，附帶技能照 found 的魔法物品格式）。`}
  TRD={sel:{},want:""}; S.opts=[]; save();
  const st=findSettle(who), stt=st?SREL[stOf(st)+2]:"";
  doJob({kind:"turn",prompt:`【交易】主角在${who}${stt?`（對主角：${stt}）`:""}提出以物易物：拿出 ${list.join("、")}，總值 ${v}；想換：${want}。
價值：F 級 1、E 級 2、D 級 5、C 級 15、B 級 50、A 級 200；普通的東西大約 1。
對方照自己的需要和對主角的態度出價：換到的東西總值大約等於 ${v}（交情好可以多一點）。想要的太貴，就討價還價、改給別的，或拒絕。${smN}
成交：trade_ok 填 true，found 填換到的東西（魔法物品用 magic 格式）；lost 不用填，程序會拿走主角給的東西。沒成交：trade_ok 填 false，found 留空。
長期的約定（例如定期交換、互不侵犯、幫忙打造）填 deal：[{"place":"${st||who}","what":"約定內容"}]。`},pre,S.log.length);
}
function tradeHTML(){
  const who=tradeTarget(); if(!who||busy)return "";
  const v=Object.keys(TRD.sel).filter(k=>TRD.sel[k]).reduce((t,k)=>t+(k[0]==="i"?valItem(S.items[+k.slice(2)]||""):valCorpse(S.corpses[+k.slice(2)]||{small:1})),0);
  const it=S.items.map((n,i)=>`<label style="display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-bottom:1px solid var(--line)"><span style="flex:1"><input type="checkbox" data-tr="i:${i}"${TRD.sel["i:"+i]?" checked":""}> ${matOf(n)?"✦":""}${esc(n)}</span><span style="white-space:nowrap">值 ${valItem(n)}</span></label>`).join("");
  const cs=S.corpses.map((c,i)=>!c.evo&&valCorpse(c)?`<label style="display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-bottom:1px solid var(--line)"><span style="flex:1"><input type="checkbox" data-tr="c:${i}"${TRD.sel["c:"+i]?" checked":""}> ${esc(c.name)}</span><span style="white-space:nowrap">值 ${valCorpse(c)}</span></label>`:"").join("");
  return `<div class="card"><h3>和${esc(who)}交易</h3><div class="note" style="margin-bottom:6px">以物易物。價值：F 1・E 2・D 5・C 15・B 50・A 200。沒談成的話東西會留在你手上。</div>
    ${it}${cs}<div class="row" style="margin-top:6px"><span class="k">合計</span><span><b>${v}</b></span></div>
    <div class="padd" style="margin-top:6px"><input id="trw" maxlength="30" placeholder="想換什麼（可以不填）" value="${esc(TRD.want)}"><button class="tl" id="trok"${v?"":" disabled"}>提出交易</button></div></div>`;
}
/* 套用某個版本：先退回這段開始前的狀態，再疊上這個版本的結果 */
/* 玩家明說「收集／撿起 X、Y」而模型沒填 found 時，照玩家說的放進背包 */
const PICK=/^(?:我)?(?:收集|撿起?|捡起?|撿走|捡走|拿走|拿起|拿(?![出給给])|收起來?|收起来?|帶走|带走|揣上|藏起)\s*(.+)$/;
function pickUp(you,a,notes){
  if(!you||you.give||a.check||(a.found&&a.found.length)||(a.caught&&a.caught.length)||(a.lost&&a.lost.length))return;
  const line=String(you.text||"").split(/\n/)[0].trim(), m=line.match(PICK); if(!m)return;
  const names=m[1].replace(/[。！!]$/,"").split(/[、，,和跟與及]/).map(x=>x.trim()).filter(x=>x&&x.length<=10).slice(0,4);
  names.forEach(x=>{if(!S.items.includes(x)&&!S.corpses.some(c=>c.name===x))receive(x,notes)});
}
function gains(a,big,notes,guard){
  if(guard&&a.lost&&a.lost.length){                     // 判定成功時：玩家沒付的物品不能被拿走
    const keep=a.lost.filter(x=>!guard.paid.some(p=>p.includes(x)||x.includes(p)));
    a.lost=a.lost.filter(x=>!keep.includes(x));
  }
  if(a.placeNew&&a.loc==null)addNode(a.placeNew,S.at,1,notes);       // 有地點資訊的回合，等位置更新完再記
  if(a.toNest&&a.toNest.length)toNest(a.toNest,notes);
  if(a.nest)nestChange(a.nest,notes);
  (a.fac||[]).forEach(x=>{const k=Object.keys(S.factions).find(k=>k===x.name||x.name.includes(k)||k.includes(x.name)||facRe(k).test(x.name));if(!k||!x.n)return;
    const f=S.factions[k], was=f.n; f.n=Math.max(0,Math.min(f.max,f.n+x.n));
    if(f.n!==was)notes.push(`${k}：約 ${was} → ${f.n}`);
    if(f.n<=0&&was>0){notes.push(`〈系統〉《大賢者》：「告。${k}已經被你打散了。」`);if(f.tag)S.nest.tags=S.nest.tags.filter(t=>t.t!==f.tag)}});
  const d=a.defeated, dn=d?cleanName(d.name):"";
  const dup=x=>d&&d.dead!==false&&(cleanName(x.name)===dn||cleanName(x.name).includes(dn)||dn.includes(cleanName(x.name))||speciesOf(x.name,x.kind)===speciesOf(d.name,d.kind));
  (a.lost||[]).forEach(x=>{const i=S.items.findIndex(it=>it===x||it.includes(x)||x.includes(it));if(i>=0){notes.push(`失去 ${S.items[i]}`);delete S.mat[S.items[i]];S.items.splice(i,1);return}
    const k=x.replace(/的?屍體|殘骸|肉塊/g,"").trim(), j=S.corpses.findIndex(c=>!c.evo&&(c.name===x||cleanName(c.name)===k||(k&&cleanName(c.name).includes(k))));
    if(j>=0){notes.push(`${S.corpses[j].name}已經不在你手上了`);S.corpses.splice(j,1)}});
  (a.caught||[]).filter(x=>!dup(x)&&GEAR.test(x.name)).forEach(x=>{if(!S.items.includes(x.name))receive(x.name,notes)});
  (a.caught||[]).filter(x=>!dup(x)&&!GEAR.test(x.name)).forEach(x=>{toCorpses(x.name,x.kind,x.lv,{big}).forEach(c=>S.corpses.push(c));notes.push(`抓到 ${x.name}（新鮮，可以吃）`)});
  if(a.npcNew&&!S.npcs.some(x=>x.n===a.npcNew.name)&&!S.party.some(x=>x.n===a.npcNew.name)&&a.npcNew.name!==S.name){
    const n=a.npcNew;
    let where=n.where&&!/${NEST()}/.test(n.where)&&!n.where.includes(NEST())?baseLoc(n.where):n.where?NEST():(homeOf({role:n.kind,n:n.name})||S.at);
    if(where&&!S.world[where]&&SETTLE.test(where))addNode({name:where,kind:"聚落"},S.at,1,notes);
    if(!S.world[where])where=S.at;
    S.npcs.push({n:n.name,role:n.kind,lv:n.lv,want:n.want,knack:"",face:n.face,secret:"",inst:"",rel:"無視",r:0,where});}
  (a.gone||[]).forEach(x=>npcGone(x.name,x.why,notes,true));
  (a.rename||[]).forEach(x=>renameChar(x.from,x.to,notes));
  if(a.capture){if(a.defeated&&a.defeated.dead!==false&&cleanName(a.defeated.name)===cleanName(a.capture.name)){const j=S.corpses.map(c=>c.name).lastIndexOf(a.defeated.name);if(j>=0)S.corpses.splice(j,1)}capture({...a.capture,cls:a.defeated&&a.defeated.cls},notes)}
  (a.deal||[]).forEach(d=>addDeal(d,notes));
  if(a.heat&&a.heat.d>0){                              // 只有人類看到、跟人類有關的才算；模型給的一天最多 +1
    const txt=`${a.heat.why}${a.text||""}`;
    if(!HUMAN_TXT.test(a.heat.why)&&!(HUMAN_TXT.test(a.text||"")&&/看到|看見|目擊|逃回|報信|傳開|發現/.test(txt)))a.heat=null;
    else if(S.heatAi===S.day)a.heat=null; else{S.heatAi=S.day;a.heat.d=1}}
  if(a.heat&&a.heat.d){if(a.heat.d>0)heatAdd(a.heat.d,a.heat.why,notes);else{S.heat=Math.max(heatLv()>=3?HEAT[3].at:0,(S.heat||0)+a.heat.d);notes.push(`注目度 ${a.heat.d}（${a.heat.why}）`)}}
  if(a.rel)relChange(a.rel,notes,a.ooc);
  if(a.recruit&&!S.party.some(p=>p.n===a.recruit.name||(p.alias||[]).includes(a.recruit.name))){
    const x=S.npcs.find(y=>y.n===a.recruit.name||(y.alias||[]).includes(a.recruit.name));
    if(x&&x.foe)notes.push(`${x.n}是你的對手，不會成為同伴。`);
    else if(x&&!hasLang(`${x.role}${x.n}`)&&!a.ooc)notes.push(`你聽不懂${langOf(`${x.role}${x.n}`)}，沒辦法跟${x.n}談跟你走的事（吃下那一族的肉、或用 OOC 說你學會了，才聽得懂）。`);
    else if(x&&relOf(x)<2&&!a.ooc)notes.push(`${x.n}對你還只是「${REL[relOf(x)+2]}」，要到「信賴」才會答應跟你走。`);
    else{if(x){x.r=Math.max(relOf(x),3);x.rel="追隨";x.captive=false}recruit({...a.recruit,name:x?x.n:a.recruit.name,kind:x?(raceOf(x.role)||a.recruit.kind):a.recruit.kind},notes)}}
  (a.untag||[]).forEach(x=>{const t=S.tags.find(y=>y===x||y.includes(x)||x.includes(y));if(t&&!/幼體|飢餓|瀕死|殘缺/.test(t)){delTag(t);notes.push(`【${t}】解除`)}});
  const eatenNames=S.eaten.slice(0,12).map(x=>x.what); let plainN=0; const plainMax=RAIDNOW?1:3;   // 一次最多帶走幾件普通物品（掠奪的魔法物品由程式另外給）
  {const cr={}; const keep=[];   // 「○○屍體」不是普通物品：改成真的屍體（身邊的屍體清單），且不重複造
   (a.found||[]).forEach(x=>{const mm=String(x).match(/^(.+?)(?:的)?(?:屍體|屍骸|屍首|尸体)$/);if(mm){const k=cleanName(mm[1]);cr[k]=(cr[k]||0)+1}else keep.push(x)});
   a.found=keep;
   Object.keys(cr).forEach(k=>{const ex=S.corpses.filter(c=>sameFoe(k,c.name)&&c.t>=nowH()-24).length, need=Math.min(3,cr[k])-ex;
     if(need>0){const lv=(S.lastFoe&&S.lastFoe.lv)||"F";for(let i=0;i<need;i++)toCorpses(k,k,lv).forEach(c=>{c.small=false;S.corpses.push(c)});notes.push(`${k}的屍體 ×${need}放進了身邊的屍體清單。`)}})}
  (a.found||[]).filter(x=>!S.items.includes(x)&&!eatenNames.includes(x)&&!S.corpses.some(c=>c.name===x)).forEach(x=>{
    let m=a.mats&&a.mats[x], fromCorpse=false;
    if(m&&!m.skill){const c=S.corpses.find(c=>!c.evo&&(x.includes(cleanName(c.name))||String(m.sp).includes(cleanName(c.name))));
      if(c&&c.harvested)m=null;                       // 這具屍體已經拆過了：當普通物品
      else if(c){c.harvested=true;m.lv=c.lv;m.sp=c.sp||m.sp;fromCorpse=true}
      else if(MUNDANE.test(x)||!PART_RE.test(x))m=null;     // 沒有來源屍體、名字又不像部位／魔核：普通東西，不是魔法原料
    }
    if(m&&MUNDANE.test(x))m=null;
    if(m&&!fromCorpse&&gIdx(m.lv)>gIdx(capItemLv(m.lv))){notes.push(`（${x}的等級被壓到 ${capItemLv(m.lv)} 級：魔法物品最多比你高一級）`);m.lv=capItemLv(m.lv)}                           // 金幣袋、文件、食物之類，就算模型填了技能也只是普通物品
    if(m){S.items.push(x);S.mat[x]=m;notes.push(`得到 ✦${x}（${m.skill?`魔法物品，附帶「${m.skill.n}」`:"魔法原料"}・${m.lv}級）`)}
    else{if(plainN>=plainMax){notes.push(`（${x}帶不走，留在原地）`);return}plainN++;receive(x,notes)}});
  (a.equip||[]).forEach(q=>equipAlly(q.who,q.item,q.off,notes));
  if(a.chief&&S.stage==="成體")becomeChief(notes);
}
function applyAlt(e){
  if(e.pre)restore(e.pre);
  const a=e.alts[e.i], notes=[];
  const idx=S.log.indexOf(e), you=S.log[idx-1];
  if(e.kind==="turn"&&!a.check)S.fightDelay=null;
  const _chapNotes=[];
  if(e.kind==="turn"){
    if(you&&you.give){(you.give.items||[]).forEach(x=>receive(x)); if(you.give.corpse)S.corpses.push({...you.give.corpse,t:nowH()})}
    if(you&&you.trade){
      if(a.tradeOk){you.trade.items.forEach(x=>{const i=S.items.indexOf(x);if(i>=0){S.items.splice(i,1);delete S.mat[x]}});
        you.trade.corpses.forEach(x=>{const j=S.corpses.findIndex(c=>c.name===x&&!c.evo);if(j>=0)S.corpses.splice(j,1)});
        const lim=Math.ceil(you.trade.v*(S.nest.tags.some(t=>t.t==="商路")?1.5:1.2)+1);let sum=0;
        a.found=(a.found||[]).filter(x=>{const m=a.mats&&a.mats[x];sum+=m?VALUE[m.lv]||1:1;return sum<=lim});
        notes.push(`成交：給出 ${[...you.trade.items,...you.trade.corpses].join("、")}`);
        const st=findSettle(you.trade.place); if(st&&stOf(st)===1&&!S.world[st].traded){S.world[st].traded=1}else if(st&&stOf(st)===1&&++S.world[st].traded>=3){S.world[st].traded=0;stChange(st,1,"做了幾次公道的生意",notes)}}
      else{a.found=[];a.mats={};notes.push("這筆交易沒談成，東西還在你手上。")}
      a.lost=[];
    }
    let t=you&&you.time!=null?you.time:(a.check?0:a.time);
    if(!t&&!a.check){S.min=(S.min||0)+20; if(S.min>=60){S.min-=60;t=1}}   // 說話、觀察：每回合 20 分鐘
    if(t)advanceTime(t,notes);
    pickUp(you,a,notes);
    if(!a.check&&a.skillUsed&&a.skillUsed.length){              // 平常行動用了自己的技能：MP -1
      const said=String(you&&you.text||"");
      a.skillUsed.forEach(n=>{const sk=boxList("act").find(x=>n.includes(x.n)||x.n.includes(n));if(!sk)return;
        if(!said.includes(sk.n)&&![...Array(Math.max(0,sk.n.length-1)).keys()].some(j=>said.includes(sk.n.slice(j,j+2))))return;   // 玩家沒說要用：被動、順手寫到的不算
        if(S.mp>=1){S.mp-=1;notes.push(`用「${sk.n}」：MP -1`)}else notes.push(`MP 不夠，「${sk.n}」沒能用出來`)});
    }
    if(a.lost&&a.lost.length&&you&&!you.give){
      const said=String(you.text||""), crafted=(a.found&&a.found.length)||(a.mats&&Object.keys(a.mats).length);
      const verb=/[丟扔給交換送賣用吃分讓拿出開开拆拆解]/.test(said), share2=n=>{n=cleanName(n).replace(/的?屍體/,"");for(let i=0;i<n.length-1;i++)if(said.includes(n.slice(i,i+2)))return true;return n.length===1&&said.includes(n)};
      a.lost=a.lost.filter(x=>crafted||said.includes(x)||said.includes(cleanName(x))||verb&&(share2(x)||S.corpses.some(c=>(x.includes(cleanName(c.name))||cleanName(c.name).includes(x.replace(/的?屍體/,"")))&&/[給交分送讓]/.test(said))));
    }
    const lf=S.lastFoe, td=!a.check&&a.tdef&&lf&&sameFoe(a.tdef.name,lf.name)?a.tdef:null;   // 一般回合收拾掉上一張判定卡的對手
    a.defeated=td;
    gains(a,false,notes);
    if(td)applyDefeat({...td,lv:lf.lv,cls:lf.cls},notes);
    else if(!a.check&&a.tdef&&a.tdef.dead!==false){const cx=S.npcs.find(x=>x.captive&&sameFoe(a.tdef.name,x.n));   // 殺掉被俘虜的對手：也要有屍體
      if(cx){a.defeated={...a.tdef,lv:cx.lv||a.tdef.lv,cls:cx.cls};applyDefeat(a.defeated,notes)}}
    else if(!a.check&&you&&/處決|殺死|殺掉|殺了|斬殺|宰了|結果了|砍死|殺光|滅口/.test(you.text||"")&&!/不殺|別殺|不要殺/.test(you.text||"")){   // 處決俘虜／投降的對手：模型常忘了填 defeated
      const t=String(you.text), vs=S.npcs.filter(x=>x.captive&&(()=>{const b=cleanName(x.n).replace(/[A-Z0-9一二三]+$/,"");return b&&(t.includes(b)||t.includes(b.slice(-2)))})());
      vs.forEach(x=>{const b=cleanName(x.n).replace(/[A-Z0-9一二三]+$/,"");toCorpses(b,x.kind||b,x.lv||"F").forEach(c=>{c.small=false;S.corpses.push(c)});
        if(/兩|二|雙|2/.test(t)&&vs.length===1)toCorpses(b,x.kind||b,x.lv||"F").forEach(c=>{c.small=false;S.corpses.push(c)});
        npcGone(x.n,"被你處決了",notes);notes.push(`${b}的屍體放進了身邊的屍體清單。`)})}
    if(you&&!a.check)invite(you.text,notes);
  }
  if(e.kind==="resolve"){
    const c=e.job.ctx;
    if(a.defeated)applyDefeat(a.defeated,notes,c.tier==="大成功",c.won);
    a.askFoe=!a.defeated&&!a.capture&&c.tier!=="失敗"&&c.foe&&FIGHT.test(c.what)?{name:c.foe,lv:c.foeLv||"F",cls:c.boss||null}:null;   // 成功卻沒寫對手怎麼了：問玩家
    RAIDNOW=RAID_RE.test(c.what||"");
    gains(a,c.tier==="大成功",notes,c.tier!=="失敗"?{paid:c.paid||[]}:null);
    RAIDNOW=false;
    raidLoot(c,notes);
    if(c.tier!=="失敗"&&/狩獵|獵殺|捕獵|打獵/.test(c.what||"")&&(S.nest.pop||0)>=4){S.nest.food=(S.nest.food||0)+1;notes.push("多打到一份獵物，直接送進巢穴存糧（+1）。")}   // 營地人多了，狩獵多給一份
    if(a.tag){addTag(a.tag);notes.push(`【${a.tag}】`)}
  }
  if(e.kind==="raid"&&a.raidEnd&&S.raid){
    const r=S.raid;
    if(a.raidEnd==="win"){
      gains(a,true,notes);
      raidWin(r,notes);
    }else{
      S.dead=true; S.raid=null; S.deathWhy=`${NEST()}被${r.name}踏平了`;
      notes.push(`${NEST()}被${r.name}踏平了。全滅。`,"（可以按「撤回」回到之前，換個打法或先搬家。）");
    }
  }
  if(e.kind==="ooc"){gains(a,false,notes);
    if(a.olang){S.langs=S.langs||["哥布林語"];if(!S.langs.includes(a.olang)){S.langs.push(a.olang);notes.push(`習得語言：${a.olang}`)}}
    if(a.onarr){S.narr=[...(S.narr||[]).filter(x=>x!==a.onarr),a.onarr].slice(-6);notes.push(`記下叙事注意（之後每回合都會提醒模型）：${a.onarr}`)}
    if(a.oloc){const rg=regionByLoc(a.oloc), rn=rg?(rg.n==="灰岩洞周邊"?"灰岩洞":rg.n):null, nb=nodeByLoc(a.oloc)||(S.world[baseLoc(a.oloc)]?baseLoc(a.oloc):null)||(rn&&S.world[rn]?rn:null);
      if(nb){S.world[nb].known=true;S.at=nb;S.loc=a.oloc.includes(nb)?a.oloc:nb;notes.push(`位置更正為：${S.loc}`)}
      else notes.push(`找不到「${a.oloc}」這個地點，位置沒有改。可以先到「地點」頁加上它。`)}
    if(a.odef){const lf=S.lastFoe;                       // 只補上最近一次交手的對手，等級照判定卡
      const nm=cleanName(a.odef.name), ex=S.corpses.filter(c=>sameFoe(nm,c.name)&&c.t>=nowH()-24).length;
      if(lf&&sameFoe(a.odef.name,lf.name)&&!ex)applyDefeat({...a.odef,lv:lf.lv,cls:lf.cls},notes);   // 最近一次交手的：完整結算
      else if(a.odef.dead){const lv=(lf&&sameFoe(a.odef.name,lf.name)?lf.lv:a.odef.lv)||"F", need=a.odef.n-ex;   // 其他：只補屍體（不加存在值），不重複補
        if(need>0){for(let i=0;i<need;i++)toCorpses(nm,a.odef.kind,lv).forEach(c=>{c.small=false;S.corpses.push(c)});notes.push(`補上了 ${need} 具${nm}的屍體（沒有加存在值）。`)}
        else notes.push(`${nm}的屍體已經在清單裡了，沒有重複補。`)}}
    if(/巢穴|據點/.test(a.text)&&/位置|搬|遷|落腳|更正為/.test(a.text))notes.push("巢穴位置不能用 OOC 改：到「同伴・巢穴」頁最下面用「搬家」（可選營地、中立以上聚落旁邊的「○○外圍營地」、或某地區裡的「○○的新營地」）。");
    if(!notes.length&&/修正|更正|切換|已經?(加入|改|移除|拿掉|補上|放進|調整|新增|升|降|刪|設定|成為|移到|移動|換到|設為)/.test(a.text))
      notes.push("程序這次沒有改到任何東西——上面說的「已修正」不算數。可以換個說法再問一次，或用頁面上的按鈕手動改（例如「同伴・巢穴」頁最下面可以補同伴）。");if(a.setChap&&a.setChap!==S.chap){S.chap=a.setChap;notes.push(`〈系統〉《世界之聲》：「第${S.chap}章・${chapOf().name}」`)}}
  if(e.kind==="war"&&a.win&&S.war){
    const f=S.war.foe;
    S.corpses.push({name:f.name,sp:speciesOf(f.name,f.kind),lv:f.lv,t:nowH(),big:true,evo:true,kind:f.kind});
    S.beaten.push(f.name); const ti=`${f.name}殺手`; if(!S.titles.includes(ti))S.titles.push(ti);
    S.war=null; S.evo=null;
    notes.push(`${f.name}倒下了。`,"〈系統〉《大賢者》：「告。進化戰勝利。吞噬對手，即可進化。」",`〈系統〉《世界之聲》：「獲得稱號『${ti}』。」`);
    npcGone(f.name,"死在進化戰",null);
  }
  S.opts=a.check?[]:a.opts.slice();
  if(a.loc&&!(you&&you.node)&&(e.kind==="turn"||e.kind==="resolve"||e.kind==="stage")){   // 不准瞬移：換到別的已知地點要花路程的時間
    const nb=nodeByLoc(a.loc);
    if(nb&&nb!==S.at){const ph=pathHours(S.at,nb), spent=(e.kind==="turn"&&you&&you.time!=null?you.time:a.time)||0;
      if(ph==null||spent<Math.min(3,ph)){notes.push(`（故事把地點寫成「${a.loc}」，但你沒有走過去，位置還是${S.at}。要過去請按「移動…」。）`);a.loc=null}}}
  if(a.loc)S.loc=a.loc;
  if(you&&you.node){                                   // 程序安排的移動
    if(you.reveal)addNode({name:you.node},you.from,S.world[you.node]?S.world[you.node].links[you.from]||2:2,notes);
    S.at=you.node; if(!S.loc.includes(you.node))S.loc=you.node+(a.loc&&!nodeByLoc(a.loc)?`・${baseLoc(a.loc)}`:"");
  }
  if(a.placeNew&&a.loc!=null){
    const from=you&&you.explore?you.from:S.at, n=addNode(a.placeNew,from,1,notes);
    if(n&&you&&you.explore){S.at=n;if(!S.loc.includes(n))S.loc=n}
  }
  if(!(you&&you.node)){const nb=nodeByLoc(a.loc);if(nb)S.at=nb}
  if(a.loc&&SETTLE.test(baseLoc(a.loc))&&!nodeByLoc(a.loc)){const n=addNode({name:a.loc,kind:"聚落"},S.at,1,notes);if(n)S.at=n}
  chapCheck(notes);
  e.notes=notes;
}
async function doJob(job,pre,ctxEnd){
  const mine=S; busy=true; TOAST=""; render();
  try{
    const alt=await runJob(job,S.log.slice(0,ctxEnd));
    if(S!==mine)return;
    const e={who:"gm",kind:job.kind,job,pre,alts:[alt],i:0};
    S.log.push(e); applyAlt(e);
    if(alt.ate&&alt.ate.length){busy=false;save();await autoEat(alt.ate);return}
  }catch(err){
    if(S!==mine)return;
    S.err={job,pre,ctxEnd,msg:err.message||String(err),raw:err.raw||""};
  }
  busy=false; save(); render();
}
function retry(){
  if(busy||!S.err)return;
  const {job,pre,ctxEnd}=S.err; S.err=null; doJob(job,pre,ctxEnd);
}
async function regen(){
  const L=S.log, e=L[L.length-1];
  if(busy||!e||e.who!=="gm"||!e.job||!e.pre)return;
  const idx=L.length-1;
  busy=true; EDIT=false; TOAST=""; render();
  try{
    restore(e.pre); const mine=S;
    const alt=await runJob(e.job,L.slice(0,idx-1));
    if(S!==mine)return;
    e.alts.push(alt); e.i=e.alts.length-1;
  }catch(err){ if(!S)return; TOAST="重新回答沒成功："+(err.message||err) }
  applyAlt(e); busy=false; save(); render();
}
function flip(d){
  const e=S.log[S.log.length-1];
  if(busy||!e||e.who!=="gm"||e.alts.length<2)return;
  e.i=(e.i+d+e.alts.length)%e.alts.length; applyAlt(e); save(); render();
}
function saveEdit(){
  const e=S.log[S.log.length-1], v=$("edtext").value.trim();
  if(v)e.alts[e.i].text=v;
  EDIT=false; save(); render();
}
/* 撤回：收回你最後一個行動和它之後的一切，狀態退回那之前 */
function undo(){
  if(busy)return;
  const L=S.log; let idx=-1;
  for(let i=L.length-1;i>=0;i--)if(L[i].who==="you"){idx=i;break}
  if(idx<0)return;
  const pre=L[idx].pre||(L[idx+1]&&L[idx+1].pre)||(S.err&&S.err.pre);
  if(!pre)return;
  DRAFT=L[idx].free?L[idx].text:""; S.log=L.slice(0,idx); restore(pre); EDIT=false; TOAST="";
  save(); render();
  const ta=$("freein"); if(ta&&DRAFT){ta.value=DRAFT;ta.focus()} DRAFT="";
}
const sysEntry=(text)=>({who:"gm",kind:"sys",alts:[{text,opts:S.opts.slice()}],i:0});

/* OOC 的規則助手 */
const OOC_SYS=`你是文字遊戲《權能進化・魔物篇》的規則助手，回答玩家跳出故事（OOC）問的問題。用繁體中文，口氣直接、簡短（150 字內），不要演戲、不要寫劇情。
遊戲規則（由程序執行）：
- 時間：小時制。說話觀察一回合 20 分鐘；搜刮、巢穴 1 小時；採集 2 小時；狩獵、探索 3 小時；判定代價可能多花時間。
- 飢餓：幼體吃飽撐 8 小時、餓著每 4 小時 HP -1；成體吃飽撐 24 小時、餓著每 24 小時 HP -1。
- 恢復：醒著沒餓每 3 小時 HP +1（有「再生」就 +再生等級）、MP +1；夜裡睡到 06:00 沒餓 HP 回一半、MP 回滿、消掉疲勞和小傷；白天小睡 3 小時各回四分之一並消掉【疲憊】；吃東西 HP +1~2。
- 吞噬：只有新鮮的（死去 24 小時內、活捉的小生物、蛋、新鮮植物）能學技能；同級保底 1 個候選，對手每高一級 +1，大成功再 +1，比你弱 0~1；已經會的技能不會再出現。主角技能沒有 Lv，只有等級字母（學到時的主角等級）；分「可用」和「倉庫」，可用上限／倉庫上限：F 6/15、E 9/15、D 9/20、C 9/20、B 9/30、A 和 S 9/30，新技能先進可用、滿了進倉庫，倉庫滿了要整合或放棄。5 個同大類（戰鬥＝攻擊防禦威懾、機動＝感知移動、生存＝其他）、同等級的技能可以整合成 1 個高一級的（最高比主角等級高一級），整合和手動換技能都花 4 小時，可能出小麻煩。判定時玩家選一個技能來用，攻擊、輔助、強化都一樣，用了就多一層優勢；一次一個，沒有組合技，也不花 MP。可用技能第一次滿 9 格（升到 E 級才有）時覺醒「異香」。
- 一天一次：自己的技能、魔法物品附帶的技能每天都只能各用一次（每件物品各自算），午夜恢復，不用睡覺。魔法物品等級低於對手等級時視同白字，沒有魔法效果，硬用會壞掉、不能修；普通（白字）武器防具可在判定時用掉一件換一層優勢，用完就沒了；紅／藍／紫藥水在背包喝，回 HP／MP／兩者，不花時間；紅或紫藥水也可以在背包餵給受傷的同伴（負傷治好、重傷減輕成負傷），藍藥水同伴用不到。
- 鍛造（背包頁）：白字武器＋魔法原料 → 魔法武器（等級＝原料等級，受物品等級上限；附帶技能從原料來源的技能池抽一個）；魔法武器＋更高級的原料 → 升級，技能不變。自己做魔化 6 小時、升級 12 小時；有工匠（同伴或族人）魔化 2 小時、升級 4 小時。
- 關鍵戰（進化戰、討伐戰）：每階段至少要付 1 項代價，傷害 ×1.5；同伴不再算優勢：程序讓在場的同伴自動減傷、並提供一天 2 次的能力，判定的 adv 不要再列同伴幫忙。
- 判定：付 1＋淨劣勢層數項代價算成功，再多 1 項大成功；對手每高一級一層劣勢。失敗由敘事者讓局面變糟。通用代價（硬吃一下＝對手一擊的傷害 F3/E5/D8/C12、拼盡全力＝MP 上限一半、多花兩小時）每次只能選一項；戰鬥中拖延會招來新麻煩（援軍等），同一場只能拖一次。用自己的技能 MP -1。【流血】每小時 HP -1，包紮或睡覺才停。
- 存在值：打贏同級 +1，對手每高一級 +1，比你弱不給；上限 F 10、E 20、D 40，每級翻倍。滿了要打進化戰：3 名高一級候選、48 小時期限、單挑 5 階段、可舍身（算兩項、永久傷殘）、撤退要犧牲；贏了吃掉對手就進化（HP 上限 +10、MP 上限 +5）。
- 魔法原料與物品：非小型的屍體（F 級也行）都可以拆出一項魔法原料，拆了屍體只剩肉；原料不會壞，吃了照等級差給技能候選；用原料做的魔法物品附帶一個技能，帶在身上判定時可以用，吃掉就學到那個技能。普通死物吃了學不到。
- 關係：敵意、警戒、無視、服從、信賴、追隨。分食物、救人、教本事、守承諾會變好，欺負、搶奪、羞辱會變壞；到追隨就成為同伴。黑顎、疤臉是對手，不會追隨。
- 同伴：最多兩名同行；技能最多 5 個（滿了由主角讓他忘掉一個才能再學）；同伴靠打獵（巢穴派工）和協助累積存在值，湊滿 20 由主角取名、選職業進化（程序處理，你不要寫他進化了）；吃東西學到的技能可以給同伴；受傷先【負傷】再【重傷】退出，睡一晚好一級。
- 狀態（標籤）：在故事裡解決就會拿掉，例如安撫或鎮壓騷亂、包紮傷口、和對方和解；睡覺會消掉疲勞和小傷。玩家也可以在「技能」頁點狀態手動拿掉。
如果玩家指出程序漏記或記錯了（故事裡拿到了卻沒進背包、狀態早就解決了、某個角色已經死了或被趕走卻還在名單上），在 fix 裡更正：found 放進背包的物品、lost 從背包拿掉的物品或屍體（例如屍體已經給了別人）、untag 要拿掉的狀態、recruit 同伴、npc_new 新角色、npc_gone 已經不在的角色 [{"name":"名字","why":"被趕走"}]、to_nest 交給巢穴的屍體或食物、faction 勢力數量更正 [{"name":"餓狼群","n":-3}]、rel 關係更正 [{"name":"名字","d":1}]、rename 改名 [{"from":"舊名","to":"新名"}]、chapter 切換到第幾章（1 求生、2 巢穴、3 拓展、4 搬家與異族爭端…，只在玩家明確要求時填）、place_new 記下地點（接在主角現在的位置旁邊）{"name":"地名","kind":"聚落","note":"一句話"}、nest 巢穴變化 {"pop":1,"d":1,"add":[{"t":"標籤","c":"good"}],"del":["標籤"]}、capture 帶回巢穴的俘虜 {"name":"名字","kind":"種族","lv":"F"}、deal 和聚落的約定 [{"place":"地名","what":"內容"}]（結束約定加 "end":true）、rel 也可以填聚落名，改聚落對主角的態度、heat 注目度更正 {"d":-2,"why":"理由"}、equip 同伴拿著的東西 [{"who":"同伴名","item":"物品名"}]（還給主角加 "off":true）。
玩家是遊戲的主人：他說某件事在故事裡發生過，就照他說的更正。回答裡說「已修正」時，fix 一定要有對應的內容；不要只用嘴巴說會修正。不要憑空給好處。
- 你的回答本身不會改任何東西，只有 fix 裡的內容會被程序執行，程序會在你的回答下面列出實際改了什麼。fix 是空的就不要說「已修正」「已加入」。
- 讓角色成為同伴一定用 recruit：{"name":"名字","kind":"種族","knack":"本事"}，不要用 rel 代替。對手（狀態資料寫「是對手」的，例如黑顎、疤臉）不能加入。
- 關係在故事裡一天最多好一級，程序會擋；用 OOC 更正的 rel、recruit 不受這個限制。
- 位置錯了（例如被寫回巢穴）：在 fix 填 loc："地名"（已知的地點或地區），程序會把主角放回那裡。
- 玩家抱怨「叙事老是寫錯某件事」（例如巢穴裡明明沒幾個人卻一直寫一群族人、寫了不存在的角色、時間地點老寫錯）：在 fix 填 narr："一句叙事注意"（例如「巢穴沒有族人，只有哥布戰和小眼」），程序會存起來，之後每回合都提醒故事模型；一句話寫完，不要超過 40 字。
- 玩家說主角學會了某族的語言（例如吃了那一族、或住進那個聚落多日學會）而程序沒記到：在 fix 填 lang："野豬人語"（只能填「某某語」）。學舌只能學同等級的動物叫聲，不用記。
- 主角在故事裡已經當上巢穴之主（老首領退位、交出位子）而程序沒記到：在 fix 填 chief：true。
- 同伴跟不跟在身邊，由「同伴・巢穴」頁的按鈕切換，OOC 改不了；遇到這種問題，請玩家去按按鈕，不要說已修正。
- 巢穴的位置（程序記的 nestAt）OOC 改不了，fix 裡也沒有這個欄位：玩家說巢穴不在這裡、要把巢穴搬到別處，只能請他到「同伴・巢穴」頁最下面用「搬家」（可以選已知的營地、中立以上聚落旁邊的「○○外圍營地」、或某個地區裡的「○○的新營地」；敵對聚落旁邊不行），不要說「已更正」「已在後台改好」。
- 存糧、人口、標籤一律以【目前狀態】為準，不要編造「系統在低於幾天會自動掛標籤」之類的規則；狀態裡沒有的標籤就說沒有。
- 同伴會變強：主角每次進化，可以替一名同伴命名進化（選方向、換種族名、多一個技能位）；吃東西學到的技能也能給同伴。光留在家裡不會變強。
- 戰鬥判定成功了卻沒有屍體、存在值沒加：故事裡對手確實死了，就在 fix 填 defeated {"name":"名字","kind":"種族","lv":"E","dead":true,"n":1}（n＝死了幾個，最多 3；屍體只能用 defeated 補，不能用 found 填「○○屍體」；程序會自己去重，不會多補）。存在值滿了本來就不會再加，要照實說。
- 巢穴：存糧是份數，交給巢穴的屍體 F 1 份、E 3 份、D 6 份，肉類 1~2 份；每天吃掉人口格數份；吃光人口掉一格，連吃飽 3 天人口漲一格；存糧夠吃 3 天以上〔需求（食物）〕自動拿掉。人口、戰力、巢穴標籤照故事事件變動。
只輸出 JSON：{"answer":"回答","fix":{"found":[],"lost":[],"untag":[],"recruit":null,"npc_new":null,"npc_gone":[],"to_nest":[],"nest":null,"faction":[],"rel":[],"place_new":null,"rename":[],"equip":[],"defeated":null,"loc":null,"chief":null,"narr":null,"lang":null}}`;

