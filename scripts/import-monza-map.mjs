import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import osmtogeojson from 'osmtogeojson';
const require=createRequire(import.meta.url);
const {DOMParser}=require(require.resolve('@xmldom/xmldom',{paths:[path.dirname(require.resolve('osmtogeojson'))]}));
const root=fileURLToPath(new URL('../',import.meta.url));
const bbox=[9.2768,45.6091,9.3008,45.6341];
const source=`https://www.openstreetmap.org/api/0.6/map?bbox=${bbox.join(',')}`;
const input=process.argv.indexOf('--input');
let xml;
if(input>=0){if(!process.argv[input+1])throw Error('Provide an OSM XML file after --input');xml=fs.readFileSync(path.resolve(process.argv[input+1]),'utf8');}
else {const response=await fetch(source,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error(`OSM download failed: ${response.status}`);xml=await response.text();}
if(!xml.includes('<osm '))throw Error('The response is not an OpenStreetMap XML snapshot');
const doc=new DOMParser().parseFromString(xml,'text/xml');
const converted=osmtogeojson(doc,{flatProperties:true});
const features=converted.features.filter(f=>{
 const p=f.properties;if(p.tainted||!f.geometry)return false;
 const wanted=p.building||p.highway||['forest','grass','meadow','recreation_ground'].includes(p.landuse)||['wood','scrub','water'].includes(p.natural)||['grandstand','bridge'].includes(p.man_made)||p.surface==='gravel'||p.amenity==='parking';
 return wanted&&['Polygon','MultiPolygon','LineString','MultiLineString'].includes(f.geometry.type);
}).map(f=>({...f,properties:Object.fromEntries(Object.entries(f.properties).filter(([key])=>/^(id|name(:en)?|building(:levels)?|height|roof:shape|landuse|natural|highway|disused:highway|surface|service|man_made|amenity|area|historic|leisure)$/.test(key))),geometry:{...f.geometry,coordinates:round(f.geometry.coordinates)}}));
function round(value){return typeof value==='number'?Math.round(value*1e7)/1e7:value.map(round);}
const collection={type:'FeatureCollection',bbox,metadata:{source,retrievedAt:new Date().toISOString(),attribution:'© OpenStreetMap contributors',license:'ODbL 1.0',licenseUrl:'https://www.openstreetmap.org/copyright',notes:'Map footprints and land cover are geographic data; inferred heights and architectural details are approximate.'},features};
if(features.filter(f=>f.properties.building).length<10||features.filter(f=>f.properties.natural==='wood'||f.properties.landuse==='forest').length<1)throw Error('The snapshot lacks the building/woodland coverage needed for the scene');
const output=path.join(root,'src/data/monza-surroundings.json');fs.writeFileSync(output,JSON.stringify(collection)+'\n');
fs.writeFileSync(path.join(root,'src/data/monza-map-source.json'),JSON.stringify(collection.metadata,null,2)+'\n');
const publicOutput=path.join(root,'public/maps');fs.mkdirSync(publicOutput,{recursive:true});fs.writeFileSync(path.join(publicOutput,'monza-surroundings.geojson'),JSON.stringify(collection)+'\n');
console.log(JSON.stringify({output,features:features.length,buildings:features.filter(f=>f.properties.building).length,woodlands:features.filter(f=>f.properties.natural==='wood'||f.properties.landuse==='forest').length,roads:features.filter(f=>f.properties.highway).length,bytes:fs.statSync(output).size}));
