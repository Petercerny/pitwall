import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildModel} from '../src/model.js';
import {explainDriver,matchedPace,qualifyingRows} from '../src/stories.js';
import {createArchiveStore} from '../server/archive.js';
import monza from '../src/data/monza-2024.json' with {type:'json'};
const model=buildModel(monza);
test('driver explanations carry reproducible metrics and lap evidence',()=>{
 for(const d of model.drivers){const story=explainDriver(model,d.id);assert(story.cards.length<=4);for(const card of story.cards){assert(card.range[0]>=1);assert(card.range[1]<=model.race.laps);assert(card.source.importedAt);assert(card.driverIds.every(id=>model.byId(id)));}}
 const lec=explainDriver(model,'LEC');assert.equal(lec.cards.find(c=>c.kind==='start').values.grid,4);assert.deepEqual(lec.cards.find(c=>c.kind==='pits').values.pitLaps,[15]);assert.equal(explainDriver(model,'TSU').cards.some(c=>c.kind==='pits'),false);
});
test('matched pace intersects eligible lap numbers and excludes flagged laps',()=>{
 const a=model.byId('LEC'),b=model.byId('SAI');const p=matchedPace(a,b);assert(p.count>=3);assert.equal(p.paces[0],p.laps.reduce((sum,n)=>sum+a.records.find(l=>l.LapNumber===n).LapTime,0)/p.count);
 const bad={...b,records:b.records.map(l=>({...l,TrackStatus:'4'}))};assert.deepEqual(matchedPace(a,bad).paces,[null,null]);
});
test('missing grid and absent teammate do not generate invented explanations',()=>{
 const s=structuredClone(monza);s.drivers=[{...s.drivers[0],GridPosition:0}];const m=buildModel({...s,session:{id:'2024-1-R'}});const story=explainDriver(m,m.drivers[0].id);assert(!story.cards.some(c=>c.kind==='start'||c.kind==='pace'));assert.equal(m.metric(m.drivers[0]).gained,null);
});
test('qualifying excludes deleted laps and only compares the selected stage',()=>{
 const fixture={drivers:[{Abbreviation:'A',Position:1},{Abbreviation:'B',Position:2}],laps:[{Driver:'A',QualifyingStage:1,LapTime:90},{Driver:'A',QualifyingStage:1,LapTime:80,Deleted:true},{Driver:'A',QualifyingStage:2,LapTime:85},{Driver:'B',QualifyingStage:1,LapTime:91}]};
 assert.equal(qualifyingRows(fixture,1)[0].best,90);assert.equal(qualifyingRows(fixture,2).find(d=>d.Abbreviation==='B').best,null);
});
test('archive storage validates IDs and does not expose unavailable snapshots',async()=>{
 let calls=0;const store=createArchiveStore({SUPABASE_URL:'https://example.invalid',SUPABASE_SECRET_KEY:'test-key'},async()=>{calls++;return Response.json([{status:'unavailable'}])});assert.equal(await store.session('../secret'),null);assert.equal(calls,0);assert.equal(await store.session('2023-1-R'),null);assert.equal(calls,1);await assert.rejects(createArchiveStore({}).index(),/not configured/);
});
test('storage failures remain explicit and content is fetched only by the published pointer',async()=>{
 const paths=[];const store=createArchiveStore({SUPABASE_URL:'https://example.invalid',SUPABASE_SECRET_KEY:'test-key'},async(url,options)=>{paths.push(url);assert.equal(options.headers.apikey,'test-key');return Response.json(paths.length===1?[{status:'available',object_path:'2023-1-R/checksum.json'}]:{schemaVersion:2})});assert.deepEqual(await store.session('2023-1-R'),{schemaVersion:2});assert.match(paths[1],/checksum.json$/);
 const failed=createArchiveStore({SUPABASE_URL:'https://example.invalid',SUPABASE_SECRET_KEY:'test-key'},async()=>new Response('',{status:503}));await assert.rejects(failed.index(),/temporarily unavailable/);
});
test('downloaded sessions normalize without invented laps or invalid evidence',()=>{
 const files=fs.existsSync('archive/sessions')?fs.readdirSync('archive/sessions').filter(f=>f.endsWith('.json')):[];
 for(const file of files){const s=JSON.parse(fs.readFileSync('archive/sessions/'+file));const m=buildModel(s);assert(m.drivers.length>0,file);if(['Q','SQ'].includes(s.session.type)){for(const n of [1,2,3])for(const r of qualifyingRows(s,n))assert(r.best===null||r.best>0,file);}else{for(const d of m.drivers){for(const card of explainDriver(m,d.id).cards)assert(card.range[1]<=m.race.laps,file);for(const row of m.laps.slice(d.completed+1))assert.equal(row[d.id],null,file);}}}
});

