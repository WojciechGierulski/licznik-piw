// The hero: an animated guy in a blue tracksuit who staggers more with every per mille.
import * as THREE from "three";
import { createActor } from "./actor.js";

export function createPlayer(scene, assets) {
  const actor = createActor(assets.man, { height: 1.85, colors: { Shirt: 0x24459a, Pants: 0x1b2440, Socks: 0xf2f2f2 } });
  const { root, body, bones } = actor;
  // a bottle always in the right hand
  const glass = new THREE.MeshStandardMaterial({ color: 0x5b3a12, roughness: 0.15, transparent: true, opacity: 0.9 });
  const bottle = new THREE.Group();
  const bb = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.22, 12), glass);
  const bn = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.12, 10), glass); bn.position.y = 0.17;
  bottle.add(bb, bn);
  actor.attach("PalmR", bottle);
  scene.add(root);
  actor.play("Idle");

  let heading = 0, speed = 0, lateral = 0, drift = 0, bend = 0, dead = false;
  const forward = new THREE.Vector3(), side = new THREE.Vector3(), tmp = new THREE.Vector3();
  const head = bones["Head"], handL = bones["PalmL"];

  return {
    root,
    get heading() { return heading; },
    hand(out) { return handL.getWorldPosition(out); },
    face(pos) { heading = Math.atan2(pos.x - root.position.x, pos.z - root.position.z); root.rotation.y = heading; },
    // where the puke comes out
    mouth(out) { return head.getWorldPosition(out).add(tmp.set(Math.sin(heading), -0.05, Math.cos(heading)).multiplyScalar(0.2)); },
    reset(pos) {
      root.position.copy(pos); heading = 0; speed = 0; drift = 0; lateral = 0; bend = 0; dead = false;
      root.rotation.set(0, 0, 0); body.rotation.set(0, 0, 0);
      actor.play("Idle", { fade: 0 });
    },
    // move: {fwd, turn, puking, eating}; d: drunkenness 0..1 (10 ‰ = 1), grows the stagger continuously
    update(dt, move, d, t) {
      drift += (Math.sin(t * 0.7) * 1.4 + Math.sin(t * 1.9 + 1) * 0.8 - drift) * dt * 0.8;
      heading += (move.turn * 2.4 + drift * d * 2.2) * dt;
      const target = move.puking || move.eating ? 0 : move.fwd * 6 * (1 + d * 0.3);
      speed += (target - speed) * Math.min(1, dt * (4 - d * 2.5));  // drunk legs react later
      forward.set(Math.sin(heading), 0, Math.cos(heading));
      side.set(forward.z, 0, -forward.x);
      lateral = Math.sin(t * 1.3) * 1.2 * d + Math.sin(t * 3.1) * 0.5 * d * d;
      root.position.addScaledVector(forward, speed * dt).addScaledVector(side, lateral * dt * (0.4 + Math.abs(speed) * 0.25));
      root.rotation.y = heading;

      const v = Math.abs(speed);
      if (move.eating) actor.play("Clapping", { speed: 0.8 });       // hands to the mouth, bite after bite
      else if (v > 3.2) actor.play("Run", { speed: v / 5 });
      else if (v > 0.3) actor.play("Walk", { speed: Math.max(0.6, v / 2) });
      else actor.play("Idle");
      actor.update(dt);

      bend += ((move.puking ? 0.7 : 0) - bend) * Math.min(1, dt * 6);  // folds over to puke
      body.rotation.z = Math.sin(t * 1.9) * 0.3 * d + lateral * 0.07;
      body.rotation.x = Math.sin(t * 1.1) * 0.12 * d + bend;
      return { speed, forward };
    },
    // dyntka: the death animation plays once; true when it is over
    fall(dt) {
      if (!dead) { dead = true; body.rotation.set(0, 0, 0); actor.play("Death", { once: true, fade: 0.15 }); }
      actor.update(dt);
      return actor.progress() >= 0.98;
    },
  };
}
