// pedestrians.js — sidewalk walkers with simple wander AI, plus enemy gang
// members used by combat missions. Walkers flee from gunfire near them.
var Pedestrians = (function () {
  var walkers = [];
  var SHIRTS = [0xe86a6a, 0x6aa8e8, 0x7ad67a, 0xe8c96a, 0xb06ad8, 0x6ad8d0, 0xe8e8e8, 0x3a3a4a];
  var SKINS = [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0];

  function buildPersonMesh(shirt, skin, scale) {
    var g = new THREE.Group();
    var mat = function (c) { return new THREE.MeshLambertMaterial({ color: c }); };
    var legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.26), mat(0x2a2a3a));
    legs.position.y = 0.4; g.add(legs);
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.3), mat(shirt));
    torso.position.y = 1.15; g.add(torso);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), mat(skin));
    head.position.y = 1.68; g.add(head);
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), mat(shirt));
    armL.position.set(-0.36, 1.15, 0); g.add(armL);
    var armR = armL.clone(); armR.position.x = 0.36; g.add(armR);
    g.scale.setScalar(scale || 1);
    g.userData.armL = armL; g.userData.armR = armR;
    return g;
  }

  function spawnWalker(scene, x, z) {
    var mesh = buildPersonMesh(Utils.pick(SHIRTS), Utils.pick(SKINS), Utils.rand(0.92, 1.08));
    mesh.position.set(x, 0, z);
    mesh.rotation.y = Utils.rand(0, Math.PI * 2);
    scene.add(mesh);
    var w = { mesh: mesh, speed: Utils.rand(1.2, 2.4), heading: mesh.rotation.y,
      targetHeading: mesh.rotation.y, retarget: Utils.rand(2, 6), fleeing: false,
      isEnemy: false, health: 100, alive: true };
    walkers.push(w);
    return w;
  }

  function spawnEnemy(scene, x, z, gangColor) {
    var mesh = buildPersonMesh(gangColor || 0x8a1a1a, Utils.pick(SKINS), 1.05);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    var e = { mesh: mesh, speed: Utils.rand(2.2, 3.2), heading: 0, targetHeading: 0,
      retarget: 0, fleeing: false, isEnemy: true, health: 100, alive: true,
      shootCooldown: Utils.rand(1, 2), isGang: true };
    walkers.push(e);
    return e;
  }

  function updateWalkers(dt, playerPos, gunfirePos) {
    dt = Utils.clamp(dt, 0, 0.05);
    for (var i = walkers.length - 1; i >= 0; i--) {
      var w = walkers[i];
      if (!w.alive) continue;
      w.retarget -= dt;
      var pd = playerPos ? Utils.dist2D(w.mesh.position.x, w.mesh.position.z, playerPos.x, playerPos.z) : 999;
      if (gunfirePos && Utils.dist2D(w.mesh.position.x, w.mesh.position.z, gunfirePos.x, gunfirePos.z) < 18 && !w.isEnemy) {
        w.fleeing = true;
        w.targetHeading = Math.atan2(w.mesh.position.x - gunfirePos.x, w.mesh.position.z - gunfirePos.z);
      } else if (w.fleeing && pd > 40) {
        w.fleeing = false;
      }
      if (w.isEnemy) {
        // gang members walk toward the player and stop at shooting range
        if (pd < 46 && pd > 10) {
          w.targetHeading = Math.atan2(playerPos.x - w.mesh.position.x, playerPos.z - w.mesh.position.z);
        } else if (pd <= 10) {
          w.targetHeading = Math.atan2(playerPos.x - w.mesh.position.x, playerPos.z - w.mesh.position.z);
        } else if (w.retarget <= 0) {
          w.targetHeading = Utils.rand(0, Math.PI * 2);
          w.retarget = Utils.rand(2, 5);
        }
      } else if (w.retarget <= 0) {
        w.targetHeading = Utils.rand(0, Math.PI * 2);
        w.retarget = Utils.rand(3, 8);
      }
      w.heading = Utils.angleLerp(w.heading, w.targetHeading, Utils.clamp(dt * 3, 0, 1));
      var spd = w.isEnemy ? (pd < 46 ? w.speed : w.speed * 0.5) : (w.fleeing ? w.speed * 2.4 : w.speed);
      var nx = w.mesh.position.x + Math.sin(w.heading) * spd * dt;
      var nz = w.mesh.position.z + Math.cos(w.heading) * spd * dt;
      var fixed = City.resolveCollision(nx, nz, 0.5);
      w.mesh.position.x = fixed.x;
      w.mesh.position.z = fixed.z;
      w.mesh.rotation.y = w.heading;
      // walk swing
      var t = performance.now() * 0.008;
      w.mesh.userData.armL.rotation.x = Math.sin(t) * 0.5;
      w.mesh.userData.armR.rotation.x = -Math.sin(t) * 0.5;
    }
  }

  function removeWalker(scene, w) {
    scene.remove(w.mesh);
    var i = walkers.indexOf(w);
    if (i >= 0) walkers.splice(i, 1);
  }

  return { walkers: walkers, spawnWalker: spawnWalker, spawnEnemy: spawnEnemy,
    updateWalkers: updateWalkers, removeWalker: removeWalker, buildPersonMesh: buildPersonMesh };
})();
