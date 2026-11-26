// Beers lying around the estate: kinds, spawning, picking up.
import * as THREE from "three";

// promil: what one pickup adds; sip: seconds you must stand still to drink it
export const KINDS = [
  { id: "perelka", name: "Perełka", color: 0xe8c547, promil: 0.35, weight: 30, lines: ["Klasyk.", "Smakuje jak wtorek.", "Na zdrowie, wątroba!", "Perełka nigdy nie zawodzi. Ty tak."] },
  { id: "mioduwka", name: "Mioduwka", color: 0xd48a1c, promil: 0.5, weight: 22, lines: ["Miodzio.", "Słodko i smutno.", "Pszczoły by się wstydziły."] },
  { id: "ipa", name: "Kraft IPA", color: 0x8fcf4a, promil: 0.9, weight: 10, sip: 1.4, lines: ["Notki grejpfruta i rozpaczy.", "Hipster uronił łzę.", "38 zł za smak sosny."] },
  { id: "promka", name: "Promka 4+2", color: 0x4aa3ff, promil: 1.8, count: 6, weight: 7, lines: ["Sześciopak w 4 sekundy. Ekonomia.", "Kasjerka patrzyła z szacunkiem."] },
  { id: "zero", name: "Bezalko", color: 0xf4f4f4, promil: -0.6, weight: 12, lines: ["FRAJER.", "Wątroba dziękuje. Grupa nie.", "Kierowca roku. Gratulacje, nudziarzu."] },
  { id: "bimber", name: "Klekot Bociana", color: 0xcfeeff, promil: 2.2, weight: 5, teleport: true, lines: ["Gdzie ja jestem?", "Film się urwał. Zaczął się nowy.", "Bocian zaklekotał. Ty też."] },
];
const TOTAL = KINDS.reduce((s, k) => s + k.weight, 0);
const pickKind = () => { let r = Math.random() * TOTAL; return KINDS.find((k) => (r -= k.weight) < 0) || KINDS[0]; };

function glow(color) {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  const col = new THREE.Color(color);
  r.addColorStop(0, `rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},0.9)`);
  r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
}

function bottleMesh(kind) {
  const g = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: kind.color, emissive: kind.color, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1 });
  const one = (x, z, s = 1) => {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.17 * s, 0.5 * s, 10), glass); body.position.y = 0.25 * s;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.12 * s, 0.25 * s, 8), glass); neck.position.y = 0.62 * s;
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.165 * s, 0.165 * s, 0.2 * s, 10), new THREE.MeshStandardMaterial({ color: 0xf4efe2, roughness: 0.8 })); label.position.y = 0.25 * s;
    b.add(body, neck, label); b.position.set(x, 0, z);
    return b;
  };
  if (kind.id === "promka") for (let i = 0; i < 6; i++) g.add(one((i % 3 - 1) * 0.36, (i < 3 ? -0.2 : 0.2), 0.75));
  else if (kind.id === "bimber") {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 12), new THREE.MeshStandardMaterial({ color: kind.color, emissive: kind.color, emissiveIntensity: 0.6, roughness: 0.1, transparent: true, opacity: 0.8 }));
    jar.position.y = 0.3; g.add(jar);
  } else g.add(one(0, 0, kind.id === "ipa" ? 1.15 : 1));
  const s = new THREE.Sprite(glow(kind.color)); s.scale.set(2.2, 2.2, 1); s.position.y = 0.5;
  g.add(s);
  return g;
}

export function createBeers(scene, world, count = 45) {
  const items = [];
  const spawn = (item) => {
    if (item) scene.remove(item.mesh);
    const kind = pickKind(), mesh = bottleMesh(kind), pos = world.randomSpot();
    mesh.position.copy(pos);
    scene.add(mesh);
    return { kind, mesh, pos, phase: Math.random() * 6, sipped: 0 };
  };
  for (let i = 0; i < count; i++) items.push(spawn());

  return {
    reset() { items.forEach((it, i) => { items[i] = spawn(it); }); },
    // onDrink(kind) when a beer is finished; returns the beer being sipped (for the progress ring)
    update(dt, t, playerPos, speed, onDrink) {
      let sipping = null;
      items.forEach((it, i) => {
        it.mesh.rotation.y += dt * 1.5;
        it.mesh.position.y = 0.25 + Math.sin(t * 2 + it.phase) * 0.15;
        const near = it.pos.distanceTo(playerPos) < 1.4;
        if (!near) { it.sipped = 0; return; }
        if (it.kind.sip) {
          if (Math.abs(speed) > 1.2) { it.sipped = 0; return; }
          it.sipped += dt;
          sipping = { kind: it.kind, progress: it.sipped / it.kind.sip };
          if (it.sipped < it.kind.sip) return;
        }
        onDrink(it.kind);
        items[i] = spawn(it);
      });
      return sipping;
    },
  };
}
