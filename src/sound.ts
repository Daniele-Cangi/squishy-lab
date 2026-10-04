import type {ShapeId} from './collection';

/** Pressure-responsive excerpts from the credited Pixabay recording. */
export class SquishySound {
  enabled=false;
  mode:'gel'|'crunchy'='gel';
  private recordings=new Map<string,AudioBuffer>();
  private context:AudioContext|undefined;
  private recording:AudioBuffer|undefined;
  private master:GainNode|undefined;
  private sources=new Set<AudioBufferSourceNode>();
  private generation=0;
  private nextPulse=0;
  private wasPressed=false;
  async enable(){
    const generation=++this.generation,mode=this.mode;
    try{
      if(!this.context){
        const Audio=window.AudioContext??(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
        this.context=new Audio();this.master=this.context.createGain();this.master.gain.value=.65;this.master.connect(this.context.destination);
      }
      // Resume inside the tap, before asynchronous download/decode (including iOS).
      void this.context.resume().catch(()=>{});
      this.recording=this.recordings.get(mode);
      if(!this.recording){
        const response=await fetch(mode==='gel'?'/audio/gel.mp3':'/audio/crinkle.mp3',{signal:AbortSignal.timeout(15000)});
        if(!response.ok)throw new Error('Recording unavailable');
        const recording=await this.context.decodeAudioData(await response.arrayBuffer());
        if(recording.duration<2)throw new Error('Recording too short');
        this.recordings.set(mode,recording);
        if(generation!==this.generation)return false;
        this.recording=recording;
      }
      if(generation!==this.generation)return false;
      this.enabled=true;return true;
    }catch{if(generation!==this.generation)return false;this.enabled=false;this.quiet();await this.context?.suspend().catch(()=>{});return false;}
  }
  get running(){return this.context?.state==='running';}
  preview(){
    if(!this.enabled||!this.running)return false;
    this.quiet();this.update('mochi',1);return true;
  }
  async disable(suspend=true){this.generation++;this.enabled=false;this.quiet();if(suspend)await this.context?.suspend().catch(()=>{});}
  quiet(){for(const source of this.sources){try{source.stop();}catch{/* Already ended. */}}this.sources.clear();this.wasPressed=false;this.nextPulse=0;}
  resume(){if(this.context)void this.context.resume().catch(()=>{});}
  update(shape:ShapeId,pressure:number){
    const ctx=this.context;if(!this.enabled||!ctx||!this.recording||ctx.state!=='running'||document.hidden)return;
    const now=ctx.currentTime,pressed=pressure>0,released=this.wasPressed&&!pressed;this.wasPressed=pressed;
    if(!pressed&&!released)return;
    if(pressed&&now<this.nextPulse)return;
    if(this.sources.size>=2)return;
    const intensity=Math.min(1,Math.max(0,pressure)),source=ctx.createBufferSource(),gain=ctx.createGain();
    const duration=released?.28:this.mode==='gel'?1.1+.25*intensity:.65+.18*intensity,rate=this.mode==='gel'?1:shape==='peanut'?1.04:.92;
    source.buffer=this.recording;source.playbackRate.value=rate;
    const peak=released?.12:.2+.5*intensity;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(peak,now+.035);
    gain.gain.setValueAtTime(peak,now+duration-.12);gain.gain.linearRampToValueAtTime(0,now+duration);
    source.connect(gain);gain.connect(this.master!);this.sources.add(source);
    source.onended=()=>{this.sources.delete(source);source.disconnect();gain.disconnect();};
    source.start(now,Math.random()*(this.recording.duration-duration*rate),duration*rate);
    this.nextPulse=now+duration-.08;
  }
}

