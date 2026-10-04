// Local equirectangular projection, in metres / 10; east = +x, north = -z.
export function createCircuitProjection(coordinates) {
 const lon=(Math.min(...coordinates.map(p=>p[0]))+Math.max(...coordinates.map(p=>p[0])))/2;
 const lat=(Math.min(...coordinates.map(p=>p[1]))+Math.max(...coordinates.map(p=>p[1])))/2;
 return ([lng,latitude])=>({x:(lng-lon)*111320*Math.cos(lat*Math.PI/180)/10,z:-(latitude-lat)*111320/10});
}
export function projectCircuit(coordinates){return coordinates.map(createCircuitProjection(coordinates));}
export function pointInRing(x,z,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;}return inside;}
export function pointInPolygon(x,z,rings){return !!rings.length&&pointInRing(x,z,rings[0])&&!rings.slice(1).some(r=>pointInRing(x,z,r));}
export function seededRandom(seed=92371){let n=seed;return()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};}
// Bounded miter joins preserve tight corners without a spline changing the centreline.
export function roadOffsets(points,halfWidth,closed=false){
 const last=points.length-1;
 return points.map((p,i)=>{
  const a=points[i===0?(closed?last-1:0):i-1],b=points[i===last?(closed?1:last):i+1];
  let ax=p.x-a.x,az=p.z-a.z,bx=b.x-p.x,bz=b.z-p.z;let al=Math.hypot(ax,az),bl=Math.hypot(bx,bz);
  if(!al){ax=bx;az=bz;al=bl;}if(!bl){bx=ax;bz=az;bl=al;}
  const na={x:-az/(al||1),z:ax/(al||1)},nb={x:-bz/(bl||1),z:bx/(bl||1)};
  let mx=na.x+nb.x,mz=na.z+nb.z;const ml=Math.hypot(mx,mz)||1;mx/=ml;mz/=ml;
  const length=Math.min(halfWidth*1.8,halfWidth/Math.max(.1,mx*nb.x+mz*nb.z));
  return {left:{x:p.x+mx*length,z:p.z+mz*length},right:{x:p.x-mx*length,z:p.z-mz*length}};
 });
}
export function measureCircuit(points) {
 const cumulative=[0];for(let i=1;i<points.length;i++)cumulative.push(cumulative.at(-1)+Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z));
 return {points,cumulative,length:cumulative.at(-1)};
}
export function sampleCircuit(path,progress) {
 const distance=((progress%1)+1)%1*path.length;
 let i=1;while(i<path.cumulative.length-1&&path.cumulative[i]<distance)i++;
 const a=path.points[i-1],b=path.points[i],t=(distance-path.cumulative[i-1])/(path.cumulative[i]-path.cumulative[i-1]||1);
 return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,angle:Math.atan2(b.x-a.x,b.z-a.z)};
}
export function distanceToCircuit(x,z,points) {
 let min=Infinity;
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z;const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));min=Math.min(min,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));}
 return min;
}
export const circuitLocations=[
 {id:'rettifilo',index:7,number:'01',name:'Prima Variante',tag:'A straight becomes a braking zone',text:'The first chicane turns the long main straight into a tight right–left sequence. Explore the contrast between outright speed and precise positioning.'},
 {id:'lesmo',index:55,number:'02',name:'Lesmo curves',tag:'Two corners, one flowing rhythm',text:'Two right-hand corners sit in the woodland. The second leads into the run towards Ascari, so the exit is part of the next straight’s story.'},
 {id:'ascari',index:84,number:'03',name:'Variante Ascari',tag:'A change of direction through the park',text:'This left–right–left sequence breaks up the long straights. Follow the shape of the circuit and see how three direction changes fit together.'},
 {id:'alboreto',index:104,number:'04',name:'Curva Alboreto',tag:'The final arc back to the straight',text:'The sweeping final corner, also known as Parabolica, feeds the main straight. Its long arc is one of Monza’s most recognizable shapes.'},
 {id:'pits',index:0,number:'05',name:'Start / finish',tag:'Where one lap becomes the next',text:'The start / finish straight anchors the circuit. Nearby pit buildings and grandstands follow mapped footprints; garage fronts, seating and unrecorded heights are procedural approximations.'}
];
