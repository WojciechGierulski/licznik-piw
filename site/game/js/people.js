// People in the interiors (neighbour, party crowd, grandma), built on the animated CC0 models.
import { createActor } from "./actor.js";

// kind: "man" | "woman"; colors recolour the model's materials by name (Shirt, Pants, Hair…)
export function createPerson(assets, kind, colors) {
  const actor = createActor(assets[kind], { height: kind === "woman" ? 1.7 : 1.82, colors });
  const { root, body } = actor;
  actor.play("Idle");
  return {
    root,
    // dance harder the drunker the player is: everyone looks wilder through beer goggles
    dance(dt, t, wild, phase = 0) {
      actor.play(Math.sin(t * 0.25 + phase) > 0 ? "Clapping" : "Jump", { speed: 0.8 + wild * 0.8 });
      body.rotation.y = Math.sin(t * (1 + wild) + phase) * (0.3 + wild * 0.9);
      body.rotation.z = Math.sin(t * 3 + phase) * wild * 0.2;
      actor.update(dt);
    },
    idle(dt) { actor.play("Idle"); actor.update(dt); },
    sit(dt) { actor.play("Sitting"); actor.update(dt); },
  };
}
