// The hero: a guy in a tracksuit and a cap who staggers more with every per mille.
import * as THREE from "three";

export function createPlayer(scene) {
  const mat = (color, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, roughness });
  const skin = mat(0xe8b890, 0.6), suit = mat(0x24459a, 0.55), stripe = mat(0xf2f2f2, 0.5);
  const pants = mat(0x1b2440, 0.6), shoe = mat(0xeeeeee, 0.4), sole = mat(0x222222), dark = mat(0x1a1a1a, 0.3);

  const root = new THREE.Group();   // position + heading
  const body = new THREE.Group();   // leans and wobbles
  root.add(body);
  const capsule = (r, len, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), m);

  const torso = capsule(0.32, 0.5, suit); torso.position.y = 1.38; torso.scale.set(1, 1, 0.68);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), suit); belly.position.set(0, 1.22, 0.1); belly.scale.set(1, 0.9, 0.75);
  const zip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.62, 0.02), stripe); zip.position.set(0, 1.4, 0.23);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.12, 10), skin); neck.position.y = 1.86;
  const headG = new THREE.Group(); headG.position.y = 2.08;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), skin); head.scale.set(1, 1.08, 1);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(0xd9846b)); nose.position.set(0, -0.02, 0.21);  // a bit red, naturally
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), dark); eyeL.position.set(-0.08, 0.04, 0.19);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.08;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.235, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), suit); cap.position.y = 0.04;
  const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 20, 1, false, -Math.PI / 2, Math.PI), suit);
  visor.position.set(0, 0.05, 0.12); visor.scale.z = 1.3;
  headG.add(head, nose, eyeL, eyeR, cap, visor);
  body.add(torso, belly, zip, neck, headG);
  for (const x of [-0.31, 0.31]) {  // the stripes down the sides
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.75, 0.05), stripe); s.position.set(x, 1.38, 0); body.add(s);
  }

  const limb = (r, len, m, x, y) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
    const mesh = capsule(r, len, m); mesh.position.y = -len / 2 - r / 2;
    pivot.add(mesh); body.add(pivot);
    return pivot;
  };
  const armL = limb(0.085, 0.55, suit, -0.42, 1.68), armR = limb(0.085, 0.55, suit, 0.42, 1.68);
  for (const arm of [armL, armR]) { const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), skin); hand.position.y = -0.78; arm.add(hand); }
  const legL = limb(0.11, 0.62, pants, -0.15, 0.95), legR = limb(0.11, 0.62, pants, 0.15, 0.95);
  for (const leg of [legL, legR]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.32), shoe); s.position.set(0, -0.9, 0.06);
    const so = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.33), sole); so.position.set(0, -0.97, 0.06);
    leg.add(s, so);
  }
  // a bottle always in hand
  const glass = new THREE.MeshStandardMaterial({ color: 0x5b3a12, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9 });
  const bottle = new THREE.Group();
  const bb = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.22, 12), glass);
  const bn = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.12, 10), glass); bn.position.y = 0.17;
  bottle.add(bb, bn); bottle.position.set(0, -0.8, 0.08); armR.add(bottle);
  root.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  scene.add(root);

  let heading = 0, speed = 0, stride = 0, lateral = 0, drift = 0, fall = 0;
  const forward = new THREE.Vector3(), side = new THREE.Vector3();

  return {
    root,
    get heading() { return heading; },
    reset(pos) {
      root.position.copy(pos); heading = 0; speed = 0; fall = 0; drift = 0; lateral = 0;
      root.rotation.set(0, 0, 0); body.rotation.set(0, 0, 0);
    },
    // move: {fwd: -1..1, turn: -1..1}; d: drunkenness 0..1 (10 ‰ = 1), grows the stagger continuously
    update(dt, move, d, t) {
      const turnSign = move.inverted ? -1 : 1;
      // the more you drink, the more your body steers on its own
      drift += (Math.sin(t * 0.7) * 1.4 + Math.sin(t * 1.9 + 1) * 0.8 - drift) * dt * 0.8;
      heading += (move.turn * turnSign * 2.4 + drift * d * 2.2) * dt;
      const target = move.fwd * 6 * (1 + d * 0.3);
      speed += (target - speed) * Math.min(1, dt * (4 - d * 2.5));  // drunk legs react later
      forward.set(Math.sin(heading), 0, Math.cos(heading));
      side.set(forward.z, 0, -forward.x);
      // sideways stagger grows with drunkenness
      lateral = Math.sin(t * 1.3) * 1.2 * d + Math.sin(t * 3.1) * 0.5 * d * d;
      root.position.addScaledVector(forward, speed * dt).addScaledVector(side, lateral * dt * (0.4 + Math.abs(speed) * 0.25));
      root.rotation.y = heading;

      stride += Math.abs(speed) * dt * 1.6;
      const swing = Math.sin(stride) * Math.min(1, Math.abs(speed) / 3) * 0.7;
      legL.rotation.x = swing; legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.8 + Math.sin(t * 2) * 0.3 * d;
      armR.rotation.x = swing * 0.8 - 0.4;  // keeps the bottle up
      armL.rotation.z = -0.1 - d * 0.6 * (0.5 + 0.5 * Math.sin(t * 1.7));  // flailing for balance
      body.rotation.z = Math.sin(t * 1.9) * 0.35 * d + lateral * 0.08;
      body.rotation.x = Math.sin(t * 1.1) * 0.15 * d + speed * 0.012;
      body.position.y = Math.abs(Math.sin(stride)) * 0.05 * Math.min(1, Math.abs(speed) / 3);
      headG.rotation.z = Math.sin(t * 2.6) * 0.4 * d;
      headG.rotation.x = Math.sin(t * 1.4) * 0.25 * d;
      return { speed, forward };
    },
    // dyntka: fall flat on your face; returns true when done
    fall(dt) {
      fall = Math.min(1, fall + dt * 0.9);
      const e = fall * fall;
      root.rotation.x = e * Math.PI / 2;
      body.rotation.z = Math.sin(fall * 9) * (1 - fall) * 0.5;
      armL.rotation.x = armR.rotation.x = -e * 2.6;
      return fall >= 1;
    },
  };
}
