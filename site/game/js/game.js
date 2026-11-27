// Drink your way to 10 ‰ in about two minutes on a night-time estate, on foot or in a stolen car. Dying is winning.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildWorld } from "./world.js";
import { createPlayer } from "./player.js";
import { createBeers } from "./beers.js";
import { createDrunkFx } from "./drunk.js";
import { createInput } from "./input.js";
import { createDriving } from "./car.js";
import { createVomit } from "./vomit.js";
import { createInteriors, ROOM_TYPES } from "./interiors.js";
import { loadAssets } from "./actor.js";

const GOAL = 10;          // ‰ for the win
const DECAY = 0.006;      // ‰ the body burns per second, so you can't stop drinking
const DROP_EVERY = 7;
const USE_RANGE = 6;      // E works (and the hint shows) this far from a car or a kebab stand     // seconds between beers falling from the sky near you
const STAGES = [
  [2, "Świat się buja. To nie świat, to ty."],
  [3, "Widzisz dwa piwa. Wypij oba."],
  [4, "Jesteś lekko wstawiony. Lekko jak fortepian."],
  [6, "Nawalony jak messerschmitt. Lecisz."],
  [7, "Mówisz po niemiecku. Nie znasz niemieckiego."],
  [8, "Jesteś w trzy dupy. Policz je. Nie dasz rady."],
  [9, "Widzisz światełko w tunelu. To sklep 24h. Albo Bóg."],
];
const LINES = {
  enter: ["Prawo jazdy masz w sercu.", "Kluczyki w stacyjce. Jak zawsze na tym osiedlu.", "Lusterko pokazuje dwóch ciebie. Obaj prowadzicie."],
  exit: ["Wysiadasz. Auto i tak nie było twoje.", "Zaparkowane po bandzie. Dosłownie."],
  crash: ["JEBUT!", "To nie był krawężnik. To był Mirek.", "Ubezpieczyciel właśnie dostał zawału.", "Blacharz już otwiera szampana."],
  vomit: ["Oddajesz Perełkę naturze.", "Pawik jak z obrazka. Monet by się zesrał.", "Wyszło nosem. Nawet frytki.", "Pizza z wczoraj pozdrawia."],
  vomitCar: ["Porzygałeś deskę rozdzielczą. Właściciel będzie zachwycony."],
  blackout: ["*urwał się film*", "*film się urwał, dubbing został*"],
  tree: ["Drzewo: 0. Ty: 1.", "Ekolodzy już jadą.", "Dzięcioł stracił mieszkanie."],
  room: {
    stairwell: "Klatka schodowa. Pachnie kapustą i panem Zdzisiem.",
    party: "Melanż u Mariusza. Nikt nie wie, kto to Mariusz.",
    cellar: "Piwnica. Ciemno, wilgotno, idealnie.",
    grandma: "Babcia! Pierogi na stole, telewizor na full.",
  },
  kebab: ["Kebab z baraniny. Baranina z kota. Smakuje.", "Sos czosnkowy wchłonął promile i twoją godność.", "Ostry jak żyleta. Jutro zaboli dwa razy."],
};
const $ = (id) => document.getElementById(id);
const store = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// a kebab in a wrap: pita, meat, lettuce, tomato
function kebabMesh() {
  const g = new THREE.Group();
  const m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
  const wrap = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 12, 1, true), m(0xe7c98f)); wrap.rotation.x = Math.PI; wrap.material.side = THREE.DoubleSide;
  const meat = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), m(0x7a3e1d)); meat.position.y = 0.14; meat.scale.y = 0.6;
  const salad = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), m(0x6fb33a)); salad.position.set(0.04, 0.18, 0.02);
  const tomato = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), m(0xd23a24)); tomato.position.set(-0.04, 0.18, -0.02);
  g.add(wrap, meat, salad, tomato);
  return g;
}

function graveTexture(lines) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 320;
  const g = c.getContext("2d");
  g.fillStyle = "#8d9096"; g.fillRect(0, 0, 256, 320);
  g.fillStyle = "#2b2d31"; g.textAlign = "center";
  g.font = "bold 26px Georgia, serif"; g.fillText("✝", 128, 50);
  g.font = "bold 22px Georgia, serif"; g.fillText("TU SPOCZYWA", 128, 92);
  g.font = "bold 26px Georgia, serif"; g.fillText("TWOJA WĄTROBA", 128, 134);
  g.font = "20px Georgia, serif"; lines.forEach((l, i) => g.fillText(l, 128, 182 + i * 32));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function startGame(autoplay = false) {
  const assets = await loadAssets();  // ~2.5 MB of CC0 models, only when someone wants to play
  const wrap = $("gameWrap"), canvas = $("gameCanvas");
  // phones get a lighter picture: no shadows, lower resolution
  const phone = window.matchMedia("(pointer: coarse)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !phone });
  renderer.setPixelRatio(phone ? 1 : Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = !phone;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  // soft reflections on car paint, glass and puddles
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.18;
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 400);
  const world = buildWorld(scene, assets);
  const player = createPlayer(scene, assets);
  const beers = createBeers(scene, world);
  const fx = createDrunkFx(renderer, scene, camera);
  const input = createInput(wrap, $("gJoy"), $("gUse"));
  const driving = createDriving(world);
  const vomit = createVomit(scene);
  const interiors = createInteriors(assets);
  // the four doors closest to the start lead to four different places, the rest repeat them
  [...world.doors].sort((a, b) => a.pos.length() - b.pos.length()).forEach((d, i) => { d.type = ROOM_TYPES[i % ROOM_TYPES.length]; });
  let inside = null, insideDoor = null;
  const sauce = createVomit(scene, 0xf4f1e6, 0x2a2a2a);  // garlic sauce dripping off the kebab

  const resize = () => {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    renderer.setSize(w, h, false); fx.resize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(wrap);
  resize();

  let state = "menu", promil = 0, drunk = 0, count = 0, elapsed = 0, stage = 0, grave = null, orbit = 0, toastTimer = 0, puking = 0, fallDone = 0, dropIn = DROP_EVERY, eating = null;
  const clock = new THREE.Clock(), mouth = new THREE.Vector3(), face = new THREE.Vector3(), handPos = new THREE.Vector3();
  const KEBAB_TIME = 2.9, BITES = [1.3, 1.9, 2.5];

  // food: {mesh, source(out): where it is handed over from, sober: ‰ it takes off, icon, sauce?, k? (kebab stand)}
  function startEating(food, facing) {
    eating = { t: 0, bite: 0, from: new THREE.Vector3(), ...food };
    (inside ? inside.scene : scene).add(eating.mesh);
    player.face(facing);
  }
  function startKebab(k) {
    k.cooldown = 30; k.serving = 1.2;
    startEating({ k, mesh: kebabMesh(), source: (out) => k.handV.getWorldPosition(out), sober: 1.2, icon: "🥙", sauce: true }, k.group.position);
    toast(`🥙 ${pick(LINES.kebab)}`);
  }
  // a fixed shot from the side of the counter: the guy, the hand-over and you, all in frame
  const shot = { pos: new THREE.Vector3(), look: new THREE.Vector3() }, away = new THREE.Vector3();
  function kebabShot() {
    const p = player.root.position, k = eating.k.group.position;
    away.subVectors(p, k).setY(0).normalize();
    shot.pos.copy(p).addScaledVector(away, 1.8).add(face.set(away.z, 0, -away.x).multiplyScalar(3.2)).setY(2.1);
    shot.look.lerpVectors(p, k, 0.45).setY(1.6);
    return shot;
  }
  function stopEating() { if (eating) { eating.mesh.removeFromParent(); eating = null; } }
  // it is handed over and flies to your hand, three bites (with sauce on a kebab), then it sobers you up
  function eat(dt) {
    const e = eating;
    e.t += dt;
    player.hand(handPos);
    if (e.t < 0.9) {
      e.source(e.from);
      e.mesh.position.lerpVectors(e.from, handPos, Math.max(0, Math.min(1, (e.t - 0.35) / 0.55)));
    } else e.mesh.position.copy(handPos).add(face.set(0, 0.12, 0));
    e.mesh.rotation.y += dt * 2;
    if (e.bite < BITES.length && e.t >= BITES[e.bite]) {
      e.bite++;
      e.mesh.scale.multiplyScalar(0.72);
      if (e.sauce) for (let i = 0; i < 3; i++) sauce.spray(handPos, face.set(0, -1, 0));
    }
    if (e.t >= KEBAB_TIME) {
      stopEating();
      promil = Math.max(0, promil - e.sober);
      toast(`${e.icon} −${String(e.sober).replace(".", ",")} ‰`);
    }
  }

  // messages wait in a queue, so each one stays long enough to read
  const queue = [];
  const showNext = () => {
    const el = $("gToast"), next = queue.shift();
    if (!next) { el.className = "g-toast"; toastTimer = 0; return; }
    el.textContent = next.text; el.className = `g-toast show ${next.big ? "big" : ""}`;
    toastTimer = setTimeout(showNext, (next.big ? 4500 : 3800) + next.text.length * 25);
  };
  const toast = (text, big = false) => {
    if (queue.length >= 3) queue.shift();  // don't fall minutes behind
    queue.push({ text, big });
    if (!toastTimer) showNext();
  };
  const hud = () => {
    $("gPromil").textContent = promil.toFixed(2).replace(".", ",");
    $("gBar").style.width = `${Math.min(100, (promil / GOAL) * 100)}%`;
    $("gBar").style.background = `hsl(${45 - drunk * 45}, 95%, 55%)`;
    $("gBeers").textContent = count;
    $("gTime").textContent = mmss(elapsed);
  };
  const nearestCar = () => {
    let best = null, bd = USE_RANGE;  // the "steal the car" hint shows up (and works) from a few steps away
    for (const c of world.cars) { const d = c.group.position.distanceTo(player.root.position); if (d < bd) { bd = d; best = c; } }
    return best;
  };

  function newRun() {
    if (driving.car) driving.exit();
    leaveRoom();
    // ?dyntka=7 in the URL starts already at 7 ‰ (for testing the effects)
    promil = Math.min(GOAL, Number(new URLSearchParams(location.search).get("dyntka")) || 0);
    drunk = promil / GOAL; count = 0; elapsed = 0; orbit = 0; puking = 0; fallDone = 0;
    stage = STAGES.filter(([p]) => promil >= p).length;
    if (grave) { scene.remove(grave); grave = null; }
    stopEating();
    player.reset(new THREE.Vector3(0, 0, 0));
    player.root.visible = true;
    beers.reset(player.root.position); fx.reset(); vomit.clear();
    camera.position.set(0, 4, -7);
    $("gStart").hidden = true; $("gEnd").hidden = true;
    queue.length = 0; clearTimeout(toastTimer); toastTimer = 0; $("gToast").className = "g-toast";
    state = "play"; input.active = true;
    hud();
    // ?pokoj=party (stairwell, party, cellar, grandma) starts inside that room (for testing)
    const testRoom = new URLSearchParams(location.search).get("pokoj");
    if (ROOM_TYPES.includes(testRoom)) enterRoom(world.doors.find((d) => d.type === testRoom));
  }

  function drink(kind) {
    count += kind.count || 1;
    promil = Math.max(0, promil + kind.promil);
    if (Math.random() < 0.35) toast(pick(kind.lines));  // a comment now and then, not after every beer
    while (stage < STAGES.length && promil >= STAGES[stage][0]) { toast(STAGES[stage][1], true); stage++; }
  }

  // what E (or the touch button) would do right now: get out, eat at the nearest stand, or steal the nearest car
  function useTarget() {
    if (inside) return inside.target(player.root.position);
    if (driving.car) return { kind: "exit" };
    const pos = player.root.position, car = nearestCar(), kebab = world.kebabAt(pos, USE_RANGE);
    const door = world.doors.find((d) => d.pos.distanceTo(pos) < 3.5);
    if (door) return { kind: "door", door };
    if (kebab && (!car || kebab.front.distanceTo(pos) < car.group.position.distanceTo(pos))) return { kind: "kebab", kebab };
    return car ? { kind: "car", car } : null;
  }
  function use(target) {
    if (target.kind === "door") { fade(() => enterRoom(target.door)); return; }
    if (target.kind === "leave") { fade(leaveRoom); return; }
    if (target.kind === "talk") {
      const res = inside.talk(target.npc);
      toast(res.text);
      if (res.promil) promil = Math.max(0, promil + res.promil);
      if (res.food) startEating(res.food, res.food.source(new THREE.Vector3()));
      return;
    }
    if (target.kind === "exit") {
      player.root.position.copy(driving.exit());
      player.root.visible = true;
      toast(pick(LINES.exit));
    } else if (target.kind === "kebab") {
      player.root.position.copy(target.kebab.front);  // step up to the counter
      startKebab(target.kebab);
    } else {
      driving.enter(target.car);
      player.root.visible = false;
      toast(`${target.car.spec.name}. ${pick(LINES.enter)}`);
    }
  }

  // a quick fade to black hides the jump between the estate and a room
  let fading = false;
  function fade(fn) {
    if (fading) return;
    fading = true;
    $("gFade").classList.add("on");
    setTimeout(() => { fn(); $("gFade").classList.remove("on"); fading = false; }, 280);
  }
  function enterRoom(door) {
    const room = interiors.get(door.type);
    inside = room; insideDoor = door;
    room.scene.add(player.root);
    fx.setScene(room.scene, room.bounds);
    vomit.moveTo(room.scene); sauce.moveTo(room.scene);
    player.reset(room.spawn);
    camera.position.set(0, 2.2, room.bounds.minZ);
    room.onEnter?.(player);
    toast(LINES.room[door.type]);
  }
  function leaveRoom() {
    if (!inside) return;
    inside.onExit?.(player);
    scene.add(player.root);
    fx.setScene(scene, null);
    vomit.moveTo(scene); sauce.moveTo(scene);
    player.reset(insideDoor.pos);
    player.face(insideDoor.pos.clone().add(new THREE.Vector3(0, 0, insideDoor.face * 5)));  // step out, back to the block
    camera.position.copy(insideDoor.pos).add(new THREE.Vector3(0, 3, -insideDoor.face * 5));
    inside = null;
  }

  function die() {
    stopEating();
    leaveRoom();
    if (driving.car) { player.root.position.copy(driving.exit()); player.root.visible = true; }
    state = "dying"; input.active = false;
    $("gHint").hidden = true; $("gUse").hidden = true;
    toast("💀", true);
  }

  function showGrave() {
    const best = Number(store.get("dyntka-best", 0)), record = !best || elapsed < best;
    if (record) store.set("dyntka-best", elapsed.toFixed(1));
    const stone = new THREE.Group();
    const side = new THREE.MeshStandardMaterial({ color: 0x8d9096, roughness: 0.9 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2, 0.3), [side, side, side, side,
      new THREE.MeshStandardMaterial({ map: graveTexture([`${count} piw`, mmss(elapsed)]), roughness: 0.9 }), side]);
    slab.position.y = 1; slab.castShadow = true;
    const mound = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 2.6), new THREE.MeshStandardMaterial({ color: 0x3b2a1a }));
    mound.position.set(0, 0.15, -1.5);
    stone.add(slab, mound);
    const p = player.root.position;
    stone.position.set(p.x, 0, p.z);
    stone.rotation.y = player.heading + Math.PI;
    scene.add(stone);
    grave = stone;
    player.root.visible = false;
    $("gEndText").innerHTML = `<b>${count}</b> piw · <b>${mmss(elapsed)}</b><br>`
      + (record ? "🏆 Nowy rekord" : `Rekord: ${mmss(best)}`);
    $("gEnd").hidden = false;
    state = "dead";
  }

  function play(dt, t) {
    elapsed += dt;
    promil = Math.max(0, promil - DECAY * dt);
    drunk = Math.min(1, promil / GOAL);
    const move = input.read();
    if (eating) { move.fwd = 0; move.turn = 0; move.use = false; move.eating = eating.t > 0.9; }
    const target = !eating && useTarget();
    if (move.use && target) use(target);
    move.puking = puking > 0;
    puking -= dt;

    let follow = player, dist = 6.5, reach = 2.6;
    if (inside) {
      player.update(dt, move, drunk, t);
      inside.resolve(player.root.position, 0.45);
      inside.update(dt, t, drunk, player.root.position, { drink, toast });
      if (eating) eat(dt);
      dist = 4.2;
    } else if (driving.car) {
      if (Math.abs(driving.speed) > (driving.car.spec.smash ? 1 : 4) && world.smashTree(driving.follow.root.position, driving.heading, 2)) {
        driving.slow(0.75);
        toast(pick(LINES.tree));
      }
      const impact = driving.update(dt, move, drunk, t);
      if (impact > 6) toast(pick(LINES.crash), impact > 14);
      follow = driving.follow; dist = 9; reach = 3.2;
      player.root.position.copy(driving.follow.root.position);
    } else {
      player.update(dt, move, drunk, t);
      world.resolve(player.root.position, 0.45);
      if (eating) eat(dt);
    }
    if (!inside) {
      world.update(follow.root.position, dt);
      if ((dropIn -= dt) <= 0) { dropIn = DROP_EVERY; beers.drop(follow.root.position); }
      beers.update(dt, t, follow.root.position, reach, drink);
    }

    const ev = fx.update(dt, t, drunk, follow, dist, eating?.k && kebabShot());
    if (ev === "blackout") {
      toast(pick(LINES.blackout));
      if (!driving.car && !inside) player.root.position.add(new THREE.Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8));
    }
    if (ev === "vomit") {
      puking = 1.6;
      toast(pick(driving.car ? LINES.vomitCar : LINES.vomit));
      if (!driving.car) vomit.puddle(player.mouth(mouth).add(face.set(Math.sin(player.heading), 0, Math.cos(player.heading)).multiplyScalar(0.8)), inside ? 0.02 : 0.2);
    }
    if (puking > 0 && !driving.car) vomit.spray(player.mouth(mouth), face.set(Math.sin(player.heading), -0.6, Math.cos(player.heading)).normalize());
    vomit.update(dt); sauce.update(dt);

    if (!inside) world.lamps.forEach((l, i) => { l.rotation.z = Math.sin(t * 2 + i) * 0.35 * drunk * drunk; l.position.y = Math.abs(Math.sin(t * 3 + i)) * 0.6 * drunk * drunk; });
    const hint = target && {
      exit: ["🚶", "wysiądź"], kebab: ["🥙", "zjedz kebsa"], leave: ["🚪", "wyjdź"],
      door: ["🚪", `wejdź do klatki ${target.door?.letter}`], talk: [target.icon, target.label],
      car: ["🚗", `ukradnij ${target.car?.spec.acc}`],
    }[target.kind];
    $("gHint").hidden = !hint || target.kind === "exit";
    $("gUse").hidden = !hint;
    if (hint) { $("gHint").innerHTML = `<kbd>E</kbd> ${hint[1]}`; $("gUse").textContent = hint[0]; }
    hud();
    if (promil >= GOAL) die();
  }

  function frame() {
    const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
    if (state === "play") play(dt, t);
    else if (state === "dying") {
      fx.update(dt, t, 1, player);
      vomit.update(dt);
      if (player.fall(dt)) { fallDone += dt; if (fallDone > 0.8) showGrave(); }
    } else if (state === "dead" && grave) {
      orbit += dt * 0.35;
      camera.position.set(grave.position.x + Math.sin(orbit) * 5, 2.2, grave.position.z + Math.cos(orbit) * 5);
      camera.lookAt(grave.position.x, 1, grave.position.z);
      camera.fov = 55; camera.updateProjectionMatrix();
    } else {
      // menu: slow flight over the estate
      camera.position.set(Math.sin(t * 0.1) * 30, 14, Math.cos(t * 0.1) * 30);
      camera.lookAt(0, 0, 0);
      world.update(new THREE.Vector3(0, 0, 0));
    }
    if (state === "dead" || state === "menu") fx.still(t);
    fx.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  $("gPlay").onclick = newRun;
  $("gAgain").onclick = newRun;
  $("gPlay").textContent = "Graj 🍺";
  if (autoplay) newRun();
  $("gFull").hidden = !wrap.requestFullscreen;  // iPhones can't fullscreen a page element
  $("gFull").onclick = () => (document.fullscreenElement ? document.exitFullscreen() : wrap.requestFullscreen?.());
}
