'use client';
import React,{useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Maximize2,Pause,Play,Plus,Minus,RotateCcw} from 'lucide-react';
import data from './data/monza-circuit.json';
import mapSource from './data/monza-map-source.json';
import CircuitPlayback from './CircuitPlayback';
import {projectCircuit,circuitLocations} from './circuit-layout';
const outline=projectCircuit(data.features[0].geometry.coordinates);
function CircuitOutline(){return <svg viewBox="-95 -140 190 280" role="img" aria-label="Monza circuit outline"><polyline points={outline.map(p=>`${p.x},${p.z}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/></svg>;}
export default function CircuitExplorer({standalone=false,sessionId=null,sessionType=null}){
 const container=useRef(null),scene=useRef(null),[ready,setReady]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState(null),[progress,setProgress]=useState(0),[playing,setPlaying]=useState(false),[view,setView]=useState('overview');
 const selection=useRef(null),playbackController=useRef(null),transportTarget=useRef(null);const [playbackMode,setPlaybackMode]=useState('explore');const location=circuitLocations.find(p=>p.id===selected);
 function select(id){selection.current=id;setSelected(id);setView('detail');scene.current?.select(id);}
 useEffect(()=>{let alive=true;let instance;
  import('./circuit-scene').then(({mountMonza})=>{if(!alive)return;instance=mountMonza(container.current,{onPlaybackTime:t=>playbackController.current?.time(t),onPlaybackEnd:()=>playbackController.current?.end(),onFollowChange:id=>playbackController.current?.follow(id),onSelect:select,onProgress:p=>{if(alive)setProgress(p);},onReady:()=>{if(alive)setReady(true);},onError:message=>{if(alive){setError(message);setReady(false);setPlaying(false);}}});scene.current=instance;if(selection.current)instance?.select(selection.current);}).catch(()=>{if(alive)setError('The 3D view could not load. Explore the circuit outline and locations below.');});
  return()=>{alive=false;instance?.destroy();scene.current=null;};
 },[]);
 function overview(){setSelected(null);selection.current=null;setView('overview');scene.current?.overview();}
 function togglePlay(){const next=!playing;setPlaying(next);scene.current?.setPlaying(next);}
 return <section className={'circuit-explorer'+(standalone?' circuit-standalone':'')} id="circuit" aria-label="Explore Monza in 3D">
  <header className="circuit-heading"><div><span className="circuit-eyebrow">CIRCUIT EXPLORER / MONZA</span><h2>The circuit. The park. The atmosphere.</h2><p>A late-afternoon flight over the Temple of Speed.</p></div><span className="circuit-edition">01<span>MONZA, ITALY</span></span></header>
  <div className="circuit-mode-tabs" aria-label="Circuit experience">{[['explore','Explore'],['compare','Compare laps'],['race','Race replay']].map(([id,label])=><button key={id} aria-pressed={playbackMode===id} disabled={id==='race'&&sessionType==='Q'} onClick={()=>{setPlaybackMode(id);setPlaying(false);scene.current?.setPlaying(false);}}>{label}</button>)}</div>
  <div className="circuit-stage"><div ref={container} className="circuit-canvas" data-ready={ready} aria-busy={!ready&&!error}/>
   {!ready&&<div className="circuit-fallback"><CircuitOutline/><span role="status">{error||'Growing the woodland. Preparing the circuit…'}</span></div>}
   <div className="circuit-caption"><span>45.62° N / 9.29° E</span><p>Monza, from above.</p><span>WESTERN SUN · LATE AFTERNOON</span></div>
   <div className="circuit-tools" aria-label="Camera controls"><button aria-label="Zoom in" disabled={!ready} onClick={()=>scene.current?.zoom(1.2)}><Plus size={17}/></button><button aria-label="Zoom out" disabled={!ready} onClick={()=>scene.current?.zoom(1/1.2)}><Minus size={17}/></button><button aria-label="Reset circuit camera" disabled={!ready} onClick={overview}><RotateCcw size={17}/></button></div>
   <div className="circuit-view-controls"><button aria-pressed={view==='overview'} onClick={overview} disabled={!ready}>Aerial view</button><button aria-pressed={view==='overhead'} disabled={!ready} onClick={()=>{setView('overhead');scene.current?.overhead();}}><Maximize2 size={13}/> Track plan</button></div>
   <div className="circuit-transport-slot" ref={transportTarget}/>
   <span className="circuit-gesture">Drag to orbit · scroll or pinch to zoom</span>
  </div>
  {playbackMode==='explore'&&<div className="circuit-tour"><button className="circuit-play" aria-label={playing?'Pause illustrative lap tour':'Play illustrative lap tour'} disabled={!ready} onClick={togglePlay}>{playing?<Pause size={18}/>:<Play size={18}/>}</button><label htmlFor="circuit-progress">Explore a lap <span>Illustrative tour · not race telemetry</span></label><input id="circuit-progress" aria-label="Illustrative lap progress" type="range" min="0" max="100" value={progress} disabled={!ready} onChange={e=>{const p=+e.target.value;setProgress(p);setPlaying(false);scene.current?.setPlaying(false);scene.current?.setProgress(p);}}/><output htmlFor="circuit-progress">{progress}%</output></div>}
  {playbackMode!=='explore'&&<CircuitPlayback mode={playbackMode} scene={scene} sceneReady={ready} sessionId={sessionId} onTimeController={playbackController} transportTarget={transportTarget}/>}
  <div className="circuit-discovery"><div className="circuit-location-list" aria-label="Circuit locations">{circuitLocations.map(p=><button key={p.id} aria-pressed={selected===p.id} onClick={()=>select(p.id)}><span>{p.number}</span>{p.name}<ArrowUpRight size={15}/></button>)}</div><article className="circuit-detail" aria-live="polite"><span className="circuit-eyebrow">{location?'THE CIRCUIT, EXPLAINED':'LOOK A LITTLE CLOSER'}</span><h3>{location?.tag??'There’s more here than a racing line.'}</h3><p>{location?.text??'Select a numbered location to move closer. Explore the chicanes, woodland curves and sweeping final corner that give Monza its character.'}</p><a href="https://www.monzanet.it/en/circuit/" target="_blank" rel="noreferrer">Explore Monza’s circuit guide ↗</a></article></div>
  <div className="circuit-source">Track: <a href="https://github.com/bacinger/f1-circuits" target="_blank" rel="noreferrer">Tomislav Bacinger / f1-circuits (MIT)</a>. Surroundings: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors (ODbL)</a> · snapshot {new Date(mapSource.retrievedAt).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Prague'})}. Elevation: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">AWS Terrain Tiles / Tilezen</a> · Europe terrain produced using Copernicus data and information funded by the European Union (EU-DEM); SRTM data courtesy of the US Geological Survey. Smoothed regional elevation, without vertical exaggeration; small embankments and historic banking are not resolved. Building heights without map measurements, architectural details and vegetation are approximate. No race positions are inferred. <a href="/maps/monza-surroundings.geojson" download>Download map snapshot ↗</a></div>
 </section>;
}
