import test from 'node:test';
import assert from 'node:assert/strict';
import {drivers,laps,metric,moments,race} from '../src/data.js';
test('all laps have a leader and unique complete classifications',()=>{for(const lap of laps){assert.equal(Math.min(...drivers.map(d=>lap[d.id])),0);assert.equal(new Set(Object.values(lap.positions)).size,20);}});
test('strategies cover the race and pit costs persist in elapsed time',()=>{for(const d of drivers){assert.equal(d.stints.reduce((n,s)=>n+s.end-s.start+1,0),race.laps);const p=d.pits[0];assert(d.offsets[p]-d.offsets[p-1]>20);assert(d.offsets[p+1]-d.offsets[p]>-2);assert.equal(d.stints[1].start,p+1);assert.equal(metric(d).count,45);assert(metric(d).pace>80&&metric(d).pace<86);}});
test('editorial claims agree with the race',()=>{assert(laps[32].NOR>laps[36].NOR);assert(laps[43].NOR>laps[43].LEC);assert(laps[53].NOR<laps[53].LEC);assert.equal(laps[53].positions.NOR,2);assert.equal(laps[53].positions.VER,1);assert(laps[25].NOR>laps[25].LEC);for(const m of moments){assert(m.range[0]>=1&&m.range[1]<=53);}});
