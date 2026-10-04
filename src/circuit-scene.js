import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {sampleCircuit} from './circuit-layout.js';
import {createMonzaWorld} from './circuit-landscape.js';
export {createMonzaWorld} from './circuit-landscape.js';

const aerialDirection=new THREE.Vector3(1,.95,.55).normalize();
const locationRanges={rettifilo:[2,14],lesmo:[47,65],ascari:[74,92],alboreto:[95,117],pits:[0,0]};
export function fitPerspective(camera,bounds,direction=aerialDirection){
 const target=bounds.getCenter(new THREE.Vector3()),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize();
 const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),tanH=tanV*camera.aspect;let distance=1;
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const p=new THREE.Vector3(x,y,z).sub(target);distance=Math.max(distance,p.dot(direction)+Math.abs(p.dot(right))/tanH*1.06,p.dot(direction)+Math.abs(p.dot(up))/tanV*1.06);}
 return {target,position:target.clone().addScaledVector(direction,distance)};
}
export function mountMonza(container,{onSelect,onProgress,onReady,onError}){
 let renderer,disposed=false,lostContext=false,frame=null;
 try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});}catch{onError('Interactive 3D is unavailable on this device. You can still explore the circuit locations below.');return null;}
 const scene=new THREE.Scene(),perspective=new THREE.PerspectiveCamera(32,1,.5,2200),plan=new THREE.OrthographicCamera(-150,150,150,-150,.5,2200);
 let camera=perspective;
 let model;try{model=createMonzaWorld({mobile:container.clientWidth<600});}catch{renderer.dispose();onError('The 3D landscape could not load. You can still explore the circuit outline and locations below.');return null;}scene.add(model.world);
 scene.background=new THREE.Color(model.groundColor);scene.fog=new THREE.Fog(model.groundColor,650,1350);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
 renderer.domElement.setAttribute('aria-label','Interactive aerial Monza circuit. Drag to rotate; pinch or scroll to zoom. Use the location buttons for keyboard navigation.');renderer.domElement.setAttribute('role','img');container.appendChild(renderer.domElement);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.1;controls.enablePan=false;controls.minZoom=.65;controls.maxZoom=5;controls.minDistance=15;controls.maxDistance=1800;controls.minPolarAngle=.001;controls.maxPolarAngle=Math.PI*.43;
 const sky=new THREE.HemisphereLight(0xdce8ee,0x757752,1.4);scene.add(sky);
 const sun=new THREE.DirectionalLight(0xffdaa3,3.1);sun.position.set(-210,145,105);sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-230,right:230,top:230,bottom:-230,near:1,far:650});sun.shadow.normalBias=.12;sun.shadow.bias=-.00015;scene.add(sun);
 const labels=model.pins.map(pin=>{const b=document.createElement('button');b.type='button';b.className='circuit-pin';b.textContent=pin.location.number;b.setAttribute('aria-label',`Explore ${pin.location.name}`);b.addEventListener('click',()=>onSelect(pin.location.id));container.appendChild(b);return {...pin,button:b};});
 let width=1,height=1,needsRender=true,playing=false,progress=0,previous=performance.now(),transition=null,visible=true,lastProgressUpdate=0,mode='overview',selectedId=null,mobilePreset=null,renderCount=0;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const animatedMeshes=[];model.world.traverse(o=>{if(o.isInstancedMesh){o.userData.fullCount=o.count;animatedMeshes.push(o);}});
 function detailBounds(id){const [start,end]=locationRanges[id],b=new THREE.Box3();for(const p of model.points.slice(start,end+1))b.expandByPoint(new THREE.Vector3(p.x,0,p.z));if(id==='pits'){b.min.add(new THREE.Vector3(-12,0,-18));b.max.add(new THREE.Vector3(15,3,18));}else b.expandByScalar(id==='lesmo'?9:6);return b;}
 function activate(next){camera=next;controls.object=next;controls.update();container.dataset.camera=next.isPerspectiveCamera?'perspective':'orthographic';}
 function setPose(pose,immediate=false){camera.zoom=1;camera.updateProjectionMatrix();if(immediate||reduced.matches){transition=null;camera.position.copy(pose.position);controls.target.copy(pose.target);camera.lookAt(pose.target);controls.update();needsRender=true;}else transition={from:camera.position.clone(),to:pose.position,targetFrom:controls.target.clone(),targetTo:pose.target,start:performance.now()};}
 function fitPlan(){const center=model.bounds.getCenter(new THREE.Vector3()),size=model.bounds.getSize(new THREE.Vector3()),span=Math.max(size.z/2,size.x/2*height/width)*1.1;plan.left=-span*width/height;plan.right=span*width/height;plan.top=span;plan.bottom=-span;plan.updateProjectionMatrix();return {target:center,position:center.clone().add(new THREE.Vector3(0,450,.01))};}
 function resize(){if(disposed)return;width=Math.max(1,container.clientWidth);height=Math.max(1,container.clientHeight);renderer.setSize(width,height);perspective.aspect=width/height;perspective.updateProjectionMatrix();const mobile=width<600;renderer.setPixelRatio(Math.min(window.devicePixelRatio,mobile?1:1.5));if(mobilePreset!==mobile){mobilePreset=mobile;const shadow=mobile?1024:2048;sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(shadow,shadow);const density=mobile?Math.min(1,900/model.trees.length):1;for(const o of animatedMeshes)o.count=Math.round(o.userData.fullCount*density);container.dataset.quality=mobile?'mobile':'desktop';}
  if(mode==='plan'){activate(plan);setPose(fitPlan(),true);}else{activate(perspective);setPose(fitPerspective(perspective,mode==='detail'?detailBounds(selectedId):model.bounds),true);}needsRender=true;
 }
 function placeCar(){const p=sampleCircuit(model.path,progress);model.car.position.set(p.x,.12,p.z);model.car.rotation.y=p.angle;}
 function render(){if(lostContext)return;renderer.render(scene,camera);renderCount++;
  const occupied=[],ordered=[...labels].sort((a,b)=>Number(b.location.id===selectedId)-Number(a.location.id===selectedId)||Number(b.button===document.activeElement)-Number(a.button===document.activeElement));
  for(const pin of ordered){const v=pin.position.clone().project(camera),x=(v.x*.5+.5)*width,y=(-v.y*.5+.5)*height;const outside=x<24||x>width-24||y<28||y>height-65||v.z< -1||v.z>1;const collides=occupied.some(p=>Math.abs(x-p.x)<44&&Math.abs(y-p.y)<44);pin.button.hidden=outside||collides;if(!pin.button.hidden){occupied.push({x,y});pin.button.style.left=`${x}px`;pin.button.style.top=`${y}px`;}}
  container.dataset.drawCalls=renderer.info.render.calls;container.dataset.triangles=renderer.info.render.triangles;container.dataset.renders=renderCount;container.dataset.treeCount=animatedMeshes.filter(o=>o.material.map&&o.geometry.type!=='CylinderGeometry').reduce((n,o)=>n+o.count,0);needsRender=false;
 }
 function animate(now){if(disposed||lostContext)return;frame=requestAnimationFrame(animate);const dt=Math.min((now-previous)/1000,.1);previous=now;if(!visible||document.hidden)return;
  if(playing){progress=(progress+dt/55)%1;placeCar();needsRender=true;if(now-lastProgressUpdate>150){onProgress(Math.round(progress*100));lastProgressUpdate=now;}}
  if(transition){const t=Math.min(1,(now-transition.start)/850),e=t*t*(3-2*t);camera.position.lerpVectors(transition.from,transition.to,e);controls.target.lerpVectors(transition.targetFrom,transition.targetTo,e);needsRender=true;if(t===1)transition=null;}
  controls.update();if(needsRender)render();
 }
 const changed=()=>{needsRender=true;},started=()=>{transition=null;};controls.addEventListener('change',changed);controls.addEventListener('start',started);
 const observer=new ResizeObserver(resize);observer.observe(container);const visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;needsRender=true;});visibility.observe(container);
 const lost=e=>{e.preventDefault();lostContext=true;playing=false;cancelAnimationFrame(frame);labels.forEach(p=>p.button.hidden=true);onError('The 3D view was interrupted. Reload the page to restore it, or use the circuit outline and locations.');};renderer.domElement.addEventListener('webglcontextlost',lost);
 const modeChanged=()=>{if(reduced.matches&&transition){setPose({position:transition.to,target:transition.targetTo},true);}};reduced.addEventListener('change',modeChanged);
 resize();placeCar();render();frame=requestAnimationFrame(animate);onReady();
 return {
  select(id){if(lostContext)return;const pin=model.pins.find(p=>p.location.id===id);if(!pin)return;selectedId=id;mode='detail';model.selection.visible=true;model.selection.position.set(pin.position.x,.16,pin.position.z);labels.forEach(p=>p.button.setAttribute('aria-pressed',String(p.location.id===id)));activate(perspective);setPose(fitPerspective(perspective,detailBounds(id)));needsRender=true;},
  overview(){if(lostContext)return;mode='overview';selectedId=null;model.selection.visible=false;labels.forEach(p=>p.button.setAttribute('aria-pressed','false'));activate(perspective);setPose(fitPerspective(perspective,model.bounds));},
  overhead(){if(lostContext)return;mode='plan';activate(plan);setPose(fitPlan());},
  setProgress(value){progress=Math.max(0,Math.min(100,value))/100;placeCar();needsRender=true;},
  setPlaying(value){playing=value&&!lostContext;},
  zoom(delta){if(lostContext)return;transition=null;camera.zoom=THREE.MathUtils.clamp(camera.zoom*delta,.65,5);camera.updateProjectionMatrix();needsRender=true;},
  destroy(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();visibility.disconnect();reduced.removeEventListener('change',modeChanged);controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',lost);labels.forEach(p=>p.button.remove());const geometries=new Set(),materials=new Set(model.ownedMaterials),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));if(o.isInstancedMesh)o.dispose();});for(const m of materials){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());sun.shadow.map?.dispose();renderer.dispose();renderer.domElement.remove();}
 };
}
