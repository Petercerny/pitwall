"""Resumable FastF1 archive. Downloads locally unless --publish is explicit."""
from pathlib import Path
import argparse, datetime as dt, hashlib, json, os, sys, time, urllib.request, urllib.error
ROOT = Path(__file__).resolve().parents[1]
if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'): sys.stderr.reconfigure(encoding='utf-8')
sys.path.insert(0, str(ROOT / '.import-deps'))
KINDS = {'Race':'R','Sprint':'S','Qualifying':'Q','Sprint Qualifying':'SQ','Sprint Shootout':'SQ'}

def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp=path.with_suffix('.tmp'); tmp.write_text(json.dumps(data,ensure_ascii=False,allow_nan=False,separators=(',',':')),encoding='utf-8'); tmp.replace(path)

def load_env():
    for name in ['.env.local','.env']:
        path=ROOT/name
        if path.exists():
            for line in path.read_text(encoding='utf-8-sig').splitlines():
                if '=' in line and not line.lstrip().startswith('#'):
                    k,v=line.split('=',1);os.environ.setdefault(k.strip(),v.strip().strip('"').strip("'"))

def api(path,method='GET',body=None,headers=None):
    url=os.environ['SUPABASE_URL'].rstrip('/')+path
    key=os.environ['SUPABASE_SECRET_KEY']
    req=urllib.request.Request(url,data=body,method=method,headers={'apikey':key,**(headers or {})})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req,timeout=60) as r:return r.read()
        except urllib.error.HTTPError as e:
            if e.code not in [429,500,502,503,504] or attempt==2:raise RuntimeError('Storage request failed: HTTP '+str(e.code)) from None
        except (urllib.error.URLError,TimeoutError):
            if attempt==2:raise RuntimeError('Storage request failed: connection unavailable') from None
        time.sleep(2**attempt)

def publish(entry,path):
    data=path.read_bytes();digest=hashlib.sha256(data).hexdigest();object_path=f"{entry['id']}/{digest}.json"
    # Immutable content-addressed upload first; the previous database pointer stays usable on failure.
    api('/storage/v1/object/pitwall-archive/'+object_path,'POST',data,{'Content-Type':'application/json','x-upsert':'true'})
    payload=json.loads(data)
    row={**{k:v for k,v in entry.items() if k not in ['file','error','published']},'object_path':object_path,'checksum':digest,'size_bytes':len(data),'schema_version':payload['schemaVersion'],'imported_at':payload['importedAt'],'source':payload['source'],'results':payload['drivers']}
    api('/rest/v1/archive_sessions?on_conflict=id','POST',json.dumps(row).encode(),{'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'})

def publish_status(entry):
    row={k:v for k,v in entry.items() if k not in ['file','error','published']}
    api('/rest/v1/archive_sessions?on_conflict=id','POST',json.dumps(row).encode(),{'Content-Type':'application/json','Prefer':'resolution=ignore-duplicates'})

def main():
    import fastf1
    import pandas as pd
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--years',nargs='+',type=int,default=list(range(2023,dt.datetime.now(dt.timezone.utc).year+1)))
    parser.add_argument('--round',type=int)
    parser.add_argument('--types',nargs='+',choices=['R','S','Q','SQ'],default=['R','S','Q','SQ'])
    parser.add_argument('--publish',action='store_true');parser.add_argument('--refresh',action='store_true')
    parser.add_argument('--publish-only',action='store_true',help='Upload cached sessions without contacting FastF1')
    parser.add_argument('--limit',type=int);parser.add_argument('--index-only',action='store_true')
    args=parser.parse_args();load_env()
    if args.publish_only:args.publish=True
    if args.publish and not all(os.environ.get(k) for k in ['SUPABASE_URL','SUPABASE_SECRET_KEY']):parser.error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local before --publish')
    cache=ROOT/'.fastf1-cache';cache.mkdir(exist_ok=True);fastf1.Cache.enable_cache(str(cache))
    archive=ROOT/'archive';archive.mkdir(exist_ok=True);index_path=archive/'index.json'
    index=json.loads(index_path.read_text(encoding='utf-8')) if index_path.exists() else {}
    schedule_path=archive/'schedule-status.json'
    schedule_status=json.loads(schedule_path.read_text(encoding='utf-8')) if schedule_path.exists() else {}
    now=dt.datetime.now(dt.timezone.utc);processed=0
    def scalar(v):
        if pd.isna(v):return None
        if isinstance(v,(pd.Timedelta,dt.timedelta)):return round(v.total_seconds(),3)
        if isinstance(v,(pd.Timestamp,dt.datetime)):return v.isoformat()
        return v.item() if hasattr(v,'item') else v
    def rows(frame,cols):return [{c:scalar(row.get(c)) for c in cols} for _,row in frame.iterrows()]
    def report():
        write_json(index_path,index)
        entries=list(index.values());ready=[x for x in entries if x['status']=='available'];total=sum(x.get('size_bytes',0) for x in ready)
        lines=['# Archive coverage',f'Generated: {dt.datetime.now(dt.timezone.utc).isoformat()}',f'Available: {len(ready)} / {len(entries)} discovered sessions',f'Local snapshot size: {total:,} bytes',f'Cloud published: {sum(bool(x.get("published")) for x in entries)}','', '## Season discovery']
        lines += [f'- {y}: {schedule_status.get(str(y), "Not yet discovered; coverage incomplete")}' for y in args.years]
        lines += ['', 'Events absent from the provider schedule are not inferred to be cancelled. Availability refers to imported timing, not an official cancellation decision.', '', '| Session | Status | Detail |','|---|---|---|']
        lines += [f"| {x['id']} · {x['event_name']} · {x['session_name']} | {x['status']} | {x.get('detail') or x.get('error') or ''} |" for x in sorted(entries,key=lambda x:x['id'])]
        (archive/'coverage.md').write_text('\n'.join(lines),encoding='utf-8')
        write_json(schedule_path,schedule_status)
    if args.publish_only:
        for sid,entry in index.items():
            if entry['year'] not in args.years or entry['session_type'] not in args.types or (args.round is not None and entry['round']!=args.round):continue
            try:
                if entry['status']=='available':publish(entry,archive/'sessions'/f'{sid}.json')
                else:publish_status(entry)
                entry['published']=True;entry.pop('error',None)
                print('PUBLISHED '+sid,flush=True)
            except Exception as e:entry['error']=str(e);print('PUBLISH FAILED '+sid+': '+str(e),flush=True)
            report()
        return
    for year in args.years:
        if year<2023 or year>now.year:parser.error('Years must be between 2023 and the current year')
        try:
            schedule=fastf1.get_event_schedule(year,include_testing=False)
            schedule_status[str(year)]=f'Discovered {len(schedule)} events'
        except Exception as e:
            schedule_status[str(year)]='Schedule unavailable: '+type(e).__name__
            print(f'Schedule unavailable for {year}: {type(e).__name__}',flush=True);report();continue
        for _,event in schedule.iterrows():
            rnd=int(event.RoundNumber)
            if args.round is not None and rnd!=args.round:continue
            for slot in range(1,6):
                name=event.get(f'Session{slot}');kind=KINDS.get(name)
                if kind not in args.types:continue
                date=event.get(f'Session{slot}DateUtc')
                if pd.isna(date):date=event.get('EventDate')
                stamp=pd.Timestamp(date).tz_localize('UTC') if pd.Timestamp(date).tzinfo is None else pd.Timestamp(date)
                sid=f'{year}-{rnd}-{kind}';old=index.get(sid,{})
                entry={'id':sid,'year':year,'round':rnd,'event_name':str(event.EventName),'location':str(event.Location),'country':str(event.Country),'session_type':kind,'session_name':str(name),'session_date':stamp.isoformat(),'status':'scheduled' if stamp.to_pydatetime()>now else 'unavailable'}
                path=archive/'sessions'/f'{sid}.json'
                if old.get('status')=='available' and path.exists() and not args.refresh:
                    entry=old
                    if args.publish:
                        try:publish(entry,path);entry['published']=True;entry.pop('error',None)
                        except Exception as e:entry['error']=str(e)
                    index[sid]=entry;report();continue
                if entry['status']=='scheduled' or args.index_only or (args.limit is not None and processed>=args.limit):
                    entry['detail']='Session not yet imported' if entry['status']=='unavailable' else 'Scheduled session; no completed data'
                    index[sid]=old or entry
                    if args.publish:
                        try:publish_status(index[sid])
                        except Exception:print('Could not publish availability for '+sid,flush=True)
                    report();continue
                processed+=1
                print('IMPORT '+sid+' '+entry['event_name']+' '+name,flush=True)
                try:
                    session=fastf1.get_session(year,rnd,name);session.load(telemetry=False,weather=True,messages=True)
                    if session.results.empty or session.laps.empty:raise ValueError('No usable results or lap timing')
                    lapframe=session.laps.copy();lapframe['QualifyingStage']=None
                    if kind in ['Q','SQ']:
                        for stage,part in enumerate(session.laps.split_qualifying_sessions(),1):
                            if part is not None:lapframe.loc[part.index,'QualifyingStage']=stage
                    out={'schemaVersion':2,'importedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'session':{'id':sid,'type':kind,'name':name},'source':{'name':'FastF1','version':fastf1.__version__,'url':'https://github.com/theOehrly/Fast-F1','timingPath':session.api_path},'event':{'year':year,'round':rnd,'name':entry['event_name'],'date':stamp.isoformat(),'location':entry['location'],'country':entry['country'],'laps':int(session.total_laps or lapframe.LapNumber.max()),'startTime':scalar(session.session_start_time)},'drivers':rows(session.results,['Abbreviation','DriverNumber','FullName','TeamName','TeamColor','GridPosition','Position','ClassifiedPosition','Status','Time','Q1','Q2','Q3']),'laps':rows(lapframe,['Driver','LapNumber','LapTime','Time','LapStartTime','PitInTime','PitOutTime','Stint','Compound','TyreLife','FreshTyre','TrackStatus','Position','IsAccurate','Deleted','FastF1Generated','QualifyingStage']),'weather':rows(session.weather_data,['Time','AirTemp','TrackTemp','Rainfall']),'trackStatus':rows(session.track_status,['Time','Status','Message']),'raceControl':rows(session.race_control_messages,list(session.race_control_messages.columns))}
                    assert len({d['Abbreviation'] for d in out['drivers']})==len(out['drivers'])
                    assert all(d['Abbreviation'] for d in out['drivers'])
                    assert any(l['LapTime'] and l['LapTime']>0 for l in out['laps'])
                    write_json(path,out);entry.update(status='available',file=str(path.relative_to(ROOT)),size_bytes=path.stat().st_size,imported_at=out['importedAt'])
                    if args.publish:publish(entry,path);entry['published']=True
                except Exception as e:
                    message=type(e).__name__+': '+str(e)[:180]
                    if old.get('status')=='available':entry={**old,'error':message}
                    elif path.exists():entry.update(status='available',file=str(path.relative_to(ROOT)),size_bytes=path.stat().st_size,error=message)
                    else:entry.update(detail='Import unavailable: '+message)
                    print('UNAVAILABLE '+sid+' '+message,flush=True)
                index[sid]=entry;report()
                if args.publish and entry['status']!='available':
                    try:api('/rest/v1/archive_sessions?on_conflict=id','POST',json.dumps({k:v for k,v in entry.items() if k not in ['file','error','published']}).encode(),{'Content-Type':'application/json','Prefer':'resolution=ignore-duplicates'})
                    except Exception:print('Could not publish availability record for '+sid,flush=True)
    report();print('Coverage: '+str(archive/'coverage.md'),flush=True)

if __name__=='__main__':main()

