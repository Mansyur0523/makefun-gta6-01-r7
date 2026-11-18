// police.js — the 5-star wanted system: patrol cops, pursuit cars and a
// helicopter that circle the player. Wanted rises with crimes and cools down
// when the player stays out of sight; getting busted or wasted resets it.
var Police = (function () {
  var wanted = 0;            // 0..5 stars
  var heat = 0;              // 0..100 internal heat meter
  var copCars = [];
  var heli = null;           // {mesh, rotor, angle}
  var bustTimer = 0;
  var sirenOn = false;

  function setWanted(n, reason) {
    var before = wanted;
    wanted = Utils.clamp(Math.round(n), 0, 5);
    heat = wanted * 20;
    if (wanted > before && window.Game) window.Game.onWantedRise(wanted, reason);
    return wanted;
  }
  function addHeat(amount, reason) {
    heat = Utils.clamp(heat + amount, 0, 100);
    var w = heat >= 90 ? 5 : heat >= 70 ? 4 : heat >= 50 ? 3 : heat >= 30 ? 2 : heat >= 12 ? 1 : 0;
    if (w !== wanted) setWanted(w, reason);
  }
  function spawnCopCar(scene, near) {
    var mesh = Vehicles.buildCarMesh(Vehicles.CAR_TYPES[0], true);
    var a = Utils.rand(0, Math.PI * 2);
    var x = near.x + Math.cos(a) * Utils.rand(30, 55);
    var z = near.z + Math.sin(a) * Utils.rand(30, 55);
    var p = City.randomRoadPoint();
    mesh.position.set(p.x, 0, p.z);
    mesh.rotation.y = Utils.rand(0, Math.PI * 2);
    scene.add(mesh);
    var cop = { mesh: mesh, type: Vehicles.CAR_TYPES[0], speed: 0, maxSpeed: 38,
      heading: mesh.rotation.y, isCop: true, isPlayer: false, stuck: 0 };
    copCars.push(cop);
    return cop;
  }
  function spawnHelicopter(scene) {
    if (heli) return heli;
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 5.2),
      new THREE.MeshLambertMaterial({ color: 0x1a2a3a }));
    body.position.y = 0; g.add(body);
    var tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.4),
      new THREE.MeshLambertMaterial({ color: 0x1a2a3a }));
    tail.position.set(0, 0.2, -4.2); g.add(tail);
    var rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    rotor.position.y = 1.0; g.add(rotor);
    var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    lamp.position.set(0, -0.9, 1.5); g.add(lamp);
    g.position.set(0, 42, 0);
    scene.add(g);
    heli = { mesh: g, rotor: rotor, angle: 0, lamp: lamp };
    return heli;
  }
  function removeHelicopter(scene) {
    if (!heli) return;
    scene.remove(heli.mesh);
    heli = null;
  }
  function desiredCops() {
    return wanted === 0 ? 0 : wanted === 1 ? 1 : wanted === 2 ? 2 : wanted === 3 ? 3 : wanted === 4 ? 4 : 5;
  }

  function update(dt, scene, playerPos, playerSpeed) {
    dt = Utils.clamp(dt, 0, 0.05);
    // keep the right number of pursuit cars
    var want = desiredCops();
    while (copCars.length < want) spawnCopCar(scene, playerPos);
    while (copCars.length > want) {
      var extra = copCars.pop();
      scene.remove(extra.mesh);
    }
    // helicopter at 3+ stars
    if (wanted >= 3 && !heli) spawnHelicopter(scene);
    if (wanted < 3 && heli) removeHelicopter(scene);
    // siren follows wanted
    var shouldSiren = wanted >= 1;
    if (shouldSiren && !sirenOn) { AudioSys.startSiren(); sirenOn = true; }
    if (!shouldSiren && sirenOn) { AudioSys.stopSiren(); sirenOn = false; }

    // pursuit steering: each cop chases the player, steering around buildings
    for (var i = 0; i < copCars.length; i++) {
      var c = copCars[i];
      var dx = playerPos.x - c.mesh.position.x;
      var dz = playerPos.z - c.mesh.position.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (!isFinite(d) || d < 0.001) d = 0.001;
      var wantHeading = Math.atan2(dx / d, dz / d);
      var targetSpeed = Utils.clamp(16 + wanted * 4 + playerSpeed * 0.35, 0, 44);
      if (d < 4) targetSpeed = 6; // ramming distance, slow to push
      c.speed = Utils.lerp(c.speed, targetSpeed, Utils.clamp(dt * 1.2, 0, 1));
      c.heading = Utils.angleLerp(c.heading, wantHeading, Utils.clamp(dt * 1.6, 0, 1));
      var nx = c.mesh.position.x + Math.sin(c.heading) * c.speed * dt;
      var nz = c.mesh.position.z + Math.cos(c.heading) * c.speed * dt;
      var fixed = City.resolveCollision(nx, nz, 1.6);
      if ((fixed.x !== nx || fixed.z !== nz) && c.speed > 2) {
        // blocked by a building: nudge the heading to slide around it
        c.heading += 0.9 * dt * 10;
        c.speed *= 0.6;
      }
      c.mesh.position.x = fixed.x;
      c.mesh.position.z = fixed.z;
      c.mesh.rotation.y = c.heading;
      // flashing light bar
      if (c.mesh.userData.lightBar) {
        c.mesh.userData.lightBar.material.color.setHex(
          (Math.floor(performance.now() / 300) % 2 === 0) ? 0xff2222 : 0x2244ff);
      }
      // cop rams the player: damage + bust pressure when very close and slow
      if (d < 3.2 && playerSpeed < 3) {
        bustTimer += dt;
        if (bustTimer > 2.5) {
          bustTimer = 0;
          if (window.Game) window.Game.onBusted();
        }
      } else {
        bustTimer = Math.max(0, bustTimer - dt);
      }
    }
    // helicopter circles overhead with a spotlight
    if (heli) {
      heli.angle += dt * 0.5;
      var r = 26;
      heli.mesh.position.x = playerPos.x + Math.cos(heli.angle) * r;
      heli.mesh.position.z = playerPos.z + Math.sin(heli.angle) * r;
      heli.mesh.position.y = 40 + Math.sin(performance.now() * 0.001) * 2;
      heli.mesh.rotation.y = -heli.angle;
      heli.rotor.rotation.y += dt * 22;
      heli.lamp.material.color.setHex(Math.floor(performance.now() / 200) % 2 === 0 ? 0xffffff : 0xffe9a8);
    }
    // heat cools when no cops are close
    var nearest = 999;
    for (var j = 0; j < copCars.length; j++) {
      nearest = Math.min(nearest, Utils.dist2D(playerPos.x, playerPos.z,
        copCars[j].mesh.position.x, copCars[j].mesh.position.z));
    }
    if (wanted > 0 && nearest > 60) {
      heat -= dt * 2.2;
      if (heat < wanted * 20 - 20) setWanted(Math.max(0, wanted - 1), 'escaped');
    }
  }

  function clearAll(scene) {
    for (var i = 0; i < copCars.length; i++) scene.remove(copCars[i].mesh);
    copCars.length = 0;
    removeHelicopter(scene);
    wanted = 0; heat = 0; bustTimer = 0;
    if (sirenOn) { AudioSys.stopSiren(); sirenOn = false; }
  }

  return { get wanted() { return wanted; }, get heat() { return heat; },
    copCars: copCars, get heli() { return heli; },
    setWanted: setWanted, addHeat: addHeat, update: update, clearAll: clearAll };
})();
