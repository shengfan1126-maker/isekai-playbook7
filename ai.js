/* isekai-playbook7｜ai.js：自由敘事。AI 只做兩件事：
   1) 讀懂玩家的話，翻成「行動清單」（JSON），由程式判定；2) 依程式給的結果寫敘事。AI 不改數字、不給東西。
   支援 Gemini（Google AI Studio 金鑰）與 OpenRouter。依賴 data.js、game.js。 */
const ls={g:k=>{try{return localStorage.getItem(k)}catch(e){return null}},s:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}},d:k=>{try{localStorage.removeItem(k)}catch(e){}}};

const AI={
  cfg(){return {prov:ls.g("ai_prov")||(ls.g("gm_key")?"gemini":"none"),gk:ls.g("gm_key")||"",gm:ls.g("gm_model")||"gemini-2.5-flash",
    ok:ls.g("or_key")||"",om:ls.g("or_model")||"google/gemini-2.5-flash"}},
  on(){const c=this.cfg();return !!((c.prov==="gemini"&&c.gk)||(c.prov==="openrouter"&&c.ok))},
  async call(system,user,json){
    const c=this.cfg();
    if(c.prov==="gemini"){
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.gm)}:generateContent?key=${encodeURIComponent(c.gk)}`,
        {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},
          contents:[{role:"user",parts:[{text:user}]}],generationConfig:json?{responseMimeType:"application/json",temperature:0.3}:{temperature:0.9}})});
      const j=await r.json();if(j.error)throw new Error(j.error.message||"Gemini 錯誤");
      return ((j.candidates||[])[0]?.content?.parts||[]).map(p=>p.text||"").join("").trim();
    }
    if(c.prov==="openrouter"){
      const r=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+c.ok},
        body:JSON.stringify({model:c.om,temperature:json?0.3:0.9,messages:[{role:"system",content:system},{role:"user",content:user}]})});
      const j=await r.json();if(j.error)throw new Error(j.error.message||"OpenRouter 錯誤");
      return (j.choices?.[0]?.message?.content||"").trim();
    }
    throw new Error("沒有設定 AI");
  }
};

/* 給 AI 看的現況（只列名字，不給它改數字的機會） */
function aiContext(){
  const P=placeOf();
  const L=[];
  L.push(`第 ${S.day} 天 ${String(S.hour).padStart(2,"0")}:00，第${S.ch===1?"一":"二"}章，在「${S.at}」（本質：${P.e.join("、")}${P.water?"，有水":""}${P.cave?"，有岩穴":""}）。`);
  L.push(`已知地點：${S.places.join("、")}`);
  L.push(`求生：${NEEDS.map(k=>k+(S.needs[k]?"✔":"✘")).join(" ")}`);
  L.push(`技能（技能表，可用）：${S.skills.map(s=>`${s.n}〔${s.e.join("・")}〕剩${usesLeft(s)}次`).join("、")||"無"}`);
  if(S.store.length)L.push(`倉庫（不能直接用）：${S.store.map(s=>s.n).join("、")}`);
  L.push(`物品：${S.items.map(i=>i.n).join("、")||"無"}；材料：${MATS.filter(m=>S.mats[m]).map(m=>m+"×"+S.mats[m]).join("、")||"無"}`);
  L.push(`看過的魔物技巧：${S.seen.map(x=>`${x.n}（${x.from}）`).join("、")||"無"}`);
  if(S.enc)L.push(`正在遭遇：${S.enc.n}（${S.enc.lv} 級）`);
  L.push(`手法：${MOVES.map(m=>m.n).join("、")}`);
  L.push(`配方：${RECIPES.map(r=>r.n).join("、")}`);
  return L.join("\n");
}
const PARSE_SYS=`你是文字冒險遊戲的「規則翻譯員」。把玩家的話翻成一個 JSON，交給程式判定。你不判定成敗、不給物品、不改數字、不寫故事。
只輸出 JSON，欄位：
{"act":"gather|explore|hunt|fight|retreat|craft|combo|shelter|rest|move|sleep|talk",
 "skills":["技能名，最多 3 個，只能用『技能表』裡有的"],
 "obj":{"t":"place|item|seen|enemy|none","n":"名稱"},
 "move":"手法名（組合時必填，只能從手法清單選最接近的）",
 "goal":"食物|火|水|避難所|（沒有就空字串）",
 "craft":"配方名（製作時）","place":"移動的目的地（只能是已知地點）",
 "weapon":true或false（玩家說要用武器），
 "adv":["玩家描述裡真的存在的有利條件，最多 2 條"],"dis":["不利條件，最多 2 條"],
 "costs":["玩家說願意付的代價：hp|mp|time|item|shesh（捨身＝拿傷殘換大成功）"],
 "say":"用一句繁體中文重述玩家要做的事"}
規則：
- 玩家把技能用在某個東西上、或把幾個技能疊在一起用，就是 combo；obj 是用在誰身上（地點、物品、看過的魔物技巧、眼前的敵人）。
- 模仿或偷學魔物的動作：combo，obj.t="seen"，n=那個技巧名。
- 動詞對應手法：鋪開、籠罩→覆蓋；扔、射、甩出去→丟出去；包、圍、裹→包住；附在武器上→灌進武器；嚇、吼、威脅→嚇；感覺、探查、聽、看→感受；聚在一點、加熱、點燃→集中；壓、擠、榨→壓縮；加速、強化身體、疊起來衝→催動。
- 找吃的、撿東西＝gather；四處走走找新地方＝explore；找獵物＝hunt；遭遇中打＝fight，逃＝retreat；做石刀、草棚、火種、水袋等＝craft；進岩穴住下＝shelter；換地方＝move；養傷、坐著休息＝rest；睡到明天＝sleep；只是聊天或想事情＝talk。
- 名稱一律照清單原字，不要自創技能、物品、地點。清單裡沒有的就不要填。`;
async function aiParse(text){
  const raw=await AI.call(PARSE_SYS,`【現況】\n${aiContext()}\n\n【玩家】${text}`,true);
  const m=raw.match(/\{[\s\S]*\}/);if(!m)throw new Error("AI 沒有回傳 JSON");
  return normIntent(JSON.parse(m[0]));
}
/* 把 AI 的回答收斂成程式認得的東西 */
function normIntent(j){
  const near=(name,list)=>{if(!name)return null;return list.find(x=>x===name)||list.find(x=>name.includes(x)||x.includes(name))||null};
  const acts=["gather","explore","hunt","fight","retreat","craft","combo","shelter","rest","move","sleep","talk"];
  const it={act:acts.includes(j.act)?j.act:"talk",say:String(j.say||"")};
  it.skills=uniq((j.skills||[]).map(n=>near(String(n),S.skills.map(s=>s.n))).filter(Boolean)).slice(0,3);
  it.move=near(j.move,MOVES.map(m=>m.n))||"";
  it.goal=NEEDS.includes(j.goal)?j.goal:"";
  it.craft=near(j.craft,RECIPES.map(r=>r.n))||"";
  it.place=near(j.place,S.places)||"";
  it.weapon=!!j.weapon;
  it.adv=(j.adv||[]).map(String).slice(0,2);it.dis=(j.dis||[]).map(String).slice(0,2);
  it.costs=(j.costs||[]).filter(c=>["hp","mp","time","item","shesh"].includes(c));
  const o=j.obj||{};let obj={t:"none",n:""};
  if(o.t==="place"){const n=near(o.n,S.places);if(n)obj={t:"place",n}}
  else if(o.t==="item"){const n=near(o.n,S.items.map(i=>i.n).concat(MATS.filter(m=>S.mats[m])));if(n)obj={t:"item",n}}
  else if(o.t==="seen"){const n=near(o.n,S.seen.map(x=>x.n));if(n)obj={t:"seen",n}}
  else if(o.t==="enemy"&&S.enc)obj={t:"enemy",n:S.enc.n};
  it.obj=obj;
  if(it.act==="combo"&&!it.skills.length)it.act="talk";
  return it;
}
const NARR_SYS=`你是「孤獨異世界」的旁白。主角是一個人被丟到異世界的轉生者，沒有同伴，四周都是荒野。
用繁體中文寫 2～4 句，描述剛剛發生的事。只能描述【結果】裡寫到的東西：不要加任何新的物品、數字、人物、同伴、技能；不要替玩家決定下一步；不要寫選項。語氣冷靜、有生存感。`;
async function aiNarrate(said,result){
  return AI.call(NARR_SYS,`【玩家說】${said||"（用按鈕行動）"}\n【結果】${result}`,false);
}
