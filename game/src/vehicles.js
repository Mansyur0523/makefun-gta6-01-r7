// vehicles.js — car models built from boxes, traffic AI that follows the road
// grid, and arcade driving physics for the player's car. All speeds are guarded
// so a zero or NaN can never freeze or fling a vehicle.
var Vehicles = (function () {
  var CAR_TYPES = [
    { name: 'Sunbird Sedan',  color: 0xd84040, top: 34, accel: 16, turn: 2.1, price: 0 },
    { name: 'Coast Cruiser',  color: 0x3a7ad8, top: 30, accel: 13, turn: 1.9, price: 0 },
    { name: 'Vela Sport',    color: 0xffd23e, top: 46, accel: 22, turn: 2.6, price: 0 },
    { name: 'Harbor Taxi',   color: 0xffc61a, top: 32, accel: 15, turn: 2.0, price: 0 },
    { name: 'Dune Pickup',   color: 0x4a8a4a, top: 36, accel: 17, turn: 2.0, price: 0 },
    { name: 'Marisol Van',   color: 0xd8d8d8, top: 26, accel: 11, turn: 1.6, price: 0 },
  ];
  var traffic = [];       // AI cars
  var playerCar = null;   // the car the player currently drives (or null)
  var parkedCars = [];    // stealable parked cars

  function buildCarMesh(type, isCop) {
    var g = new THREE.Group();
    var bodyCol = isCop ? 0x1a1a22 : type.color;
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4),
      new THREE.MeshLambertMaterial({ color: bodyCol }));
    body.position.y = 0.55; g.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.2),
      new THREE.MeshLambertMaterial({ color: isCop ? 0x1a1a22 : 0x1c2733 }));
    cabin.position.set(0, 1.1, -0.2); g.add(cabin);
    var glass = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.4, 2.0),
      new THREE.MeshLambertMaterial({ color: 0x9fd8ff }));
    glass.position.set(0, 1.12, -0.2); g.add(glass);
    var wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
    var wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    var wheelPos = [[-0.95, 0.36, 1.45], [0.95, 0.36, 1.45], [-0.95, 0.36, -1.45], [0.95, 0.36, -1.45]];
    for (var i = 0; i < 4; i++) {
      var w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wheelPos[i][0], wheelPos[i][1], wheelPos[i][2]);
      g.add(w);
    }
    var lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    var hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    hl1.position.set(-0.6, 0.62, 2.21); g.add(hl1);
    var hl2 = hl1.clone(); hl2.position.x = 0.6; g.add(hl2);
    var tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    var t1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    t1.position.set(-0.6, 0.62, -2.21); g.add(t1);
    var t2 = t1.clone(); t2.position.x = 0.6; g.add(t2);
    if (isCop) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.4),
        new THREE.MeshBasicMaterial({ color: 0x2244ff }));
      bar.position.set(0, 1.5, -0.2); g.add(bar);
      g.userData.lightBar = bar;
    }
    return g;
  }

  function spawnTrafficCar(scene) {
    var p = City.randomRoadPoint();
    var type = Utils.pick(CAR_TYPES);
    var mesh = buildCarMesh(type, false);
    var alongX = Math.abs(p.x - City.nearestRoadCoord(p.x)) < 1;
    var dir = Utils.pick([-1, 1]);
    var heading = alongX ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    mesh.position.set(p.x, 0, p.z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    var car = { mesh: mesh, type: type, speed: Utils.rand(8, 14), maxSpeed: Utils.rand(9, 15),
      heading: heading, alongX: alongX, dir: dir, stopped: false, isCop: false, isPlayer: false,
      turnCooldown: Utils.rand(1, 4) };
    traffic.push(car);
    return car;
  }

  function spawnParkedCar(scene, x, z, heading) {
    var type = Utils.pick(CAR_TYPES);
    var mesh = buildCarMesh(type, false);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading || 0;
    scene.add(mesh);
    var car = { mesh: mesh, type: type, speed: 0, maxSpeed: type.top, heading: heading || 0,
      isCop: false, isPlayer: false, parked: true, health: 100 };
    parkedCars.push(car);
    return car;
  }

  function nearestCar(x, z, maxDist, list) {
    var best = null, bd = maxDist;
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      var d = Utils.dist2D(x, z, c.mesh.position.x, c.mesh.position.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  function updateTraffic(dt, playerPos) {
    dt = Utils.clamp(dt, 0, 0.05);
    for (var i = 0; i < traffic.length; i++) {
      var c = traffic[i];
      if (!isFinite(c.speed)) c.speed = 0;
      // slow down for the car ahead on the same road
      var ahead = false;
      for (var j = 0; j < traffic.length; j++) {
        if (i === j) continue;
        var o = traffic[j];
        var dx = o.mesh.position.x - c.mesh.position.x;
        var dz = o.mesh.position.z - c.mesh.position.z;
        var fwd = c.alongX ? (dx * c.dir) : (dz * c.dir);
        var side = c.alongX ? Math.abs(dz) : Math.abs(dx);
        if (fwd > 0 && fwd < 9 && side < 3) { ahead = true; break; }
      }
      var target = ahead ? 0 : c.maxSpeed;
      c.speed = Utils.lerp(c.speed, target, Utils.clamp(dt * 1.5, 0, 1));
      c.turnCooldown -= dt;
      var nx = c.mesh.position.x, nz = c.mesh.position.z;
      if (c.alongX) nx += Math.sin(c.heading) * c.speed * dt;
      else nz += Math.cos(c.heading) * c.speed * dt;
      // at an intersection, sometimes turn
      var onXLine = Math.abs(nz - City.nearestRoadCoord(nz)) < 1.2;
      var onZLine = Math.abs(nx - City.nearestRoadCoord(nx)) < 1.2;
      if (c.turnCooldown <= 0 && ((c.alongX && onZLine) || (!c.alongX && onXLine))) {
        if (Utils.rand(0, 1) < 0.35) {
          c.alongX = !c.alongX;
          c.dir = Utils.pick([-1, 1]);
          c.heading = c.alongX ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
          c.mesh.rotation.y = c.heading;
        }
        c.turnCooldown = Utils.rand(2, 6);
      }
      // keep inside the city; wrap around the far edge
      if (nx > 215) nx = -215; if (nx < -215) nx = 215;
      if (nz > 215) nz = -215; if (nz < -215) nz = 215;
      c.mesh.position.x = nx; c.mesh.position.z = nz;
      // gentle body lean
      c.mesh.rotation.z = Utils.lerp(c.mesh.rotation.z, 0, dt * 4);
    }
  }

  // Arcade driving for the player's car. Returns current speed (mph-ish).
  function drivePlayerCar(car, input, dt) {
    dt = Utils.clamp(dt, 0, 0.05);
    var type = car.type;
    var accel = 0;
    if (input.forward) accel += type.accel;
    if (input.back) accel -= type.accel * 0.6;
    if (!input.forward && !input.back) {
      car.speed -= car.speed * Utils.clamp(dt * 1.2, 0, 1); // drag
    }
    car.speed = Utils.clamp(car.speed + accel * dt, -type.top * 0.4, type.top);
    if (input.handbrake) car.speed = Utils.lerp(car.speed, 0, Utils.clamp(dt * 6, 0, 1));
    var steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    var spdFactor = Utils.clamp(Math.abs(car.speed) / type.top, 0, 1);
    var turnRate = type.turn * spdFactor * (car.speed >= 0 ? 1 : -1);
    car.heading += steer * turnRate * dt;
    if (!isFinite(car.heading)) car.heading = 0;
    var nx = car.mesh.position.x + Math.sin(car.heading) * car.speed * dt;
    var nz = car.mesh.position.z + Math.cos(car.heading) * car.speed * dt;
    var fixed = City.resolveCollision(nx, nz, 1.6);
    if (fixed.x !== nx || fixed.z !== nz) car.speed *= 0.4; // bumped a building
    car.mesh.position.x = fixed.x;
    car.mesh.position.z = fixed.z;
    car.mesh.rotation.y = car.heading;
    car.mesh.rotation.z = Utils.lerp(car.mesh.rotation.z, -steer * 0.06 * spdFactor, dt * 6);
    return Math.abs(car.speed) * 2.2;
  }

  function removeCar(scene, car) {
    scene.remove(car.mesh);
    var ti = traffic.indexOf(car); if (ti >= 0) traffic.splice(ti, 1);
    var pi = parkedCars.indexOf(car); if (pi >= 0) parkedCars.splice(pi, 1);
  }

  return { CAR_TYPES: CAR_TYPES, traffic: traffic, parkedCars: parkedCars,
    buildCarMesh: buildCarMesh, spawnTrafficCar: spawnTrafficCar, spawnParkedCar: spawnParkedCar,
    nearestCar: nearestCar, updateTraffic: updateTraffic, drivePlayerCar: drivePlayerCar,
    removeCar: removeCar,
    get playerCar() { return playerCar; }, set playerCar(c) { playerCar = c; } };
})();
