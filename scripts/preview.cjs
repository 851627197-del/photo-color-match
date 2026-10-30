'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),sharp=require('sharp'),E=require('../engine.js');
module.exports=async function preview({input,reference,out,parameters}){
 async function load(file){const {data,info}=await sharp(file,{limitInputPixels:50000000}).autoOrient().toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,width:info.width,height:info.height}}
 const src=await load(input),ref=await load(reference),ss=E.stats(src.data),rs=E.stats(ref.data);
 const small=await sharp(src.data,{raw:{width:src.width,height:src.height,channels:4}}).resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true}).raw().toBuffer({resolveWithObject:true});
 const photo={data:small.data,width:small.info.width,height:small.info.height};
 await fs.mkdir(out,{recursive:true});const dir=await fs.mkdtemp(path.join(out,'preview-'));
 const choices=E.variants(parameters),tiles=[{key:'original',label:'ORIGINAL',image:photo}],manifest={version:1,input:path.basename(input),reference:path.basename(reference),variants:[]};
 for(const choice of choices){const image=await E.apply(photo,rs,choice.parameters,ss),file=choice.key+'.png';await sharp(Buffer.from(image.data),{raw:{width:image.width,height:image.height,channels:4}}).png().toFile(path.join(dir,file));manifest.variants.push({...choice,file});tiles.push({key:choice.key,label:choice.key.toUpperCase()+' '+Math.round(choice.strength*100)+'%',image})}
 const width=360,height=300,composite=[];
 for(let i=0;i<tiles.length;i++){const tile=tiles[i];const picture=await sharp(Buffer.from(tile.image.data),{raw:{width:photo.width,height:photo.height,channels:4}}).resize({width,height:height-30,fit:'contain',background:'#f4f3ec'}).png().toBuffer();composite.push({input:picture,left:i*width,top:30});const label=Buffer.from(`<svg width="360" height="30"><text x="12" y="21" font-family="sans-serif" font-size="15" fill="#243630">${tile.label}</text></svg>`);composite.push({input:label,left:i*width,top:0})}
 await sharp({create:{width:width*4,height,channels:4,background:'#f4f3ec'}}).composite(composite).png().toFile(path.join(dir,'comparison.png'));
 await fs.writeFile(path.join(dir,'variants.json'),JSON.stringify(manifest,null,2));console.log('Preview choices: '+path.join(dir,'comparison.png'));return dir;
};
