const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:9336/devtools/page/EA4CCA91B3E338B4EA4F8942369F9500');
let id=0; const pending=new Map();
const send=(m,p)=>new Promise((res,rej)=>{const mid=++id;pending.set(mid,{res,rej});ws.send(JSON.stringify({id:mid,method:m,params:p||{}}));});
ws.on('message',d=>{const m=JSON.parse(d.toString());if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.rej(m.error):p.res(m.result);}});
ws.on('open',async()=>{
  const ev=(code)=>send('Runtime.evaluate',{expression:code,awaitPromise:true,returnByValue:true}).then(r=>r.result?r.result.value:undefined);
  try{
    const pp=await ev('window.api.getProviderPresets().then(a=>a.map(x=>x.name).join(" | "))');
    console.log('PRESETS:',pp);
    const ss=await ev('window.api.loadSettings().then(x=>"provCount:"+x.providers.length+" activeProv:"+x.activeProviderId+" activeModel:"+x.activeModel+" effort:"+x.activeReasoningEffort)');
    console.log('SETTINGS:',ss);
    console.log('ALL PASS');
  }catch(e){console.error('ERR',e.message)}finally{ws.close();process.exit(0);}
});
setTimeout(()=>process.exit(1),12000);
