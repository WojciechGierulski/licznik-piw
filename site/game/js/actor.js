// Loads the CC0 models once and turns them into animated actors (people) and car bodies.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

const FILES = {
  man: "man.glb", woman: "woman.glb",
  hatchback: "car-hatchback.glb", sedan: "car-sedan.glb", wagon: "car-wagon.glb", sports: "car-sports.glb", pickup: "car-pickup.glb",
};

export async function loadAssets() {
  const loader = new GLTFLoader();
  const base = new URL("../models/", import.meta.url);
  const entries = await Promise.all(Object.entries(FILES).map(async ([k, f]) => [k, await loader.loadAsync(new URL(f, base).href)]));
  return Object.fromEntries(entries);
}

// recolour materials by name, e.g. {Shirt: 0x2b4fa3}; each copy gets its own materials
function paint(root, colors = {}) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    for (const m of [].concat(o.material)) if (colors[m.name] !== undefined) m.color.setHex(colors[m.name]);
  });
}

// Box3.setFromObject on a fresh skinned clone reads a skeleton that has not been posed yet and gets
// the size wrong, so measure the source model once with its skeleton posed
function bindPoseBox(gltf) {
  if (gltf.userData.box) return gltf.userData.box;
  const box = new THREE.Box3(), part = new THREE.Box3();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.skeleton.update();
    o.computeBoundingBox();
    box.union(part.copy(o.boundingBox).applyMatrix4(o.matrixWorld));
  });
  return (gltf.userData.box = box);
}

// an animated person: plays clips by their short name ("Walk", "Run", "Idle", "Death", "Sitting"…)
export function createActor(gltf, { height = 1.8, colors } = {}) {
  const model = SkeletonUtils.clone(gltf.scene);
  paint(model, colors);
  const box = bindPoseBox(gltf), size = box.getSize(new THREE.Vector3());
  model.scale.setScalar(height / size.y);
  model.position.y = -box.min.y * (height / size.y);
  const root = new THREE.Group(), body = new THREE.Group();  // root: place + heading, body: drunk lean
  body.add(model); root.add(body);

  const mixer = new THREE.AnimationMixer(model);
  const clips = {};
  for (const c of gltf.animations) clips[c.name.split("|").pop().replace(/^(Man|Female)_/, "")] = mixer.clipAction(c);
  let current = null;
  const bones = {};
  model.traverse((o) => { if (o.isBone) bones[o.name] = o; });

  return {
    root, body, bones, mixer,
    // hang an object on a bone at its real size (the armatures carry their own scale, e.g. ×100)
    attach(boneName, obj) {
      const bone = bones[boneName];
      root.updateMatrixWorld(true);
      obj.scale.divideScalar(bone.getWorldScale(new THREE.Vector3()).x);
      bone.add(obj);
    },
    has: (name) => !!clips[name],
    play(name, { fade = 0.25, once = false, speed = 1 } = {}) {
      const a = clips[name];
      if (!a) return;
      a.timeScale = speed;
      if (current === a) return;
      a.reset();
      if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } else a.setLoop(THREE.LoopRepeat, Infinity);
      a.play();
      if (current) current.crossFadeTo(a, fade, false);
      current = a;
    },
    // 0…1 of the current clip, for one-shot animations like falling down
    progress() { return current ? current.time / current.getClip().duration : 0; },
    update(dt) { mixer.update(dt); },
  };
}

// a car body scaled to a given length, facing +Z, optionally with its paint recoloured
export function createCarBody(gltf, { length, paint: paintName, color, flip = false }) {
  const model = gltf.scene.clone(true);
  paint(model, paintName ? { [paintName]: color } : {});
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
  const along = Math.max(size.x, size.z), k = length / along;
  model.scale.multiplyScalar(k);
  const turned = size.x > size.z;  // some models are modelled sideways
  const holder = new THREE.Group();
  holder.add(model);
  model.rotation.y = (turned ? Math.PI / 2 : 0) + (flip ? Math.PI : 0);
  const b2 = new THREE.Box3().setFromObject(holder), c = b2.getCenter(new THREE.Vector3());
  model.position.x -= c.x; model.position.z -= c.z; model.position.y -= b2.min.y;
  return holder;
}
