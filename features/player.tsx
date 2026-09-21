'use client';
import {createContext,useContext,useRef,useState,useEffect,ReactNode} from 'react';
import {Play,Pause,SkipBack,SkipForward,Volume2,Disc3,ChevronUp} from 'lucide-react';
import {Slider} from '@/components/ui/slider';
import {toast} from 'sonner';
export type Track={id:string;title:string;artist:string;art:number;url:string;private?:boolean};
const Context=createContext<{play:(t:Track)=>void;track:Track|null;playing:boolean;clear:()=>void}>({play:()=>{},track:null,playing:false,clear:()=>{}});
export const usePlayer=()=>useContext(Context);
// Eight distinct dark-toned cover palettes — no external sprite required
const ART_PALETTES=[
  {bg:'#1a1020',layer:'radial-gradient(ellipse 80% 80% at 28% 38%,#58244a 0%,#1a1020 62%),radial-gradient(ellipse 50% 50% at 75% 78%,#2c1630 0%,transparent 55%)'},
  {bg:'#0d1e28',layer:'radial-gradient(ellipse 80% 80% at 62% 28%,#0d4060 0%,#0d1e28 62%),radial-gradient(ellipse 50% 50% at 20% 72%,#12263a 0%,transparent 55%)'},
  {bg:'#1c1c0c',layer:'radial-gradient(ellipse 80% 80% at 42% 62%,#3e3e0c 0%,#1c1c0c 62%),radial-gradient(ellipse 50% 50% at 80% 18%,#2c2c18 0%,transparent 55%)'},
  {bg:'#220c0e',layer:'radial-gradient(ellipse 80% 80% at 70% 38%,#520c16 0%,#220c0e 62%),radial-gradient(ellipse 50% 50% at 10% 80%,#2e1216 0%,transparent 55%)'},
  {bg:'#0c2016',layer:'radial-gradient(ellipse 80% 80% at 22% 52%,#0c4e22 0%,#0c2016 62%),radial-gradient(ellipse 50% 50% at 80% 20%,#16301e 0%,transparent 55%)'},
  {bg:'#1c0c20',layer:'radial-gradient(ellipse 80% 80% at 52% 28%,#440c54 0%,#1c0c20 62%),radial-gradient(ellipse 50% 50% at 18% 80%,#281030 0%,transparent 55%)'},
  {bg:'#201608',layer:'radial-gradient(ellipse 80% 80% at 30% 68%,#4e3808 0%,#201608 62%),radial-gradient(ellipse 50% 50% at 76% 22%,#302010 0%,transparent 55%)'},
  {bg:'#080e20',layer:'radial-gradient(ellipse 80% 80% at 60% 58%,#0a1c52 0%,#080e20 62%),radial-gradient(ellipse 50% 50% at 28% 18%,#10162c 0%,transparent 55%)'},
] as const;
export function Artwork({art,className=''}:{art:number;className?:string}){const p=ART_PALETTES[art%ART_PALETTES.length];return <div role="img" aria-label="Original demo cover artwork" className={`cover ${className}`} style={{background:`${p.layer},${p.bg}`}}/>}
const time=(s:number)=>`${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;

const INIT_VOL=0.7;

export function PlayerProvider({children}:{children:ReactNode}){
  const audio=useRef<HTMLAudioElement>(null);
  // trackRef keeps the current track for closures without stale-closure bugs
  const trackRef=useRef<Track|null>(null);
  // dragging ref prevents onTimeUpdate fighting with slider drag
  const dragging=useRef(false);

  const [track,setTrack]=useState<Track|null>(null);
  const [playing,setPlaying]=useState(false);
  const [pos,setPos]=useState(0);
  const [duration,setDuration]=useState(0);
  const [expanded,setExpanded]=useState(false);
  const [vol,setVol]=useState(INIT_VOL);

  // Bug fix #1: HTML audio element defaults to volume 1.0 (100%).
  // Set it to INIT_VOL on mount so first play isn't ear-splitting.
  useEffect(()=>{if(audio.current)audio.current.volume=INIT_VOL},[]);

  function play(t:Track){
    const a=audio.current;
    if(!a)return;
    if(t.id===trackRef.current?.id){
      if(a.paused)a.play().catch(()=>toast.error('Tap play again — audio could not start.'));
      else a.pause();
      return;
    }
    a.pause();
    setPlaying(false);
    trackRef.current=t;
    setTrack(t);
    setPos(0);
    setDuration(0);
    a.src=t.url;
    a.load();
    a.play().catch(()=>{setPlaying(false);toast.error('Audio unavailable. Try another track.');});
  }

  function clear(){
    const a=audio.current;
    if(a){a.pause();a.removeAttribute('src');a.load();}
    trackRef.current=null;
    setTrack(null);setPlaying(false);setPos(0);setDuration(0);
  }

  // Bug fix #3: use ref instead of closure to avoid stale track
  function handleError(){
    setPlaying(false);
    if(trackRef.current)toast.error('Audio unavailable. Try another track.');
  }

  return <Context.Provider value={{play,track,playing,clear}}>
    {children}
    <audio ref={audio}
      onPlay={()=>setPlaying(true)}
      onPause={()=>setPlaying(false)}
      onEnded={()=>setPlaying(false)}
      onTimeUpdate={()=>{
        // Bug fix #2: don't update pos while user is dragging seek bar
        if(!dragging.current)setPos(audio.current?.currentTime||0);
      }}
      onLoadedMetadata={()=>setDuration(audio.current?.duration||0)}
      onError={handleError}
    />
    <footer className={`player${expanded?' expanded':''}`}>
      <div className="now-playing">
        {track?<Artwork art={track.art}/>:<Disc3 size={34} className="player-idle-icon"/>}
        <div>
          <b>{track?.title||'nothing playing yet'}</b>
          <p>{track?.artist||'hit play when you\'re ready'}</p>
        </div>
      </div>
      <div className="playback">
        <div className="transport">
          <button aria-label="Restart track" disabled={!track} onClick={()=>{
            if(audio.current){audio.current.currentTime=0;setPos(0);}
          }}><SkipBack size={17}/></button>
          <button className="play-main" aria-label={playing?'Pause':'Play'} disabled={!track}
            onClick={()=>track&&play(track)}>
            {playing?<Pause size={17} fill="currentColor"/>:<Play size={17} fill="currentColor"/>}
          </button>
          <button aria-label="Skip forward 10 seconds" disabled={!track} onClick={()=>{
            if(audio.current){const next=Math.min(duration,pos+10);audio.current.currentTime=next;setPos(next);}
          }}><SkipForward size={17}/></button>
        </div>
        <div className="seek">
          <small>{time(pos)}</small>
          <Slider
            aria-label="Track position"
            value={[pos]}
            max={duration||1}
            step={.1}
            disabled={!duration}
            onValueChange={v=>{dragging.current=true;setPos(v[0]);}}
            onValueCommit={v=>{
              dragging.current=false;
              if(audio.current){audio.current.currentTime=v[0];setPos(v[0]);}
            }}
          />
          <small>{time(duration)}</small>
        </div>
      </div>
      <div className="volume">
        <Volume2 size={17}/>
        <Slider
          aria-label="Volume"
          value={[vol]}
          max={1}
          step={.01}
          onValueChange={v=>{setVol(v[0]);if(audio.current)audio.current.volume=v[0];}}
        />
      </div>
      <button className="expand-player" aria-label="Expand audio controls"
        onClick={()=>setExpanded(e=>!e)}><ChevronUp size={20}/></button>
    </footer>
  </Context.Provider>
}
