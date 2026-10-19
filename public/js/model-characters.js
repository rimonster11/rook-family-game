// Local GLB assets are fetched once; each seat gets independent transforms.
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

const templates = new Map();
const loader = new GLTFLoader();
export function loadCharacterModel(name) {
  if (name !== 'barbarian') return Promise.reject(new Error('Unknown character model'));
  if (!templates.has(name)) {
    const promise = loader.loadAsync('/models/barbarian/barbarian.glb').then(({ scene }) => {
      scene.traverse((o) => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      return scene;
    }).catch((error) => { templates.delete(name); throw error; });
    templates.set(name, promise);
  }
  return templates.get(name);
}

export function createModelCharacter(spec, load = loadCharacterModel) {
  const root = new THREE.Group();
  root.name = spec.model;
  root.userData.modelCharacter = true;
  root.userData.modelStatus = 'loading';
  // A portrait stands in during loading, or if WebGL cannot decode the asset.
  if (typeof document !== 'undefined') {
    const texture = new THREE.TextureLoader().load(spec.portrait);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const portrait = new THREE.Sprite(material);
    portrait.position.y = .75; portrait.scale.set(1.5, 1.5, 1);
    root.add(portrait); root.userData.placeholder = portrait;
  }
  root.userData.ready = Promise.resolve().then(() => load(spec.model)).then((template) => {
    if (root.userData.disposed) return root;
    const instance = template.clone(true);
    root.add(instance); root.userData.instance = instance;
    root.userData.head = instance.getObjectByName('HeadPivot');
    if (root.userData.head) root.userData.headRest = root.userData.head.quaternion.clone();
    clearPlaceholder(root);
    root.userData.modelStatus = 'ready';
    return root;
  }).catch((error) => {
    if (!root.userData.disposed) {
      root.userData.modelStatus = 'error';
      console.warn('Barbarian model unavailable; showing portrait.', error);
    }
    return root;
  });
  return root;
}

function clearPlaceholder(root) {
  const portrait = root.userData.placeholder;
  if (!portrait) return;
  root.remove(portrait);
  portrait.material.map?.dispose(); portrait.material.dispose();
  delete root.userData.placeholder;
}

export function disposeModelCharacter(root) {
  root.userData.disposed = true;
  clearPlaceholder(root);
  root.clear();
  // Template geometry, textures, and materials are shared by all instances.
  // Keep the one cached model alive when a preview or another seat is removed.
}

export function animateModelCharacter(root, seconds, active, reducedMotion) {
  const head = root.userData.head;
  if (!head) return;
  head.quaternion.copy(root.userData.headRest);
  if (!reducedMotion) {
    head.rotateY(Math.sin(seconds * .65) * .045);
    head.rotateX(Math.sin(seconds * .9) * .012 + (active ? -.035 : 0));
  }
}
