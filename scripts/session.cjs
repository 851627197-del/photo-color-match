#!/usr/bin/env node
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const E=require('../engine.js'),match=require('./match.cjs');
const help=`node scripts/session.cjs reference sample.jpg --session /workspace/style
node scripts/session.cjs reference sample.jpg --keep-settings --session /workspace/style
node scripts/session.cjs preview photo.jpg --out previews --session /workspace/style
node scripts/session.cjs apply a.jpg b.jpg --out results --session /workspace/style
node scripts/session.cjs settings --strength 0.6 --session /workspace/style
node scripts/session.cjs status --session /workspace/style`;
async function main(args=process.argv.slice(2)){
 const command=args.shift();if(!command||command==='--help'){console.log(help);return}
 if(!['reference','preview','apply','settings','status'].includes(command))throw Error('Unknown command. '+help);
 const opts={},inputs=[];
 for(let i=0;i<args.length;i++){const arg=args[i];if(arg.startsWith('--')){const key=arg.slice(2);if(key==='keep-settings'){if(command!=='reference')throw Error('--keep-settings is only for reference');opts[key]=true;continue}if(!['session','out',...Object.keys(E.defaults)].includes(key))throw Error('Unknown option: '+key);if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing value: '+key);opts[key]=args[++i]}else inputs.push(arg)}
 const dir=path.resolve(opts.session||path.join(process.cwd(),'.photo-color-match','default'));
 const relative=path.relative(path.resolve(__dirname,'..'),dir);
 if(relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw Error('Keep session photos outside the skill folder. Pass --session with a workspace path.');
 const stateFile=path.join(dir,'session.json');let state=null;
 try{state=JSON.parse(await fs.readFile(stateFile,'utf8'));if(state.version!==1||!state.reference||path.basename(state.reference)!==state.reference)throw Error('Invalid session data')}catch(e){if(e.code!=='ENOENT')throw e}
 if(command==='status'){if(!state){console.log(JSON.stringify({ready:false,session:dir}));return}await fs.access(path.join(dir,state.reference));console.log(JSON.stringify({ready:true,session:dir,reference:state.originalName,parameters:state.parameters},null,2));return}
 const changes=Object.fromEntries(Object.keys(E.defaults).filter(k=>k in opts).map(k=>[k,Number(opts[k])]));
 const parameters=E.validate({...((command!=='reference'||opts['keep-settings'])?state?.parameters:{}),...changes});
 async function save(next){await fs.mkdir(dir,{recursive:true});const temp=path.join(dir,'state-'+crypto.randomUUID()+'.tmp');await fs.writeFile(temp,JSON.stringify(next,null,2),{flag:'wx'});await fs.rename(temp,stateFile)}
 if(command==='reference'){
  if(inputs.length!==1)throw Error('Provide exactly one reference image');
  const sharp=require('sharp'),source=path.resolve(inputs[0]);
  const image=await sharp(source,{limitInputPixels:50000000}).autoOrient().toColourspace('srgb').ensureAlpha().png().toBuffer();
  const {data}=await sharp(image).raw().toBuffer({resolveWithObject:true});E.stats(data);
  await fs.mkdir(dir,{recursive:true});const name='reference-'+crypto.randomUUID()+'.png';await fs.writeFile(path.join(dir,name),image,{flag:'wx'});
  await save({version:1,reference:name,originalName:path.basename(source),parameters,updatedAt:new Date().toISOString()});
  console.log('Reference saved: '+dir+'; parameters '+(opts['keep-settings']?'retained':'reset to defaults')+' (explicit overrides applied)');return;
 }
 if(!state)throw Error('No reference is set. Run the reference command with a sample image first.');
 await fs.access(path.join(dir,state.reference));
 if(command==='preview'){
  if(inputs.length!==1||!opts.out)throw Error('Preview needs exactly one photo and --out');
  const preview=require('./preview.cjs');await preview({input:path.resolve(inputs[0]),reference:path.join(dir,state.reference),out:path.resolve(opts.out),parameters});return;
 }
 if(command==='settings'){if(inputs.length)throw Error('Settings takes flags, not photos');await save({...state,parameters,updatedAt:new Date().toISOString()});console.log(JSON.stringify(parameters,null,2));return}
 if(!opts.out||!inputs.length)throw Error('Apply needs input photos and --out');
 const flags=Object.entries(parameters).flatMap(([key,value])=>['--'+key,String(value)]);
 await match(['--reference',path.join(dir,state.reference),'--out',path.resolve(opts.out),...flags,...inputs]);
 if(!process.exitCode)await save({...state,parameters,updatedAt:new Date().toISOString()});
}
module.exports=main;
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
