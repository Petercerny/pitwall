export const exclusions=['Opening lap','Pit in/out laps','Non-green track status','Deleted laps','Inaccurate or generated timing'];
export function eligible(l){return l.LapNumber>1&&Number.isFinite(l.LapTime)&&l.LapTime>0&&l.PitInTime==null&&l.PitOutTime==null&&l.TrackStatus==='1'&&l.IsAccurate===true&&!l.Deleted&&!l.FastF1Generated;}
export function matchedPace(a,b){
 const left=new Map(a.records.filter(eligible).map(l=>[l.LapNumber,l.LapTime]));
 const right=b.records.filter(l=>eligible(l)&&left.has(l.LapNumber));
 return {count:right.length,laps:right.map(l=>l.LapNumber),paces:right.length?[right.reduce((sum,l)=>sum+left.get(l.LapNumber),0)/right.length,right.reduce((sum,l)=>sum+l.LapTime,0)/right.length]:[null,null]};
}
export function explainDriver(model,id){
 const d=model.byId(id);if(!d)return {summary:'Select a driver to inspect their race.',cards:[]};
 const teammate=model.results.find(x=>x.team===d.team&&x.id!==id);const cards=[];
 const add=(kind,title,text,range,values,ids=[id])=>cards.push({id:model.race.id+':'+id+':'+kind,sessionId:model.race.id,driverIds:ids,kind,title,text,range,values,exclusions:kind==='pace'?exclusions:[],source:{...model.race.source,importedAt:model.race.importedAt},limitations:kind==='pace'?'Fuel, traffic and tyre age are not adjusted.':'Timing observations alone do not establish why a position changed.'});
 const first=d.records.find(l=>l.LapNumber===1);
 if(d.grid&&first?.Position){const gained=d.grid-first.Position;add('start','The opening lap',`Started P${d.grid}; crossed the end of lap one in P${first.Position}. ${gained===0?'No net position change.':Math.abs(gained)+' position'+(Math.abs(gained)===1?'':'s')+(gained>0?' gained.':' lost.')} This does not distinguish passes from incidents or pit activity.`,[1,1],{grid:d.grid,lapOnePosition:first.Position,netChange:gained});}
 if(d.pits.length){const last=d.stints.at(-1);add('pits','The pit sequence',`${d.pits.length} completed stop${d.pits.length===1?'':'s'}, with pit entry on lap${d.pits.length===1?'':'s'} ${d.pits.join(', ')}. The final recorded stint covers laps ${last.start}–${last.end} on ${model.compoundNames[last.compound].toLowerCase()} tyres.`,[Math.max(1,d.pits[0]-1),Math.min(model.race.laps,d.pits[0]+1)],{pitLaps:d.pits,finalStint:last});}
 if(teammate){const p=matchedPace(d,teammate);if(p.count>=3){const delta=p.paces[0]-p.paces[1];add('pace','Across the garage',`${d.id} averaged ${Math.abs(delta).toFixed(3)}s ${delta<=0?'quicker':'slower'} than ${teammate.id} over ${p.count} matched clean laps. Both averages use the same lap numbers.`,[Math.min(...p.laps),Math.max(...p.laps)],{meanSeconds:p.paces,deltaSeconds:delta,sampleSize:p.count,lapNumbers:p.laps},[id,teammate.id]);}}
 if(d.completed){const m=model.metric(d);add('finish','At the flag',`${model.finishLabel(d)} · ${d.completed} recorded laps.${Number.isFinite(m.gained)?' Grid-to-classification change: '+(m.gained>0?'+':'')+m.gained+' positions.':''}${d.retired?' No later laps have been filled in.':' Final classification can include penalties absent from timing gaps.'}`,[Math.max(1,d.completed-3),d.completed],{finish:d.finish,status:d.status,positionsGained:m.gained,completed:d.completed,classifiedGap:d.classifiedGap});}
 return {summary:`${d.name} · ${d.grid?'P'+d.grid+' on the grid':'Grid position unavailable'} → ${model.finishLabel(d)}. ${d.pits.length} completed pit stop${d.pits.length===1?'':'s'}.`,cards};
}
export function qualifyingRows(snapshot,stage){
 return snapshot.drivers.map(d=>{
  const valid=snapshot.laps.filter(l=>l.Driver===d.Abbreviation&&l.QualifyingStage===stage&&!l.Deleted&&!l.FastF1Generated&&Number.isFinite(l.LapTime)&&l.LapTime>0);
  const best=valid.length?Math.min(...valid.map(l=>l.LapTime)):null;
  return {...d,best,attempts:valid.length,progression:[1,2,3].map(n=>snapshot.laps.some(l=>l.Driver===d.Abbreviation&&l.QualifyingStage===n))};
 }).sort((a,b)=>(a.best??Infinity)-(b.best??Infinity)||(a.Position??99)-(b.Position??99));
}
