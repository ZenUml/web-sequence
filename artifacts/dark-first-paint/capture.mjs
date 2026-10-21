import fs from 'node:fs/promises';
export async function capture(p, directory, label, {latency=150,throughput=500000}={}) {
 const source = `window.__paintStates=[];let last='';function take(){const d=document.querySelector('iframe')?.contentDocument;const s={t:Math.round(performance.now()),appearance:document.documentElement.dataset.appearance||null,html:getComputedStyle(document.documentElement).backgroundColor,body:document.body?getComputedStyle(document.body).backgroundColor:null,shell:document.querySelector('.editor-hifi-shell')?getComputedStyle(document.querySelector('.editor-hifi-shell')).backgroundColor:null,frame:d?.body?d.defaultView.getComputedStyle(d.body).backgroundColor:null,canvas:d?.querySelector('.bg-skin-canvas')?d.defaultView.getComputedStyle(d.querySelector('.bg-skin-canvas')).backgroundColor:null};const key=JSON.stringify({...s,t:0});if(key!==last){window.__paintStates.push(s);last=key;}if(performance.now()<25000)requestAnimationFrame(take)}requestAnimationFrame(take);`;
 await p.cdp('Page.addScriptToEvaluateOnNewDocument',{source});
 await p.cdp('Network.setCacheDisabled',{cacheDisabled:true});
 await p.cdp('Network.emulateNetworkConditions',{offline:false,latency,downloadThroughput:throughput,uploadThroughput:throughput});
 await p.events();
 await p.cdp('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.screenshot',transferMode:'ReturnAsStream'});
 await p.reload();
 await p.waitForFunction(()=>!!document.querySelector('iframe')?.contentDocument.querySelector('.sequence-diagram'),undefined,{timeout:30000});
 await p.waitForFunction(()=>{let d=document.querySelector('iframe')?.contentDocument;return document.documentElement.dataset.appearance==='dark'?!!d?.querySelector('.theme-dark'):!!d?.querySelector('.theme-default')},undefined,{timeout:30000});
 const timeline=await p.evaluate(()=>({states:window.__paintStates,paint:performance.getEntriesByType('paint').map(p=>({name:p.name,t:p.startTime})),origin:performance.timeOrigin}));
 await p.cdp('Tracing.end');
 let stream;
 for(let i=0;i<50&&!stream;i++){stream=(await p.events()).find(e=>e.method==='Tracing.tracingComplete')?.params?.stream;if(!stream)await new Promise(r=>setTimeout(r,100));}
 if(!stream)throw new Error('No trace stream');
 let trace='';while(true){const c=await p.cdp('IO.read',{handle:stream});trace+=c.base64Encoded?Buffer.from(c.data,'base64').toString():c.data;if(c.eof)break;}
 await p.cdp('IO.close',{handle:stream});
 await fs.mkdir(directory,{recursive:true});
 const events=JSON.parse(trace).traceEvents;
 const shots=events.filter(e=>e.name==='Screenshot'&&e.args?.snapshot);
 for(let i=0;i<shots.length;i++)await fs.writeFile(`${directory}/${label}-${String(i).padStart(2,'0')}.jpg`,Buffer.from(shots[i].args.snapshot,'base64'));
 timeline.screenshots=shots.map((s,i)=>({file:`${label}-${String(i).padStart(2,'0')}.jpg`,traceTime:s.ts}));
 await fs.writeFile(`${directory}/${label}-timeline.json`,JSON.stringify(timeline,null,2));
 console.log({label,...timeline});
}
