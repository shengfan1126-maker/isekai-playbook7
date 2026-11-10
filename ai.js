/* 魔物篇｜ai.js：呼叫模型：OpenRouter、Gemini、串流、換模型重試。
   所有 .js 共用同一個全域範圍，載入順序見 index.html；改之前先讀 README.md。 */
/* ═════════ 呼叫模型（沿用抽牌造怪的做法）═════════ */
const NOT_CHAT_EARLY=/lyria|music|audio|tts|speech|whisper|embed|image/i;
const DEFAULT_MODEL="";
key.value=ls.g("or_key")||"";
gkey.value=ls.g("gm_key")||"";
let PROV=ls.g("mowu_prov")||(ls.g("gm_key")&&ls.g("or_key")?"both":ls.g("gm_key")?"gemini":ls.g("or_key")?"or":"both");
model.value=(ls.g("or_model")||"").replace(/^anthropic\/claude-sonnet-4\.5$/,"");
let MODE=ls.g("mowu_mode")==="list"?"list":"auto";
if(ls.g("mowu_good")&&NOT_CHAT_EARLY.test(ls.g("mowu_good")))ls.d("mowu_good");
ls.d("mowu_free");
const modelList=()=>(ls.g("or_model")||model.value||"").split(/[\n,]/).map(s=>s.trim()).filter(Boolean);
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
      if(i<list.length-1)await sleep(250);
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
  const k=(ls.g("gm_key")||gkey.value).trim();
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
  const k=(ls.g("gm_key")||gkey.value).trim();
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
      await sleep(300);
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
/* 種族用詞統一：模型照中文 D&D 寫「地精」（goblin）就改成哥布林，「侏儒」（gnome）改成諾姆 */
const fixRaceWords=t=>String(t??"").replace(/地精/g,"哥布林").replace(/侏儒/g,"諾姆");
async function callModel(messages,maxTok,validate0,onDelta){
  const validate=r=>{r.txt=fixRaceWords(r.txt);return validate0(r)};
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
  const k=(ls.g("or_key")||key.value).trim();
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

