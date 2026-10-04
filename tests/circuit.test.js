import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectCircuit,createCircuitProjection,measureCircuit,sampleCircuit,distanceToCircuit,circuitLocations,pointInPolygon,roadOffsets} from '../src/circuit-layout.js';
import {projectMap,generateWoodland} from '../src/circuit-geography.js';
const data=JSON.parse(fs.readFileSync(new URL('../src/data/monza-circuit.json',import.meta.url)));
const points=projectCircuit(data.features[0].geometry.coordinates),path=measureCircuit(points);
test('geographic circuit is closed, plausibly scaled, and landmarks lie on it',()=>{
 assert.deepEqual(points[0],points.at(-1));assert(Math.abs(path.length*10-5793)<150);
 for(const location of circuitLocations){const p=points[location.index];assert(Number.isFinite(p.x)&&Number.isFinite(p.z));assert.equal(distanceToCircuit(p.x,p.z,points),0);}
});
test('map and circuit use the same projection; polygon holes remain empty',()=>{
 const project=createCircuitProjection(data.features[0].geometry.coordinates);assert.deepEqual(project(data.features[0].geometry.coordinates[55]),points[55]);
 const ring=[[0,0],[10,0],[10,10],[0,10],[0,0]].map(([x,z])=>({x,z})),hole=[[3,3],[7,3],[7,7],[3,7],[3,3]].map(([x,z])=>({x,z}));assert(pointInPolygon(1,1,[ring,hole]));assert(!pointInPolygon(5,5,[ring,hole]));assert(!pointInPolygon(11,5,[ring,hole]));
});
test('sharp road joins remain bounded and the closing seam matches',()=>{
 const offsets=roadOffsets(points,.9,true);assert.deepEqual(offsets[0],offsets.at(-1));offsets.forEach((o,i)=>{assert(Math.hypot(o.left.x-points[i].x,o.left.z-points[i].z)<=1.6200001);assert(Number.isFinite(o.right.x)&&Number.isFinite(o.right.z));});
});
test('bundled map includes source and real footprints; woodland placement respects geography',()=>{
 const snapshot=JSON.parse(fs.readFileSync(new URL('../src/data/monza-surroundings.json',import.meta.url)));assert(snapshot.metadata.source.startsWith('https://www.openstreetmap.org/api/'));assert.equal(snapshot.metadata.license,'ODbL 1.0');assert(snapshot.features.some(f=>f.properties.name==='Palazzina Box'));
 const map=projectMap(snapshot,createCircuitProjection(data.features[0].geometry.coordinates)),a=generateWoodland(map,points,180),b=generateWoodland(map,points,180);assert.equal(a.length,180);assert.deepEqual(a,b);
 const woods=map.features.filter(f=>f.tags.natural==='wood'||f.tags.landuse==='forest').flatMap(f=>f.polygons),buildings=map.features.filter(f=>f.tags.building).flatMap(f=>f.polygons),roads=map.features.filter(f=>f.tags.highway).flatMap(f=>f.lines);
 for(const t of a){assert(woods.some(p=>pointInPolygon(t.x,t.z,p)));assert(distanceToCircuit(t.x,t.z,points)>=3.8);assert(!buildings.some(p=>pointInPolygon(t.x,t.z,p)));assert(!roads.some(p=>distanceToCircuit(t.x,t.z,p)<1.5));}
});
test('tour follows distance along the real outline and wraps without inventing positions',()=>{
 for(const t of [0,.05,.25,.5,.9,.999,1]){const p=sampleCircuit(path,t);assert(distanceToCircuit(p.x,p.z,points)<1e-9);assert(Number.isFinite(p.angle));}
 assert.deepEqual(sampleCircuit(path,0),sampleCircuit(path,1));
 const p=sampleCircuit(path,.01);assert(Math.abs(Math.hypot(p.x-points[0].x,p.z-points[0].z)-path.length*.01)<.1);
});
