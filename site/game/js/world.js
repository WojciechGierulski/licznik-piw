// The night-time estate: blocks of flats with balconies, streets, lamps, parked cars, a 24h shop and a starry sky.
import * as THREE from "three";

export const HALF = 105;  // the playable area is a square of ±HALF metres
const GRID = 30;          // distance between street axes
const LAMP_LIGHTS = 6;    // real lights follow the lamps nearest to the player

const canvasTex = (w, h, draw, repeat = [1, 1], color = true) => {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  t.anisotropy = 4;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
const noise = (g, w, h, base, spread, n = 9000, size = 2) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = Math.random() * spread - spread / 2;
    g.fillStyle = `rgba(${v > 0 ? "255,255,255" : "0,0,0"},${Math.abs(v)})`;
    g.fillRect(Math.random() * w, Math.random() * h, size, size);
  }
};

// a block of flats facade: pastel panels after thermo-modernisation, windows with frames, some lit
const PASTELS = ["#c9b79c", "#b9c2b0", "#c7a98f", "#aeb8c4", "#d1c49e", "#b8aab9", "#9fb0a3"];
function facade(cols, floors) {
  const cw = 32, fh = 32, base = PASTELS[Math.floor(Math.random() * PASTELS.length)];
  const accent = PASTELS[Math.floor(Math.random() * PASTELS.length)];
  const lit = [];
  const map = canvasTex(cols * cw, floors * fh, (g, w, h) => {
    noise(g, w, h, base, 0.08, w * h / 6, 1);
    g.fillStyle = accent; g.globalAlpha = 0.55;
    const stripe = Math.floor(Math.random() * Math.max(1, cols - 2));
    g.fillRect(stripe * cw, 0, cw * 2, h); g.globalAlpha = 1;
    for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
      const x = c * cw + 7, y = f * fh + 8, on = Math.random() < 0.38;
      const glow = Math.random() < 0.75 ? "#ffcf7a" : Math.random() < 0.5 ? "#8fc7ff" : "#ff9f6b";  // lamp, TV, candle
      g.fillStyle = "#e9e6df"; g.fillRect(x - 2, y - 2, 22, 19);  // frame
      g.fillStyle = on ? glow : "#1a1d24";
      g.fillRect(x, y, 18, 15);
      if (on) lit.push([x, y, glow]);
      g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(x + 8, y, 2, 15);  // mullion
    }
  });
  // emissive map: only the lit windows glow
  const emissive = canvasTex(cols * cw, floors * fh, (g, w, h) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    for (const [x, y, glow] of lit) { g.fillStyle = glow; g.fillRect(x, y, 18, 15); }
  });
  return { map, emissive };
}

function skyDome(scene) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: "varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `varying vec3 p; void main(){
      float h = max(p.y, 0.0);
      vec3 horizon = vec3(0.23, 0.15, 0.20), zenith = vec3(0.01, 0.015, 0.05);
      gl_FragColor = vec4(mix(horizon, zenith, pow(h, 0.45)), 1.0); }`,
  }));
  scene.add(sky);
  const pts = [];
  for (let i = 0; i < 1400; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.45;
    pts.push(170 * Math.sin(ph) * Math.cos(th), 170 * Math.cos(ph), 170 * Math.sin(ph) * Math.sin(th));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, sizeAttenuation: false, fog: false })));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false }));
  moon.position.set(-90, 110, 70);
  scene.add(moon);
}

export function buildWorld(scene) {
  scene.background = new THREE.Color(0x120d18);
  scene.fog = new THREE.FogExp2(0x1a1220, 0.017);
  skyDome(scene);
  scene.add(new THREE.HemisphereLight(0x6070a8, 0x2a2016, 0.9));
  const moon = new THREE.DirectionalLight(0xaab8ff, 1.2);
  moon.position.set(-30, 50, 25);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  Object.assign(moon.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 140 });
  moon.shadow.bias = -0.0008;
  scene.add(moon, moon.target);

  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const colliders = [], lamps = [];

  // ground: asphalt everywhere, grass squares with curbs between the streets
  const asphalt = canvasTex(256, 256, (g, w, h) => noise(g, w, h, "#2a2c30", 0.16), [70, 70]);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 60, HALF * 2 + 60), std({ map: asphalt, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  const grassTex = canvasTex(256, 256, (g, w, h) => noise(g, w, h, "#24391f", 0.22, 14000), [5, 5]);
  const grass = std({ map: grassTex }), curb = std({ color: 0x8a8a86, roughness: 0.9 }), walk = std({ color: 0x55565a, roughness: 0.95 });
  for (let gx = -3; gx <= 3; gx++) for (let gz = -3; gz <= 3; gz++) {
    const x = gx * GRID, z = gz * GRID;
    const side = new THREE.Mesh(new THREE.BoxGeometry(24, 0.14, 24), walk); side.position.set(x, 0.07, z); side.receiveShadow = true;
    const edge = new THREE.Mesh(new THREE.BoxGeometry(24.3, 0.16, 24.3), curb); edge.position.set(x, 0.06, z);
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(21, 0.16, 21), grass); lawn.position.set(x, 0.08, z); lawn.receiveShadow = true;
    scene.add(edge, side, lawn);
  }
  // dashed lane markings
  const dash = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.02, 1.6), new THREE.MeshBasicMaterial({ color: 0xbdbdb0 }), 2 * 7 * 14);
  const m4 = new THREE.Matrix4(); let di = 0;
  for (let s = -3; s <= 3; s++) for (let k = -7; k < 7; k++) {
    const along = k * 15 + 7.5, axis = s * GRID + GRID / 2;
    dash.setMatrixAt(di++, m4.makeTranslation(axis, 0.01, along));
    dash.setMatrixAt(di++, m4.makeRotationY(Math.PI / 2).setPosition(along, 0.01, axis));
  }
  scene.add(dash);

  const add = (mesh, x, z, w, d, solid = true) => {
    mesh.position.x = x; mesh.position.z = z; mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    if (solid) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return mesh;
  };

  // blocks of flats with balconies (the middle squares stay free: that's where you start)
  const balconyGeo = new THREE.BoxGeometry(2.4, 1.1, 1.1), balconyMat = std({ color: 0x9b9892 });
  const balconies = [];
  for (let gx = -3; gx <= 3; gx++) for (let gz = -3; gz <= 3; gz++) {
    if ((Math.abs(gx) <= 1 && Math.abs(gz) <= 1 && !(gx === 1 && gz === 1)) || Math.random() < 0.12) continue;
    const cols = 4 + Math.floor(Math.random() * 4), floors = 4 + Math.floor(Math.random() * 8);
    const w = cols * 2.6, h = floors * 2.8, d = 9 + Math.random() * 3;
    const { map, emissive } = facade(cols, floors);
    const wall = std({ map, emissiveMap: emissive, emissive: 0xffffff, emissiveIntensity: 1.4, roughness: 0.9 });
    const side = std({ color: 0x8f8b84 }), roof = std({ color: 0x3c3d40 });
    const x = gx * GRID + (Math.random() - 0.5) * 3, z = gz * GRID + (Math.random() - 0.5) * 3;
    const block = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, roof, roof, wall, wall]), x, z, w, d);
    block.position.y = h / 2;
    const hut = add(new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), roof), x, z, 0, 0, false);
    hut.position.y = h + 1;
    for (let f = 1; f < floors; f++) for (let c = 0; c < cols; c++) {
      if (Math.random() < 0.45) continue;
      for (const face of [1, -1]) balconies.push([x - w / 2 + 1.3 + c * 2.6, f * 2.8 + 0.2, z + face * (d / 2 + 0.55)]);
    }
  }
  const bal = new THREE.InstancedMesh(balconyGeo, balconyMat, balconies.length);
  balconies.forEach(([x, y, z], i) => bal.setMatrixAt(i, m4.makeTranslation(x, y, z)));
  bal.castShadow = bal.receiveShadow = true;
  scene.add(bal);

  // the 24h shop with a lit shop window
  const shop = add(new THREE.Mesh(new THREE.BoxGeometry(9, 3.6, 6), std({ color: 0x3b8a46 })), 30, 30, 9, 6);
  shop.position.y = 1.8;
  const win = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.8), new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xfff1b0, emissiveIntensity: 2.2 }));
  win.position.set(30, 1.3, 26.98); win.rotation.y = Math.PI; scene.add(win);
  const signTex = canvasTex(512, 96, (g, w, h) => {
    g.fillStyle = "#16521f"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#ffe66b"; g.font = "bold 64px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("SKLEP 24h", w / 2, h / 2 + 4);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.3), new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 1.5 }));
  sign.position.set(30, 3.05, 26.97); sign.rotation.y = Math.PI; scene.add(sign);

  // street lamps: bright heads (they bloom), soft light pools, and a few real lights near the player
  const poleMat = std({ color: 0x2e3136, roughness: 0.6, metalness: 0.4 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc870, emissiveIntensity: 6 });
  const poolTex = canvasTex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "rgba(255,200,120,0.32)"); r.addColorStop(1, "rgba(255,200,120,0)");
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  });
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (let s = -3; s <= 3; s++) for (let k = -3; k <= 3; k++) {
    for (const [x, z, rot] of [[s * GRID + GRID / 2 - 1.6, k * GRID + 6, 0], [k * GRID + 6, s * GRID + GRID / 2 - 1.6, Math.PI / 2]]) {
      const lamp = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 6, 8), poleMat); pole.position.y = 3; pole.castShadow = true;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), poleMat); arm.position.set(0.55, 5.95, 0);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, 0.3), headMat); head.position.set(1.05, 5.85, 0);
      lamp.add(pole, arm, head);
      lamp.position.set(x, 0, z); lamp.rotation.y = rot;
      scene.add(lamp);
      const spot = new THREE.Vector3(1.05, 0, 0).applyEuler(lamp.rotation).add(lamp.position);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), poolMat);
      pool.rotation.x = -Math.PI / 2; pool.position.set(spot.x, 0.2, spot.z);
      scene.add(pool);
      lamps.push(lamp);
      lamp.userData.spot = spot;
      colliders.push({ minX: x - 0.2, maxX: x + 0.2, minZ: z - 0.2, maxZ: z + 0.2 });
    }
  }
  const lights = Array.from({ length: LAMP_LIGHTS }, () => {
    const l = new THREE.PointLight(0xffc477, 45, 16, 1.6);
    scene.add(l);
    return l;
  });

  // parked cars along the streets
  const carColors = [0x8a1c1c, 0x1c3f8a, 0xb7b7b2, 0x222222, 0x2f6b3a, 0x6b5a2f];
  const glass = std({ color: 0x0c1218, roughness: 0.15, metalness: 0.6 }), tyre = std({ color: 0x111111 });
  for (let i = 0; i < 24; i++) {
    const s = Math.floor(Math.random() * 7) - 3, along = (Math.random() - 0.5) * HALF * 1.8, alongX = Math.random() < 0.5;
    const axis = s * GRID + GRID / 2 + 2.3;
    const car = new THREE.Group();
    const paint = std({ color: carColors[i % carColors.length], roughness: 0.35, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 4.2), paint); body.position.y = 0.65;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.2), glass); cabin.position.set(0, 1.25, -0.2);
    car.add(body, cabin);
    for (const [wx, wz] of [[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 14), tyre);
      w.rotation.z = Math.PI / 2; w.position.set(wx, 0.35, wz); car.add(w);
    }
    car.traverse((m) => { m.castShadow = true; });
    const [x, z] = alongX ? [along, axis] : [axis, along];
    car.position.set(x, 0, z); car.rotation.y = alongX ? Math.PI / 2 : 0;
    scene.add(car);
    const [hw, hd] = alongX ? [2.2, 1] : [1, 2.2];
    colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd });
  }

  // benches and trees
  const wood = std({ color: 0x6b4a2b });
  for (let i = 0; i < 26; i++) {
    const x = (Math.floor(Math.random() * 7) - 3) * GRID + 8, z = (Math.floor(Math.random() * 7) - 3) * GRID - 8;
    const bench = add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 0.7), wood), x, z, 2.2, 0.7);
    bench.position.y = 0.6;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 0.1), wood); back.position.set(x, 0.95, z - 0.32); back.castShadow = true; scene.add(back);
  }
  const leaf = std({ color: 0x1e4a26 }), bark = std({ color: 0x4a3420 });
  for (let i = 0; i < 60; i++) {
    const x = (Math.random() - 0.5) * HALF * 2, z = (Math.random() - 0.5) * HALF * 2;
    if (Math.abs(x) < 12 && Math.abs(z) < 12) continue;
    const t = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 2.2, 7), bark); tr.position.y = 1.1;
    const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 + Math.random() * 0.8, 1), leaf); cr.position.y = 3.2; cr.scale.y = 1.2;
    t.add(tr, cr); t.traverse((m) => { m.castShadow = true; });
    t.position.set(x, 0, z);
    scene.add(t);
    colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
  }

  const blocked = (x, z, margin) => colliders.some((c) => x > c.minX - margin && x < c.maxX + margin && z > c.minZ - margin && z < c.maxZ + margin);
  const nearest = [];

  return {
    lamps,
    // move the few real lights to the lamps nearest the player, and the moon's shadow box with them
    update(pos) {
      nearest.length = 0;
      for (const l of lamps) nearest.push([l.userData.spot.distanceToSquared(pos), l]);
      nearest.sort((a, b) => a[0] - b[0]);
      lights.forEach((light, i) => { const s = nearest[i][1].userData.spot; light.position.set(s.x, 5.6, s.z); });
      moon.target.position.set(pos.x, 0, pos.z);
      moon.position.set(pos.x - 30, 50, pos.z + 25);
    },
    // push a circle (the player) out of every box it overlaps, and keep it inside the estate
    resolve(pos, r) {
      for (const c of colliders) {
        const cx = Math.max(c.minX, Math.min(pos.x, c.maxX)), cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
        const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          const d = Math.sqrt(d2) || 0.0001;
          pos.x = cx + (dx / d) * r; pos.z = cz + (dz / d) * r;
        }
      }
      pos.x = Math.max(-HALF, Math.min(HALF, pos.x));
      pos.z = Math.max(-HALF, Math.min(HALF, pos.z));
    },
    randomSpot(margin = 1.2) {
      for (;;) {
        const x = (Math.random() - 0.5) * HALF * 1.9, z = (Math.random() - 0.5) * HALF * 1.9;
        if (!blocked(x, z, margin)) return new THREE.Vector3(x, 0, z);
      }
    },
  };
}
