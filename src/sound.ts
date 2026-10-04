import type {ShapeId} from './collection';
export class SquishySound {
  enabled=false;
  private context:AudioContext|undefined;
  private noise:AudioBuffer|undefined;
  private master:GainNode|undefined;
  private sources=new Set<AudioBufferSourceNode>();
  private lastPulse=-1;
  private wasPressed=false;
  private releasedAt=-10;
  async enable(){
    try{
      if(!this.context){
        const Audio=window.AudioContext??(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
        this.context=new Audio();this.master=this.context.createGain();this.master.gain.value=.28;this.master.connect(this.context.destination);
        this.noise=this.context.createBuffer(1,this.context.sampleRate,this.context.sampleRate);const samples=this.noise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
      }
      await this.context.resume();this.enabled=this.context.state==='running';return this.enabled;
    }catch{this.enabled=false;return false;}
  }
  async disable(){this.enabled=false;this.quiet();await this.context?.suspend().catch(()=>{});}
  quiet(){for(const source of this.sources){try{source.stop();}catch{/* Already ended. */}}this.sources.clear();this.wasPressed=false;this.releasedAt=-10;}
  resume(){if(this.enabled)void this.context?.resume().catch(()=>{});}
  update(shape:ShapeId,pressure:number){
    const ctx=this.context;if(!this.enabled||!ctx||ctx.state!=='running'||document.hidden)return;
    const now=ctx.currentTime,pressed=pressure>0;
    if(this.wasPressed&&!pressed)this.releasedAt=now;this.wasPressed=pressed;
    const tail=!pressed&&now-this.releasedAt<.55;
    if(!pressed&&!tail)return;
    const intensity=Math.min(1,Math.max(0,pressure));
    if(now-this.lastPulse<(pressed?.19-.09*intensity:.16))return;this.lastPulse=now;
    const crisp=shape==='peanut',source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=this.noise!;source.playbackRate.value=.8+Math.random()*.5;
    filter.type=crisp?'bandpass':'lowpass';filter.frequency.value=(crisp?2400:shape==='cube'?1900:shape==='chocolate'||shape==='cheese'?1600:1000)*( .8+Math.random()*.4);filter.Q.value=crisp?.8:.5;
    const duration=crisp?.035+Math.random()*.025:.055+Math.random()*.035,peak=pressed?(.035+.15*intensity)*(crisp?1.2:1):.025*(1-(now-this.releasedAt)/.55);
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(peak,now+.003);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    source.connect(filter);filter.connect(gain);gain.connect(this.master!);this.sources.add(source);
    source.onended=()=>{this.sources.delete(source);source.disconnect();filter.disconnect();gain.disconnect();};source.start(now,Math.random()*.7);source.stop(now+duration+.005);
  }
}
