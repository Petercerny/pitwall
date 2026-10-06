import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {samplePosition,bestLap,eligibleLaps,mergeSamples,lapSamples,raceState,compareDeltas,createReplayCache,trackStatusAt} from '../src/circuit-playback.js';
import {createArchiveStore} from '../server/archive.js';
import {createCarAssets,createCarFleet} from '../src/circuit-cars.js';
import * as THREE from 'three';
const manifest=JSON.parse(fs.readFileSync(new URL('../public/replays/2024-16-R/manifest.json',import.meta.url)));
test('replay interpolates native timestamps but never crosses gaps or coverage bounds',()=>{
 const a=[[10,0,0,100,1],[10.5,1,2,200,1],[12,3,4,220,1]];assert.deepEqual(samplePosition(a,10.25),{x:.5,z:1,speed:150,angle:Math.atan2(1,2),onTrack:true});assert.equal(samplePosition(a,11),null);assert.equal(samplePosition(a,9.9),null);assert.equal(samplePosition(a,12.1),null);assert.equal(samplePosition(a,12).x,3);
});
test('best laps keep timing eligibility and stage separate from telemetry coverage',()=>{
 const m={type:'Q',laps:[{driverId:'A',number:1,valid:true,replayable:false,stage:1,duration:80},{driverId:'A',number:2,valid:true,replayable:true,stage:1,duration:81},{driverId:'A',number:3,valid:false,stage:1,duration:79},{driverId:'A',number:4,valid:true,stage:2,duration:78}]};assert.equal(bestLap(m,'A',1).number,1);assert.equal(bestLap(m,'A',2).number,4);assert.equal(eligibleLaps(m,'A',1).length,2);assert.equal(bestLap(m,'B',1),null);
});
test('chunk boundaries deduplicate samples and lap trimming interpolates precise endpoints',()=>{
 const a=[[0,0,0,100,1],[.5,1,0,100,1],[1,2,0,100,1]],merged=mergeSamples([{drivers:{A:a}},{drivers:{A:a.slice(1)}}],'A');assert.equal(merged.length,3);const lap=lapSamples(merged,{start:.25,end:.75});assert.deepEqual(lap.map(s=>s[0]),[.25,.5,.75]);assert.equal(lap[0][1],.5);
});
test('equal-distance deltas preserve finish-time differences',()=>{
 const result=compareDeltas([{id:'A',samples:[[10,0,0,0,1],[11,1,0,0,1]]},{id:'B',samples:[[20,0,0,0,1],[22,1,0,0,1]]}]);assert.equal(result[0].values[0].delta,0);assert.equal(result[0].values.at(-1).delta,1);
});
test('race replay uses each driver clock for lap, pits, retirement and lapping',()=>{
 const lec=manifest.laps.find(l=>l.driverId==='LEC'&&l.pitIn!==null),out=manifest.laps.find(l=>l.driverId==='LEC'&&l.pitOut>lec.pitIn);assert.equal(raceState(manifest,'LEC',(lec.pitIn+out.pitOut)/2).state,'Pit lane');assert.equal(raceState(manifest,'TSU',manifest.end).state,'Retired');assert.equal(raceState(manifest,'LEC',manifest.end).state,'Finished');assert(raceState(manifest,'LEC',manifest.start+200).lap>1);assert(trackStatusAt(manifest,manifest.start));
});
test('telemetry cache coalesces requests and evicts old chunks',async()=>{
 let count=0;const cache=createReplayCache({id:'2024-16-R',local:true},{maxEntries:2,fetcher:async()=>{count++;return Response.json({drivers:{}});}});await Promise.all([cache.get(1),cache.get(1)]);assert.equal(count,1);await cache.get(2);await cache.get(3);assert.equal(cache.size,2);await cache.get(1);assert.equal(count,4);
});
test('replay storage rejects arbitrary sessions, indices and object paths',async()=>{
 let calls=0;const store=createArchiveStore({SUPABASE_URL:'https://example.invalid',SUPABASE_SECRET_KEY:'test'},async()=>{calls++;return Response.json([{replay_object_path:'../private'}]);});assert.equal(await store.replayManifest('../secret'),null);assert.equal(await store.replayChunk('2024-16-R',-1),null);assert.equal(calls,0);assert.equal(await store.replayManifest('2024-16-R'),null);assert.equal(calls,1);
});
test('bundled sessions are calibrated and every published chunk has ordered finite samples',()=>{
 for(const kind of ['R','Q']){const root=new URL(`../public/replays/2024-16-${kind}/`,import.meta.url),m=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));assert(m.calibration.medianErrorMetres<=10);assert(m.calibration.p95ErrorMetres<=25);assert.equal(m.drivers.length,20);assert(m.laps.some(l=>l.replayable&&l.valid));for(const chunk of m.chunks){const data=JSON.parse(fs.readFileSync(new URL(chunk.file,root)));for(const samples of Object.values(data.drivers)){let prev=-Infinity;for(const sample of samples){assert(sample.slice(0,3).every(Number.isFinite));assert(sample[0]>prev);prev=sample[0];}}}}
});
test('detailed cars have shared geometry and physically plausible dimensions',()=>{const assets=createCarAssets();let near=0,far=0;for(const [lod,parts] of Object.entries(assets.geometry))for(const g of Object.values(parts)){g.computeBoundingBox();assert(g.boundingBox.max.x-g.boundingBox.min.x<=.21);if(lod==='near')near+=g.getAttribute('position').count/3;else far+=g.getAttribute('position').count/3;g.dispose();}assert(near>far);assert(near<2500);Object.values(assets.materials).forEach(m=>m.dispose());});
test('car bodies and wheels sit above the rendered asphalt, including terrain elevation',()=>{const assets=createCarAssets(),fleet=createCarFleet(assets),camera=new THREE.PerspectiveCamera();camera.position.set(0,5,1);fleet.update([{id:'A',x:0,z:0,angle:0,color:'#ff0000'}],camera,()=>2,['A'],'A');const matrix=new THREE.Matrix4();for(const mesh of fleet.group.children){if(!mesh.count)continue;mesh.geometry.computeBoundingBox();mesh.getMatrixAt(0,matrix);const box=mesh.geometry.boundingBox.clone().applyMatrix4(matrix);assert(box.min.y>=2.09,'Car intersects the asphalt surface');}fleet.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});Object.values(assets.geometry).forEach(parts=>Object.values(parts).forEach(g=>g.dispose()));Object.values(assets.materials).forEach(m=>m.dispose());});
