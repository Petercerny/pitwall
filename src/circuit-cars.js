import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

function carGeometry(detailed){
 const parts={body:[],carbon:[],metal:[],accent:[]};
 function add(name,g,x=0,y=0,z=0){g.translate(x,y,z);const flat=g.index?g.toNonIndexed():g.clone();g.dispose();parts[name].push(flat);}
 function box(name,w,h,d,x,y,z){add(name,new THREE.BoxGeometry(w,h,d),x,y,z);}
 function shape(name,vertices,depth,y,z=0){const s=new THREE.Shape(vertices.map(([x,v])=>new THREE.Vector2(x,v))),g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false});g.rotateX(-Math.PI/2);add(name,g,0,y,z);}
 // 5.5m long, 2m wide. Nose points along local +z.
 shape('body',[[-.045,-.17],[-.058,.05],[-.023,.19],[.023,.19],[.058,.05],[.045,-.17]],.035,.027);
 box('carbon',.135,.01,.31,0,.023,-.025);
 for(const side of [-1,1]){
  shape('body',[[side*.04,-.12],[side*.065,-.04],[side*.07,.04],[side*.039,.07]],.035,.036);
  for(const z of [-.16,.145]){const wheel=new THREE.CylinderGeometry(.036,.036,.034,detailed?20:8,1);wheel.rotateZ(Math.PI/2);add('carbon',wheel,side*.079,.036,z);}
 }
 box('body',.025,.045,.13,0,.072,-.10);
 box('carbon',.055,.018,.09,0,.069,-.005);
 box('accent',.19,.008,.046,0,.026,.225);
 box('accent',.16,.009,.045,0,.107,-.23);
 if(detailed){
  for(const x of [-.081,.081]){box('body',.008,.055,.054,x,.092,-.23);box('carbon',.005,.025,.065,x,.033,.225);}
  for(const y of [.04,.049])box('carbon',.18,.004,.025,0,y,.225);
  box('carbon',.145,.005,.035,0,.09,-.225);
  for(const x of [-.037,.037])box('metal',.004,.044,.007,x,.075,-.22);
  const helmet=new THREE.SphereGeometry(.013,10,6);add('accent',helmet,0,.088,-.01);
  const halo=new THREE.TorusGeometry(.031,.004,5,16,Math.PI*1.8);halo.rotateX(Math.PI/2);add('metal',halo,0,.094,-.002);box('metal',.005,.029,.008,0,.083,.028);
  for(const side of [-1,1])for(const z of [-.16,.145])for(const dz of [-.025,.025]){
   const a=new THREE.Vector3(side*.034,.047,z+dz),b=new THREE.Vector3(side*.078,.04,z),g=new THREE.CylinderGeometry(.002,.002,a.distanceTo(b),5);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()));add('metal',g,(a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);
  }
  for(const side of [-1,1])for(const z of [-.16,.145]){const hub=new THREE.CylinderGeometry(.017,.017,.035,10);hub.rotateZ(Math.PI/2);add('metal',hub,side*.079,.036,z);}
 }
 const result={};for(const [name,list] of Object.entries(parts)){if(list.length){result[name]=mergeGeometries(list);list.forEach(g=>g.dispose());}}
 return result;
}

export function createCarAssets(){
 const geometry={near:carGeometry(true),far:carGeometry(false)},materials={body:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.38,metalness:.15}),accent:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.4}),carbon:new THREE.MeshStandardMaterial({color:0x222b2b,roughness:.85}),metal:new THREE.MeshStandardMaterial({color:0x8f999a,metalness:.5,roughness:.4})};
 return {geometry,materials};
}
export function createIllustrativeCar(assets){const group=new THREE.Group();for(const [name,g] of Object.entries(assets.geometry.near)){const material=['body','accent'].includes(name)?assets.materials[name].clone():assets.materials[name];if(name==='body')material.color.set('#cc4934');if(name==='accent')material.color.set('#ded6bd');const mesh=new THREE.Mesh(g,material);mesh.castShadow=true;group.add(mesh);}return group;}

export function createCarFleet(assets,capacity=24){
 const group=new THREE.Group(),meshes={},dummy=new THREE.Object3D(),position=new THREE.Vector3();
 for(const lod of ['near','far']){meshes[lod]={};for(const [name,g] of Object.entries(assets.geometry[lod])){const mesh=new THREE.InstancedMesh(g,assets.materials[name],capacity);mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=lod==='near';meshes[lod][name]=mesh;group.add(mesh);}}
 function update(cars,camera,groundHeight,highlighted,followId){
  const counts={near:0,far:0},nearIds=cars.filter(c=>c.id===followId||camera.position.distanceTo(new THREE.Vector3(c.x,groundHeight(c.x,c.z),c.z))<25).sort((a,b)=>Number(b.id===followId)-Number(a.id===followId)||camera.position.distanceToSquared(new THREE.Vector3(a.x,groundHeight(a.x,a.z),a.z))-camera.position.distanceToSquared(new THREE.Vector3(b.x,groundHeight(b.x,b.z),b.z))).slice(0,4).map(c=>c.id);
  for(const car of cars.slice(0,capacity)){
   const height=groundHeight(car.x,car.z);position.set(car.x,height,car.z);const lod=nearIds.includes(car.id)?'near':'far',index=counts[lod]++;
   const angle=car.angle||0,dx=Math.sin(angle)*.12,dz=Math.cos(angle)*.12,slope=-Math.atan2(groundHeight(car.x+dx,car.z+dz)-groundHeight(car.x-dx,car.z-dz),.24);
   dummy.position.copy(position);dummy.position.y+=.105;dummy.rotation.set(slope,angle,0,'YXZ');dummy.scale.setScalar(1);dummy.updateMatrix();
   const selected=highlighted.includes(car.id),body=new THREE.Color(car.color||'#cc4934');if(!selected)body.lerp(new THREE.Color('#8c9681'),.65);
   const accent=new THREE.Color(selected?'#fff0c4':'#717d70');
   for(const [name,m] of Object.entries(meshes[lod])){m.setMatrixAt(index,dummy.matrix);m.setColorAt(index,name==='body'?body:name==='accent'?accent:new THREE.Color(selected?'#ffffff':'#899487'));}
  }
  for(const lod of ['near','far'])for(const m of Object.values(meshes[lod])){m.count=counts[lod];m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
 }
 return {group,update};
}
