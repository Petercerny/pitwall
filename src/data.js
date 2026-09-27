// Fictional Monza race. Offsets describe elapsed time relative to a common clock.
// Lap times, positions, gaps, clean pace, and editorial statistics share this source.
export const race = {id:'monza-demo',name:'Italian Grand Prix',circuit:'Autodromo Nazionale Monza',location:'Monza, Italy',laps:53,air:27,track:39,sc:[33,36],flagged:[1,37]};
const entries = [
 ['VER','Max Verstappen','Red Bull',1,'#648aff',24,0],['NOR','Lando Norris','McLaren',4,'#ff9c42',20,5.8],['LEC','Charles Leclerc','Ferrari',2,'#f26372',22,8.6],['PIA','Oscar Piastri','McLaren',5,'#f6cd87',21,12.4],['SAI','Carlos Sainz','Ferrari',3,'#ca8ba1',23,17.1],['HAM','Lewis Hamilton','Mercedes',8,'#59d4bb',25,20.2],['RUS','George Russell','Mercedes',6,'#99e2d7',26,23.7],['PER','Sergio Pérez','Red Bull',7,'#a1b4f3',27,27.9],['ALO','Fernando Alonso','Aston Martin',10,'#5ba88d',19,32.4],['STR','Lance Stroll','Aston Martin',9,'#acd1b5',28,36.1],['TSU','Yuki Tsunoda','RB',12,'#98a2cc',18,39.5],['HUL','Nico Hülkenberg','Haas',11,'#ccd0d5',29,43.2],['RIC','Daniel Ricciardo','RB',14,'#c4a9d6',21,46.8],['GAS','Pierre Gasly','Alpine',13,'#db8bd2',22,49.6],['ALB','Alex Albon','Williams',16,'#61b6d8',23,52.2],['OCO','Esteban Ocon','Alpine',15,'#ae85be',24,55.9],['MAG','Kevin Magnussen','Haas',17,'#ada8a0',25,59.1],['BOT','Valtteri Bottas','Sauber',19,'#95ba67',26,62.3],['ZHO','Zhou Guanyu','Sauber',20,'#c1cf95',27,65.8],['SAR','Logan Sargeant','Williams',18,'#9bc6e8',28,69.4]
];
function interpolate(anchors,lap){const i=anchors.findIndex(a=>a[0]>=lap);if(i===0)return anchors[0][1];const a=anchors[i-1],b=anchors[i];return a[1]+(b[1]-a[1])*(lap-a[0])/(b[0]-a[0]);}
export const drivers=entries.map(([id,name,team,grid,color,pit,finishGap],i)=>{
 const early=i===0?0:i===1?5.4:i===2?2.4: i*2.1;
 const mid=i===0?0:i===1?5.7:i===2?4.1:i*2.5;
 const late=i===0?0:i===1?4.5:i===2?4.0:i*1.4;
 const anchors=[[0,0],[1,(grid-1)*.62],[18,early],[32,mid],[36,i*.72],[43,late],[53,finishGap]];
 const offsets=Array.from({length:54},(_,lap)=>interpolate(anchors,lap)+(lap>=pit?21:0));
 const stints=[{compound:'M',start:1,end:pit},{compound:'H',start:pit+1,end:53}];
 return {id,name,team,grid,color,pits:[pit],stints,offsets};
});
const clock=[0];for(let lap=1;lap<=53;lap++)clock[lap]=clock[lap-1]+(lap>=33&&lap<=36?116:82.8-.027*lap+Math.sin(lap*.7)*.14);
export const laps=Array.from({length:54},(_,lap)=>{
 const ordered=[...drivers].sort((a,b)=>a.offsets[lap]-b.offsets[lap]);const lead=ordered[0].offsets[lap];
 return {lap,...Object.fromEntries(drivers.map(d=>[d.id,+(d.offsets[lap]-lead).toFixed(3)])),positions:Object.fromEntries(ordered.map((d,i)=>[d.id,i+1]))};
});
export function metric(d){const clean=Array.from({length:53},(_,i)=>i+1).filter(l=>!(l>=33&&l<=36)&&!race.flagged.includes(l)&&!d.pits.some(p=>l===p||l===p+1));const pace=clean.reduce((s,l)=>s+clock[l]-clock[l-1]+d.offsets[l]-d.offsets[l-1],0)/clean.length;const finish=laps[53].positions[d.id];return {finish,gained:d.grid-finish,pace,count:clean.length};}
export const results=[...drivers].sort((a,b)=>metric(a).finish-metric(b).finish);
export const formatPace=n=>`${Math.floor(n/60)}:${(n%60).toFixed(3).padStart(6,'0')}`;
export const moments=[
 {title:'The pit window reshuffles the order',range:[20,25],ids:['VER','NOR','LEC'],tag:'PIT WINDOW',text:`Norris stops on lap ${drivers[1].pits[0]}, two laps before Leclerc. The pit-lap spikes show the time cost; Leclerc is still ahead once both have stopped.`},
 {title:'A safety car resets the gaps',range:[33,36],ids:['VER','NOR','LEC','PIA'],tag:'SAFETY CAR',text:`Norris’s gap shrinks from ${laps[32].NOR.toFixed(1)}s to ${laps[36].NOR.toFixed(1)}s as the field bunches together. Racing resumes on lap 37.`},
 {title:'Norris takes second in the closing laps',range:[43,53],ids:['NOR','LEC','VER'],tag:'LATE RACE',text:`Norris trails Leclerc by ${(laps[43].NOR-laps[43].LEC).toFixed(1)}s on lap 43, but finishes ${(laps[53].LEC-laps[53].NOR).toFixed(1)}s ahead. Verstappen wins by ${laps[53].NOR.toFixed(1)}s.`}
];
