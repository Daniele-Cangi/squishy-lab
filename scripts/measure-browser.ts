import { chromium } from '@playwright/test';
import { mkdirSync,writeFileSync } from 'node:fs';
import { evidenceContext } from './evidence';
const browser=await chromium.launch({channel:process.env.SQUISHY_BROWSER_CHANNEL??'chrome',headless:true,args:['--enable-webgl']});
try {
  const page=await browser.newPage({viewport:{width:1366,height:1000},deviceScaleFactor:1});
  await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>!!window.__squishy);await page.evaluate(()=>window.__squishy!.press());await page.waitForTimeout(5000);
  const report=await page.evaluate(()=>{
    const s=window.__squishy!.snapshot() as {samples:Record<string,number>[];particles:number;tetrahedra:number;vertices:number;triangles:number;maxDisplacement:number;safetyBackoffs:number};
    const canvas=document.querySelector('canvas')!,gl=canvas.getContext('webgl2')!,extension=gl.getExtension('WEBGL_debug_renderer_info'),samples=s.samples.slice(-240);
    return {measuredAt:new Date().toISOString(),browser:navigator.userAgent,gpu:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) as string:'unavailable',webgl:gl.getParameter(gl.VERSION) as string,viewport:[innerWidth,innerHeight],canvasPixels:[canvas.width,canvas.height],dpr:devicePixelRatio,particles:s.particles,tetrahedra:s.tetrahedra,vertices:s.vertices,triangles:s.triangles,sampleCount:samples.length,samples,safetyBackoffs:s.safetyBackoffs,load:'5 seconds held standard press'};
  });
  const stats=(key:string)=>{const values=report.samples.map(v=>v[key]).sort((a,b)=>a-b);return {medianMs:values[Math.floor(values.length*.5)],p95Ms:values[Math.floor(values.length*.95)]};};
  const summary={...evidenceContext(),...report,solver:stats('solverMs'),surface:stats('surfaceMs'),renderCpuSubmission:stats('renderMs'),frame:stats('frameMs')};
  mkdirSync('evidence/refined',{recursive:true});writeFileSync('evidence/refined/browser-performance.json',JSON.stringify(summary,null,2));console.log({...summary,samples:`${report.samples.length} samples saved`});
}finally{await browser.close();}
