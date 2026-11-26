// Everything that makes the screen drunk. All effects scale smoothly with d = promil / 10 (0…1).
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const DrunkShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uWave: { value: 0 }, uDouble: { value: 0 },
    uSplit: { value: 0 }, uVignette: { value: 0 }, uBlack: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uWave, uDouble, uSplit, uVignette, uBlack; varying vec2 vUv;
    vec3 sampleSplit(vec2 uv) {
      return vec3(texture2D(tDiffuse, uv + vec2(uSplit, 0.0)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(uSplit, 0.0)).b);
    }
    void main() {
      vec2 uv = vUv;
      uv.x += sin(uv.y * 9.0 + uTime * 1.6) * 0.012 * uWave;
      uv.y += cos(uv.x * 7.0 + uTime * 1.2) * 0.010 * uWave;
      vec2 off = vec2(sin(uTime * 0.8), cos(uTime * 0.6)) * uDouble;
      vec3 c = mix(sampleSplit(uv), sampleSplit(uv + off), clamp(uDouble * 25.0, 0.0, 0.5));
      float v = smoothstep(0.95, 0.25, length(vUv - 0.5));
      c *= mix(1.0, v, uVignette);
      c *= 1.0 - uBlack;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export function createDrunkFx(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1024, 576), 0.8, 0.55, 0.82);  // lamps, windows and beers glow
  composer.addPass(bloom);
  const pass = new ShaderPass(DrunkShader);
  composer.addPass(pass);
  composer.addPass(new OutputPass());

  let blackout = 0, blackoutLeft = 0, invertLeft = 0;
  const camPos = new THREE.Vector3(), look = new THREE.Vector3();

  return {
    composer,
    get inverted() { return invertLeft > 0; },
    get blackedOut() { return blackoutLeft > 0; },
    resize(w, h) { composer.setSize(w, h); },
    // returns an event name when something random happens ("blackout", "invert", "hiccup")
    update(dt, t, d, player) {
      let event = null;
      // random events get more frequent the drunker you are
      if (blackoutLeft <= 0 && d > 0.55 && Math.random() < dt * (d - 0.55) * 0.5) { blackoutLeft = 0.7 + d; event = "blackout"; }
      if (invertLeft <= 0 && d > 0.35 && Math.random() < dt * (d - 0.35) * 0.35) { invertLeft = 2 + d * 4; event = "invert"; }
      blackoutLeft -= dt; invertLeft -= dt;
      blackout += ((blackoutLeft > 0 ? 1 : 0) - blackout) * Math.min(1, dt * 5);

      const u = pass.uniforms;
      u.uTime.value = t;
      u.uWave.value = Math.pow(d, 1.1) * 1.6;
      u.uDouble.value = Math.max(0, d - 0.12) * 0.035;
      u.uSplit.value = d * d * 0.012;
      u.uVignette.value = 0.25 + d * 0.65;
      u.uBlack.value = blackout;
      bloom.strength = 0.8 + d * 1.4;  // drunk eyes: every light becomes a halo
      bloom.radius = 0.55 + d * 0.35;

      // third-person camera that follows the player and sways more with every beer
      const h = player.heading;
      camPos.set(player.root.position.x - Math.sin(h) * 6.5, 3.4 + Math.sin(t * 0.9) * 0.6 * d, player.root.position.z - Math.cos(h) * 6.5);
      camPos.x += Math.sin(t * 0.7) * 1.8 * d * d;
      camPos.z += Math.cos(t * 0.5) * 1.2 * d * d;
      camera.position.lerp(camPos, Math.min(1, dt * (3.5 - d * 2)));
      look.set(player.root.position.x, 1.6, player.root.position.z);
      camera.lookAt(look);
      camera.rotateZ(Math.sin(t * 0.8) * 0.32 * Math.pow(d, 1.2) + Math.sin(t * 2.3) * 0.05 * d);
      camera.fov = 62 + Math.sin(t * 1.1) * 10 * d;
      camera.updateProjectionMatrix();
      return event;
    },
    render() { composer.render(); },
    // sober picture for the menu and the grave
    still(t) {
      const u = pass.uniforms;
      u.uTime.value = t; u.uWave.value = 0; u.uDouble.value = 0; u.uSplit.value = 0; u.uVignette.value = 0.35; u.uBlack.value = 0;
      bloom.strength = 0.8; bloom.radius = 0.55;
    },
    reset() { blackout = 0; blackoutLeft = 0; invertLeft = 0; },
  };
}
