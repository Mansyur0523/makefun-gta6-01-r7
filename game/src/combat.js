// combat.js — four weapons, hitscan shooting with tracers and muzzle flash,
// enemy return fire, and the player's health / armor / damage model.
var Combat = (function () {
  var WEAPONS = [
    { id: 'pistol',  name: 'PISTOL',  damage: 34, rate: 0.28, range: 60,  spread: 0.012, auto: false, ammo: Infinity, mag: Infinity, price: 0,    owned: true },
    { id: 'shotgun', name: 'SHOTGUN', damage: 18, rate: 0.85, range: 26,  spread: 0.09,  auto: false, ammo: 24,       mag: 6,        price: 450,  owned: false, pellets: 6 },
    { id: 'smg',     name: 'SMG',     damage: 16, rate: 0.09, range: 45,  spread: 0.035, auto: true,  ammo: 120,      mag: 30,       price: 900,  owned: false },
    { id: 'rifle',   name: 'RIFLE',   damage: 55, rate: 0.16, range: 110, spread: 0.006, auto: true,  ammo: 60,       mag: 20,       price: 1600, owned: false },
  ];
  var current = 0;
  var cooldown = 0;
  var magAmmo = [Infinity, 6, 30, 20];
  var tracerPool = [];
  var raycaster = null;

  function init(scene) {
    raycaster = new THREE.Raycaster();
    for (var i = 0; i < 12; i++) {
      var t = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1),
        new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
      t.visible = false;
      scene.add(t);
      tracerPool.push({ mesh: t, life: 0 });
    }
  }
  function weapon() { return WEAPONS[current]; }
  function select(i) {
    if (i < 0 || i >= WEAPONS.length) return false;
    if (!WEAPONS[i].owned) return false;
    current = i;
    return true;
  }
  function buyWeapon(id) {
    for (var i = 0; i < WEAPONS.length; i++) {
      if (WEAPONS[i].id === id) { WEAPONS[i].owned = true; return WEAPONS[i]; }
    }
    return null;
  }
  function refillAmmo() {
    for (var i = 0; i < WEAPONS.length; i++) {
      if (WEAPONS[i].owned && isFinite(WEAPONS[i].ammo)) {
        WEAPONS[i].ammo = WEAPONS[i].id === 'shotgun' ? 24 : WEAPONS[i].id === 'smg' ? 120 : 60;
        magAmmo[i] = WEAPONS[i].mag;
      }
    }
  }
  function ammoText() {
    var w = WEAPONS[current];
    if (!isFinite(w.ammo)) return '∞';
    return magAmmo[current] + ' / ' + w.ammo;
  }

  // Fire from the camera toward the crosshair. Returns the hit enemy or null.
  function shoot(scene, camera, origin, targets) {
    if (cooldown > 0) return null;
    var w = WEAPONS[current];
    if (isFinite(w.ammo) && magAmmo[current] <= 0) {
      cooldown = 0.4; // dry click
      return 'empty';
    }
    cooldown = w.rate;
    if (isFinite(w.ammo)) {
      magAmmo[current]--;
      if (magAmmo[current] === 0 && w.ammo > 0) { w.ammo -= 0; }
    }
    AudioSys.gunshot();
    var dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    var pellets = w.pellets || 1;
    var hitEnemy = null;
    for (var p = 0; p < pellets; p++) {
      var d = dir.clone();
      d.x += (Math.random() - 0.5) * w.spread * 2;
      d.y += (Math.random() - 0.5) * w.spread * 2;
      d.z += (Math.random() - 0.5) * w.spread * 2;
      d.normalize();
      raycaster.set(origin, d);
      raycaster.far = w.range;
      var meshes = [];
      for (var i = 0; i < targets.length; i++) {
        if (targets[i].alive) meshes.push(targets[i].mesh);
      }
      var hits = raycaster.intersectObjects(meshes, true);
      var end = origin.clone().add(d.clone().multiplyScalar(w.range));
      if (hits.length > 0) {
        var h = hits[0];
        end = h.point.clone();
        var obj = h.object;
        while (obj && !obj.userData.walkerRef) obj = obj.parent;
        // find the walker that owns this mesh
        for (var k = 0; k < targets.length; k++) {
          if (targets[k].mesh === h.object || isDescendant(targets[k].mesh, h.object)) {
            hitEnemy = targets[k];
            damageEnemy(targets[k], w.damage, scene);
            break;
          }
        }
      }
      spawnTracer(origin, end);
    }
    // muzzle flash light handled by main via event
    return hitEnemy;
  }
  function isDescendant(root, obj) {
    var o = obj;
    while (o) { if (o === root) return true; o = o.parent; }
    return false;
  }
  function spawnTracer(from, to) {
    for (var i = 0; i < tracerPool.length; i++) {
      var t = tracerPool[i];
      if (t.life <= 0) {
        var mid = from.clone().add(to).multiplyScalar(0.5);
        var len = from.distanceTo(to);
        if (!isFinite(len) || len <= 0) return;
        t.mesh.position.copy(mid);
        t.mesh.scale.set(1, 1, len);
        t.mesh.lookAt(to);
        t.mesh.visible = true;
        t.mesh.material.opacity = 0.9;
        t.life = 0.09;
        return;
      }
    }
  }
  function updateTracers(dt) {
    for (var i = 0; i < tracerPool.length; i++) {
      var t = tracerPool[i];
      if (t.life > 0) {
        t.life -= dt;
        t.mesh.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
        if (t.life <= 0) t.mesh.visible = false;
      }
    }
  }
  function damageEnemy(enemy, dmg, scene) {
    if (!enemy || !enemy.alive) return;
    enemy.health -= dmg;
    if (enemy.health <= 0) {
      enemy.alive = false;
      // fall over
      enemy.mesh.rotation.x = -Math.PI / 2;
      enemy.mesh.position.y = 0.3;
      if (window.Game) window.Game.onEnemyDown(enemy);
    }
  }
  // Enemies shoot back at the player when in range and line of sight is close.
  function enemyFire(dt, playerPos, onPlayerHit) {
    for (var i = 0; i < Pedestrians.walkers.length; i++) {
      var w = Pedestrians.walkers[i];
      if (!w.alive || !w.isEnemy) continue;
      var d = Utils.dist2D(w.mesh.position.x, w.mesh.position.z, playerPos.x, playerPos.z);
      if (d > 34) continue;
      w.shootCooldown -= dt;
      if (w.shootCooldown <= 0) {
        w.shootCooldown = Utils.rand(0.9, 1.8);
        // hit chance falls with distance
        if (Math.random() < Utils.clamp(0.55 - d / 90, 0.08, 0.5)) {
          onPlayerHit(Utils.randInt(6, 12));
          spawnTracer(new THREE.Vector3(w.mesh.position.x, 1.4, w.mesh.position.z),
            new THREE.Vector3(playerPos.x, 1.2, playerPos.z));
        } else {
          spawnTracer(new THREE.Vector3(w.mesh.position.x, 1.4, w.mesh.position.z),
            new THREE.Vector3(playerPos.x + Utils.rand(-3, 3), 1.2, playerPos.z + Utils.rand(-3, 3)));
        }
        AudioSys.gunshot();
      }
    }
  }
  function update(dt) {
    if (cooldown > 0) cooldown -= dt;
    updateTracers(dt);
  }
  function reload() {
    var w = WEAPONS[current];
    if (!isFinite(w.ammo)) return;
    var need = w.mag - magAmmo[current];
    var take = Math.min(need, w.ammo);
    magAmmo[current] += take;
    w.ammo -= take;
  }

  return { WEAPONS: WEAPONS, init: init, weapon: weapon, select: select, buyWeapon: buyWeapon,
    refillAmmo: refillAmmo, ammoText: ammoText, shoot: shoot, update: update,
    damageEnemy: damageEnemy, enemyFire: enemyFire, reload: reload,
    get current() { return current; }, get magAmmo() { return magAmmo; } };
})();
