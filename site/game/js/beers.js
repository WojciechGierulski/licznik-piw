// Beers lying around the estate: kinds, spawning (often near you), picking up on foot or by car.
import * as THREE from "three";

export const KINDS = [
  { id: "perelka", name: "Perełka", color: 0xf2c94c, promil: 0.32, weight: 32, lines: [
    "Wątroba właśnie napisała do ciebie „spierdalaj”.",
    "Ciepła jak dupa ratlerka. Wchodzi.",
    "Perełka. Szampan biedoty.",
    "Smakuje jak poniedziałek. Pijesz dalej, bo jesteś twardziel.",
  ] },
  { id: "mioduwka", name: "Miodówka", color: 0xe08a1e, promil: 0.45, weight: 22, lines: [
    "Kubuś Puchatek na odwyku też to pił.",
    "Miodówka. Pszczoły złożyły pozew zbiorowy.",
    "Słodkie jak pierwsza wypłata. I tak samo szybko znika.",
  ] },
  { id: "ipa", name: "Kraft IPA", color: 0x7ed957, promil: 0.6, weight: 12, lines: [
    "38 zł za smak choinki. Szanujemy.",
    "Notki grejpfruta, sosny i kredytu we frankach.",
    "Gorzkie jak mina teściowej na weselu.",
  ] },
  { id: "promka", name: "Promka 4+2", color: 0x4aa3ff, promil: 1.4, count: 6, weight: 8, lines: [
    "Sześciopak w 4 sekundy. Kasjerka zadzwoniła po księdza.",
    "Promocja 4+2. Matematyka mówi: zero kontroli.",
  ] },
];
const TOTAL = KINDS.reduce((s, k) => s + k.weight, 0);
const pickKind = () => { let r = Math.random() * TOTAL; return KINDS.find((k) => (r -= k.weight) < 0) || KINDS[0]; };
const promilText = (p) => `${p > 0 ? "+" : "−"}${Math.abs(p).toFixed(1).replace(".", ",")} ‰`;

// one floating label texture per kind: name + what it does
const labels = new Map();
function labelMaterial(kind) {
  if (labels.has(kind.id)) return labels.get(kind.id);
  const c = document.createElement("canvas"); c.width = 512; c.height = 160;
  const g = c.getContext("2d"), col = "#" + kind.color.toString(16).padStart(6, "0");
  g.fillStyle = "rgba(10,10,16,0.72)";
  g.beginPath(); g.roundRect(8, 8, 496, 144, 40); g.fill();
  g.strokeStyle = col; g.lineWidth = 8; g.stroke();
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "#ffffff"; g.font = "bold 62px system-ui, sans-serif"; g.fillText(kind.name, 256, 62);
  g.fillStyle = col; g.font = "bold 44px system-ui, sans-serif"; g.fillText(promilText(kind.promil), 256, 118);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false });
  labels.set(kind.id, m);
  return m;
}

export function bottleMesh(kind) {
  const g = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: kind.color, emissive: kind.color, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1 });
  const one = (x, z, s = 1) => {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.17 * s, 0.5 * s, 12), glass); body.position.y = 0.25 * s;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.12 * s, 0.25 * s, 10), glass); neck.position.y = 0.62 * s;
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.168 * s, 0.168 * s, 0.2 * s, 12), new THREE.MeshStandardMaterial({ color: 0xf4efe2, roughness: 0.8 }));
    label.position.y = 0.25 * s;
    b.add(body, neck, label); b.position.set(x, 0, z);
    return b;
  };
  if (kind.id === "promka") for (let i = 0; i < 6; i++) g.add(one((i % 3 - 1) * 0.36, (i < 3 ? -0.2 : 0.2), 0.8));
  else g.add(one(0, 0, kind.id === "ipa" ? 1.15 : 1));
  g.scale.setScalar(1.7);  // big enough to see from the street
  const label = new THREE.Sprite(labelMaterial(kind));
  label.scale.set(1.7, 0.53, 1); label.position.y = 1.05;
  g.add(label);
  g.userData.label = label;
  return g;
}

export function createBeers(scene, world, count = 90) {
  const items = [];
  const spawn = (item, near) => {
    if (item) scene.remove(item.mesh);
    const kind = pickKind(), mesh = bottleMesh(kind);
    let pos = world.randomSpot();
    // half of the new beers land close to you, so there is always something to drink
    if (near && Math.random() < 0.5) {
      for (let i = 0; i < 20; i++) {
        const p = world.randomSpot();
        if (p.distanceTo(near) > 8 && p.distanceTo(near) < 40) { pos = p; break; }
      }
    }
    mesh.position.copy(pos);
    scene.add(mesh);
    return { kind, mesh, pos, phase: Math.random() * 6, fall: 0 };
  };
  const MAX = count + 60;
  for (let i = 0; i < count; i++) items.push(spawn());

  return {
    reset(near) {
      items.splice(count).forEach((it) => scene.remove(it.mesh));
      items.forEach((it, i) => { items[i] = spawn(it, i % 8 === 0 ? near : null); });
    },
    // a fresh beer falls from the sky somewhere near you; the farthest old one makes room
    drop(near) {
      const it = spawn(null, near);
      if (it.pos.distanceTo(near) > 40) { scene.remove(it.mesh); return; }
      it.fall = 14;
      items.push(it);
      if (items.length > MAX) {
        let far = 0;
        items.forEach((x, i) => { if (x.pos.distanceTo(near) > items[far].pos.distanceTo(near)) far = i; });
        scene.remove(items[far].mesh); items.splice(far, 1);
      }
    },
    // drinks everything within reach (bigger reach in a car)
    update(dt, t, pos, reach, onDrink) {
      items.forEach((it, i) => {
        it.mesh.rotation.y += dt * 1.5;
        it.mesh.userData.label.visible = it.pos.distanceTo(pos) < 25;  // labels only nearby, no clutter
        if (it.fall > 0) it.fall = Math.max(0, it.fall - dt * 18);  // dropping in from above
        it.mesh.position.y = 0.2 + it.fall + Math.sin(t * 2 + it.phase) * 0.15;
        if (it.fall > 1 || it.pos.distanceTo(pos) > reach) return;
        onDrink(it.kind);
        items[i] = spawn(it, pos);
      });
    },
  };
}
