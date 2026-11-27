// Four small interiors behind the block doors. Each one is its own little scene, so only one place is drawn at a time.
import * as THREE from "three";
import { canvasTex, noise } from "./world.js";
import { KINDS, bottleMesh } from "./beers.js";
import { createPerson } from "./people.js";

const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const HOMEMADE = { id: "domowe", name: "Domowe", color: 0x8a5a2b, promil: 0.9, lines: ["Robione w wannie. Smakuje jak wanna.", "Od wujka Zbyszka. Wujek Zbyszek już nie widzi na jedno oko."] };

// walls/floor/ceiling seen from inside; returns colliders that keep you in the room
function room(scene, w, d, h, { floor, wall, ceil }) {
  // seen from inside: back faces, with the wall texture mirrored back so writing reads the right way
  const inside = (m, mirror) => {
    const c = m.clone(); c.side = THREE.BackSide;
    if (mirror && c.map) { c.map = c.map.clone(); c.map.repeat.x = -Math.abs(c.map.repeat.x); c.map.needsUpdate = true; }
    return c;
  };
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [inside(wall, true), inside(wall, true), inside(ceil), inside(floor), inside(wall, true), inside(wall, true)]);
  box.position.y = h / 2; box.receiveShadow = true;
  scene.add(box);
  // the way out, always in the middle of the near wall
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.08), std({ color: 0x5a3b22 }));
  door.position.set(0, 1.05, -d / 2 + 0.05);
  const exit = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.25), new THREE.MeshStandardMaterial({ map: signTex("WYJŚCIE", "#0b7a33", "#ffffff"), emissive: 0xffffff, emissiveMap: signTex("WYJŚCIE", "#0b7a33", "#ffffff"), emissiveIntensity: 0.8 }));
  exit.position.set(0, 2.35, -d / 2 + 0.02);
  scene.add(door, exit);
  return { minX: -w / 2 + 0.45, maxX: w / 2 - 0.45, minZ: -d / 2 + 0.45, maxZ: d / 2 - 0.45, h };
}
function signTex(text, bg, fg, w = 256, h = 96, size = 46) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.font = `bold ${size}px system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 2);
  });
}
const tiled = (draw, rx, ry, size = 256) => canvasTex(size, size, draw, [rx, ry]);

function makeRoom(scene, bounds, extras) {
  const colliders = [], beers = [], npcs = [], tickers = [];
  const solid = (mesh, w, d) => {
    scene.add(mesh); mesh.castShadow = mesh.receiveShadow = true;
    colliders.push({ minX: mesh.position.x - w / 2, maxX: mesh.position.x + w / 2, minZ: mesh.position.z - d / 2, maxZ: mesh.position.z + d / 2 });
    return mesh;
  };
  const beer = (x, y, z, kind = null) => {
    const k = kind || pick(KINDS.filter((b) => b.id !== "promka"));
    const mesh = bottleMesh(k); mesh.scale.setScalar(0.9);
    mesh.position.set(x, y, z); scene.add(mesh);
    beers.push({ kind: k, mesh, base: y, respawn: 0, fixedKind: kind });
  };
  return {
    scene, colliders, beers, npcs, tickers, solid, beer,
    bounds, spawn: new THREE.Vector3(0, 0, bounds.minZ + 2.6), exit: new THREE.Vector3(0, 0, bounds.minZ + 0.2),
    ...extras,
  };
}

// ------------------------------------------------------------------ the stairwell
function stairwell(assets) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101010);
  const w = 9, d = 12, h = 5.5;
  const wallTex = canvasTex(512, 512, (g, W, H) => {
    noise(g, W, H, "#d8cfb5", 0.06, 6000, 2);
    g.fillStyle = "#4f6f55"; g.fillRect(0, H * 0.62, W, H * 0.38);  // the classic oil-paint green half
    g.fillStyle = "#3c5541"; g.fillRect(0, H * 0.615, W, 6);
    g.font = "bold 34px Comic Sans MS, system-ui"; g.textAlign = "left";
    [["TU BYŁ ZDZICHU", "#c22"], ["KOCHAM JOLĘ", "#225"], ["PIWO > WODA", "#111"], ["KTO TO CZYTA TEN FRAJER", "#a33"]].forEach(([t, c], i) => {
      g.save(); g.translate(30 + (i % 2) * 230, 120 + i * 95); g.rotate((Math.random() - 0.5) * 0.25);
      g.fillStyle = c; g.fillText(t, 0, 0); g.restore();
    });
  }, [2, 1]);
  const floor = tiled((g, W, H) => { noise(g, W, H, "#8a857a", 0.25, 20000, 3); }, 4, 5);
  const bounds = room(scene, w, d, h, { floor: std({ map: floor, roughness: 0.5 }), wall: std({ map: wallTex }), ceil: std({ color: 0xcfcac0 }) });
  scene.add(new THREE.HemisphereLight(0xfff6e0, 0x403830, 0.5));
  const tube = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe8fff4, emissiveIntensity: 3 }));
  tube.position.set(0, h - 0.05, 0); scene.add(tube);
  const light = new THREE.PointLight(0xe8fff4, 30, 16, 1.5); light.position.set(0, h - 0.4, 0); scene.add(light);
  const r = makeRoom(scene, bounds, {});
  // stairs going up along the right wall
  const step = std({ color: 0x9a948a, roughness: 0.6 });
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3 * (i + 1), 0.5), step);
    s.position.set(3.2, 0.15 * (i + 1), -1.5 + i * 0.5); scene.add(s); s.receiveShadow = true;
  }
  r.colliders.push({ minX: 2.1, maxX: 4.5, minZ: -1.75, maxZ: 4.25 });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 6.5), std({ color: 0x5a2f1a })); rail.position.set(2.05, 2.6, 1.2); rail.rotation.x = -0.5; scene.add(rail);
  // the lift that hasn't worked since 1998
  const liftDoor = std({ color: 0x7d8288, metalness: 0.6, roughness: 0.4 });
  for (const z of [2.1, 2.9]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.1, 0.78), liftDoor); p.position.set(-4.45, 1.05, z); scene.add(p); }
  const liftSign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), std({ map: signTex("NIECZYNNA OD 1998", "#fff8d0", "#b00", 512, 128, 46) }));
  liftSign.position.set(-4.42, 2.4, 2.5); liftSign.rotation.y = Math.PI / 2; scene.add(liftSign);
  // mailboxes
  const box = std({ color: 0x6b6f3a, metalness: 0.3 });
  for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.32), box); m.position.set(-4.45, 1.2 + Math.floor(i / 4) * 0.32, -3.6 + (i % 4) * 0.36); scene.add(m); }
  // the neighbour
  const n = createPerson(assets, "man", { Shirt: 0xb0476b, Pants: 0xc98aa0, Hair: 0x6b6b6b });  // pink bathrobe vibes
  n.root.position.set(-2.6, 0, 3.2); n.root.rotation.y = Math.PI; scene.add(n.root);
  r.colliders.push({ minX: -3, maxX: -2.2, minZ: 2.8, maxZ: 3.6 });
  r.npcs.push({ person: n, label: "pogadaj z sąsiadem", icon: "💬", lines: [
    "Znowu ty? Jest trzecia w nocy, menelu.", "Ciszej, kurde bele. Dzieci śpią. Mają po 40 lat, ale śpią.",
    "Pożycz dwie dychy. Oddam w czwartek. Nie mówię którym.", "Ta winda ostatnio jechała, jak Małysz skakał.",
    "Ja w twoim wieku miałem już dwa rozwody. I dobrze mi z tym.",
  ] });
  [[3.2, 1.0, 0], [3.2, 2.2, 2], [-1.5, 0, -2], [1, 0, 4]].forEach(([x, y, z]) => r.beer(x, y, z));
  r.tickers.push((dt, t) => { light.intensity = Math.random() < 0.03 ? 5 : 30; tube.material.emissiveIntensity = light.intensity / 10; });
  return r;
}

// ------------------------------------------------------------------ the party flat
function party(assets) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0a10);
  const w = 10, d = 9, h = 2.8;
  const paper = tiled((g, W, H) => {
    g.fillStyle = "#6b5a7a"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#7d6b8c"; for (let x = 0; x < W; x += 32) g.fillRect(x, 0, 14, H);
    g.fillStyle = "#e4c86b"; for (let y = 16; y < H; y += 64) for (let x = 7; x < W; x += 32) g.fillRect(x - 2, y, 4, 4);
  }, 5, 2);
  const parquet = tiled((g, W, H) => {
    for (let y = 0; y < H; y += 32) for (let x = 0; x < W; x += 96) { g.fillStyle = `hsl(28, 45%, ${30 + Math.random() * 12}%)`; g.fillRect(x + (y / 32 % 2) * 48, y, 94, 30); }
  }, 4, 4);
  const bounds = room(scene, w, d, h, { floor: std({ map: parquet, roughness: 0.4 }), wall: std({ map: paper }), ceil: std({ color: 0xbdb6c4 }) });
  scene.add(new THREE.HemisphereLight(0x9a7cff, 0x201020, 0.35));
  const r = makeRoom(scene, bounds, {});
  const sofa = std({ color: 0x3d5a8a }), wood = std({ color: 0x5a3a20, roughness: 0.5 });
  const couch = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 3.4), sofa); couch.position.set(-4.3, 0.4, 1);
  r.solid(couch, 1, 3.4);
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.2), wood); table.position.set(1.8, 0.75, 1.2);
  r.solid(table, 2.2, 1.2);
  for (const [x, z] of [[0.8, 0.7], [2.8, 0.7], [0.8, 1.7], [2.8, 1.7]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.08), wood); l.position.set(x, 0.37, z); scene.add(l); }
  for (const x of [-4.3, 4.3]) {  // speakers
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.3, 0.6), std({ color: 0x151515 })); s.position.set(x, 0.65, 3.9); r.solid(s, 0.7, 0.6);
  }
  // disco ball and two colourful lights going round it
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.15, flatShading: true, emissive: 0x444444 }));
  ball.position.set(0, h - 0.5, 1); scene.add(ball);
  const lamps = [new THREE.PointLight(0xff3aa8, 22, 12, 1.4), new THREE.PointLight(0x35d6ff, 22, 12, 1.4)];
  lamps.forEach((l) => scene.add(l));
  // the crowd
  const looks = [["man", { Shirt: 0xd94848, Hair: 0x2a1a0e }], ["woman", { Shirt: 0x3aa35b, LightJacket: 0x2d7d46, Hair: 0xd9b25a }],
    ["man", { Shirt: 0xf0c419, Pants: 0x2a3a6b, Hair: 0x111111 }], ["woman", { Shirt: 0x8a4bd1, Jacket: 0x5e2f99, Hair: 0x7a3b1b }]];
  const spots = [[-2, 2.5], [-0.5, 3.4], [0.6, 2.6], [-1.4, 0.5]];
  looks.forEach(([kind, colors], i) => {
    const p = createPerson(assets, kind, colors); p.root.position.set(spots[i][0], 0, spots[i][1]); p.root.rotation.y = Math.random() * 6; scene.add(p.root);
    r.colliders.push({ minX: spots[i][0] - 0.35, maxX: spots[i][0] + 0.35, minZ: spots[i][1] - 0.35, maxZ: spots[i][1] + 0.35 });
    r.npcs.push({ person: p, dancer: true, phase: i * 1.7, label: "zagadaj", icon: "💬", lines: [
      "Ty, a ty kto jesteś? Chuj z tym, wchodź.", "Ziomal, rozlałeś mi browara na buty. Polej, to wybaczę.",
      "Ja nie piję. Ja degustuję. Od piątku.", "Gdzie jest kibel? A, nieważne, już nie trzeba.",
      "Mariusz? Nie znam żadnego Mariusza. Ja tu tylko mieszkam.",
    ] });
  });
  [[1.2, 0.8, 0.9], [1.8, 0.8, 1.5], [2.4, 0.8, 0.9], [2.6, 0.8, 1.5], [1.0, 0.8, 1.5], [-4.3, 0.85, 0]].forEach(([x, y, z]) => r.beer(x, y, z));
  r.tickers.push((dt, t) => {
    ball.rotation.y += dt * 1.2;
    lamps[0].position.set(Math.sin(t * 1.3) * 3, h - 0.6, 1 + Math.cos(t * 1.3) * 3);
    lamps[1].position.set(Math.sin(t * 1.3 + Math.PI) * 3, h - 0.6, 1 + Math.cos(t * 1.3 + Math.PI) * 3);
  });
  return r;
}

// ------------------------------------------------------------------ the cellar
function cellar(assets) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x020202);
  const w = 9, d = 8, h = 2.3;
  const concrete = tiled((g, W, H) => noise(g, W, H, "#4d4b47", 0.3, 25000, 2), 3, 2);
  const bounds = room(scene, w, d, h, { floor: std({ map: concrete }), wall: std({ map: concrete }), ceil: std({ map: concrete }) });
  scene.add(new THREE.AmbientLight(0x202530, 0.25));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffd38a, emissive: 0xffb04a, emissiveIntensity: 4 }));
  bulb.position.set(2, h - 0.35, 2); scene.add(bulb);
  const light = new THREE.PointLight(0xffb04a, 6, 7, 1.6); light.position.copy(bulb.position); scene.add(light);
  const r = makeRoom(scene, bounds, {});
  // shelves full of jars
  const shelfMat = std({ color: 0x4a3420 }), jarMat = new THREE.MeshStandardMaterial({ color: 0xc96f2a, roughness: 0.2, transparent: true, opacity: 0.8 });
  for (const z of [-1, 2]) {
    for (let y = 0; y < 3; y++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 2.4), shelfMat); s.position.set(-4.2, 0.4 + y * 0.6, z); scene.add(s); }
    const jars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 10), jarMat, 15);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 15; i++) jars.setMatrixAt(i, m4.makeTranslation(-4.2, 0.54 + Math.floor(i / 5) * 0.6, z - 0.9 + (i % 5) * 0.45));
    scene.add(jars);
    r.colliders.push({ minX: -4.5, maxX: -3.9, minZ: z - 1.2, maxZ: z + 1.2 });
  }
  [[1, 0, 3], [3.5, 0, 0], [-2, 0, -2.5], [2.5, 0, -2.5], [-1, 0, 1.5]].forEach(([x, y, z]) => r.beer(x, y, z, HOMEMADE));
  // rats
  const ratMat = std({ color: 0x5b5550, roughness: 0.9 }), tail = std({ color: 0xc79a8a });
  const rats = Array.from({ length: 4 }, () => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), ratMat); b.scale.set(0.8, 0.7, 1.4); b.position.y = 0.1;
    const hd = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 8), ratMat); hd.rotation.x = Math.PI / 2; hd.position.set(0, 0.1, 0.2);
    const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.3, 5), tail); tl.rotation.x = Math.PI / 2.2; tl.position.set(0, 0.08, -0.28);
    g.add(b, hd, tl); g.position.set((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 5);
    scene.add(g);
    return { g, dir: Math.random() * 6, bite: 0 };
  });
  // a torch in your hand: the only real light down here
  const torch = new THREE.SpotLight(0xfff2d6, 40, 14, 0.5, 0.5, 1.2);
  torch.position.set(0, 1.5, 0.3); torch.target.position.set(0, 0.5, 4);
  r.onEnter = (player) => { player.root.add(torch, torch.target); };
  r.onExit = (player) => { player.root.remove(torch, torch.target); };
  r.tickers.push((dt, t, pos, api) => {
    light.intensity = Math.random() < 0.05 ? 1 : 6;
    for (const rat of rats) {
      rat.dir += (Math.random() - 0.5) * dt * 6;
      const near = rat.g.position.distanceTo(pos) < 1.1;
      if (near) rat.dir = Math.atan2(rat.g.position.x - pos.x, rat.g.position.z - pos.z);  // flee
      rat.g.position.x = THREE.MathUtils.clamp(rat.g.position.x + Math.sin(rat.dir) * dt * (near ? 3 : 1.2), bounds.minX, bounds.maxX);
      rat.g.position.z = THREE.MathUtils.clamp(rat.g.position.z + Math.cos(rat.dir) * dt * (near ? 3 : 1.2), bounds.minZ, bounds.maxZ);
      rat.g.rotation.y = rat.dir;
      rat.bite -= dt;
      if (near && rat.bite <= 0) { rat.bite = 10; api.toast(pick(["Szczur ugryzł cię w kostkę. Wścieklizna w gratisie.", "Szczur patrzy na ciebie z politowaniem. Nawet szczur.", "Szczur zajumał ci kapsel. Szacun."])); }
    }
  });
  return r;
}

// ------------------------------------------------------------------ grandma's flat
function grandma(assets) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0806);
  const w = 8, d = 7, h = 2.6;
  const flowers = tiled((g, W, H) => {
    g.fillStyle = "#d8c7a0"; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { g.fillStyle = ["#b5544a", "#7a8f4a", "#c98f3a"][i % 3]; g.beginPath(); g.arc(Math.random() * W, Math.random() * H, 5, 0, 7); g.fill(); }
  }, 4, 2);
  const carpet = canvasTex(512, 512, (g, W, H) => {  // the famous carpet on the wall
    g.fillStyle = "#7a1520"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#e0b45a"; g.lineWidth = 10; g.strokeRect(20, 20, W - 40, H - 40);
    g.fillStyle = "#1d2d5a"; g.beginPath(); g.moveTo(W / 2, 70); g.lineTo(W - 70, H / 2); g.lineTo(W / 2, H - 70); g.lineTo(70, H / 2); g.fill();
    g.fillStyle = "#e0b45a"; g.beginPath(); g.arc(W / 2, H / 2, 60, 0, 7); g.fill();
  });
  const floorCarpet = tiled((g, W, H) => noise(g, W, H, "#6b2a2a", 0.2, 15000, 2), 3, 3);
  const bounds = room(scene, w, d, h, { floor: std({ map: floorCarpet }), wall: std({ map: flowers }), ceil: std({ color: 0xe8e0d0 }) });
  scene.add(new THREE.HemisphereLight(0xffe6c0, 0x2a1a10, 0.45));
  const lampLight = new THREE.PointLight(0xffc77a, 9, 10, 1.5); lampLight.position.set(-1, 2.3, 0); scene.add(lampLight);
  const r = makeRoom(scene, bounds, {});
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.2), std({ map: carpet })); rug.position.set(w / 2 - 0.02, 1.4, 0.5); rug.rotation.y = -Math.PI / 2; scene.add(rug);
  // the wall unit with glass doors and crystal
  const brown = std({ color: 0x4a2c18, roughness: 0.4 }), glassM = new THREE.MeshStandardMaterial({ color: 0x9fc7d9, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.35 });
  const unit = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.1, 0.5), brown); unit.position.set(-0.5, 1.05, d / 2 - 0.3); r.solid(unit, 4.5, 0.5);
  for (const x of [-1.8, -0.5, 0.8]) { const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.9), glassM); gl.position.set(x, 1.4, d / 2 - 0.54); gl.rotation.y = Math.PI; scene.add(gl); }
  // TV with something blue flickering
  const tv = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.6), std({ color: 0x3a3a3a })); tv.position.set(-2.8, 0.95, d / 2 - 1.1);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), new THREE.MeshStandardMaterial({ color: 0x223355, emissive: 0x6aa0ff, emissiveIntensity: 1.5 }));
  screen.position.set(-2.8, 0.97, d / 2 - 1.41); screen.rotation.y = Math.PI;
  const tvTable = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.7), brown); tvTable.position.set(-2.8, 0.3, d / 2 - 1.1);
  scene.add(tv, screen); r.solid(tvTable, 1, 0.7);
  const tvLight = new THREE.PointLight(0x6aa0ff, 5, 5, 1.5); tvLight.position.set(-2.8, 1, d / 2 - 2); scene.add(tvLight);
  // armchair, grandma, pierogi
  const chair = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 1), std({ color: 0x5a6b3a })); chair.position.set(2.3, 0.25, 0.8);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.25), chair.material); back.position.set(2.3, 0.9, 1.25);
  scene.add(back); r.solid(chair, 1.1, 1);
  const gm = createPerson(assets, "woman", { Shirt: 0x6b4c8a, LightJacket: 0x7d5a9e, Jacket: 0x5a3f73, Pants: 0x3a3030, Hair: 0xdedede, HairBase: 0xdedede });
  gm.root.position.set(2.3, 0, 0.85); gm.root.rotation.y = Math.PI; scene.add(gm.root);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.03, 18), std({ color: 0xf4f4f4, roughness: 0.3 })); plate.position.set(1.2, 0.62, -0.2);
  const stool = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), brown); stool.position.set(1.2, 0.3, -0.2);
  scene.add(plate); r.solid(stool, 0.6, 0.6);
  for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: 0xf0dca8 })); p.position.set(1.2 + Math.cos(i) * 0.12, 0.635, -0.2 + Math.sin(i) * 0.12); p.scale.set(1.3, 0.6, 0.8); scene.add(p); }
  let cooldown = 0;
  r.npcs.push({ person: gm, label: "babcia, daj pierogi", icon: "🥟", sitting: true, act() {
    if (cooldown > 0) return { text: "Babcia chrapie przy Kole Fortuny." };
    cooldown = 25;
    return { text: `🥟 ${pick(["Jedz, jedz, chudy jesteś jak szczypiorek.", "Zawsze wiedziałam, że skończysz jak dziadek. Dziadek był wspaniały.", "Dziewczynę to już masz? No tak, z taką gębą.", "Ruskie. Z miłością i cebulką."])} (−1 ‰)`, promil: -1 };
  } });
  r.tickers.push((dt) => { cooldown -= dt; screen.material.emissiveIntensity = 1.2 + Math.random() * 0.6; tvLight.intensity = 4 + Math.random() * 2; });
  return r;
}

// ------------------------------------------------------------------ shared behaviour
export const ROOM_TYPES = ["stairwell", "party", "cellar", "grandma"];
const BUILD = { stairwell, party, cellar, grandma };

export function createInteriors(assets) {
  const rooms = {};
  const get = (type) => {
    if (rooms[type]) return rooms[type];
    const r = BUILD[type](assets);
    r.type = type;
    // push the player out of furniture and keep them inside the walls
    r.resolve = (pos, rad) => {
      for (const c of r.colliders) {
        const cx = Math.max(c.minX, Math.min(pos.x, c.maxX)), cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
        const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
        if (d2 < rad * rad) { const dd = Math.sqrt(d2) || 0.0001; pos.x = cx + (dx / dd) * rad; pos.z = cz + (dz / dd) * rad; }
      }
      pos.x = THREE.MathUtils.clamp(pos.x, r.bounds.minX, r.bounds.maxX);
      pos.z = THREE.MathUtils.clamp(pos.z, r.bounds.minZ, r.bounds.maxZ);
    };
    // E targets inside: the door out, or someone to talk to
    r.target = (pos) => {
      if (pos.distanceTo(r.exit) < 1.6) return { kind: "leave", icon: "🚪", label: "wyjdź" };
      for (const n of r.npcs) if (n.person.root.position.distanceTo(pos) < 2.2) return { kind: "talk", icon: n.icon, label: n.label, npc: n };
      return null;
    };
    r.talk = (n) => (n.act ? n.act() : { text: pick(n.lines) });
    r.update = (dt, t, d, pos, api) => {
      for (const b of r.beers) {
        if (b.respawn > 0) { b.respawn -= dt; if (b.respawn <= 0) b.mesh.visible = true; continue; }
        b.mesh.rotation.y += dt * 1.5;
        b.mesh.position.y = b.base + 0.1 + Math.sin(t * 2 + b.base) * 0.06;
        if (Math.hypot(b.mesh.position.x - pos.x, b.mesh.position.z - pos.z) < 1.3) {
          api.drink(b.kind);
          b.mesh.visible = false; b.respawn = 20 + Math.random() * 10;
        }
      }
      for (const n of r.npcs) {
        if (n.dancer) n.person.dance(dt, t, d, n.phase);
        else if (n.sitting) n.person.sit(dt);
        else n.person.idle(dt);
        // people turn to look at you when you're close
        if (!n.dancer && n.person.root.position.distanceTo(pos) < 4) {
          const want = Math.atan2(pos.x - n.person.root.position.x, pos.z - n.person.root.position.z);
          n.person.root.rotation.y += (want - n.person.root.rotation.y) * Math.min(1, dt * 3);
        }
      }
      for (const tick of r.tickers) tick(dt, t, pos, api);
    };
    rooms[type] = r;
    return r;
  };
  return { get };
}
