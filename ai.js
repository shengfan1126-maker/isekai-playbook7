/* isekai-playbook7｜ai.js：呼叫模型的部分照搬魔物篇（monster-game v0.45 的 ai.js）：
   OpenRouter 免費模型自動挑選、Gemini 自動挑模型、Gemini＋OpenRouter 互相備援、串流、換模型重試。
   金鑰與設定沿用魔物篇的存法（gm_key、or_key、mowu_prov、mowu_mode、or_model…），同一個網址下兩個遊戲共用。
   後半是本遊戲自己的：把玩家的話翻成行動（aiParse）、依結果寫故事（aiNarrate）。AI 不改數字、不給東西。 */
const ls={g:k=>{try{return localStorage.getItem(k)}catch(e){return null}},s:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}},d:k=>{try{localStorage.removeItem(k)}catch(e){}}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const EL={key:document.getElementById("key"),gkey:document.getElementById("gkey"),model:document.getElementById("model")};
const NOT_CHAT_EARLY=/lyria|music|audio|tts|speech|whisper|embed|image/i;
const DEFAULT_MODEL="";
EL.key.value=ls.g("or_key")||"";
EL.gkey.value=ls.g("gm_key")||"";
let PROV=ls.g("mowu_prov")||(ls.g("gm_key")&&ls.g("or_key")?"both":ls.g("gm_key")?"gemini":ls.g("or_key")?"or":"both");
EL.model.value=(ls.g("or_model")||"").replace(/^anthropic\/claude-sonnet-4\.5$/,"");
let MODE=ls.g("mowu_mode")==="list"?"list":"auto";
if(ls.g("mowu_good")&&NOT_CHAT_EARLY.test(ls.g("mowu_good")))ls.d("mowu_good");
ls.d("mowu_free");
const modelList=()=>(ls.g("or_model")||EL.model.value||"").split(/[\n,]/).map(s=>s.trim()).filter(Boolean);
const shortName=m=>m.replace(/:free$/,"").split("/").pop();

/* OpenRouter 可能在回應前塞幾行「: OPENROUTER PROCESSING」保活訊息，先去掉再讀 */
function readBody(t){
  const clean=t.split("\n").filter(l=>!/^\s*:/.test(l)).join("\n").trim();
  try{return JSON.parse(clean)}catch(e){}
  const i=clean.indexOf("{"); if(i>=0){try{return JSON.parse(clean.slice(i))}catch(e){}}
  return null;
}
function apiError(msg,code){
  msg=String(msg||"");
  if(/per-day|per day|daily/i.test(msg)){const e=new Error("今天的免費額度用完了");e.stop=true;return e}
  if(code===402||/credit|insufficient|payment/i.test(msg)){const e=new Error("帳戶點數不足");e.stop=true;return e}
  if(code===401||/invalid.*key|no auth|unauthorized|user not found/i.test(msg)){const e=new Error("金鑰無效，檢查一下齒輪裡的 key");e.stop=true;return e}
  return new Error(code===429||/rate|limit|quota|capacity|overload/i.test(msg)?"塞車":msg.slice(0,80));
}
/* 串流：一邊收一邊顯示，也不會因為等太久被斷線 */
async function askOne(mdl,k,messages,maxTok,json,onDelta){
  if(!FREE_OK.has(mdl))throw new Error("不是免費模型，沒有送出");
  const body={model:mdl,max_tokens:maxTok,temperature:0.85,messages,stream:true,reasoning:{exclude:true}};
  if(json)body.response_format={type:"json_object"};
  const ctl=new AbortController(); let idle=null;
  const poke=()=>{clearTimeout(idle);idle=setTimeout(()=>ctl.abort(),75e3)};
  poke();
  let r;
  try{
    r=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",signal:ctl.signal,
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+k},body:JSON.stringify(body)});
  }catch(e){clearTimeout(idle);throw new Error(e.name==="AbortError"?"等太久沒回應":"連不上")}
  if(!r.ok){
    clearTimeout(idle);
    const t=await r.text().catch(()=>"" ), d=readBody(t)||{};
    throw apiError((d.error&&d.error.message)||("HTTP "+r.status),(d.error&&d.error.code)||r.status);
  }
  let txt="",finish=null,usage=null,sErr=null,buf="";
  try{
    if(!r.body||!r.body.getReader){            // 不支援串流的瀏覽器：整包讀
      const d=readBody(await r.text())||{};
      const c=(d.choices||[])[0]||{}; txt=((c.message||{}).content)||((c.delta||{}).content)||""; finish=c.finish_reason; usage=d.usage;
    }else{
      const rd=r.body.getReader(), dec=new TextDecoder();
      for(;;){
        const {done,value}=await rd.read(); if(done)break; poke();
        buf+=dec.decode(value,{stream:true});
        const lines=buf.split("\n"); buf=lines.pop();
        for(const ln of lines){
          const L=ln.trim(); if(!L.startsWith("data:"))continue;
          const data=L.slice(5).trim(); if(data==="[DONE]")continue;
          let j; try{j=JSON.parse(data)}catch(e){continue}
          if(j.error)sErr=j.error;
          const c=(j.choices||[])[0];
          if(c){const dl=c.delta&&c.delta.content; if(dl){txt+=dl;if(onDelta)onDelta(txt)} if(c.finish_reason)finish=c.finish_reason}
          if(j.usage)usage=j.usage;
        }
      }
    }
  }catch(e){
    if(!txt.trim())throw new Error(e.name==="AbortError"?"等太久沒回應":"連線中斷");
    finish="length";                        // 收到一半斷線：當成被截斷，交給救援
  }finally{clearTimeout(idle)}
  if(sErr&&!txt.trim())throw apiError(sErr.message,sErr.code);
  if(!txt.trim())throw new Error("回了空白");
  return {txt:txt.trim(),cut:finish==="length",used:mdl,usage};
}
/* 依序試，回應要通過 validate 才算成功；
   有模型寫了中文故事但沒照格式，先記著當最後的備案 */
async function tryList(list,k,messages,maxTok,validate,onFail,onDelta){
  const tried=[]; let backup=null, lastRaw="";
  for(let i=0;i<list.length;i++){
    const m=list[i];
    if(onDelta)onDelta("");
    try{
      const res=await askOne(m.id,k,messages,maxTok,m.json,onDelta);
      res.val=validate(res); res.fellBack=i>0?tried.slice():null; res.model=m; return res;
    }catch(e){
      tried.push(shortName(m.id)+"（"+(e.message||"失敗")+"）");
      if(e.prose&&!backup)backup={used:m.id,val:e.prose,loose:true,model:m};
      if(e.raw)lastRaw=e.raw;
      if(e.stop){const x=new Error(e.message+(e.message.includes("免費額度")?"。OpenRouter 免費模型一天 50 次（帳戶累計買過 10 美元點數以上是 1000 次），明天會重置。":""));x.raw=lastRaw;x.stop=true;throw x}
      if(onFail)onFail(m.id);
      if(i<list.length-1)await wait(250);
    }
  }
  if(backup){backup.fellBack=tried.slice();return backup}
  const err=new Error((list.length>1?"試過的模型都不通：\n":"")+tried.join("\n"));
  err.raw=lastRaw; err.allFail=true; throw err;
}
/* 只挑「文字進、文字出」的聊天模型 */
const MODELS_URL="https://openrouter.ai/api/v1/models";
const outCap=m=>(m.top_provider||{}).max_completion_tokens||0;
const NOT_CHAT=/[-/ ]code\b|coder|laguna|lyria|music|audio|tts|speech|whisper|transcri|embed|rerank|moderat|guard|safety|classif|image|vision-only|imagen|veo|flux|sdxl|diffusion/i;
const SLOW=/reason|think|r1\b|omni|ultra|550b|405b/i;
const TOP=/deepseek|qwen|glm|kimi|gemini|gemma|llama|mistral/i;
const PREF=/deepseek|qwen|llama|mistral|gemma|glm|kimi|gpt-oss|nemotron|hermes|grok|gemini|phi|minimax/i;
const supJson=m=>(m.supported_parameters||[]).some(x=>x==="response_format"||x==="structured_outputs");
const isChat=m=>{const a=m.architecture||{},out=a.output_modalities||["text"],inp=a.input_modalities||["text"];
  return out.length===1&&out[0]==="text"&&inp.includes("text")&&!NOT_CHAT.test(m.id+" "+(m.name||""))&&(m.context_length||0)>=16000};
const price=m=>{const p=m.pricing||{};return{pin:parseFloat(p.prompt||"0")||0,pout:parseFloat(p.completion||"0")||0}};
const FREE_OK=new Set();
async function fetchModels(){const r=await fetch(MODELS_URL);const d=(await r.json()).data||[];d.forEach(m=>{const x=price(m);if(x.pin===0&&x.pout===0)FREE_OK.add(m.id)});return d}
async function fetchFree(){
  const ok=(await fetchModels()).filter(m=>{const x=price(m);return x.pin===0&&x.pout===0&&isChat(m)});
  const score=m=>(TOP.test(m.id)?3:0)+(PREF.test(m.id)?4:0)+(supJson(m)?2:0)-(SLOW.test(m.id)?5:0);
  return ok.sort((a,b)=>score(b)-score(a)||outCap(b)-outCap(a)||(b.context_length||0)-(a.context_length||0))
    .map(m=>({id:m.id,json:supJson(m),pin:0,pout:0}));
}
async function cachedList(kind,force){
  const K="mowu_free3";
  let c=null;try{c=JSON.parse(ls.g(K)||"null")}catch(e){}
  if(!force&&c&&c.list&&c.list.length&&Date.now()-c.t<6*3600e3){c.list.forEach(m=>{if(!m.pin&&!m.pout)FREE_OK.add(m.id)});return c.list}
  const list=(await fetchFree()).slice(0,25);
  if(!list.length)throw new Error("OpenRouter 現在查不到免費的聊天模型。");
  ls.s(K,JSON.stringify({t:Date.now(),list}));
  return list;
}
const getBad=()=>{try{return JSON.parse(ls.g("mowu_bad")||"{}")}catch(e){return {}}};
/* ═════════ Gemini（Google AI Studio）═════════ */
const GEM="https://generativelanguage.googleapis.com/v1beta";
const GEM_NOT=/embed|image|imagen|veo|tts|audio|live|aqa|robotics|computer-use|learnlm|gemma/i;
function gemRank(id){
  const v=parseFloat((id.match(/gemini-(\d+(?:\.\d+)?)/)||[])[1]||"0");
  const tier=/flash-lite/.test(id)?1:/flash/.test(id)?2:/pro/.test(id)?0:-1;   // flash 額度最寬，排前面
  return tier*100+v*10-(/preview|exp/.test(id)?1:0);
}
async function gemModels(force){
  let c=null;try{c=JSON.parse(ls.g("mowu_gem")||"null")}catch(e){}
  if(!force&&c&&c.list&&c.list.length&&Date.now()-c.t<6*3600e3)return c.list;
  const k=(ls.g("gm_key")||EL.gkey.value).trim();
  const r=await fetch(GEM+"/models?pageSize=200&key="+encodeURIComponent(k));
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw gemErr(d,r.status);
  const list=(d.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes("generateContent")&&/gemini/.test(m.name)&&!GEM_NOT.test(m.name))
    .map(m=>m.name.replace(/^models\//,"")).sort((a,b)=>gemRank(b)-gemRank(a)).slice(0,12);
  if(!list.length)throw new Error("這把 key 查不到可用的 Gemini 模型。");
  ls.s("mowu_gem",JSON.stringify({t:Date.now(),list}));
  return list;
}
function gemErr(d,status){
  const e=(d&&d.error)||{}, msg=e.message||("HTTP "+status), st=e.status||"";
  if(status===400&&/API key not valid|API_KEY_INVALID/i.test(msg)){const x=new Error("Gemini key 無效，檢查一下齒輪裡的 key");x.stop=true;return x}
  if(status===403){const x=new Error("這把 key 沒有權限（"+msg.slice(0,60)+"）");x.stop=true;return x}
  if(/limit:\s*0\b/.test(msg)){const x=new Error("免費方案不能用這個模型");x.noFree=true;return x}
  if(status===429||st==="RESOURCE_EXHAUSTED")return new Error(/day|PerDay/i.test(msg)?"這個模型今天的免費額度用完了":"塞車或每分鐘次數到了");
  if(status===503||status===500)return new Error("Google 那邊忙線");
  return new Error(msg.slice(0,80));
}
async function gemOne(model,k,messages,maxTok,onDelta){
  const sys=messages.filter(m=>m.role==="system").map(m=>m.content).join("\n\n");
  const body={
    systemInstruction:{parts:[{text:sys}]},
    contents:messages.filter(m=>m.role!=="system").map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.content}]})),
    generationConfig:{temperature:0.9,maxOutputTokens:Math.max(maxTok,6000),responseMimeType:"application/json"},
    // 吃魔物、打架、和夥伴親近的描寫容易被預設過濾誤擋，四類都放寬（Google 另有一層調不了的過濾）
    safetySettings:["HARM_CATEGORY_DANGEROUS_CONTENT","HARM_CATEGORY_HARASSMENT","HARM_CATEGORY_SEXUALLY_EXPLICIT","HARM_CATEGORY_HATE_SPEECH"].map(category=>({category,threshold:"BLOCK_NONE"}))
  };
  const ctl=new AbortController(); let idle=null;
  const poke=()=>{clearTimeout(idle);idle=setTimeout(()=>ctl.abort(),90e3)}; poke();
  let r;
  try{
    r=await fetch(`${GEM}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(k)}`,{method:"POST",signal:ctl.signal,
      headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  }catch(e){clearTimeout(idle);throw new Error(e.name==="AbortError"?"等太久沒回應":"連不上 Google")}
  if(!r.ok){clearTimeout(idle);const d=await r.json().catch(()=>({}));throw gemErr(d,r.status)}
  let txt="",finish=null,block=null,buf="",cats=[];
  const pick=rs=>(rs||[]).forEach(x=>{if((x.blocked||/HIGH|MEDIUM/.test(x.probability||""))&&!cats.includes(x.category))cats.push(x.category)});
  try{
    const rd=r.body.getReader(),dec=new TextDecoder();
    for(;;){
      const {done,value}=await rd.read(); if(done)break; poke();
      buf+=dec.decode(value,{stream:true});
      const lines=buf.split("\n"); buf=lines.pop();
      for(const ln of lines){
        const L=ln.trim(); if(!L.startsWith("data:"))continue;
        let j; try{j=JSON.parse(L.slice(5).trim())}catch(e){continue}
        if(j.promptFeedback){if(j.promptFeedback.blockReason)block=j.promptFeedback.blockReason;pick(j.promptFeedback.safetyRatings)}
        const c=(j.candidates||[])[0]; if(!c)continue;
        pick(c.safetyRatings);
        const t=((c.content||{}).parts||[]).filter(p=>!p.thought).map(p=>p.text||"").join("");
        if(t){txt+=t;if(onDelta)onDelta(txt)}
        if(c.finishReason)finish=c.finishReason;
      }
    }
  }catch(e){
    if(!txt.trim())throw new Error(e.name==="AbortError"?"等太久沒回應":"連線中斷");
    finish="MAX_TOKENS";
  }finally{clearTimeout(idle)}
  if(!txt.trim()){
    const why=block||finish||"";
    if(block||/SAFETY|PROHIBITED|BLOCKLIST|SPII|IMAGE_SAFETY/.test(finish||"")){
      const CAT={HARM_CATEGORY_SEXUALLY_EXPLICIT:"色情",HARM_CATEGORY_HATE_SPEECH:"仇恨言論",HARM_CATEGORY_HARASSMENT:"騷擾",HARM_CATEGORY_DANGEROUS_CONTENT:"危險內容",HARM_CATEGORY_CIVIC_INTEGRITY:"公民誠信"};
      const kind=cats.length?cats.map(c=>CAT[c]||c.replace("HARM_CATEGORY_","")).join("、")
        :/PROHIBITED/.test(why)?"禁止內容（Google 調不了的那層）":/BLOCKLIST/.test(why)?"禁用詞清單":/SPII/.test(why)?"個人敏感資訊":"沒說是哪一類";
      const x=new Error(`被 Google 的安全過濾擋下：${kind}`);x.safety=true;throw x;
    }
    throw new Error("回了空白");
  }
  return {txt:txt.trim(),cut:finish==="MAX_TOKENS",used:model};
}
async function callGemini(messages,maxTok,validate,onDelta){
  const k=(ls.g("gm_key")||EL.gkey.value).trim();
  if(!k)throw new Error("還沒填 Gemini key，點右上角齒輪。");
  const all=await gemModels(), good=ls.g("mowu_gem_good"), bad=getBad(), now=Date.now();
  let order=[...(all.includes(good)?[good]:[]),...all.filter(x=>x!==good)];
  const fresh=order.filter(x=>!(bad["g:"+x]&&now-bad["g:"+x]<10*60e3)); if(fresh.length)order=fresh;
  const tried=[]; let backup=null,lastRaw="",msgs=messages,blocked=false;
  for(const m of order.slice(0,3)){
    if(onDelta)onDelta("");
    try{
      const res=await gemOne(m,k,msgs,maxTok,onDelta);
      res.val=validate(res); res.fellBack=tried.length?tried.slice():null;
      ls.s("mowu_gem_good",m); return res;
    }catch(e){
      tried.push(m+"（"+(e.message||"失敗")+"）");
      if(e.prose&&!backup)backup={used:m,val:e.prose,loose:true};
      if(e.raw)lastRaw=e.raw;
      if(e.stop){e.raw=lastRaw;throw e}
      if(e.safety){blocked=true; if(messages.short){msgs=messages.short;tried[tried.length-1]+="，下一個改送較少的前文"}}   // 被擋不是模型壞了，不跳過它
      else{const b=getBad();b["g:"+m]=Date.now()+(e.noFree?24*3600e3:0);ls.s("mowu_bad",JSON.stringify(b))}   // 免費方案不給用的，一天內不再試
      await wait(300);
    }
  }
  if(backup){backup.fellBack=tried;return backup}
  const hint=blocked&&PROV==="gemini"?"\n（齒輪裡把模型來源改成「Gemini＋OpenRouter」，Gemini 被擋時會自動換 OpenRouter 再寫。）":"";
  const err=new Error("試過的模型都不通：\n"+tried.join("\n")+hint); err.raw=lastRaw; throw err;
}
/* 保險：只准送給免費模型（價格為 0）。名單裡查不到、或有標價的，一律不送 */
async function freeOnly(ids){
  const all=await fetchModels(), ok=[], skipped=[];
  for(const id of ids){
    const m=all.find(x=>x.id===id), x=m&&price(m);
    if(m&&x.pin===0&&x.pout===0)ok.push({id,json:supJson(m)}); else skipped.push(id);
  }
  return {ok,skipped};
}
/* 模型來源：both＝先 Gemini，不通再換 OpenRouter 免費模型 */
async function callModel(messages,maxTok,validate0,onDelta){
  const validate=validate0;
  if(PROV==="gemini")return callGemini(messages,maxTok,validate,onDelta);
  if(PROV==="both"){
    const gk=ls.g("gm_key"), ok=ls.g("or_key");
    if(gk){try{return await callGemini(messages,maxTok,validate,onDelta)}catch(e){if(!ok)throw e;
      const r=await callOR(messages,maxTok,validate,onDelta);r.fellBack=[...(r.fellBack||[]),"Gemini"];return r}}
    return callOR(messages,maxTok,validate,onDelta);
  }
  return callOR(messages,maxTok,validate,onDelta);
}
async function callOR(messages,maxTok,validate,onDelta){
  const k=(ls.g("or_key")||EL.key.value).trim();
  if(!k) throw new Error("還沒填 OpenRouter 金鑰，點右上角齒輪。");
  if(MODE==="list"){
    const {ok,skipped}=await freeOnly(modelList());
    if(!ok.length)throw new Error("清單裡沒有免費模型"+(skipped.length?"（跳過了付費的："+skipped.map(shortName).join("、")+"）":"")+"。");
    return tryList(ok,k,messages,maxTok,validate,null,onDelta);
  }
  const all=await cachedList("free"), good=ls.g("mowu_good"), bad=getBad(), now=Date.now();
  const g=all.find(m=>m.id===good);
  let order=[...(g?[g]:[]),...all.filter(m=>m.id!==good)];
  const fresh=order.filter(m=>!(bad[m.id]&&now-bad[m.id]<10*60e3));
  if(fresh.length)order=fresh;
  const res=await tryList(order.slice(0,3),k,messages,maxTok,validate,id=>{const b=getBad();b[id]=Date.now();ls.s("mowu_bad",JSON.stringify(b))},onDelta);
  if(!res.loose)ls.s("mowu_good",res.used);
  return res;
}
function allObjects(t){
  const out=[],st=[];let inStr=false,e2=false;
  for(let i=0;i<t.length;i++){const ch=t[i];
    if(inStr){if(e2)e2=false;else if(ch==="\\")e2=true;else if(ch==='"')inStr=false;continue}
    if(ch==='"'){inStr=true;continue}
    if(ch==="{")st.push(i);else if(ch==="}"&&st.length)out.push(t.slice(st.pop(),i+1));}
  return out;
}
const parseObjs=t=>allObjects(t).map(s=>{try{return JSON.parse(s)}catch(e){return null}}).filter(Boolean);



/* 有沒有可用的 AI（照魔物篇的「用哪一家」） */
const AI={on(){const gk=ls.g("gm_key"),ok=ls.g("or_key");return PROV==="gemini"?!!gk:PROV==="or"?!!ok:!!(gk||ok)}};

/* 給 AI 看的現況（只列名字，不給它改數字的機會） */
function aiContext(){
  const P=placeOf();
  const L=[];
  L.push(`第 ${S.day} 天 ${String(S.hour).padStart(2,"0")}:00，第${S.ch===1?"一":"二"}章，在「${S.at}」（本質：${P.e.join("、")}${P.water?"，有水":""}${P.cave?"，有岩穴":""}）。`);
  L.push(`已知地點：${S.places.join("、")}`);
  L.push(`求生：${NEEDS.map(k=>k+(S.needs[k]?"✔":"✘")).join(" ")}`);
  L.push(`技能（技能表，可用）：${S.skills.concat(itemSkills()).map(s=>`${s.n}〔${s.e.join("・")}〕剩${usesLeft(s)}次${s.fromItem?"（魔法物品附帶）":""}`).join("、")||"無"}`);
  L.push(`裝備：${SLOTS.map(k=>S.eq[k]?`${k}＝${S.eq[k].n}${S.eq[k].mg?"（"+mgDesc(S.eq[k].mg)+"）":""}`:"").filter(Boolean).join("、")||"無"}`);
  if(S.store.length)L.push(`倉庫（不能直接用）：${S.store.map(s=>s.n).join("、")}`);
  L.push(`背包物品：${S.items.map(i=>i.n).join("、")||"無"}；材料：${MATS.filter(m=>S.mats[m]).map(m=>m+"×"+S.mats[m]).join("、")||"無"}`);
  if(S.ch===2)L.push(`據點：${S.nest} 級（${S.base}），點數 ${S.pts}；設施：${S.fac.map(f=>f.n+(f.s?`〔${f.s.n}〕`:"〔空〕")).join("、")||"無"}`);
  if(S.raid)L.push(`${S.raid.kind==="boss"?"魔王戰":"升級戰"}進行中：第 ${S.raid.i+1}/${S.raid.list.length} 場（${S.enc?S.enc.dir:""}），已輸 ${S.raid.lost}`);
  if(S.enc)L.push(`正在遭遇：${S.enc.n}（${S.enc.lv} 級，屬性 ${(S.enc.e||[]).join("、")||"無"}${S.enc.r?"，遠程":""}）${S.enc.army?"，大軍":""}`);
  if(P.kind&&P.kind!=="wild")L.push(`這裡是${KIND_WORD[P.kind]}${P.race?`（${P.race}，態度${REL_WORD[relOf(P.race)]}）`:""}${specialHere()?`，可以「${specialHere().label}」`:""}`);
  L.push(`手法：${MOVES.map(m=>m.n).join("、")}`);
  L.push(`配方：${RECIPES.map(r=>r.n).join("、")}`);
  return L.join("\n");
}
const PARSE_SYS=`你是文字冒險遊戲的「規則翻譯員」。把玩家的話翻成一個 JSON，交給程式判定。你不判定成敗、不給物品、不改數字、不寫故事。
只輸出 JSON，欄位：
{"act":"gather|explore|hunt|fight|retreat|craft|combo|shelter|rest|move|sleep|potion|delve|talk",
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
- 玩家把技能用在某個東西上、或把幾個技能疊在一起用，就是 combo；obj 是用在誰身上（地點、物品、眼前的敵人）。
- 動詞對應手法：鋪開、籠罩→覆蓋；扔、射、甩出去→丟出去；包、圍、裹→包住；附在武器上→灌進武器；嚇、吼、威脅→嚇；感覺、探查、聽、看→感受；聚在一點、加熱、點燃→集中；壓、擠、榨→壓縮；加速、強化身體、疊起來衝→催動。
- 喝藥、吃藥水＝potion（item 填藥名）；突襲敵對據點、深入地城或迷宮＝delve。
- 找吃的、撿東西＝gather；四處走走找新地方＝explore；找獵物＝hunt；遭遇中打＝fight，逃＝retreat；做石刀、草棚、火種、水袋等＝craft；進岩穴住下＝shelter；換地方＝move；養傷、坐著休息＝rest；睡到明天＝sleep；只是聊天或想事情＝talk。
- 名稱一律照清單原字，不要自創技能、物品、地點。清單裡沒有的就不要填。`;
async function aiParse(text){
  const msgs=[{role:"system",content:PARSE_SYS},{role:"user",content:`【現況】\n${aiContext()}\n\n【玩家】${text}`}];
  const res=await callModel(msgs,1500,r=>{const o=parseObjs(r.txt).find(x=>x&&x.act);if(!o)throw new Error("沒有照格式回 JSON");return o});
  return normIntent(res.val);
}
/* 把 AI 的回答收斂成程式認得的東西 */
function normIntent(j){
  const near=(name,list)=>{if(!name)return null;return list.find(x=>x===name)||list.find(x=>name.includes(x)||x.includes(name))||null};
  const acts=["gather","explore","hunt","fight","retreat","craft","combo","shelter","rest","move","sleep","potion","delve","talk"];
  const it={act:acts.includes(j.act)?j.act:"talk",say:String(j.say||"")};
  it.skills=uniq((j.skills||[]).map(n=>near(String(n),S.skills.concat(itemSkills()).map(s=>s.n))).filter(Boolean)).slice(0,3);
  it.potion=near(j.item||(j.obj&&j.obj.n),S.items.filter(i=>i.k==="potion").map(i=>i.n))||"";
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
/* v5.1：遭遇中，大賢者把玩家的話拆成步驟（標籤式組合）。程式再看標籤判定，AI 不判成敗 */
const STEP_SYS=`你是文字冒險遊戲「孤獨異世界」裡的大賢者：把玩家這一句話「解析、拆解」成結構化的步驟，交給程式判定。你不判成敗、不給東西、不改數字、不寫故事。
只輸出 JSON：
{"act":"fight|retreat|potion|talk","steps":[{"src":"來源名字","prim":"原語","kind":"控制的種類","tags":["這一步用到的標籤"],"to":"對象","say":"一句繁體中文，照玩家的描述寫這一步"}],"say":"用一句繁體中文重述玩家要做的事","costs":["玩家說願意付的代價：hp|mp|time|item"],"potion":"藥名（喝藥時）"}
規則：
- act：要打、要用技能或東西對付眼前的敵人＝fight；逃走＝retreat；喝藥＝potion；只是說話或想事情＝talk。
- src 只能是【可用的東西】清單裡的名字（徒手、撿石頭打寫「自己」；利用地形寫「周圍」）。玩家說了幾樣就拆幾步，同一個來源可以出現在好幾步，不要替玩家加他沒提到的東西。別名要對回原名。
- prim 只能是：傷害、控制、防護、位移、破綻、隱匿、環境、附加、增幅。
  · 控制時 kind 填：${Object.keys(ART_CTRL).join("、")} 之一。
  · 附加：把這個來源的標籤加到另一個東西上（例：用火把刀刃燒紅 → prim 附加，tags ["火"]，to "刀的名字"）。之後那個東西就帶著這些標籤。
  · 增幅：讓前面某一步更強（例：用風加速火焰），to 寫那一步的編號（從 1 開始）。
  · 躲、藏、偷偷接近＝隱匿；看穿、找弱點＝破綻；擋、護住自己＝防護；把地面變成泥、點燃草叢＝環境。
- tags 只能從這個來源自己的標籤裡挑（附加過的也可以），而且要挑這一步需要的：
  傷害＝${ART_PRIM.傷害.join("、")}；防護＝${ART_PRIM.防護.join("、")}；位移＝${ART_PRIM.位移.join("、")}；破綻＝${ART_PRIM.破綻.join("、")}；隱匿＝${ART_PRIM.隱匿.join("、")}；環境＝${ART_PRIM.環境.join("、")}；
  控制：${Object.entries(ART_CTRL).map(([k,v])=>k+"＝"+v.join("、")).join("；")}。
- 標籤只有遊戲這 15 個：${ART_TAGS.join("、")}。黏、粉末、沙、泥＝土；酸、冰、霧＝水；毒、影＝暗；熱、炎＝火；雷＝風。撒沙、撒粉弄瞎＝控制・致盲（土）；酸蝕、腐蝕＝傷害（水）。
- 觸發詞（意思相近都算）：組合、結合、融合、混合、注入、裹上、點燃、加速、實驗、試試＝附加或增幅；抓住、按住、綁、困住、拖住、絆倒、弄瞎、悶住、嚇退、毒倒＝控制。`;
async function aiSteps(text){
  const ctx=`【現況】\n${aiContext()}\n\n【可用的東西】（名字｜種類｜標籤｜本來用法）\n${artListText()}\n\n【眼前的敵人】${S.enc?`${S.enc.n}（${S.enc.lv} 級）${foeTags().length?"，標籤："+foeTags().map(t=>`${t}（${ART_FOE[t]||""}）`).join("、"):""}`:"無"}`;
  const msgs=[{role:"system",content:STEP_SYS},{role:"user",content:`${ctx}\n\n【玩家】${text}`}];
  const res=await callModel(msgs,1500,r=>{const o=parseObjs(r.txt).find(x=>x&&(x.act||x.steps));if(!o)throw new Error("沒有照格式回 JSON");return o});
  const j=res.val,arr=x=>Array.isArray(x)?x:[];
  const names=artSources().map(x=>x.n);
  const steps=arr(j.steps).filter(x=>x&&typeof x==="object").slice(0,10).map(x=>normStep({src:String(x.src||"").replace(/[×x*]\s*\d+$/,""),prim:String(x.prim||""),kind:String(x.kind||""),
    tags:arr(x.tags).map(String),to:String(x.to||""),say:String(x.say||"").slice(0,60)})).map(x=>Object.assign(x,{tags:x.tags.filter(t=>ART_TAGS.includes(t))}))
    .map(x=>Object.assign(x,{src:names.find(n=>n===x.src)||names.find(n=>x.src&&(n.includes(x.src)||x.src.includes(n)))||x.src}))
    .filter(x=>ART_PRIMS.includes(x.prim));
  const acts=["fight","retreat","potion","talk"];
  return {act:acts.includes(j.act)?j.act:(steps.length?"fight":"talk"),steps,say:String(j.say||""),
    costs:arr(j.costs).filter(c=>["hp","mp","time","item"].includes(c)),potion:String(j.potion||"")};
}
const NARR_SYS=`你是「孤獨異世界」的旁白。主角是一個人被丟到異世界的轉生者，沒有同伴，四周都是荒野。
用繁體中文寫 2～4 句，描述剛剛發生的事。只能描述【結果】裡寫到的東西：不要加任何新的物品、數字、人物、同伴、技能；不要替玩家決定下一步；不要寫選項。語氣冷靜、有生存感。`;
async function aiNarrate(said,result,prev){
  const msgs=[{role:"system",content:NARR_SYS+'\n上一段旁白已經寫過的事不要再寫一次，只寫【結果】裡新發生的。\n只輸出 JSON：{"story":"故事內容"}'},{role:"user",content:`${prev?`【上一段旁白（已經寫過，不要重複）】${prev}\n`:""}【玩家說】${said||"（用按鈕行動）"}\n【結果】${result}`}];
  const res=await callModel(msgs,800,r=>{const o=parseObjs(r.txt).find(x=>x&&x.story);if(o)return String(o.story);if(/[\u4e00-\u9fff]/.test(r.txt)&&!r.txt.includes("{"))return r.txt;throw new Error("沒有故事")});
  return res.val;
}

/* v5.16：鍛冶台特定打造。大賢者把「想做的東西」拆成 底子＋標籤＋用途；程式再檢查（forgeCheck） */
async function aiForge(text){
  const sys=`你是「孤獨異世界」的大賢者。玩家想在鍛冶台打造一件魔法裝備，把它拆成結構，交給程式檢查。你不判成敗、不給東西。
只輸出 JSON：{"base":"底子","prim":"用途","kind":"控制的種類（不是控制就空字串）","tags":["標籤"],"why":"一句繁體中文，這件東西怎麼做到"}
- base 只能是：${WHITE_BASES.join("、")}（劍、刀、匕首＝石刀；斧、錘＝石斧；矛、槍＝石矛；弓＝短弓；盾＝木盾；帽、盔＝皮帽；甲、衣、斗篷＝皮甲；鞋、靴＝草鞋；項鍊＝骨項鍊；戒指＝魔核戒指）。
- prim 只能是：隱匿、破綻、位移、防護、傷害、環境、控制。控制時 kind 填：${Object.keys(ART_CTRL).join("、")} 之一。
- tags 只能從這 15 個挑 1～2 個：${ART_TAGS.join("、")}。要挑做得到那個用途的：${Object.entries(ART_PRIM).filter(([k])=>!["附加","增幅"].includes(k)).map(([k,v])=>k+"＝"+v.join("、")).join("；")}；控制：${Object.entries(ART_CTRL).map(([k,v])=>k+"＝"+v.join("、")).join("；")}。`;
  const res=await callModel([{role:"system",content:sys},{role:"user",content:`【玩家想做】${text}`}],600,r=>{const o=parseObjs(r.txt).find(x=>x&&x.prim);if(!o)throw new Error("沒有照格式回 JSON");return o});
  const j=res.val,arr=x=>Array.isArray(x)?x:[];
  return {n:String(text).trim().slice(0,12),base:WHITE_BASES.includes(j.base)?j.base:null,use:{p:String(j.prim||""),k:String(j.kind||""),tags:uniq(arr(j.tags).map(String).map(normTag)).filter(t=>ART_TAGS.includes(t)).slice(0,2)},x:null,why:String(j.why||"").slice(0,60)};
}
