import {env} from 'cloudflare:workers';
import catalog from '../../../../../src/data/replay-catalog.json';
import {createArchiveStore} from '../../../../../server/archive.js';
export async function GET(request,{params}){
 const {id,chunk}=await params,index=Number(chunk);if(!/^20\d{2}-\d{1,2}-(R|Q)$/.test(id)||!/^\d{1,3}$/.test(chunk)||!Number.isInteger(index)||index>500)return Response.json({error:'Invalid replay chunk.'},{status:400});
 if(new URL(request.url).searchParams.get('local')==='1'){
  const entry=catalog.sessions.find(s=>s.id===id);return entry?.chunks.includes(index)?Response.redirect(new URL(`/replays/${id}/${index}.json`,request.url),302):Response.json({error:'Replay chunk unavailable.'},{status:404});
 }
 try{const data=await createArchiveStore(env).replayChunk(id,index);return data?Response.json(data,{headers:{'Cache-Control':'private, max-age=3600'}}):Response.json({error:'Replay chunk unavailable.'},{status:404});}
 catch{return Response.json({error:'Telemetry archive is temporarily unavailable.'},{status:503});}
}
