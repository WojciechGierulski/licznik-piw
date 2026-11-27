// Simple people for the interiors: the neighbour in a bathrobe, party crowd, grandma.
import * as THREE from "three";

const mat = (color, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, roughness });

// look: {skin, top, bottom, hair, hat?, glasses?, bun?, robe?}
export function createPerson(look) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const skin = mat(look.skin ?? 0xe0ac86, 0.6), top = mat(look.top), bottom = mat(look.bottom ?? 0x2a2a35), hair = mat(look.hair ?? 0x3b2a1c, 0.9);
  const cap = (r, len, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), m);

  const torso = cap(0.3, 0.5, top); torso.position.y = 1.38; torso.scale.z = 0.7;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 18, 14), skin); head.position.y = 2.04;
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), hair); hairCap.position.y = 2.06;
  const eyes = [-0.07, 0.07].map((x) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), mat(0x151515, 0.3)); e.position.set(x, 2.08, 0.19); return e; });
  body.add(torso, head, hairCap, ...eyes);
  if (look.bun) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), hair); b.position.set(0, 2.24, -0.12); body.add(b); }
  if (look.glasses) {
    const g = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 14), mat(0x222222, 0.3));
    for (const x of [-0.07, 0.07]) { const l = g.clone(); l.position.set(x, 2.08, 0.2); body.add(l); }
  }
  if (look.robe) {  // bathrobe skirt
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.7, 14), top); skirt.position.y = 0.85; body.add(skirt);
  }
  const limb = (r, len, m, x, y) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
    const mesh = cap(r, len, m); mesh.position.y = -len / 2 - r / 2; pivot.add(mesh);
    const end = new THREE.Mesh(new THREE.SphereGeometry(r * 0.95, 10, 8), m === bottom ? mat(0x2b2b2b) : skin); end.position.y = -len - r * 1.2; pivot.add(end);
    body.add(pivot);
    return pivot;
  };
  const armL = limb(0.08, 0.52, top, -0.4, 1.66), armR = limb(0.08, 0.52, top, 0.4, 1.66);
  const legL = limb(0.1, 0.6, bottom, -0.14, 0.93), legR = limb(0.1, 0.6, bottom, 0.14, 0.93);
  root.traverse((m) => { if (m.isMesh) m.castShadow = true; });

  return {
    root, body, head, armL, armR, legL, legR,
    // dance harder the drunker the player is: everyone looks wilder through beer goggles
    dance(t, wild, phase = 0) {
      const p = t * (3 + wild * 3) + phase;
      body.position.y = Math.abs(Math.sin(p)) * (0.08 + wild * 0.25);
      body.rotation.y = Math.sin(p * 0.5) * (0.3 + wild * 0.9);
      body.rotation.z = Math.sin(p) * wild * 0.25;
      armL.rotation.x = -1.2 - Math.sin(p) * (0.6 + wild);  armL.rotation.z = -0.4 - wild * 0.8;
      armR.rotation.x = -1.2 + Math.sin(p) * (0.6 + wild);  armR.rotation.z = 0.4 + wild * 0.8;
      legL.rotation.x = Math.sin(p) * 0.4; legR.rotation.x = -Math.sin(p) * 0.4;
      head.rotation.x = Math.sin(p * 2) * 0.2;
    },
    idle(t, phase = 0) {
      body.position.y = Math.sin(t * 1.5 + phase) * 0.015;
      head.rotation.y = Math.sin(t * 0.4 + phase) * 0.35;
      armL.rotation.x = Math.sin(t * 0.8 + phase) * 0.06;
    },
    sit() {
      legL.rotation.x = legR.rotation.x = -1.5;
      root.position.y = -0.45;
    },
  };
}
