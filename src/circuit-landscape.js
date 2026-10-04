import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import trackData from './data/monza-circuit.json';
import surroundings from './data/monza-surroundings.json';
import {createCircuitProjection,measureCircuit,roadOffsets,seededRandom,distanceToCircuit,circuitLocations} from './circuit-layout.js';
import {projectMap,polygonBounds,isInBounds,generateWoodland} from './circuit-geography.js';

const groundColor=0xe9e3d4;
const mat=(color,options={})=>new THREE.MeshStandardMaterial({color,roughness:.92,...options});
function shapeFor(rings){const s=new THREE.Shape(rings[0].map(p=>new THREE.Vector2(p.x,-p.z)));for(const ring of rings.slice(1))s.holes.push(new THREE.Path(ring.map(p=>new THREE.Vector2(p.x,-p.z))));return s;}
function flatten(geometry){const result=geometry.index?geometry.toNonIndexed():geometry.clone();geometry.dispose();return result;}
function textureCanvas(size=512){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;return {canvas,ctx:canvas.getContext('2d')};}
function canvasTexture(canvas,repeat=1){const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);return t;}
function grainTexture(color,range=12,repeat=1){const {canvas,ctx}=textureCanvas(256),image=ctx.createImageData(256,256),random=seededRandom(232);
 for(let i=0;i<image.data.length;i+=4){const delta=(random()-.5)*range;image.data[i]=color[0]+delta;image.data[i+1]=color[1]+delta;image.data[i+2]=color[2]+delta;image.data[i+3]=255;}ctx.putImageData(image,0,0);return canvasTexture(canvas,repeat);
}
function landscapeTexture(map){
 const {canvas,ctx}=textureCanvas(),{bounds}=map,w=bounds.maxX-bounds.minX,d=bounds.maxZ-bounds.minZ;
 ctx.fillStyle='#a1a47a';ctx.fillRect(0,0,512,512);
 for(const f of map.features){const p=f.tags;const color=p.natural==='water'?'#7d9490':p.natural==='wood'||p.landuse==='forest'?'#657b56':p.natural==='scrub'?'#869366':p.amenity==='parking'?'#ada994':p.surface==='gravel'?'#c1b49a':p.landuse?'#a8ac82':null;if(!color)continue;
  ctx.fillStyle=color;for(const rings of f.polygons){ctx.beginPath();for(const ring of rings){ring.forEach((p,i)=>{const x=(p.x-bounds.minX)/w*512,y=(p.z-bounds.minZ)/d*512;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.closePath();}ctx.fill('evenodd');}
 }
 const random=seededRandom(49),image=ctx.getImageData(0,0,512,512);
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4,n=(random()-.5)*18+Math.sin(x*.11)*Math.sin(y*.07)*6;for(let c=0;c<3;c++)image.data[i+c]+=n;const edge=Math.min(x,y,511-x,511-y);const a=THREE.MathUtils.smoothstep(edge,0,50);image.data[i+3]=Math.round(a*255);}
 ctx.putImageData(image,0,0);const t=canvasTexture(canvas);t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;return t;
}
function foliageTexture(){const {canvas,ctx}=textureCanvas(128),random=seededRandom(521);ctx.fillStyle='#e0e2ce';ctx.fillRect(0,0,128,128);for(let i=0;i<1300;i++){ctx.fillStyle=random()>.5?'#fffde9':'#9da782';ctx.beginPath();ctx.ellipse(random()*128,random()*128,1+random()*3,1+random()*2,random()*3,0,7);ctx.fill();}return canvasTexture(canvas);}
function smoothCrown(){const g=new THREE.IcosahedronGeometry(1,0),p=g.getAttribute('position'),n=g.getAttribute('normal');for(let i=0;i<p.count;i++)n.setXYZ(i,p.getX(i),p.getY(i),p.getZ(i));g.normalizeNormals();return g;}
export function ribbonGeometry(points,width,y,closed=false){
 const offsets=roadOffsets(points,width/2,closed),vertices=[],uvs=[],indices=[];let distance=0;
 offsets.forEach((o,i)=>{if(i)distance+=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);vertices.push(o.left.x,y,o.left.z,o.right.x,y,o.right.z);uvs.push(0,distance/3,1,distance/3);if(i<points.length-1){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}});
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function crownGeometry(type){
 const parts=[];
 if(type===2){for(let i=0;i<3;i++){const g=new THREE.ConeGeometry(.64-i*.12,.9,8);g.translate(0,.7+i*.3,0);parts.push(flatten(g));}}
 else {const lobes=type===0?[[0,1.05,0,.8],[.45,.83,.12,.62],[-.38,.78,-.18,.62]]:[[0,1.25,0,.52],[.12,.75,0,.57]];for(const [x,y,z,size] of lobes){const g=smoothCrown();g.scale(size,type===1?size*1.6:size*.9,size);g.translate(x,y,z);parts.push(flatten(g));}}
 const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());return g;
}
function gabledRoof(rings,height,dx,dz){
 const ring=rings[0];if(rings.length!==1||ring.length!==5)return null;
 const us=ring.map(p=>p.x*dx+p.z*dz),vs=ring.map(p=>p.x*dz-p.z*dx),a=Math.min(...us),b=Math.max(...us),c=Math.min(...vs),d=Math.max(...vs),mid=(c+d)/2;
 const at=(u,v,y)=>[dx*u+dz*v,y,dz*u-dx*v],ridge=height+Math.min(.55,(d-c)*.3);
 const p=[at(a,c,height),at(b,c,height),at(b,d,height),at(a,d,height),at(a,mid,ridge),at(b,mid,ridge)],triangles=[[0,1,4],[1,5,4],[4,5,3],[5,2,3],[0,4,3],[1,2,5]],vertices=[],uv=[];
 for(const triangle of triangles)for(const i of triangle){vertices.push(...p[i]);uv.push(p[i][0],p[i][2]);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
export function createMonzaWorld({mobile=false}={}){
 const world=new THREE.Group(),project=createCircuitProjection(trackData.features[0].geometry.coordinates),points=trackData.features[0].geometry.coordinates.map(project),path=measureCircuit(points),map=projectMap(surroundings,project),{bounds}=map;
 const materials={road:mat(0xffffff,{map:grainTexture([62,66,63],18),side:THREE.DoubleSide}),path:mat(0xffffff,{map:grainTexture([171,158,131],20),side:THREE.DoubleSide}),gravel:mat(0xffffff,{map:grainTexture([194,182,156],32),side:THREE.DoubleSide}),white:mat(0xe8e4ce,{side:THREE.DoubleSide}),red:mat(0xb95a42,{side:THREE.DoubleSide}),walls:mat(0xc2bca9),roofs:mat(0x65716c),tileRoof:mat(0x9d6951),glass:mat(0x4b6362,{roughness:.48}),metal:mat(0x92998e),seats:mat(0xa74d36),bark:mat(0x6f6753),ground:mat(0xffffff,{map:landscapeTexture(map),transparent:true,depthWrite:false})};
 const batches=new Map();function addBatch(name,g){if(!batches.has(name))batches.set(name,[]);batches.get(name).push(flatten(g));}
 function batchBox(name,w,h,d,x,y,z,angle=0){const g=new THREE.BoxGeometry(w,h,d);g.rotateY(angle);g.translate(x,y,z);addBatch(name,g);}
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),mat(groundColor));floor.rotation.x=-Math.PI/2;floor.position.y=-.04;floor.receiveShadow=true;world.add(floor);
 const park=new THREE.Mesh(new THREE.PlaneGeometry(bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ),materials.ground);park.rotation.x=-Math.PI/2;park.position.set((bounds.minX+bounds.maxX)/2,0,(bounds.minZ+bounds.maxZ)/2);park.receiveShadow=true;world.add(park);
 // Secondary roads come from OSM, including the old oval where it is mapped.
 const roads=[];
 for(const f of map.features){if(!f.tags.highway)continue;for(const line of f.lines){if(line.length<2)continue;const roadBounds={minX:Math.min(...line.map(p=>p.x)),maxX:Math.max(...line.map(p=>p.x)),minZ:Math.min(...line.map(p=>p.z)),maxZ:Math.max(...line.map(p=>p.z))};if(roadBounds.maxX<bounds.minX||roadBounds.minX>bounds.maxX||roadBounds.maxZ<bounds.minZ||roadBounds.minZ>bounds.maxZ)continue;
   const raceway=f.tags.highway==='raceway',main=raceway&&line.filter(p=>distanceToCircuit(p.x,p.z,points)<2.5).length/line.length>.65;if(main)continue;
   // Clip individual segments to the snapshot area; no long road escapes the landscape.
   const paved=['raceway','service','residential','unclassified'].includes(f.tags.highway),width=raceway?1.2:paved?.45:.23;
   let section=[];for(const p of line){if(isInBounds(p.x,p.z,bounds,8)){section.push(p);}else{if(section.length>1){addBatch(paved?'road':'path',ribbonGeometry(section,width,.035));roads.push(section);}section=[];}}if(section.length>1){addBatch(paved?'road':'path',ribbonGeometry(section,width,.035));roads.push(section);}
  }}
 // Local gravel aprons and the centreline-derived road; joins are bounded miters.
 addBatch('white',ribbonGeometry(points,2.05,.075,true));addBatch('road',ribbonGeometry(points,1.8,.09,true));
 for(const [start,end] of [[2,14],[34,44],[47,65],[74,92],[95,117]]){const strip=points.slice(start,end+1);addBatch('gravel',ribbonGeometry(strip,4.9,.025));}
 const offsets=roadOffsets(points,1.04,true),edgeLines=[offsets.map(o=>o.left),offsets.map(o=>o.right)];
 for(const [start,end] of [[2,14],[34,44],[47,65],[74,92],[95,117]])for(const edge of edgeLines){const line=edge.slice(start,end+1);for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],length=Math.hypot(b.x-a.x,b.z-a.z),count=Math.ceil(length/.7);for(let j=0;j<count;j++){const t0=j/count,t1=(j+1)/count;addBatch(j%2?'white':'red',ribbonGeometry([{x:a.x+(b.x-a.x)*t0,z:a.z+(b.z-a.z)*t0},{x:a.x+(b.x-a.x)*t1,z:a.z+(b.z-a.z)*t1}],.18,.115));}}}
 // Edge markings are ribbons, not hundreds of separate mesh objects.
 const paintOffsets=roadOffsets(points,.82,true);
 for(const edge of [paintOffsets.map(o=>o.left),paintOffsets.map(o=>o.right)])addBatch('white',ribbonGeometry(edge,.045,.105,true));
 // Extrude every retained footprint, preserving courtyards and other polygon holes.
 const buildingFootprints=[];
 for(const f of map.features){if(!f.tags.building)continue;for(const rings of f.polygons){const b=polygonBounds(rings),cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2;if(!isInBounds(cx,cz,bounds,10))continue;buildingFootprints.push(rings);
   const stand=f.tags.building==='grandstand',pit=/palazzina box/i.test(f.tags.name||''),recorded=parseFloat(f.tags.height),levels=parseFloat(f.tags['building:levels']);const height=Number.isFinite(recorded)?Math.max(.25,Math.min(4,recorded/10)):Number.isFinite(levels)?Math.max(.3,Math.min(3,levels*.3)):stand?.7:pit?1.3:.7;
   const shape=shapeFor(rings),body=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,steps:1});body.rotateX(-Math.PI/2);addBatch('walls',body);
   const roof=new THREE.ShapeGeometry(shape);roof.rotateX(-Math.PI/2);roof.translate(0,height+.015,0);addBatch(stand?'roofs':f.tags['roof:shape']==='gabled'?'tileRoof':'roofs',roof);
   const ring=rings[0];let longest=0,fa,fb;for(let i=1;i<ring.length;i++){const length=Math.hypot(ring[i].x-ring[i-1].x,ring[i].z-ring[i-1].z);if(length>longest){longest=length;fa=ring[i-1];fb=ring[i];}}
   if(!fa)continue;const angle=Math.atan2(fb.x-fa.x,fb.z-fa.z),dx=(fb.x-fa.x)/longest,dz=(fb.z-fa.z)/longest;
   if(!stand&&!pit&&(f.tags['roof:shape']==='gabled'||['house','residential','detached'].includes(f.tags.building))){const gable=gabledRoof(rings,height+.02,dx,dz);if(gable)addBatch('tileRoof',gable);}
   if(pit){for(let k=.7;k<longest-.5;k+=1.2){const x=fa.x+dx*k,z=fa.z+dz*k;batchBox('glass',.07,.48,.8,x,.48,z,angle);batchBox('metal',.12,.09,.86,x,.83,z,angle);}batchBox('metal',.1,.16,longest,cx,height+.1,cz,angle);}
   else if(stand){const width=Math.max(.7,Math.min(3.4,(b.maxX-b.minX)*(b.maxZ-b.minZ)/longest));for(let row=0;row<4;row++){const across=(row-1.5)*width/5;batchBox(row%2?'white':'seats',width/6,.07,longest*.9,cx+dz*across,height+.07+row*.1,cz-dx*across,angle);}for(const k of [-.4,.4])batchBox('metal',.08,height+.7,.08,cx+dx*longest*k,height/2+.35,cz+dz*longest*k);}
  }}
 // Low guardrails follow the real route and are batched with the track furniture.
 const barrierOffsets=roadOffsets(points,2.35,true);
 for(const edge of [barrierOffsets.map(o=>o.left),barrierOffsets.map(o=>o.right)])for(let i=1;i<edge.length;i++){const a=edge[i-1],b=edge[i],length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.1)continue;batchBox('metal',.045,.15,length,(a.x+b.x)/2,.25,(a.z+b.z)/2,Math.atan2(b.x-a.x,b.z-a.z));}
 const start=points[0],tangent=Math.atan2(points[1].x-start.x,points[1].z-start.z);for(let i=0;i<8;i++)for(let j=0;j<2;j++){const offset=(i-3.5)*.23;batchBox((i+j)%2?'white':'road',.23,.02,.3,start.x+Math.cos(tangent)*offset,.14,start.z-Math.sin(tangent)*offset+j*.3,tangent);}
 // Small procedural start gantry and car are illustrative scene furniture.
 batchBox('metal',3.2,.32,.24,start.x,1.7,start.z+.6);for(const x of [-1.55,1.55])batchBox('metal',.06,1.7,.06,start.x+x,.85,start.z+.6);
 for(const [name,parts] of batches){if(!parts.length)continue;const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());const m=new THREE.Mesh(geometry,materials[name]);m.receiveShadow=true;m.castShadow=['walls','roofs','metal','seats'].includes(name);world.add(m);}
 const trees=generateWoodland(map,points,mobile?900:1500),leafMap=foliageTexture(),leafMaterial=mat(0xffffff,{map:leafMap}),dummy=new THREE.Object3D(),random=seededRandom(36);
 for(let type=0;type<3;type++){const selected=trees.filter(t=>t.type===type);if(!selected.length)continue;const foliage=new THREE.InstancedMesh(crownGeometry(type),leafMaterial,selected.length);selected.forEach((t,i)=>{dummy.position.set(t.x,0,t.z);dummy.rotation.y=t.rotation;dummy.scale.set(t.radius,t.height/1.65,t.radius);dummy.updateMatrix();foliage.setMatrixAt(i,dummy.matrix);foliage.setColorAt(i,new THREE.Color().setHSL(.23+t.tint*.04,.22+t.tint*.14,.25+t.tint*.12));});foliage.castShadow=foliage.receiveShadow=true;world.add(foliage);}
 const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.04,.08,1,5),materials.bark,trees.length);trees.forEach((t,i)=>{dummy.position.set(t.x,t.height*.2,t.z);dummy.rotation.set(0,t.rotation,0);dummy.scale.set(1,t.height*.4,1);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);});world.add(trunks);
 const bushes=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),mat(0x758657),Math.min(240,trees.length));for(let i=0;i<bushes.count;i++){const t=trees[i];dummy.position.set(t.x+.3,.18,t.z);dummy.rotation.set(0,random()*6,0);dummy.scale.set(.5,.22,.5);dummy.updateMatrix();bushes.setMatrixAt(i,dummy.matrix);}bushes.receiveShadow=true;world.add(bushes);
 const car=new THREE.Group(),carMaterials={red:mat(0xcc4934),dark:mat(0x25332e),cream:mat(0xded6bd)};
 function carBox(w,h,d,name,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),carMaterials[name]);m.position.set(x,y,z);m.castShadow=true;car.add(m);}
 carBox(.5,.18,1.5,'red',0,.22,0);carBox(.2,.12,.8,'red',0,.17,.8);carBox(.85,.06,.22,'dark',0,.15,1.15);carBox(.8,.06,.25,'dark',0,.4,-.7);carBox(.22,.12,.3,'cream',0,.34,-.1);for(const x of [-.36,.36])for(const z of [-.5,.55])carBox(.18,.26,.35,'dark',x,.17,z);world.add(car);
 const pins=circuitLocations.map(location=>({location,position:new THREE.Vector3(points[location.index].x,1.6,points[location.index].z)}));
 const selection=new THREE.Mesh(new THREE.RingGeometry(2.7,2.95,48),new THREE.MeshBasicMaterial({color:0xdfad65,side:THREE.DoubleSide,transparent:true,opacity:.9}));selection.rotation.x=-Math.PI/2;selection.position.y=.16;selection.visible=false;world.add(selection);
 const fittedBounds=new THREE.Box3(new THREE.Vector3(bounds.minX,0,bounds.minZ),new THREE.Vector3(bounds.maxX,4,bounds.maxZ));
 world.userData={trees:trees.length,buildings:buildingFootprints.length,mapFeatures:map.features.length};
 return {world,path,points,car,pins,selection,bounds:fittedBounds,trees,map,groundColor,ownedMaterials:Object.values(materials)};
}
