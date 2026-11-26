// Dyntka: drink your way to 10 ‰ on a night-time estate. Dying is winning.
import * as THREE from "three";
import { buildWorld } from "./world.js";
import { createPlayer } from "./player.js";
import { createBeers } from "./beers.js";
import { createDrunkFx } from "./drunk.js";
import { createInput } from "./input.js";

const GOAL = 10;          // ‰ to reach the dyntka
const DECAY = 0.015;      // ‰ the body burns per second, so you can't stop drinking
const STAGES = [
  [1, "Rozluźnienie. Wszystko pod kontrolą."],
  [2, "Świat lekko się buja. To nie świat."],
  [3, "Widzisz dwa piwa. Wypij oba."],
  [4, "Kolega pisze „jeszcze jedno”. Słuchasz kolegi."],
  [5, "Nogi mają własne plany."],
  [6, "Latarnie zaczynają tańczyć. Dołącz."],
  [7, "Mówisz po niemiecku. Nie znasz niemieckiego."],
  [8, "Film urywa się coraz częściej."],
  [9, "Czujesz dyntkę. Już blisko."],
];
const $ = (id) => document.getElementById(id);
const store = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function graveTexture(lines) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 320;
  const g = c.getContext("2d");
  g.fillStyle = "#8d9096"; g.fillRect(0, 0, 256, 320);
  g.fillStyle = "#2b2d31"; g.textAlign = "center";
  g.font = "bold 26px Georgia, serif"; g.fillText("✝", 128, 50);
  g.font = "bold 22px Georgia, serif"; g.fillText("TU SPOCZYWA", 128, 92);
  g.font = "bold 28px Georgia, serif"; g.fillText(lines[0].slice(0, 16), 128, 136);
  g.font = "20px Georgia, serif"; lines.slice(1).forEach((l, i) => g.fillText(l, 128, 182 + i * 32));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function startGame(autoplay = false) {
  const wrap = $("gameWrap"), canvas = $("gameCanvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 200);
  const world = buildWorld(scene);
  const player = createPlayer(scene);
  const beers = createBeers(scene, world);
  const fx = createDrunkFx(renderer, scene, camera);
  const input = createInput(wrap, $("gJoy"));

  const resize = () => {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    renderer.setSize(w, h, false); fx.resize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(wrap);
  resize();

  let state = "menu", promil = 0, drunk = 0, count = 0, elapsed = 0, stage = 0, grave = null, orbit = 0, toastTimer = 0;
  const clock = new THREE.Clock();

  const toast = (text, big = false) => {
    const el = $("gToast");
    el.textContent = text; el.className = `g-toast show ${big ? "big" : ""}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = "g-toast"; }, big ? 2600 : 1800);
  };
  const hud = () => {
    $("gPromil").textContent = promil.toFixed(2).replace(".", ",");
    $("gBar").style.width = `${Math.min(100, (promil / GOAL) * 100)}%`;
    $("gBar").style.background = `hsl(${45 - drunk * 45}, 95%, 55%)`;
    $("gBeers").textContent = count;
    $("gTime").textContent = mmss(elapsed);
  };

  function newRun() {
    // ?dyntka=7 in the URL starts already at 7 ‰ (for testing the effects)
    promil = Math.min(GOAL, Number(new URLSearchParams(location.search).get("dyntka")) || 0);
    drunk = promil / GOAL; count = 0; elapsed = 0; orbit = 0;
    stage = STAGES.filter(([p]) => promil >= p).length;
    if (grave) { scene.remove(grave); grave = null; }
    player.reset(new THREE.Vector3(0, 0, 0));
    beers.reset(); fx.reset();
    camera.position.set(0, 4, -7);
    $("gStart").hidden = true; $("gEnd").hidden = true; $("gSip").hidden = true;
    state = "play"; input.active = true;
    hud();
    toast("Cel: 10 promili. Powodzenia, wątrobo.", true);
  }

  function drink(kind) {
    count += kind.count || 1;
    promil = Math.max(0, promil + kind.promil);
    toast(`${kind.name}: ${pick(kind.lines)}`);
    if (kind.teleport) { player.root.position.copy(world.randomSpot()); }
    while (stage < STAGES.length && promil >= STAGES[stage][0]) { toast(STAGES[stage][1], true); stage++; }
  }

  function dyntka() {
    state = "dying"; input.active = false;
    $("gSip").hidden = true;
    toast("💀 DYNTKA", true);
  }

  function showGrave() {
    const nick = $("gNick").value.trim() || "Anonimowy Pijak";
    const best = Number(store.get("dyntka-best", 0)), record = !best || elapsed < best;
    if (record) store.set("dyntka-best", elapsed.toFixed(1));
    const stone = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2, 0.3), [
      ...Array(4).fill(new THREE.MeshLambertMaterial({ color: 0x8d9096 })),
      new THREE.MeshLambertMaterial({ map: graveTexture([nick, `${count} piw`, mmss(elapsed), "DYNTKA"]) }),
      new THREE.MeshLambertMaterial({ color: 0x8d9096 }),
    ]);
    slab.position.y = 1;
    const mound = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 2.6), new THREE.MeshLambertMaterial({ color: 0x3b2a1a }));
    mound.position.set(0, 0.15, -1.5);
    stone.add(slab, mound);
    const p = player.root.position;
    stone.position.set(p.x, 0, p.z);
    stone.rotation.y = player.heading + Math.PI;
    scene.add(stone);
    grave = stone;
    player.root.visible = false;
    $("gEndText").innerHTML = `<b>${nick.replace(/[<>&]/g, "")}</b> wypił <b>${count}</b> piw i osiągnął dyntkę w <b>${mmss(elapsed)}</b>.<br>`
      + (record ? "🏆 Nowy rekord! Najszybsza śmierć w tej przeglądarce." : `Rekord: ${mmss(best)}. Pij szybciej.`);
    $("gEnd").hidden = false;
    state = "dead";
  }

  $("gPlay").onclick = () => { store.set("dyntka-nick", $("gNick").value.trim()); player.root.visible = true; newRun(); };
  $("gAgain").onclick = () => { player.root.visible = true; newRun(); };
  $("gNick").value = store.get("dyntka-nick", "");
  const best = Number(store.get("dyntka-best", 0));
  $("gBest").textContent = best ? `Twój rekord: ${mmss(best)}` : "";

  let fallDone = 0;
  function frame() {
    const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
    if (state === "play") {
      elapsed += dt;
      promil = Math.max(0, promil - DECAY * dt);
      drunk = Math.min(1, promil / GOAL);
      const move = input.read();
      move.inverted = fx.inverted;
      const { speed } = player.update(dt, move, drunk, t);
      world.resolve(player.root.position, 0.45);
      world.update(player.root.position);
      const sip = beers.update(dt, t, player.root.position, speed, drink);
      $("gSip").hidden = !sip;
      if (sip) $("gSip").firstElementChild.style.width = `${Math.min(100, sip.progress * 100)}%`;
      const ev = fx.update(dt, t, drunk, player);
      if (ev === "blackout") { toast("*urwał się film*"); player.root.position.add(new THREE.Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8)); }
      if (ev === "invert") toast("Lewo to prawo. Prawo to lewo.");
      world.lamps.forEach((l, i) => { l.rotation.z = Math.sin(t * 2 + i) * 0.35 * drunk * drunk; l.position.y = Math.abs(Math.sin(t * 3 + i)) * 0.6 * drunk * drunk; });
      hud();
      if (promil >= GOAL) dyntka();
    } else if (state === "dying") {
      fx.update(dt, t, 1, player);
      if (player.fall(dt)) { fallDone += dt; if (fallDone > 0.8) { fallDone = 0; showGrave(); } }
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

  $("gPlay").textContent = "Graj 🍺";
  if (autoplay) $("gPlay").onclick();
  $("gFull").onclick = () => (document.fullscreenElement ? document.exitFullscreen() : wrap.requestFullscreen?.());
}
