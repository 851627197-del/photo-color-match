/* Local, deterministic reference colour transfer. No network or model calls. */
(function(root){
'use strict';
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const defaults={strength:.7,tone:.35,exposure:0,contrast:0,saturation:0,warmth:0,fade:0,glow:0,grain:0};
function lab(r,g,b){
 const lin=x=>{x/=255;return x>.04045?Math.pow((x+.055)/1.055,2.4):x/12.92};
 r=lin(r);g=lin(g);b=lin(b);
 const f=x=>x>.008856451679?Math.cbrt(x):7.787037037*x+16/116;
 const x=f((.4124564*r+.3575761*g+.1804375*b)/.95047),y=f(.2126729*r+.7151522*g+.072175*b),z=f((.0193339*r+.119192*g+.9503041*b)/1.08883);
 return [116*y-16,500*(x-y),200*(y-z)];
}
function rgb(L,a,b){
 const fy=(L+16)/116,fx=fy+a/500,fz=fy-b/200;
 const inv=t=>t>.206896551724?t*t*t:(t-16/116)/7.787037037;
 const x=.95047*inv(fx),y=inv(fy),z=1.08883*inv(fz);
 const enc=t=>255*(t>.0031308?1.055*Math.pow(Math.max(0,t),1/2.4)-.055:12.92*t);
 return [enc(3.2404542*x-1.5371385*y-.4985314*z),enc(-.969266*x+1.8760108*y+.041556*z),enc(.0556434*x-.2040259*y+1.0572252*z)];
}
function stats(data){
 const sums=[0,0,0],sq=[0,0,0];let n=0;
 const stride=Math.max(1,Math.ceil(data.length/4/65536));
 for(let i=0;i<data.length;i+=4*stride){if(data[i+3]<128)continue;const v=lab(data[i],data[i+1],data[i+2]);n++;for(let k=0;k<3;k++){sums[k]+=v[k];sq[k]+=v[k]*v[k]}}
 if(!n)throw Error('图片没有足够的不透明像素可用于仿色。');
 return {mean:sums.map(v=>v/n),std:sq.map((v,k)=>Math.sqrt(Math.max(0,v/n-(sums[k]/n)**2)))};
}
function validate(options){
 const p={...defaults,...options};
 const ranges={strength:[0,1],tone:[0,1],exposure:[-2,2],contrast:[-1,1],saturation:[-1,1],warmth:[-1,1],fade:[0,1],glow:[0,1],grain:[0,1]};
 for(const [k,[a,b]] of Object.entries(ranges))if(!Number.isFinite(p[k])||p[k]<a||p[k]>b)throw Error('参数超出范围：'+k);
 return Object.fromEntries(Object.keys(defaults).map(k=>[k,p[k]]));
}
function blur(src,w,h,r){
 const tmp=new Float32Array(src.length),out=new Float32Array(src.length);
 for(let y=0;y<h;y++)for(let c=0;c<3;c++){let s=0;for(let x=-r;x<=r;x++)s+=src[(y*w+clamp(x,0,w-1))*3+c];for(let x=0;x<w;x++){tmp[(y*w+x)*3+c]=s/(2*r+1);s+=src[(y*w+clamp(x+r+1,0,w-1))*3+c]-src[(y*w+clamp(x-r,0,w-1))*3+c]}}
 for(let x=0;x<w;x++)for(let c=0;c<3;c++){let s=0;for(let y=-r;y<=r;y++)s+=tmp[(clamp(y,0,h-1)*w+x)*3+c];for(let y=0;y<h;y++){out[(y*w+x)*3+c]=s/(2*r+1);s+=tmp[(clamp(y+r+1,0,h-1)*w+x)*3+c]-tmp[(clamp(y-r,0,h-1)*w+x)*3+c]}}
 return out;
}
async function apply(image,referenceStats,options={},sourceStats){
 const p=validate(options),{data,width:w,height:h}=image;
 const out=new Uint8ClampedArray(data),s=sourceStats||stats(data),t=referenceStats;
 const neutral=p.strength===0&&Object.entries(p).every(([k,v])=>k==='tone'||k==='strength'||v===0);
 if(neutral)return {data:out,width:w,height:h};
 const ratios=s.std.map((v,k)=>v<.5?1:clamp(t.std[k]/v,.4,2.5));
 for(let i=0;i<data.length;i+=4){
  if(data[i+3]===0)continue;
  const v=lab(data[i],data[i+1],data[i+2]);
  const mapped=v.map((x,k)=>(x-s.mean[k])*ratios[k]+t.mean[k]);
  const v2=v.map((x,k)=>x+(mapped[k]-x)*p.strength*(k===0?p.tone:1));
  v2[0]=clamp(v2[0]*Math.pow(2,p.exposure),0,100);v2[1]*=1+p.saturation;v2[2]=v2[2]*(1+p.saturation)+p.warmth*12;
  v2[0]=clamp((v2[0]-50)*(1+p.contrast*.7)+50,0,100);
  const col=rgb(...v2);
  for(let k=0;k<3;k++)out[i+k]=clamp(col[k]/255)*(1-p.fade*.25)*255+p.fade*20;
  if(i%(4*262144)===0)await new Promise(r=>setTimeout(r,0));
 }
 if(p.glow){
  const highlights=new Float32Array(w*h*3);
  for(let i=0,j=0;i<out.length;i+=4,j+=3){const mask=clamp((Math.max(out[i],out[i+1],out[i+2])/255-.5)*2)*(out[i+3]/255);for(let c=0;c<3;c++)highlights[j+c]=out[i+c]/255*mask}
  const blurred=blur(highlights,w,h,Math.max(1,Math.round(Math.min(w,h)*.012)));
  for(let i=0,j=0;i<out.length;i+=4,j+=3)for(let c=0;c<3;c++)out[i+c]=255*(1-(1-out[i+c]/255)*(1-blurred[j+c]*p.glow*.65));
 }
 if(p.grain){let seed=123456789;for(let i=0;i<out.length;i+=4){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;const noise=((seed>>>0)/4294967295-.5)*p.grain*36;for(let c=0;c<3;c++)out[i+c]+=noise}}
 return {data:out,width:w,height:h};
}
const previewLevels=Object.freeze([{key:'light',label:'轻',strength:.35},{key:'medium',label:'中',strength:.65},{key:'strong',label:'强',strength:.9}].map(Object.freeze));
function variants(options={}){const p=validate(options);return previewLevels.map(level=>({...level,parameters:{...p,strength:level.strength}}))}
const api={lab,rgb,stats,apply,defaults,validate,previewLevels,variants};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ColorMatch=api;
})(typeof globalThis!=='undefined'?globalThis:this);
