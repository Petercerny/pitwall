// Metres above the local datum, converted to the scene's metres / 10 scale.
export function createTerrainSampler(data,project){
 const nw=project([data.bbox[0],data.bbox[3]]),se=project([data.bbox[2],data.bbox[1]]),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const smooth=v=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
 function elevation(x,z){
  const u=clamp((x-nw.x)/(se.x-nw.x),0,1)*(data.columns-1),v=clamp((z-nw.z)/(se.z-nw.z),0,1)*(data.rows-1),c=Math.min(data.columns-2,Math.floor(u)),r=Math.min(data.rows-2,Math.floor(v)),a=u-c,b=v-r;
  const h=(col,row)=>data.heights[row*data.columns+col];
  return (h(c,r)*(1-a)+h(c+1,r)*a)*(1-b)+(h(c,r+1)*(1-a)+h(c+1,r+1)*a)*b;
 }
 // Blend the snapshot edge into the paper-coloured infinite floor.
 function height(x,z){const edge=Math.min(x-nw.x,se.x-x,z-nw.z,se.z-z);return (elevation(x,z)-data.minimum)/10*smooth(edge/12);}
 return {height,elevation,maximum:(data.maximum-data.minimum)/10,bounds:{minX:nw.x,maxX:se.x,minZ:nw.z,maxZ:se.z}};
}
export function drapeGeometry(geometry,height){const p=geometry.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+height(p.getX(i),p.getZ(i)));p.needsUpdate=true;geometry.computeVertexNormals();return geometry;}
export function subdivideLine(points,spacing=3){const result=[points[0]];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/spacing));for(let j=1;j<=steps;j++)result.push({x:a.x+(b.x-a.x)*j/steps,z:a.z+(b.z-a.z)*j/steps});}return result;}
