"""Import local Monza replay data. Cloud writes require --publish explicitly."""
from pathlib import Path
import sys, json, datetime as dt, argparse, hashlib, math
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.import-deps'))
import fastf1
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree
from scipy.optimize import least_squares

def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(value,separators=(',',':'),allow_nan=False),encoding='utf-8');temp.replace(path)

def seconds(value):
    return None if pd.isna(value) else round(value.total_seconds(),3)

def calibrate(session):
    coords=np.array(json.loads((ROOT/'src/data/monza-circuit.json').read_text())['features'][0]['geometry']['coordinates'])
    lon=(coords[:,0].min()+coords[:,0].max())/2;lat=(coords[:,1].min()+coords[:,1].max())/2
    track=np.column_stack(((coords[:,0]-lon)*111320*math.cos(lat*math.pi/180)/10,-(coords[:,1]-lat)*111320/10))
    dense=[]
    for a,b in zip(track[:-1],track[1:]):
        for t in np.linspace(0,1,max(2,int(np.linalg.norm(b-a)/.15)),endpoint=False):dense.append(a+(b-a)*t)
    tree=cKDTree(dense);raw=[]
    # Several drivers prevent one racing line from determining the map fit.
    for driver in session.drivers[:5]:
        lap=session.laps.pick_drivers(driver).pick_fastest()
        if lap is None:continue
        pos=lap.get_pos_data();raw.extend(pos.loc[pos.Status=='OnTrack',['X','Y']].to_numpy()[::3]/100)
    raw=np.asarray(raw);target_center=(track.min(axis=0)+track.max(axis=0))/2
    if len(raw)<100:raise ValueError('Insufficient calibration positions')
    best=None
    for mirror in [-1,1]:
        source=raw.copy();source[:,1]*=mirror
        center=(source.min(axis=0)+source.max(axis=0))/2
        def transform(p):
            theta,scale,tx,tz=p;c,s=math.cos(theta),math.sin(theta)
            return source@np.array([[c,s],[-s,c]])*scale+np.array([tx,tz])
        def residual(p):return tree.query(transform(p))[0]
        for theta in np.arange(-math.pi,math.pi,math.pi/12):
            c,s=math.cos(theta),math.sin(theta);shift=target_center-center@np.array([[c,s],[-s,c]])
            result=least_squares(residual,[theta,1,*shift],bounds=([-10,.92,-1000,-1000],[10,1.08,1000,1000]),loss='soft_l1',f_scale=.7,max_nfev=120)
            error=np.median(residual(result.x))
            if best is None or error<best[0]:best=(error,mirror,result.x,residual(result.x))
    _,mirror,p,errors=best;theta,scale,tx,tz=p
    median=float(np.median(errors)*10);p95=float(np.quantile(errors,.95)*10)
    if median>10 or p95>25:raise ValueError(f'Calibration rejected: median {median:.1f}m / p95 {p95:.1f}m')
    # Resolve the reflected fit with the known direction through the start straight.
    def apply(x,y):
        x=x/100;y=y/100*mirror;c,s=math.cos(theta),math.sin(theta)
        return [(x*c-y*s)*scale+tx,(x*s+y*c)*scale+tz]
    for driver in session.drivers:
        lap=session.laps.pick_drivers(driver).pick_fastest()
        if lap is None:continue
        pos=lap.get_pos_data()
        if len(pos)>8:
            a=np.array(apply(pos.iloc[0].X,pos.iloc[0].Y));b=np.array(apply(pos.iloc[7].X,pos.iloc[7].Y))
            i=int(np.argmin(np.linalg.norm(track-a,axis=1)));i=min(i,len(track)-2)
            if np.dot(b-a,track[i+1]-track[i])<=0:raise ValueError('Calibration direction disagrees with circuit')
            break
    return apply,{'rotationRadians':float(theta),'scale':float(scale),'mirror':mirror,'translation':[float(tx),float(tz)],'rawUnits':'decimetres','sceneUnits':'metres / 10','medianErrorMetres':round(median,2),'p95ErrorMetres':round(p95,2),'referenceDrivers':session.drivers[:5]}

def import_session(year,kind,refresh=False):
    session=fastf1.get_session(year,'Monza',kind);session.load(telemetry=True,weather=True,messages=True)
    sid=f'{year}-{int(session.event.RoundNumber)}-{kind}';out=ROOT/'public/replays'/sid
    if (out/'manifest.json').exists() and not refresh:
        print('CACHED '+sid,flush=True);return sid
    apply,calibration=calibrate(session);print('CALIBRATED '+sid+' '+str(calibration),flush=True)
    laps=session.laps.copy();laps['QualifyingStage']=None
    if kind=='Q':
        for stage,part in enumerate(session.laps.split_qualifying_sessions(),1):
            if part is not None:laps.loc[part.index,'QualifyingStage']=stage
    lap_meta=[];drivers=[];chunks={};start=seconds(session.session_start_time)
    finish=max(seconds(v) or 0 for v in laps.Time)
    for _,driver in session.results.iterrows():
        number=str(driver.DriverNumber);code=driver.Abbreviation
        drivers.append({'id':code,'number':number,'name':driver.FullName,'team':driver.TeamName,'color':'#'+str(driver.TeamColor),'finish':None if pd.isna(driver.Position) else int(driver.Position),'status':str(driver.Status),'classification':str(driver.ClassifiedPosition)})
        dlaps=laps[laps.Driver==code].sort_values('LapNumber');pos=session.pos_data.get(number);car=session.car_data.get(number)
        if pos is None or car is None:continue
        car_times=car.SessionTime.dt.total_seconds().to_numpy();speeds=car.Speed.to_numpy()
        # Native positions, with one boundary neighbour per chunk for interpolation.
        samples=[]
        for _,row in pos.iterrows():
            t=seconds(row.SessionTime)
            if t is None or t<start-1 or t>finish+1 or not np.isfinite(row.X) or not np.isfinite(row.Y):continue
            x,z=apply(row.X,row.Y);j=np.searchsorted(car_times,t)
            speed=None
            if 0<j<len(car_times) and car_times[j]-car_times[j-1]<=1:
                speed=round(float(np.interp(t,car_times[j-1:j+1],speeds[j-1:j+1])),1)
            samples.append([t,round(x,4),round(z,4),speed,1 if row.Status=='OnTrack' else 0])
        times=np.array([s[0] for s in samples])
        for _,lap in dlaps.iterrows():
            begin=seconds(lap.LapStartTime);end=seconds(lap.Time);duration=seconds(lap.LapTime)
            if begin is None or end is None:continue
            portion=times[(times>=begin)&(times<=end)]
            complete=len(portion)>10 and portion[0]-begin<=1 and end-portion[-1]<=1 and np.max(np.diff(portion))<=1
            valid=bool(duration and duration>0 and lap.IsAccurate==True and lap.Deleted!=True and lap.FastF1Generated!=True and pd.isna(lap.PitInTime) and pd.isna(lap.PitOutTime))
            lap_meta.append({'driverId':code,'number':int(lap.LapNumber),'start':begin,'end':end,'duration':duration,'valid':valid,'generated':bool(lap.FastF1Generated==True),'accurate':bool(lap.IsAccurate==True),'deleted':bool(lap.Deleted==True),'replayable':bool(complete),'stage':None if pd.isna(lap.QualifyingStage) else int(lap.QualifyingStage),'compound':str(lap.Compound),'position':None if pd.isna(lap.Position) else int(lap.Position),'pitIn':seconds(lap.PitInTime),'pitOut':seconds(lap.PitOutTime)})
        for sample in samples:
            index=max(0,int((sample[0]-start)//60));chunks.setdefault(index,{}).setdefault(code,[]).append(sample)
    # Include adjacent samples so playback does not blink at chunk boundaries.
    for index,tracks in list(chunks.items()):
        for code,values in tracks.items():
            previous=chunks.get(index-1,{}).get(code,[]);following=chunks.get(index+1,{}).get(code,[])
            if previous:values.insert(0,next((v for v in reversed(previous) if v[0]<values[0][0]),previous[-1]))
            if following:values.append(next((v for v in following if v[0]>values[-1][0]),following[0]))
    index_entries=[]
    for index,tracks in sorted(chunks.items()):
        file=f'{index}.json';payload={'index':index,'drivers':tracks};write(out/file,payload)
        checksum=hashlib.sha256((out/file).read_bytes()).hexdigest()
        index_entries.append({'index':index,'start':start+index*60,'end':min(finish,start+(index+1)*60),'file':file,'checksum':checksum})
    statuses=[{'time':seconds(r.Time),'status':str(r.Status),'message':str(r.Message)} for _,r in session.track_status.iterrows()]
    manifest={'schemaVersion':1,'sessionId':sid,'year':year,'type':kind,'start':start,'end':finish,'chunkSeconds':60,'importedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'source':{'name':'FastF1','version':fastf1.__version__,'url':'https://github.com/theOehrly/Fast-F1','timingPath':session.api_path},'calibration':calibration,'drivers':drivers,'laps':lap_meta,'trackStatus':statuses,'chunks':index_entries}
    write(out/'manifest.json',manifest)
    print(f'IMPORTED {sid}: {len(lap_meta)} laps, {len(chunks)} chunks, {sum(l["replayable"] for l in lap_meta)} replayable',flush=True)
    return sid

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--year',type=int,default=2024);parser.add_argument('--types',nargs='+',choices=['R','Q'],default=['R','Q']);parser.add_argument('--refresh',action='store_true');parser.add_argument('--publish',action='store_true');args=parser.parse_args()
    fastf1.Cache.enable_cache(str(ROOT/'.fastf1-cache'))
    ids=[import_session(args.year,kind,args.refresh) for kind in args.types]
    entries=[]
    for path in (ROOT/'public/replays').glob('*/manifest.json'):
        m=json.loads(path.read_text());entries.append({'id':m['sessionId'],'year':m['year'],'type':m['type'],'importedAt':m['importedAt'],'chunks':[c['index'] for c in m['chunks']]})
    catalog={'sessions':sorted(entries,key=lambda s:(-s['year'],s['type']))}
    write(ROOT/'public/replays/index.json',catalog)
    write(ROOT/'src/data/replay-catalog.json',catalog)
    if args.publish:
        from importlib import import_module
        archive=import_module('import-archive');archive.load_env()
        for sid in ids:
            out=ROOT/'public/replays'/sid;m=json.loads((out/'manifest.json').read_text())
            for chunk in m['chunks']:
                data=(out/chunk['file']).read_bytes();key=f'{sid}/replay/{chunk["checksum"]}.json';archive.api('/storage/v1/object/pitwall-archive/'+key,'POST',data,{'Content-Type':'application/json','x-upsert':'true'});chunk['objectPath']=key
            data=json.dumps(m,separators=(',',':')).encode();digest=hashlib.sha256(data).hexdigest();key=f'{sid}/replay/{digest}.json'
            archive.api('/storage/v1/object/pitwall-archive/'+key,'POST',data,{'Content-Type':'application/json','x-upsert':'true'})
            archive.api('/rest/v1/archive_sessions?id=eq.'+sid,'PATCH',json.dumps({'replay_object_path':key}).encode(),{'Content-Type':'application/json'})
            print('PUBLISHED '+sid,flush=True)

if __name__=='__main__':main()
