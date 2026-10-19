// Export the actual runtime meshes for an offline Blender visual check.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Style from '../public/js/style-options.js';
globalThis.RookStyle=Style;
const THREE=await import('../public/vendor/three.module.min.js');
const {buildCharacter,disposeCharacter}=await import('../public/js/characters.js');
const examples=[
  ['Everyday',0,{}],
  ['Bob / hoodie',0,{style:2,hair:2,skin:0,outfit:1,shirt:3,expression:0}],
  ['Curls / jacket',0,{style:5,hair:0,skin:4,outfit:2,shirt:1,expression:1}],
  ['Bun / cardigan',0,{style:4,hair:3,skin:2,outfit:3,shirt:4,expression:3,accessory:1}],
  ['Long / scarf',0,{style:3,hair:1,skin:1,outfit:0,shirt:2,expression:2,accessory:4}],
  ['Afro / glasses',0,{style:6,hair:5,skin:5,outfit:2,shirt:5,expression:4,glasses:1}],
];
const result=[];
for(const [label,index,appearance] of examples){
  const model=buildCharacter(index,appearance);model.updateMatrixWorld(true);
  const meshes=[];
  model.traverse(o=>{
    if(!o.isMesh)return;
    const p=o.geometry.attributes.position,points=[];
    for(let i=0;i<p.count;i++){
      const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);
      points.push([v.x,-v.z,v.y]);
    }
    const indices=o.geometry.index?Array.from(o.geometry.index.array):Array.from({length:p.count},(_,i)=>i);
    meshes.push({name:o.name,points,indices,color:o.material.color.toArray(),roughness:o.material.roughness,metalness:o.material.metalness});
  });
  result.push({label,meshes});disposeCharacter(model);
}
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../art-source/avatars');
fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(os.tmpdir(),'rook-avatar-preview-meshes.json'),JSON.stringify(result));
console.log('Exported six runtime avatars for Blender preview.');
