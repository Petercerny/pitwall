import {env} from 'cloudflare:workers';
import catalog from '../../../src/data/replay-catalog.json';
import {createArchiveStore} from '../../../server/archive.js';
export async function GET(){
 const local=catalog.sessions.map(s=>({id:s.id,year:s.year,type:s.type,local:true})),store=createArchiveStore(env);let cloud=[];
 try{if(store.configured)cloud=(await store.replayIndex()).map(s=>({id:s.id,year:s.year,type:s.session_type,local:false}));}catch{/* Old archives without the optional migration keep local replay. */}
 return Response.json({sessions:[...local,...cloud.filter(s=>!local.some(l=>l.id===s.id))]},{headers:{'Cache-Control':'private, max-age=60'}});
}
