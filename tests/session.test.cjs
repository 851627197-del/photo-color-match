const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const sharp=require('sharp'),E=require('../engine.js');
const script=path.resolve(__dirname,'../scripts/session.cjs');
function run(...args){return spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:process.env})}
function ok(...args){const r=run(...args);assert.equal(r.status,0,r.stderr);return r.stdout}
test('sessions: reuse, reset/retain settings, three previews and export consistency',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'photo-color-match-'));
 t.after(()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert(path.basename(dir).startsWith('photo-color-match-'));return fs.rm(dir,{recursive:true,force:true})});
 const ref=path.join(dir,'ref.png'),other=path.join(dir,'other.png'),photo=path.join(dir,'photo.png');
 const data=Buffer.alloc(32*24*4);for(let i=0;i<data.length;i+=4){data[i]=60+(i/4%32)*3;data[i+1]=90+Math.floor(i/4/32)*3;data[i+2]=150;data[i+3]=(i%16?255:0)}
 await sharp(data,{raw:{width:32,height:24,channels:4}}).png().toFile(photo);
 await sharp({create:{width:20,height:20,channels:4,background:'#bd9d65'}}).png().toFile(ref);
 await sharp({create:{width:20,height:20,channels:4,background:'#488aab'}}).png().toFile(other);
 const session=path.join(dir,'session'),session2=path.join(dir,'session2'),out=path.join(dir,'results');
 assert.notEqual(run('apply',photo,'--out',out,'--session',session).status,0);
 ok('reference',ref,'--session',session);await fs.unlink(ref);
 ok('apply',photo,'--out',out,'--session',session);
 ok('apply',photo,'--out',out,'--session',session);
 const output=path.join(out,'photo-matched.png'),output2=path.join(out,'photo-matched-1.png');
 assert.deepEqual(await fs.readFile(output),await fs.readFile(output2));
 const actual=await sharp(output).raw().toBuffer({resolveWithObject:true});assert.equal(actual.info.width,32);assert.equal(actual.info.height,24);for(let i=3;i<data.length;i+=4)assert.equal(actual.data[i],data[i]);
 ok('settings','--strength','0.4','--glow','0.1','--session',session);
 assert.equal(JSON.parse(ok('status','--session',session)).parameters.strength,.4);
 ok('reference',other,'--session',session2);ok('apply',photo,'--out',path.join(dir,'blue'),'--session',session2);
 assert.notDeepEqual(await fs.readFile(output),await fs.readFile(path.join(dir,'blue','photo-matched.png')));
 ok('reference',other,'--session',session);assert.equal(JSON.parse(ok('status','--session',session)).reference,'other.png');
 assert.deepEqual(JSON.parse(ok('status','--session',session)).parameters,E.defaults);
 ok('settings','--strength','0.4','--glow','0.1','--grain','0.2','--session',session);
 const retained=JSON.parse(ok('status','--session',session)).parameters;
 ok('reference',other,'--keep-settings','--warmth','0.15','--session',session);
 assert.deepEqual(JSON.parse(ok('status','--session',session)).parameters,{...retained,warmth:.15});
 ok('reference',other,'--strength','0.55','--session',session);
 assert.deepEqual(JSON.parse(ok('status','--session',session)).parameters,{...E.defaults,strength:.55});
 const before=await fs.readFile(path.join(session,'session.json'));assert.notEqual(run('settings','--strength','4','--session',session).status,0);assert.deepEqual(await fs.readFile(path.join(session,'session.json')),before);
 assert.notEqual(run('reference',path.join(dir,'missing.png'),'--session',session).status,0);assert.deepEqual(await fs.readFile(path.join(session,'session.json')),before);
 assert.notEqual(run('apply',photo,'--keep-settings','--out',out,'--session',session).status,0);
 const inputBefore=await fs.readFile(photo),previews=path.join(dir,'previews');
 ok('preview',photo,'--out',previews,'--session',session);ok('preview',photo,'--out',previews,'--session',session);
 assert.deepEqual(await fs.readFile(path.join(session,'session.json')),before);
 assert.deepEqual(await fs.readFile(photo),inputBefore);
 const previewDirs=await fs.readdir(previews);assert.equal(previewDirs.length,2);
 const previewDir=path.join(previews,previewDirs[0]),manifest=JSON.parse(await fs.readFile(path.join(previewDir,'variants.json')));
 assert.deepEqual(manifest.variants.map(x=>x.strength),[.35,.65,.9]);
 const images=[];
 for(const v of manifest.variants){assert.deepEqual(v.parameters,{...E.defaults,strength:v.strength});const image=await sharp(path.join(previewDir,v.file)).raw().toBuffer({resolveWithObject:true});assert.equal(image.info.width,32);assert.equal(image.info.height,24);for(let i=3;i<data.length;i+=4)assert.equal(image.data[i],data[i]);images.push(image.data)}
 assert.notDeepEqual(images[0],images[1]);assert.notDeepEqual(images[1],images[2]);
 const grid=await sharp(path.join(previewDir,'comparison.png')).metadata();assert.equal(grid.width,1440);assert.equal(grid.height,300);
 ok('apply',photo,'--strength','0.65','--out',path.join(dir,'selected'),'--session',session);
 assert.deepEqual(await sharp(path.join(dir,'selected','photo-matched.png')).raw().toBuffer(),images[1]);
 assert.equal(JSON.parse(ok('status','--session',session)).parameters.strength,.65);
 assert.notEqual(run('reference',other,'--session',path.resolve(__dirname,'../.photo-color-match/test')).status,0);
});
test('zero strength preserves exact RGBA bytes and conversion is stable',async()=>{
 const data=new Uint8ClampedArray([30,50,90,255,60,120,190,130,99,80,20,0]);
 const out=await E.apply({width:3,height:1,data},E.stats(data),{strength:0});assert.deepEqual(out.data,data);
 for(const c of [[0,0,0],[255,255,255],[30,140,220]])assert(E.rgb(...E.lab(...c)).every((x,i)=>Math.abs(x-c[i])<.01));
});
