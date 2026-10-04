export const fallbackEntry={id:'2024-16-R',year:2024,round:16,event_name:'Italian Grand Prix',location:'Monza',country:'Italy',session_type:'R',session_name:'Race',session_date:'2024-09-01T13:00:00Z',status:'available',local:true};
export function createArchiveStore(env,fetcher=fetch){
 const url=env.SUPABASE_URL?.replace(/\/$/,'');const key=env.SUPABASE_SECRET_KEY;
 const configured=Boolean(url&&key);
 async function request(path){
  if(!configured)throw new Error('Archive storage is not configured');
  const r=await fetcher(url+path,{headers:{apikey:key},signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error('Archive storage is temporarily unavailable');
  return r.json();
 }
 return {configured,async index(){let rows=[],offset=0;do{const page=await request(`/rest/v1/archive_sessions?select=id,year,round,event_name,location,country,session_type,session_name,session_date,status,imported_at,detail&order=year.desc,round.desc,id&limit=1000&offset=${offset}`);rows.push(...page);if(page.length<1000)break;offset+=1000;}while(offset<10000);return rows;},async session(id){
  if(!/^20\d{2}-\d{1,2}-(R|S|Q|SQ)$/.test(id))return null;
  const rows=await request(`/rest/v1/archive_sessions?id=eq.${encodeURIComponent(id)}&select=status,object_path&limit=1`);
  const row=rows[0];if(row?.status!=='available'||!row.object_path)return null;
  return request('/storage/v1/object/pitwall-archive/'+row.object_path.split('/').map(encodeURIComponent).join('/'));
 }};
}

