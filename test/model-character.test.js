'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Barbarian GLB has embedded textures, bounded geometry, and a movable head', async () => {
  const data = fs.readFileSync(path.join(__dirname, '../public/models/barbarian/barbarian.glb'));
  assert.equal(data.toString('ascii', 0, 4), 'glTF');
  assert.equal(data.readUInt32LE(4), 2);
  assert.equal(data.readUInt32LE(8), data.length);
  const gltf = JSON.parse(data.toString('utf8', 20, 20 + data.readUInt32LE(12)));
  assert.ok(gltf.nodes.some((n) => n.name === 'HeadPivot'));
  assert.ok(gltf.images.length >= 3);
  assert.ok(gltf.images.every((i) => Number.isInteger(i.bufferView) && !i.uri));
  assert.ok(gltf.buffers.every((b) => !b.uri), 'No external asset dependencies');
  let triangles = 0;
  for (const mesh of gltf.meshes) for (const p of mesh.primitives) {
    assert.ok(p.attributes.TEXCOORD_0 !== undefined);
    triangles += gltf.accessors[p.indices].count / 3;
    const position = gltf.accessors[p.attributes.POSITION];
    assert.ok([...position.min, ...position.max].every(Number.isFinite));
  }
  assert.ok(triangles > 5000 && triangles < 100000, `${triangles} triangles`);
  assert.ok(data.length < 5 * 1024 * 1024, 'Keep the browser asset below 5 MiB');
  globalThis.RookStyle = require('../public/js/style-options');
  const { CHARACTERS, avatarSVG } = await import('../public/js/art.js');
  assert.equal(CHARACTERS.length, globalThis.RookStyle.characterCount);
  assert.equal(CHARACTERS[12].model, 'barbarian');
  assert.match(avatarSVG(12), /models\/barbarian\/portrait\.png/);
});

test('GLB instances keep independent poses and shared resources survive disposal', async () => {
  const THREE = await import('../public/vendor/three.module.min.js');
  const { createModelCharacter, disposeModelCharacter, animateModelCharacter } = await import('../public/js/model-characters.js');
  const template = new THREE.Group();
  const head = new THREE.Group(); head.name = 'HeadPivot'; template.add(head);
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshStandardMaterial();
  head.add(new THREE.Mesh(geometry, material));
  let disposed = 0; geometry.addEventListener('dispose', () => disposed++);
  const spec = { model: 'barbarian' };
  const a = createModelCharacter(spec, async () => template);
  const b = createModelCharacter(spec, async () => template);
  await Promise.all([a.userData.ready, b.userData.ready]);
  assert.equal(a.userData.modelStatus, 'ready');
  assert.notEqual(a.userData.head, b.userData.head);
  animateModelCharacter(a, 2, true, false);
  assert.notDeepEqual(a.userData.head.quaternion.toArray(), b.userData.head.quaternion.toArray());
  animateModelCharacter(a, 2, true, true);
  assert.deepEqual(a.userData.head.quaternion.toArray(), a.userData.headRest.toArray());
  disposeModelCharacter(a);
  assert.equal(disposed, 0);
  assert.equal(b.children.length, 1);
  disposeModelCharacter(b); geometry.dispose(); material.dispose();
});

test('browser GLTF loader parses shipped geometry and texture references (bitmap decoder stubbed)', async () => {
  const oldSelf = globalThis.self, oldBitmap = globalThis.createImageBitmap;
  globalThis.self = globalThis;
  // Node cannot create a browser bitmap. Check PNG headers and dimensions here;
  // actual texture appearance is verified by reimporting/rendering the GLB in Blender.
  globalThis.createImageBitmap = async (blob) => {
    const png = Buffer.from(await blob.arrayBuffer());
    assert.equal(png.toString('ascii', 1, 4), 'PNG');
    return { width: png.readUInt32BE(16), height: png.readUInt32BE(20), close() {} };
  };
  try {
    const THREE = await import('../public/vendor/three.module.min.js');
    const { GLTFLoader } = await import('../public/vendor/GLTFLoader.js');
    const buffer = fs.readFileSync(path.join(__dirname, '../public/models/barbarian/barbarian.glb'));
    const { scene } = await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
    scene.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
    assert.ok(size.y > 2 && size.y < 2.4, `Model height ${size.y}`);
    assert.ok(size.x < 1.8 && size.z < 1, 'No exploded geometry or incorrect orientation');
    let textured = 0;
    scene.traverse((o) => { if (o.isMesh && o.material.map) { textured++; assert.equal(o.material.map.image.width, 512); } });
    assert.ok(textured >= 3);
  } finally {
    if (oldSelf === undefined) delete globalThis.self; else globalThis.self = oldSelf;
    if (oldBitmap === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = oldBitmap;
  }
});

test('switching characters during a load cannot resurrect a disposed preview', async () => {
  const THREE = await import('../public/vendor/three.module.min.js');
  const { createModelCharacter, disposeModelCharacter } = await import('../public/js/model-characters.js');
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const character = createModelCharacter({ model: 'barbarian' }, () => pending);
  disposeModelCharacter(character);
  finish(new THREE.Group());
  await character.userData.ready;
  assert.equal(character.children.length, 0);
  assert.equal(character.userData.disposed, true);
});

test('failed model loads settle without an unhandled rejection', async () => {
  const { createModelCharacter } = await import('../public/js/model-characters.js');
  const original = console.warn;
  console.warn = () => {};
  try {
    const character = createModelCharacter({ model: 'barbarian' }, async () => { throw new Error('offline'); });
    await character.userData.ready;
    assert.equal(character.userData.modelStatus, 'error');
  } finally { console.warn = original; }
});
