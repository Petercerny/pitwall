// Offline elevation import: node scripts/import-monza-terrain.mjs
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {execFileSync} from 'node:child_process';
const bbox=[9.2768,45.6091,9.3008,45.6341],zoom=14,n=2**zoom,columns=49,rows=73;
const tilePoint=(lon,lat)=>[(lon+180)/360*n,(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n];
const tiles=new Map(),urls=[];
await fs.mkdir('archive/maps/terrain',{recursive:true});
for(let x=8614;x<=8615;x++)for(let y=5852;y<=5854;y++){
 const url=`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${x}/${y}.png`,file=`archive/maps/terrain/${zoom}-${x}-${y}.png`;
 try{await fs.access(file);}catch{execFileSync('curl.exe',['--ssl-no-revoke','-sS','--fail','--max-time','30',url,'-o',file]);}
 const {data,info}=await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject:true});
 if(info.width!==256||info.height!==256)throw new Error('Unexpected elevation tile size');
 tiles.set(`${x}/${y}`,data);urls.push(url);
}
function sample(lon,lat){const [x,y]=tilePoint(lon,lat),tx=Math.floor(x),ty=Math.floor(y),data=tiles.get(`${tx}/${ty}`),px=Math.min(255,Math.floor((x-tx)*256)),py=Math.min(255,Math.floor((y-ty)*256)),i=(py*256+px)*3;return data[i]*256+data[i+1]+data[i+2]/256-32768;}
// Modest 3x3 filter limits vegetation/building artefacts in the regional DEM.
const heights=[];
for(let r=0;r<rows;r++)for(let c=0;c<columns;c++){
 const lon=bbox[0]+(bbox[2]-bbox[0])*c/(columns-1),lat=bbox[3]-(bbox[3]-bbox[1])*r/(rows-1);let sum=0,weight=0;
 for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const w=(a===0?2:1)*(b===0?2:1);sum+=sample(lon+a*.00015,lat+b*.0001)*w;weight+=w;}
 heights.push(Math.round(sum/weight*100)/100);
}
if(heights.some(h=>!Number.isFinite(h)||h<100||h>300))throw new Error('Invalid Monza elevation values');
const result={bbox,columns,rows,heights,minimum:Math.min(...heights),maximum:Math.max(...heights),retrievedAt:new Date().toISOString(),source:'AWS Terrain Tiles / Tilezen',urls,attribution:'Europe terrain produced using Copernicus data and information funded by the European Union (EU-DEM); SRTM data courtesy of the US Geological Survey.',processing:'Zoom 14 Terrarium tiles, 3x3 weighted smoothing, sampled approximately every 39 metres. Native source resolution may be coarser. No vertical exaggeration.'};
await fs.writeFile('src/data/monza-terrain.json',JSON.stringify(result));
console.log(`Elevation: ${result.minimum}–${result.maximum} metres; ${columns}×${rows} samples`);
