import {pointInPolygon,distanceToCircuit,seededRandom} from './circuit-layout.js';
export function projectMap(collection,project){
 const features=collection.features.map(f=>{
  const polygon=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[];
  const lines=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.type==='MultiLineString'?f.geometry.coordinates:[];
  return {id:f.id,tags:f.properties,polygons:polygon.map(rings=>rings.map(r=>r.map(project))),lines:lines.map(line=>line.map(project))};
 });
 const a=project([collection.bbox[0],collection.bbox[1]]),b=project([collection.bbox[2],collection.bbox[3]]);
 return {features,bounds:{minX:a.x,maxX:b.x,minZ:b.z,maxZ:a.z}};
}
export function polygonBounds(rings){const ring=rings[0];return {minX:Math.min(...ring.map(p=>p.x)),maxX:Math.max(...ring.map(p=>p.x)),minZ:Math.min(...ring.map(p=>p.z)),maxZ:Math.max(...ring.map(p=>p.z))};}
export function isInBounds(x,z,bounds,margin=0){return x>=bounds.minX+margin&&x<=bounds.maxX-margin&&z>=bounds.minZ+margin&&z<=bounds.maxZ-margin;}
export function generateWoodland(map,track,limit){
 const random=seededRandom(),woods=[],buildings=[],roads=[];
 for(const f of map.features){if(f.tags.natural==='wood'||f.tags.landuse==='forest')woods.push(...f.polygons.map(rings=>({rings,bounds:polygonBounds(rings)})));if(f.tags.building)buildings.push(...f.polygons.map(rings=>({rings,bounds:polygonBounds(rings)})));if(f.tags.highway)roads.push(...f.lines);}
 function within(x,z,p){return isInBounds(x,z,p.bounds)&&pointInPolygon(x,z,p.rings);}
 const clusters=[];
 for(let i=0;i<2500&&clusters.length<110;i++){const x=map.bounds.minX+random()*(map.bounds.maxX-map.bounds.minX),z=map.bounds.minZ+random()*(map.bounds.maxZ-map.bounds.minZ);if(woods.some(w=>within(x,z,w)))clusters.push({x,z,size:3+random()*9});}
 const trees=[];
 for(let attempt=0;attempt<limit*70&&trees.length<limit&&clusters.length;attempt++){
  const c=clusters[Math.floor(random()*clusters.length)],angle=random()*Math.PI*2,r=Math.sqrt(random())*c.size,x=c.x+Math.cos(angle)*r,z=c.z+Math.sin(angle)*r;
  if(!isInBounds(x,z,map.bounds,5)||!woods.some(w=>within(x,z,w)))continue;
  if(distanceToCircuit(x,z,track)<3.8||buildings.some(b=>isInBounds(x,z,b.bounds,-1.5)&&(pointInPolygon(x,z,b.rings)||b.rings.some(ring=>distanceToCircuit(x,z,ring)<1.5))))continue;
  if(roads.some(line=>distanceToCircuit(x,z,line)<1.5))continue;
  if(trees.some(t=>Math.abs(t.x-x)<1.3&&Math.abs(t.z-z)<1.3))continue;
  trees.push({x,z,height:1.6+random()*1.5,radius:.7+random()*.5,type:random()<.65?0:random()<.7?1:2,tint:random(),rotation:random()*Math.PI*2});
 }
 return trees;
}
