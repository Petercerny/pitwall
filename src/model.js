export function buildModel(snapshot){
// Every chart and metric uses this immutable historical snapshot.
const colors={VER:'#648aff',NOR:'#ff9c42',LEC:'#f26372',PIA:'#f6cd87',SAI:'#ca8ba1',HAM:'#59d4bb',RUS:'#99e2d7',PER:'#a1b4f3',ALO:'#5ba88d',STR:'#acd1b5',TSU:'#98a2cc',HUL:'#ccd0d5',RIC:'#c4a9d6',GAS:'#db8bd2',ALB:'#61b6d8',OCO:'#ae85be',MAG:'#ada8a0',BOT:'#95ba67',ZHO:'#c1cf95',COL:'#9bc6e8'};
const compoundNames={S:'Soft',M:'Medium',H:'Hard',I:'Intermediate',W:'Wet',U:'Unknown'};
const recorded=snapshot.laps.filter(l=>!l.FastF1Generated&&Number.isFinite(l.Time));
const raceEnd=Math.max(0,...recorded.map(l=>l.Time));
const weather=snapshot.weather.filter(w=>w.Time>=snapshot.event.startTime&&w.Time<=raceEnd);
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const race={id:snapshot.session?.id??'2024-16-R',name:snapshot.event.name,circuit:snapshot.event.location??'Autodromo Nazionale di Monza',location:[snapshot.event.location,snapshot.event.country].filter(Boolean).join(', ')||'Monza, Italy',year:snapshot.event.year,round:snapshot.event.round,date:new Date(snapshot.event.date).toLocaleDateString('en-GB',{timeZone:'UTC'}),type:snapshot.session?.type??'R',sessionName:snapshot.session?.name??'Race',laps:snapshot.event.laps,air:mean(weather.map(w=>w.AirTemp)),track:mean(weather.map(w=>w.TrackTemp)),dry:weather.length?weather.every(w=>!w.Rainfall):null,importedAt:snapshot.importedAt,source:snapshot.source};
const drivers=snapshot.drivers.map(r=>{
 const records=recorded.filter(l=>l.Driver===r.Abbreviation).sort((a,b)=>a.LapNumber-b.LapNumber);
 const completed=records.at(-1)?.LapNumber??0;
 const groups=Object.groupBy(records,l=>l.Stint);
 const stints=Object.values(groups).map(ls=>({compound:['S','M','H','I','W'].includes(ls[0].Compound?.[0])?ls[0].Compound[0]:'U',start:ls[0].LapNumber,end:ls.at(-1).LapNumber,startingAge:ls[0].TyreLife,fresh:ls[0].FreshTyre}));
 // A pit entry without a later exit is a retirement, not a completed stop.
 const pits=records.filter(l=>l.PitInTime!==null&&records.some(n=>n.PitOutTime!==null&&n.PitOutTime>l.PitInTime)).map(l=>l.LapNumber);
 return {id:r.Abbreviation,name:r.FullName,team:r.TeamName,grid:Number.isFinite(r.GridPosition)&&r.GridPosition>0?r.GridPosition:null,color:colors[r.Abbreviation]??(r.TeamColor?'#'+r.TeamColor:'#bac1cc'),finish:r.Position,status:r.Status,retired:r.ClassifiedPosition==='R',classification:r.ClassifiedPosition,classifiedGap:r.Position===1?0:r.Status==='Finished'?r.Time:null,completed,stints,pits,records};
});
const results=[...drivers].sort((a,b)=>a.finish-b.finish);
const laps=Array.from({length:race.laps+1},(_,lap)=>{
 const rows=drivers.map(d=>({d,row:d.records.find(l=>l.LapNumber===lap)}));
 const times=rows.filter(x=>x.row).map(x=>x.row.Time);const leaderTime=times.length?Math.min(...times):null;
 return {lap,positions:Object.fromEntries(rows.map(({d,row})=>[d.id,row?.Position??null])),...Object.fromEntries(rows.map(({d,row})=>[d.id,row?+Math.max(0,row.Time-leaderTime).toFixed(3):null]))};
});
const safetyPeriods=snapshot.trackStatus.flatMap((s,i)=>{
 if(!['4','6','7'].includes(s.Status))return [];
 const lapAt=t=>results[0]?.records.find(l=>l.Time>=t)?.LapNumber??race.laps;
 return [{start:lapAt(s.Time),end:lapAt(snapshot.trackStatus[i+1]?.Time??raceEnd),label:s.Status==='4'?'SC':'VSC'}];
});
function cleanLaps(d){return d.records.filter(l=>l.LapNumber>1&&Number.isFinite(l.LapTime)&&l.LapTime>0&&l.PitInTime===null&&l.PitOutTime===null&&l.TrackStatus==='1'&&l.IsAccurate===true&&!l.Deleted&&!l.FastF1Generated);}
function metric(d){const clean=cleanLaps(d);return {finish:d.finish,gained:Number.isFinite(d.grid)&&Number.isFinite(d.finish)?d.grid-d.finish:null,pace:mean(clean.map(l=>l.LapTime)),count:clean.length};}
const formatPace=n=>Number.isFinite(n)?Math.floor(n/60)+':'+(n%60).toFixed(3).padStart(6,'0'):'—';
function gapLabel(d,lap){const gap=laps[lap]?.[d.id];if(Number.isFinite(gap))return gap===0?'Leader':'+'+gap.toFixed(3)+'s';if(lap>d.completed)return d.retired?'Retired · '+d.completed+' laps':'Finished · +'+(race.laps-d.completed)+' lap';return 'No timing data';}
function finishLabel(d){return d.retired?'DNF':['D','E','W','F','N'].includes(d.classification)?d.status:Number.isFinite(d.finish)?'P'+d.finish:'—';}
const byId=id=>drivers.find(d=>d.id===id);
let moments=[],insights=[];
if(race.id==='2024-16-R'){
const lec=byId('LEC'),pia=byId('PIA'),nor=byId('NOR');
const firstWindow=[nor.pits[0],pia.pits[0]+1];
const takeover=lec.records.find(l=>l.LapNumber>pia.pits[1]&&l.Position===1).LapNumber;
const chaseGap=laps[takeover].PIA;
const lastStint=lec.stints.at(-1);
moments=[
 {title:'The first stops put Norris ahead of Leclerc',range:[firstWindow[0]-1,firstWindow[1]],ids:['NOR','LEC','PIA'],tag:'FIRST PIT WINDOW',text:'Norris pits on lap '+nor.pits[0]+', Leclerc on '+lec.pits[0]+'. Norris is behind Leclerc before the stops, but ahead by '+(laps[firstWindow[1]].LEC-laps[firstWindow[1]].NOR).toFixed(3)+'s at the end of lap '+firstWindow[1]+'.'},
 {title:'One stop puts Leclerc in control',range:[nor.pits[1],takeover],ids:['LEC','PIA','NOR','SAI'],tag:'STRATEGY SPLIT',text:'Norris stops again on lap '+nor.pits[1]+', Piastri on '+pia.pits[1]+'. Leclerc stays on his hard tyres and takes the lead on lap '+takeover+', with '+chaseGap.toFixed(3)+'s over Piastri.'},
 {title:'Piastri closes in, but runs out of laps',range:[takeover,race.laps],ids:['LEC','PIA','NOR'],tag:'THE FINAL CHASE',text:'Piastri reduces his deficit from '+chaseGap.toFixed(3)+'s on lap '+takeover+' to '+pia.classifiedGap.toFixed(3)+'s at the finish. Leclerc completes '+(lastStint.end-lastStint.start+1)+' laps on his final hard-tyre set.'}
];
insights=[
 {label:'THE WINNING MARGIN',value:pia.classifiedGap.toFixed(3),unit:'s',title:'Leclerc holds on',text:'Leclerc finishes '+pia.classifiedGap.toFixed(3)+'s ahead of Piastri. Norris completes the podium, '+nor.classifiedGap.toFixed(3)+'s behind the winner.',moment:2,link:'Explore the closing laps'},
 {label:'THE STRATEGY DIFFERENCE',value:String(lastStint.end-lastStint.start+1),unit:'laps',title:'One set to the flag',text:'Leclerc makes '+lec.pits.length+' stop; both McLarens make '+pia.pits.length+'. His final hard stint runs from lap '+lastStint.start+' through '+lastStint.end+'.',moment:1,link:'See the strategy split'},
 {label:'THE FINAL CHASE',value:(chaseGap-pia.classifiedGap).toFixed(3),unit:'s',title:'Piastri reels in the leader',text:'Piastri cuts Leclerc’s advantage from '+chaseGap.toFixed(3)+'s on lap '+takeover+' to '+pia.classifiedGap.toFixed(3)+'s at the flag, but finishes second.',moment:2,link:'Follow the battle for the win'}
];

}else{
const top=results[0];
if(top){
const stop=top.pits[0];
const first=top.records.find(l=>l.LapNumber===1);
const candidates=[{title:top.id+' at the end of lap one',range:[1,Math.min(3,race.laps)],ids:results.slice(0,3).map(d=>d.id),tag:'OPENING LAP',text:first?.Position?'The eventual '+finishLabel(top)+' driver completes lap one in P'+first.Position+'. Position changes do not identify their cause.':'Opening-lap position is unavailable.'},...(stop?[{title:top.id+' enters the pits',range:[Math.max(1,stop-1),Math.min(race.laps,stop+1)],ids:[top.id],tag:'PIT SEQUENCE',text:top.id+' completes a pit stop with entry on lap '+stop+'. The highlighted window includes the in and out laps.'}]:[]),{title:'The classified result',range:[Math.max(1,race.laps-4),race.laps],ids:results.slice(0,3).map(d=>d.id),tag:'FINAL LAPS',text:results.slice(0,3).map(d=>d.id+' '+finishLabel(d)).join(' · ')+'. Classification may include penalties not reflected in timing gaps.'}];
moments=candidates;insights=moments.map((m,i)=>({label:m.tag,value:i===0?String(first?.Position??'—'):i===1&&stop?String(stop):String(race.laps),unit:i===0?'position':'lap',title:m.title,text:m.text,moment:i,link:'Inspect the evidence'}));
}
}
return {race,drivers,results,laps,safetyPeriods,cleanLaps,metric,formatPace,gapLabel,finishLabel,compoundNames,byId,moments,insights,snapshot};
}

