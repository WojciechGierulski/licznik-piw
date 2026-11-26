// Keyboard (WASD / arrows), drag to turn, and an on-screen joystick for phones.
export function createInput(wrap, joyEl, useBtn) {
  const keys = new Set();
  let usePressed = false;  // E or the 🚗 button, consumed once per press
  let joyX = 0, joyY = 0, dragTurn = 0, active = false;
  const GAME_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

  window.addEventListener("keydown", (e) => {
    if (active && e.code === "KeyE" && !e.repeat) { usePressed = true; e.preventDefault(); return; }
    if (!active || !GAME_KEYS.includes(e.code)) return;
    keys.add(e.code); e.preventDefault();  // no page scrolling while playing
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => keys.clear());

  // joystick: touch anywhere in its circle and drag
  const knob = joyEl.querySelector("i");
  let joyId = null;
  const joyMove = (x, y) => {
    const r = joyEl.getBoundingClientRect(), R = r.width / 2;
    let dx = x - (r.left + R), dy = y - (r.top + R);
    const len = Math.hypot(dx, dy);
    if (len > R) { dx *= R / len; dy *= R / len; }
    joyX = dx / R; joyY = dy / R;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  joyEl.addEventListener("pointerdown", (e) => { joyId = e.pointerId; joyEl.setPointerCapture(e.pointerId); joyMove(e.clientX, e.clientY); e.preventDefault(); });
  joyEl.addEventListener("pointermove", (e) => { if (e.pointerId === joyId) joyMove(e.clientX, e.clientY); });
  const joyEnd = (e) => { if (e.pointerId !== joyId) return; joyId = null; joyX = joyY = 0; knob.style.transform = ""; };
  joyEl.addEventListener("pointerup", joyEnd);
  joyEl.addEventListener("pointercancel", joyEnd);

  useBtn.addEventListener("pointerdown", (e) => { usePressed = true; e.preventDefault(); });

  // dragging on the scene turns the player
  let dragX = null;
  wrap.addEventListener("pointerdown", (e) => { if (e.target === wrap.querySelector("canvas")) dragX = e.clientX; });
  window.addEventListener("pointermove", (e) => { if (dragX !== null) { dragTurn = (dragX - e.clientX) * 0.05; dragX = e.clientX; } });
  window.addEventListener("pointerup", () => { dragX = null; });

  return {
    set active(v) { active = v; if (!v) keys.clear(); },
    read() {
      const k = (...codes) => codes.some((c) => keys.has(c));
      const fwd = (k("KeyW", "ArrowUp") ? 1 : 0) - (k("KeyS", "ArrowDown") ? 1 : 0) - joyY;
      const turn = (k("KeyA", "ArrowLeft") ? 1 : 0) - (k("KeyD", "ArrowRight") ? 1 : 0) - joyX + dragTurn;
      dragTurn *= 0.6;
      const use = usePressed; usePressed = false;
      return { use, fwd: Math.max(-1, Math.min(1, fwd)), turn: Math.max(-1.5, Math.min(1.5, turn)) };
    },
  };
}
