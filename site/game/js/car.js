// Drunk driving: arcade car physics where the steering wheel gets a life of its own with every per mille.
import * as THREE from "three";

export function createDriving(world) {
  let car = null, heading = 0, speed = 0, steer = 0, swerve = 0;
  const forward = new THREE.Vector3();
  const follow = { root: { position: new THREE.Vector3() }, heading: 0 };  // what the camera tracks

  return {
    get car() { return car; },
    get speed() { return speed; },
    get heading() { return heading; },
    slow(f) { speed *= f; },
    follow,
    enter(entry) {
      car = entry; world.unpark(entry);
      heading = entry.group.rotation.y; speed = 0; steer = 0;
    },
    exit() {
      world.park(car);
      const left = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading)).multiplyScalar(1.9);
      const out = car.group.position.clone().add(left);
      car = null; speed = 0;
      return out;  // where the driver stands after getting out
    },
    // returns the impact speed when the car hits something, otherwise 0
    update(dt, move, d, t) {
      // the drunker you are, the slower your hands and the more the wheel turns by itself
      swerve += ((Math.sin(t * 0.9) + Math.sin(t * 2.3 + 2) * 0.6) - swerve) * dt * 1.5;
      steer += (move.turn - steer) * Math.min(1, dt * (6 - d * 4.5));
      const gas = move.fwd;
      const target = gas > 0 ? gas * (22 + d * 10) : gas * 8;
      speed += (target - speed) * Math.min(1, dt * (gas === 0 ? 0.8 : 1.6));
      const grip = Math.min(1, Math.abs(speed) / 6);
      heading += (steer * 1.6 + swerve * d * 1.3) * grip * Math.sign(speed || 1) * dt;
      forward.set(Math.sin(heading), 0, Math.cos(heading));
      const pos = car.group.position;
      pos.addScaledVector(forward, speed * dt);
      let impact = 0;
      if (world.resolve(pos, 1.6) && Math.abs(speed) > 2) { impact = Math.abs(speed); speed *= -0.35; }
      car.group.rotation.y = heading;
      car.group.rotation.z = -steer * grip * 0.06 - swerve * d * 0.05;  // body roll in turns
      follow.root.position.copy(pos);
      follow.heading = heading;
      return impact;
    },
  };
}
