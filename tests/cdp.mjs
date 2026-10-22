// Tiny dependency-free Chrome DevTools client. Run against a dedicated test browser only.
export async function browserSession() {
  const port=process.env.CDP_PORT||9222;
  const response=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'});
  if(!response.ok)throw Error(`CDP target creation failed: ${response.status}`);
  const target=await response.json(),ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  let id=0;const pending=new Map(),errors=[];
  ws.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(message.id){const p=pending.get(message.id);if(!p)return;pending.delete(message.id);clearTimeout(p.timer);message.error?p.reject(Error(JSON.stringify(message.error))):p.resolve(message.result);}
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const next=++id,timer=setTimeout(()=>{pending.delete(next);reject(Error(`CDP timeout: ${method}`));},15000);
    pending.set(next,{resolve,reject,timer});ws.send(JSON.stringify({id:next,method,params}));
  });
  const run=async expression=>{
    const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;
  };
  await send('Runtime.enable');await send('Page.enable');
  return {send,run,errors,close:async()=>{await send('Page.close');ws.close();}};
}
export const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
