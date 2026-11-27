// Puking: green drops with gravity and puddles left on the pavement.
import * as THREE from "three";

const DROPS = 90, PUDDLES = 40;

// the same drops also work as garlic sauce (white) dripping off a kebab
export function createVomit(scene, color = 0x9bbf2a, glow = 0x3d5a00) {
  const dropMat = new THREE.MeshStandardMaterial({ color, emissive: glow, roughness: 0.3 });
  const drops = Array.from({ length: DROPS }, () => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), dropMat);
    m.visible = false; scene.add(m);
    return { m, v: new THREE.Vector3(), life: 0 };
  });
  const puddleMat = new THREE.MeshStandardMaterial({ color: 0x8aa82a, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
  const puddles = [];
  let next = 0, pi = 0;

  return {
    // emit a few drops per frame while puking; mouth: world position, dir: where the face points
    spray(mouth, dir) {
      for (let k = 0; k < 3; k++) {
        const d = drops[next = (next + 1) % DROPS];
        d.m.position.copy(mouth);
        d.v.copy(dir).multiplyScalar(2 + Math.random() * 1.5).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, -0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8));
        d.life = 1.2; d.m.visible = true;
      }
    },
    puddle(at, y = 0.2) {
      let p = puddles[pi];
      if (!p) { p = new THREE.Mesh(new THREE.CircleGeometry(0.7, 18), puddleMat); p.rotation.x = -Math.PI / 2; scene.add(p); puddles[pi] = p; }
      p.position.set(at.x, y, at.z); p.scale.set(0.8 + Math.random() * 0.6, 0.6 + Math.random() * 0.5, 1);
      pi = (pi + 1) % PUDDLES;
    },
    update(dt) {
      for (const d of drops) {
        if (d.life <= 0) continue;
        d.life -= dt;
        d.v.y -= 9.8 * dt;
        d.m.position.addScaledVector(d.v, dt);
        if (d.m.position.y < 0.2 || d.life <= 0) { d.life = 0; d.m.visible = false; }
      }
    },
    // follow the player into a building and back out
    moveTo(target) { drops.forEach((d) => target.add(d.m)); puddles.forEach((p) => { target.add(p); p.position.set(0, -10, 0); }); scene = target; },
    clear() { drops.forEach((d) => { d.life = 0; d.m.visible = false; }); puddles.forEach((p) => p.position.set(0, -10, 0)); },
  };
}
