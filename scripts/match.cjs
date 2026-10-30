#!/usr/bin/env node
'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const engine=require('../engine.js');
async function main(args=process.argv.slice(2)){
 const opts={},inputs=[];
 for(let i=0;i<args.length;i++){if(args[i].startsWith('--')){const key=args[i].slice(2);if(!['reference','out','preset',...Object.keys(engine.defaults)].includes(key))throw Error('Unknown option: '+key);if(i+1===args.length)throw Error('Missing value: '+key);opts[key]=args[++i]}else inputs.push(args[i])}
 if(!opts.reference||!opts.out||!inputs.length)throw Error('Usage: node scripts/match.cjs --reference reference.jpg --out output-dir [--strength 0.7] [--preset settings.json] input.jpg [input-folder ...]');
 const sharp=require('sharp');
 const settings=engine.validate({...opts.preset?JSON.parse(await fs.readFile(opts.preset,'utf8')).parameters||JSON.parse(await fs.readFile(opts.preset,'utf8')):{},...Object.fromEntries(Object.keys(engine.defaults).filter(k=>k in opts).map(k=>[k,Number(opts[k])]))});
 async function load(file){const {data,info}=await sharp(file,{limitInputPixels:50000000}).autoOrient().toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,width:info.width,height:info.height}}
 const ref=await load(opts.reference),rs=engine.stats(ref.data);const files=[];
 for(const input of inputs){const st=await fs.stat(input);if(st.isDirectory()){for(const item of (await fs.readdir(input,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name)))if(item.isFile()&&/\.(png|jpe?g|webp|tiff?)$/i.test(item.name))files.push(path.join(input,item.name))}else files.push(input)}
 await fs.mkdir(opts.out,{recursive:true});let failures=0,done=0;
 for(const file of files){if(path.resolve(file)===path.resolve(opts.reference))continue;try{const src=await load(file),result=await engine.apply(src,rs,settings);let base=path.basename(file,path.extname(file))+'-matched',dest=path.join(opts.out,base+'.png'),index=1;while(await fs.access(dest).then(()=>true,()=>false))dest=path.join(opts.out,base+'-'+index+++'.png');await sharp(Buffer.from(result.data),{raw:{width:result.width,height:result.height,channels:4}}).png().toFile(dest);console.log(dest);done++}catch(e){failures++;console.error(file+': '+e.message)}}
 if(!done)throw Error('No images processed. Check input files.');
 await fs.writeFile(path.join(opts.out,'recipe-'+Date.now()+'.json'),JSON.stringify({version:1,reference:path.basename(opts.reference),parameters:settings,processed:done,failures},null,2));
 if(failures)process.exitCode=1;
}
module.exports=main;
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
