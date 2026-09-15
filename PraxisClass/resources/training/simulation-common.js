'use strict';
const $ = id => document.getElementById(id);
const clone = value => JSON.parse(JSON.stringify(value));
const S = window.TrainingSimulation;
const node = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = String(text); if (className) el.className = className; return el; };
function fillList(id, lines) { $(id).replaceChildren(...lines.map(text => node('li', text))); }
function required(id) { const value = $(id).value.trim(); if (!value) throw Error('请填写“'+($(id).labels?.[0]?.textContent || id)+'”。'); return value; }
function integerInput(id, min, max) { const raw = $(id).value.trim(); if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw)<min || Number(raw)>max) throw Error('请输入 '+min+'–'+max+' 的整数，不自动舍入。'); return Number(raw); }
function attempt(action) { try { action(); $('action-status').textContent=''; } catch(error) { $('action-status').textContent=error.message; } }
function fieldValues(ids) { return Object.fromEntries(ids.map(id => [id,$(id).value])); }
function restoreFields(fields) { for (const [id,value] of Object.entries(fields || {})) if ($(id) && typeof value === 'string') $(id).value=value; }
let pageBridge;
function persist() { pageBridge?.persist(); }
function startTraining(config) {
  let connected=false, booted=false, role='teacher', frozen=null, saved=false, saving=false, timer, saveRequest, helpRequest;
  const send=(action,extra={},id=crypto.randomUUID())=>{window.parent.postMessage({type:'praxis:training',version:1,action,requestId:id,...extra},'*');return id;};
  const snapshot=()=>({...config.state(),bridge:{frozen,saved}});
  function sync() { $('work').disabled=!!frozen; $('save').disabled=!connected||role!=='student'||saving; $('save').textContent=saving?'正在保存…':frozen?'重试同一次保存':'保存本次成果'; $('revise').hidden=!saved; }
  pageBridge={
    persist(){if(!connected||role!=='student')return;clearTimeout(timer);timer=setTimeout(()=>send('draft',{state:snapshot()}),120);},
    flush(){if(connected&&role==='student')send('draft',{state:snapshot()});},
  };
  $('work').addEventListener('input',persist); $('work').addEventListener('change',persist);
  $('reconnect').onclick=()=>send('ready');
  $('back').onclick=()=>send('return',{state:snapshot()});
  $('save').onclick=()=>{try{frozen??={[config.part]:config.record()};saving=true;saveRequest=crypto.randomUUID();pageBridge.flush();send('save',{submittedContent:frozen},saveRequest);$('save-status').textContent='正在保存当前快照，请等待服务端回执。';sync();}catch(error){$('save-status').textContent=error.message;}};
  $('revise').onclick=()=>{frozen=null;saved=false;sync();persist();$('save-status').textContent='继续修改后保存会形成修订，原文和旧计算继续保留。';};
  $('help').onclick=()=>{const message=$('help-input').value.trim();if(!message)return;helpRequest=crypto.randomUUID();$('help').disabled=true;$('help-result').textContent='正在读取本次任务、资料和当前可见记录…';send('help',{message,state:config.state()},helpRequest);};
  window.addEventListener('message',({source,data})=>{
    if(source!==window.parent)return;
    if(data?.type==='praxis:training-request-ready'){send('ready');return;}
    if(data?.type!=='praxis:training-reply')return;
    if(data.action==='save'&&data.requestId!==saveRequest)return;
    if(data.action==='help'&&data.requestId!==helpRequest)return;
    if(!data.ok){if(data.action==='save'){saving=false;if(data.editable)frozen=null;$('save-status').textContent=data.message+(data.editable?' 请修正后保存。':' 可重试同一次保存。');sync();persist();}else if(data.action==='help'){$('help').disabled=false;$('help-result').textContent=data.message;}else if(data.action==='ready')$('binding').textContent=data.message;return;}
    if(data.action==='ready'){connected=true;role=data.role;if(data.replies?.length)$('help-result').textContent=data.replies.map(r=>r.content+'\n实际读取：'+r.sourceRefs.map(s=>s.sourceId+' · '+s.title).join('；')).join('\n\n——已保存的辅导——\n\n');if(data.historyUnavailable)$('help-result').textContent='以往辅导暂时未读到，可重连实训记录后回看。当前操作与成果可继续。';if(!booted&&data.state){config.restore(data.state);frozen=data.state.bridge?.frozen??null;saved=!!data.state.bridge?.saved;}booted=true;$('binding').textContent=(role==='student'?'本次作答':'教师预览')+' · 方案 '+data.revision;if(data.evidenceId)$('save-status').textContent='上次成果已保存：'+data.evidenceId;if(data.pending)$('save-status').textContent='上次保存尚未确认，请重试同一次保存。';sync();}
    else if(data.action==='save'){saving=false;saved=true;$('save-status').textContent='已保存到服务端 · 方案 '+data.planRevision+' · 成果编号：'+data.evidenceId;sync();persist();}
    else if(data.action==='help'){$('help').disabled=false;$('help-result').textContent=data.content+'\n实际读取：'+data.sources.map(s=>s.sourceId+' · '+s.title).join('；');if(!frozen){config.assisted?.();$('assistance').value=($('assistance').value+'\n本次已请求 Agent 辅导，参见本任务对话。').trim();persist();}}
  });
  sync();send('ready');
}
