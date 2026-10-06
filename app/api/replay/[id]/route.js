import {env} from 'cloudflare:workers';
import catalog from '../../../../src/data/replay-catalog.json';
import {createArchiveStore} from '../../../../server/archive.js';
export async function GET(request,{params}){
 const {id}=await params;if(!/^20\d{2}-\d{1,2}-(R|Q)$/.test(id))return Response.json({error:'Invalid replay session.'},{status:400});
 if(new URL(request.url).searchParams.get('local')==='1'&&catalog.sessions.some(s=>s.id===id))return Response.redirect(new URL(`/replays/${id}/manifest.json`,request.url),302);
 try{const data=await createArchiveStore(env).replayManifest(id);return data?Response.json(data,{headers:{'Cache-Control':'private, max-age=300'}}):Response.json({error:'Telemetry has not been imported for this session.'},{status:404});}
 catch{return Response.json({error:'Telemetry archive is temporarily unavailable.'},{status:503});}
}
