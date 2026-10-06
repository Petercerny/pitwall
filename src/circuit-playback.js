export function eligibleLaps(manifest,id,stage){return manifest.laps.filter(l=>l.driverId===id&&l.valid&&(manifest.type!=='Q'||l.stage===stage)).sort((a,b)=>a.number-b.number);}
export function bestLap(manifest,id,stage){return [...eligibleLaps(manifest,id,stage)].sort((a,b)=>a.duration-b.duration)[0]??null;}
export function defaultStage(manifest){return [3,2,1].find(stage=>manifest.laps.some(l=>l.stage===stage&&l.valid&&l.replayable))??1;}
export function defaultDrivers(manifest,stage){const candidates=manifest.drivers.filter(d=>bestLap(manifest,d.id,stage)?.replayable);return (manifest.type==='Q'?candidates.sort((a,b)=>bestLap(manifest,a.id,stage).duration-bestLap(manifest,b.id,stage).duration):candidates.sort((a,b)=>(a.finish??99)-(b.finish??99))).slice(0,3).map(d=>d.id);}
export function mergeSamples(chunks,id){const byTime=new Map();for(const chunk of chunks)for(const s of chunk.drivers[id]??[])byTime.set(s[0],s);return [...byTime.values()].sort((a,b)=>a[0]-b[0]);}
export function samplePosition(samples,time){
 if(!samples?.length||time<samples[0][0]||time>samples.at(-1)[0])return null;
 let lo=0,hi=samples.length-1;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(samples[mid][0]<time)lo=mid+1;else hi=mid;}
 let i=lo;if(samples[i][0]===time){const s=samples[i],a=samples[Math.max(0,i-1)],b=samples[Math.min(samples.length-1,i+1)];return {x:s[1],z:s[2],speed:s[3],angle:Math.atan2(b[1]-a[1],b[2]-a[2]),onTrack:!!s[4]};}
 const a=samples[i-1],b=samples[i];if(!a||b[0]-a[0]>1.00001)return null;const t=(time-a[0])/(b[0]-a[0]);
 return {x:a[1]+(b[1]-a[1])*t,z:a[2]+(b[2]-a[2])*t,speed:a[3]!==null&&b[3]!==null?a[3]+(b[3]-a[3])*t:null,angle:Math.atan2(b[1]-a[1],b[2]-a[2]),onTrack:!!a[4]&&!!b[4]};
}
export function lapSamples(samples,lap){const start=samplePosition(samples,lap.start),end=samplePosition(samples,lap.end);if(!start||!end)return [];const wrap=(p,t)=>[t,p.x,p.z,p.speed,p.onTrack?1:0];return [wrap(start,lap.start),...samples.filter(s=>s[0]>lap.start&&s[0]<lap.end),wrap(end,lap.end)];}
export function distanceSeries(samples){let distance=0;return samples.map((s,i)=>{if(i)distance+=Math.hypot(s[1]-samples[i-1][1],s[2]-samples[i-1][2]);return {time:s[0]-samples[0][0],distance};});}
export function timeAtDistance(series,fraction){if(!series.length)return null;const target=series.at(-1).distance*Math.max(0,Math.min(1,fraction));let i=1;while(i<series.length-1&&series[i].distance<target)i++;if(series.length===1)return 0;const a=series[i-1],b=series[i];return a.time+(b.time-a.time)*(target-a.distance)/(b.distance-a.distance||1);}
export function compareDeltas(tracks){const reference=tracks[0];if(!reference)return [];const ref=distanceSeries(reference.samples);return tracks.slice(1).map(track=>{const series=distanceSeries(track.samples);return {id:track.id,color:track.color,values:Array.from({length:101},(_,i)=>({distance:i,delta:timeAtDistance(series,i/100)-timeAtDistance(ref,i/100)}))};});}
export function raceState(manifest,id,time){
 const laps=manifest.laps.filter(l=>l.driverId===id).sort((a,b)=>a.end-b.end),driver=manifest.drivers.find(d=>d.id===id),last=laps.at(-1),crossed=[...laps].reverse().find(l=>l.end<=time&&!l.generated),current=laps.find(l=>time>=l.start&&time<l.end);
 if(last&&time>=last.end)return {state:driver?.classification==='R'?'Retired':'Finished',lap:last.number,position:crossed?.position??null};
 const pitIn=[...laps].reverse().find(l=>l.pitIn!==null&&l.pitIn<=time)?.pitIn,pitOut=[...laps].reverse().find(l=>l.pitOut!==null&&l.pitOut<=time)?.pitOut;
 return {state:pitIn!==undefined&&(pitOut===undefined||pitIn>pitOut)?'Pit lane':'Running',lap:current?.number??((crossed?.number??0)+1),position:crossed?.position??null};
}
export function trackStatusAt(manifest,time){return [...manifest.trackStatus].reverse().find(s=>s.time<=time)??null;}
export function chunkIndices(manifest,start,end){return manifest.chunks.filter(c=>c.end>=start&&c.start<=end).map(c=>c.index);}

export function createReplayCache(session,{fetcher=fetch,signal,maxEntries=10}={}){
 const cache=new Map(),pending=new Map();
 async function get(index){if(cache.has(index)){const value=cache.get(index);cache.delete(index);cache.set(index,value);return value;}if(pending.has(index))return pending.get(index);
  const promise=fetcher(`/api/replay/${session.id}/${index}${session.local?'?local=1':''}`,{signal}).then(async r=>{if(!r.ok)throw Error('Position data could not load. Retry playback.');const value=await r.json();if(signal?.aborted)throw new DOMException('Aborted','AbortError');cache.set(index,value);while(cache.size>maxEntries)cache.delete(cache.keys().next().value);return value;}).finally(()=>pending.delete(index));pending.set(index,promise);return promise;
 }
 return {get,clear(){cache.clear();},get size(){return cache.size;}};
}
