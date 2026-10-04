import snapshot from './data/monza-2024.json' with {type:'json'};
// Every chart and metric uses this immutable historical snapshot.
const colors={VER:'#648aff',NOR:'#ff9c42',LEC:'#f26372',PIA:'#f6cd87',SAI:'#ca8ba1',HAM:'#59d4bb',RUS:'#99e2d7',PER:'#a1b4f3',ALO:'#5ba88d',STR:'#acd1b5',TSU:'#98a2cc',HUL:'#ccd0d5',RIC:'#c4a9d6',GAS:'#db8bd2',ALB:'#61b6d8',OCO:'#ae85be',MAG:'#ada8a0',BOT:'#95ba67',ZHO:'#c1cf95',COL:'#9bc6e8'};
export const compoundNames={S:'Soft',M:'Medium',H:'Hard',I:'Intermediate',W:'Wet',U:'Unknown'};
const recorded=snapshot.laps.filter(l=>!l.FastF1Generated&&Number.isFinite(l.Time));
const raceEnd=Math.max(...recorded.map(l=>l.Time));
const weather=snapshot.weather.filter(w=>w.Time>=snapshot.event.startTime&&w.Time<=raceEnd);
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
export const race={id:'monza-2024',name:snapshot.event.name,circuit:'Autodromo Nazionale di Monza',location:'Monza, Italy',year:2024,date:'1 September 2024',laps:snapshot.event.laps,air:mean(weather.map(w=>w.AirTemp)),track:mean(weather.map(w=>w.TrackTemp)),dry:weather.every(w=>!w.Rainfall),importedAt:snapshot.importedAt,source:snapshot.source};
export const drivers=snapshot.drivers.map(r=>{
 const records=recorded.filter(l=>l.Driver===r.Abbreviation).sort((a,b)=>a.LapNumber-b.LapNumber);
 const completed=records.at(-1)?.LapNumber??0;
 const groups=Object.groupBy(records,l=>l.Stint);
 const stints=Object.values(groups).map(ls=>({compound:ls[0].Compound?.[0]??'U',start:ls[0].LapNumber,end:ls.at(-1).LapNumber,startingAge:ls[0].TyreLife,fresh:ls[0].FreshTyre}));
 // A pit entry without a later exit is a retirement, not a completed stop.
 const pits=records.filter(l=>l.PitInTime!==null&&records.some(n=>n.PitOutTime!==null&&n.PitOutTime>l.PitInTime)).map(l=>l.LapNumber);
 return {id:r.Abbreviation,name:r.FullName,team:r.TeamName,grid:r.GridPosition,color:colors[r.Abbreviation]??'#bac1cc',finish:r.Position,status:r.Status,retired:r.ClassifiedPosition==='R',classifiedGap:r.Position===1?0:r.Status==='Finished'?r.Time:null,completed,stints,pits,records};
});
export const results=[...drivers].sort((a,b)=>a.finish-b.finish);
export const laps=Array.from({length:race.laps+1},(_,lap)=>{
 const rows=drivers.map(d=>({d,row:d.records.find(l=>l.LapNumber===lap)}));
 const times=rows.filter(x=>x.row).map(x=>x.row.Time);const leaderTime=times.length?Math.min(...times):null;
 return {lap,positions:Object.fromEntries(rows.map(({d,row})=>[d.id,row?.Position??null])),...Object.fromEntries(rows.map(({d,row})=>[d.id,row?+Math.max(0,row.Time-leaderTime).toFixed(3):null]))};
});
export const safetyPeriods=snapshot.trackStatus.flatMap((s,i)=>{
 if(!['4','6','7'].includes(s.Status))return [];
 const lapAt=t=>results[0].records.find(l=>l.Time>=t)?.LapNumber??race.laps;
 return [{start:lapAt(s.Time),end:lapAt(snapshot.trackStatus[i+1]?.Time??raceEnd),label:s.Status==='4'?'SC':'VSC'}];
});
export function cleanLaps(d){return d.records.filter(l=>l.LapNumber>1&&Number.isFinite(l.LapTime)&&l.LapTime>0&&l.PitInTime===null&&l.PitOutTime===null&&l.TrackStatus==='1'&&l.IsAccurate===true&&!l.Deleted&&!l.FastF1Generated);}
export function metric(d){const clean=cleanLaps(d);return {finish:d.finish,gained:d.grid-d.finish,pace:mean(clean.map(l=>l.LapTime)),count:clean.length};}
export const formatPace=n=>Number.isFinite(n)?Math.floor(n/60)+':'+(n%60).toFixed(3).padStart(6,'0'):'—';
export function gapLabel(d,lap){const gap=laps[lap]?.[d.id];if(Number.isFinite(gap))return gap===0?'Leader':'+'+gap.toFixed(3)+'s';if(lap>d.completed)return d.retired?'Retired · '+d.completed+' laps':'Finished · +'+(race.laps-d.completed)+' lap';return 'No timing data';}
export function finishLabel(d){return d.retired?'DNF':'P'+d.finish;}
export const byId=id=>drivers.find(d=>d.id===id);
const lec=byId('LEC'),pia=byId('PIA'),nor=byId('NOR');
const firstWindow=[nor.pits[0],pia.pits[0]+1];
const takeover=lec.records.find(l=>l.LapNumber>pia.pits[1]&&l.Position===1).LapNumber;
const chaseGap=laps[takeover].PIA;
const lastStint=lec.stints.at(-1);
export const moments=[
 {title:'The first stops put Norris ahead of Leclerc',range:[firstWindow[0]-1,firstWindow[1]],ids:['NOR','LEC','PIA'],tag:'FIRST PIT WINDOW',text:'Norris pits on lap '+nor.pits[0]+', Leclerc on '+lec.pits[0]+'. Norris is behind Leclerc before the stops, but ahead by '+(laps[firstWindow[1]].LEC-laps[firstWindow[1]].NOR).toFixed(3)+'s at the end of lap '+firstWindow[1]+'.'},
 {title:'One stop puts Leclerc in control',range:[nor.pits[1],takeover],ids:['LEC','PIA','NOR','SAI'],tag:'STRATEGY SPLIT',text:'Norris stops again on lap '+nor.pits[1]+', Piastri on '+pia.pits[1]+'. Leclerc stays on his hard tyres and takes the lead on lap '+takeover+', with '+chaseGap.toFixed(3)+'s over Piastri.'},
 {title:'Piastri closes in, but runs out of laps',range:[takeover,race.laps],ids:['LEC','PIA','NOR'],tag:'THE FINAL CHASE',text:'Piastri reduces his deficit from '+chaseGap.toFixed(3)+'s on lap '+takeover+' to '+pia.classifiedGap.toFixed(3)+'s at the finish. Leclerc completes '+(lastStint.end-lastStint.start+1)+' laps on his final hard-tyre set.'}
];
export const insights=[
 {label:'THE WINNING MARGIN',value:pia.classifiedGap.toFixed(3),unit:'s',title:'Leclerc holds on',text:'Leclerc finishes '+pia.classifiedGap.toFixed(3)+'s ahead of Piastri. Norris completes the podium, '+nor.classifiedGap.toFixed(3)+'s behind the winner.',moment:2,link:'Explore the closing laps'},
 {label:'THE STRATEGY DIFFERENCE',value:String(lastStint.end-lastStint.start+1),unit:'laps',title:'One set to the flag',text:'Leclerc makes '+lec.pits.length+' stop; both McLarens make '+pia.pits.length+'. His final hard stint runs from lap '+lastStint.start+' through '+lastStint.end+'.',moment:1,link:'See the strategy split'},
 {label:'THE FINAL CHASE',value:(chaseGap-pia.classifiedGap).toFixed(3),unit:'s',title:'Piastri reels in the leader',text:'Piastri cuts Leclerc’s advantage from '+chaseGap.toFixed(3)+'s on lap '+takeover+' to '+pia.classifiedGap.toFixed(3)+'s at the flag, but finishes second.',moment:2,link:'Follow the battle for the win'}
];
