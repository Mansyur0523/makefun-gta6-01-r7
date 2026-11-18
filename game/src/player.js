// player.js — Jax Marlowe on foot: WASD movement, mouse-look third-person
// camera, sprint, carjacking (E), interaction (F), and the on-foot shooting pose.
var Player = (function () {
  var pos = new THREE.Vector3(0, 0, 40);
  var heading = 0;           // facing angle
  var camYaw = 0, camPitch = 0.32;
  var camDist = 7.5;
  var mesh = null;
  var inCar = false;
  var car = null;
  var speed = 0;
  var aiming = false;
  var keys = {};
  var mouseDown = false;
  var sprinting = false;

  function init(scene) {
    mesh = Pedestrians.buildPersonMesh(0x2a6a8a, 0xe8b88a, 1.0);
    // Jax: teal jacket, dark jeans, backwards cap
    var cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.36),
      new THREE.MeshLambertMaterial({ color: 0xffd23e }));
    cap.position.y = 1.9; mesh.add(cap);
    mesh.position.copy(pos);
    scene.add(mesh);
  }
  function setPosition(x, z, h) {
    pos.set(x, 0, z);
    if (h !== undefined) { heading = h; camYaw = h; }
    mesh.position.copy(pos);
    mesh.rotation.y = heading;
  }
  function getPos() { return pos; }

  function tryEnterCar(scene) {
    if (inCar) { exitCar(scene); return true; }
    var near = Vehicles.nearestCar(pos.x, pos.z, 4.5, Vehicles.parkedCars) ||
               Vehicles.nearestCar(pos.x, pos.z, 4.5, Vehicles.traffic);
    if (!near) return false;
    // carjacking: take a traffic car over (its driver bails), steal parked ones free
    var ti = Vehicles.traffic.indexOf(near);
    if (ti >= 0) {
      Vehicles.traffic.splice(ti, 1);
      near.parked = true;
      Vehicles.parkedCars.push(near);
      Police.addHeat(14, 'carjacking');
      if (window.Game) window.Game.toast('Car jacked! The cops noticed.');
      AudioSys.thud();
    }
    car = near;
    car.isPlayer = true;
    car.speed = 0;
    Vehicles.playerCar = car;
    inCar = true;
    mesh.visible = false;
    if (window.Game) window.Game.onEnterCar(car);
    return true;
  }
  function exitCar(scene) {
    if (!car) { inCar = false; return; }
    var side = Math.cos(car.heading) * 1.8;
    var fwd = Math.sin(car.heading) * 1.8;
    pos.set(car.mesh.position.x + side + fwd * 0.2, 0, car.mesh.position.z - fwd + side * 0.2);
    var fixed = City.resolveCollision(pos.x, pos.z, 0.6);
    pos.x = fixed.x; pos.z = fixed.z;
    mesh.position.copy(pos);
    mesh.visible = true;
    heading = car.heading;
    camYaw = heading;
    car.isPlayer = false;
    car.speed = 0;
    Vehicles.playerCar = null;
    car = null;
    inCar = false;
    if (window.Game) window.Game.onExitCar();
  }

  function update(dt, camera, input) {
    dt = Utils.clamp(dt, 0, 0.05);
    if (inCar && car) {
      var upg = window.Game ? window.Game.upgrades : { engine: false, brakes: false };
      var effType = car.type;
      var boosted = { name: effType.name, color: effType.color,
        top: effType.top * (upg.engine ? 1.2 : 1),
        accel: effType.accel * (upg.engine ? 1.15 : 1),
        turn: effType.turn * (upg.brakes ? 1.25 : 1) };
      var savedType = car.type;
      car.type = boosted;
      var mph = Vehicles.drivePlayerCar(car, input, dt);
      car.type = savedType;
      speed = mph;
      pos.copy(car.mesh.position);
      heading = car.heading;
      // chase camera behind the car
      var back = 9.5, up = 4.2;
      var cx = pos.x - Math.sin(heading) * back;
      var cz = pos.z - Math.cos(heading) * back;
      camera.position.set(cx, up, cz);
      camera.lookAt(pos.x, 1.6, pos.z);
      AudioSys.setEngine(Utils.clamp(Math.abs(car.speed) / car.type.top, 0, 1), true);
      return mph;
    }
    // on foot
    var moveSpeed = (input.sprint ? 9.5 : 5.2);
    sprinting = !!input.sprint;
    var mx = 0, mz = 0;
    if (input.forward) { mx += Math.sin(camYaw); mz += Math.cos(camYaw); }
    if (input.back) { mx -= Math.sin(camYaw); mz -= Math.cos(camYaw); }
    if (input.left) { mx -= Math.cos(camYaw); mz += Math.sin(camYaw); }
    if (input.right) { mx += Math.cos(camYaw); mz -= Math.sin(camYaw); }
    var len = Math.sqrt(mx * mx + mz * mz);
    if (len > 0.001) {
      mx /= len; mz /= len;
      var nx = pos.x + mx * moveSpeed * dt;
      var nz = pos.z + mz * moveSpeed * dt;
      var fixed = City.resolveCollision(nx, nz, 0.6);
      pos.x = fixed.x; pos.z = fixed.z;
      heading = Math.atan2(mx, mz);
      speed = moveSpeed;
    } else {
      speed = 0;
    }
    mesh.position.copy(pos);
    mesh.rotation.y = heading;
    // walk swing
    var t = performance.now() * 0.01;
    if (speed > 0) {
      mesh.userData.armL.rotation.x = Math.sin(t * 1.6) * 0.6;
      mesh.userData.armR.rotation.x = -Math.sin(t * 1.6) * 0.6;
    }
    // third-person camera: behind the player, mouse orbits
    var cy = Utils.clamp(camPitch, 0.08, 1.1);
    var cd = camDist;
    var cx2 = pos.x - Math.sin(camYaw) * Math.cos(cy) * cd;
    var cz2 = pos.z - Math.cos(camYaw) * Math.cos(cy) * cd;
    var cy2 = 1.6 + Math.sin(cy) * cd;
    camera.position.set(cx2, cy2, cz2);
    camera.lookAt(pos.x, 1.5, pos.z);
    AudioSys.setEngine(0, false);
    return 0;
  }
  function aimDirection(camera) {
    var d = new THREE.Vector3();
    camera.getWorldDirection(d);
    return d;
  }
  function shootOrigin() {
    return new THREE.Vector3(pos.x, 1.5, pos.z);
  }

  return { init: init, setPosition: setPosition, update: update,
    tryEnterCar: tryEnterCar, exitCar: exitCar, aimDirection: aimDirection,
    shootOrigin: shootOrigin,
    get x() { return pos.x; }, get z() { return pos.z; },
    get heading() { return heading; }, set heading(v) { heading = v; },
    get camYaw() { return camYaw; }, set camYaw(v) { camYaw = v; },
    get camPitch() { return camPitch; }, set camPitch(v) { camPitch = v; },
    get inCar() { return inCar; }, get car() { return car; },
    get speed() { return speed; }, get aiming() { return aiming; }, set aiming(v) { aiming = v; },
    get mesh() { return mesh; }, keys: keys };
})();
