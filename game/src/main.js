// main.js — game bootstrap and the main loop. Owns the Game state object the
// other systems call back into (window.Game): cash, health, missions, wanted
// events, pause, save/load, and the ?shot= modes used for screenshots.
(function () {
  var params = new URLSearchParams(location.search);
  var shotMode = params.get('shot'); // cover | street | chase | mission
  var autostart = params.get('autostart') === '1' || !!shotMode;

  var canvas = document.getElementById('game-canvas');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 8, -12);

  var Game = {
    cash: 150, health: 100, armor: 0,
    upgrades: { engine: false, brakes: false },
    playTime: 0, state: 'menu', // menu | playing | paused | dead | won
    paused: false, shopPaused: false,
    playerInCar: false, carSpeed: 0, playerX: 0, playerZ: 40, playerHeading: 0,
    aiming: false, missionsDone: 0,
    toast: function (m) { Hud.toast(m); },
    refreshHud: function () { Hud.refresh(Game); },
    showBanner: function (t, s) { Hud.showBanner(t, s); },
    onMissionStart: function (m) { Hud.toast('Mission started: ' + m.title); },
    onMissionComplete: function (m) {
      Game.cash += m.reward;
      Game.missionsDone++;
      Hud.showBanner('MISSION COMPLETE', '+' + Utils.fmtMoney(m.reward) + '  —  ' + m.title);
      AudioSys.blip(1320); setTimeout(function () { AudioSys.blip(1760); }, 160);
      SaveGame.save(snapshot());
      Hud.refresh(Game);
    },
    onStoryComplete: function () {
      Game.state = 'won';
      document.getElementById('win-screen').classList.remove('hidden');
      Hud.hideHud();
    },
    onKillProgress: function (k, n) { Hud.toast('Targets down: ' + k + ' / ' + n); },
    onEnemyDown: function (e) {
      Missions.onKill(e);
      Game.cash += 25;
      if (Math.random() < 0.3) Police.addHeat(4, 'shooting');
    },
    onWantedRise: function (w, reason) {
      if (w >= 1) Hud.toast('WANTED LEVEL ' + w + ' — the Marisol PD is on you!');
    },
    onBusted: function () {
      if (Game.state !== 'playing') return;
      Game.state = 'dead';
      Game.cash = Math.max(0, Game.cash - 200);
      Police.clearAll(scene);
      document.getElementById('dead-screen').classList.remove('hidden');
      Hud.hideHud();
    },
    onEnterCar: function (car) { Game.playerInCar = true; Hud.toast('Now driving: ' + car.type.name); },
    onExitCar: function () { Game.playerInCar = false; },
    startNextMission: function () { Missions.startNext(scene); },
    setPaused: function (p, fromShop) {
      if (fromShop) { Game.shopPaused = p; }
      else { Game.paused = p; }
      var any = Game.paused || Game.shopPaused;
      document.getElementById('pause-screen').classList.toggle('hidden', !Game.paused);
      if (!any && Game.state === 'playing') { /* resume */ }
    },
  };
  window.Game = Game;
  window.__scene = scene;

  function snapshot() {
    return { cash: Game.cash, health: Game.health, armor: Game.armor, upgrades: Game.upgrades,
      x: Player.x, z: Player.z };
  }

  // ---------- world build ----------
  City.buildCity(scene);
  Combat.init(scene);
  Player.init(scene);
  for (var i = 0; i < 14; i++) Vehicles.spawnTrafficCar(scene);
  for (var p = 0; p < 26; p++) {
    var wp = City.randomSidewalkPoint();
    Pedestrians.spawnWalker(scene, wp.x, wp.z);
  }
  // parked cars to steal, lined up on roads
  var parkSpots = [[-60, 12], [0, -48], [60, 72], [-120, -12], [120, 12], [180, 48], [-180, 132], [60, -132]];
  for (var s = 0; s < parkSpots.length; s++) {
    Vehicles.spawnParkedCar(scene, parkSpots[s][0], parkSpots[s][1], (s % 2 === 0) ? Math.PI / 2 : 0);
  }
  // shop + safehouse markers in the world
  function addWorldMarker(x, z, color, label) {
    var g = new THREE.Group();
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    pole.position.y = 3; g.add(pole);
    var sign = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 0.2),
      new THREE.MeshBasicMaterial({ color: color }));
    sign.position.y = 6.4; g.add(sign);
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
  }
  addWorldMarker(Shops.shopPos.x, Shops.shopPos.z, 0x2a8a2a, 'SHOP');
  addWorldMarker(Shops.safehousePos.x, Shops.safehousePos.z, 0x2a5a8a, 'HOME');

  // ---------- input ----------
  var input = { forward: false, back: false, left: false, right: false, sprint: false, handbrake: false };
  var keyMap = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'handbrake' };
  document.addEventListener('keydown', function (e) {
    if (keyMap[e.code] !== undefined) { input[keyMap[e.code]] = true; e.preventDefault(); }
    if (e.code === 'KeyE' && Game.state === 'playing' && !Shops.open) Player.tryEnterCar(scene);
    if (e.code === 'KeyF') handleInteract();
    if (e.code === 'KeyR') { AudioSys.nextStation(); Hud.refresh(Game); }
    if (e.code === 'KeyM') { var m = AudioSys.toggleMute(); Hud.toast(m ? 'Sound muted' : 'Sound on'); }
    if (e.code === 'Digit1') Combat.select(0);
    if (e.code === 'Digit2') Combat.select(1);
    if (e.code === 'Digit3') Combat.select(2);
    if (e.code === 'Digit4') Combat.select(3);
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    if (e.code === 'KeyR' && e.shiftKey) Combat.reload();
  });
  document.addEventListener('keyup', function (e) {
    if (keyMap[e.code] !== undefined) input[keyMap[e.code]] = false;
  });
  document.addEventListener('mousemove', function (e) {
    if (Game.state !== 'playing' || Game.paused || Game.shopPaused) return;
    Player.camYaw -= e.movementX * 0.0028;
    Player.camPitch = Utils.clamp(Player.camPitch + e.movementY * 0.0022, 0.08, 1.1);
  });
  document.addEventListener('mousedown', function (e) {
    if (e.button === 0 && Game.state === 'playing' && !Game.paused && !Game.shopPaused) {
      Player.aiming = true;
      tryShoot();
    }
    if (e.button === 2) Player.aiming = true;
  });
  document.addEventListener('mouseup', function (e) {
    if (e.button === 0) Player.aiming = false;
    if (e.button === 2) Player.aiming = false;
  });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('click', function () {
    if (Game.state === 'playing' && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock && canvas.requestPointerLock();
    }
  });
  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function tryShoot() {
    if (Player.inCar) return; // no drive-by in this build; shoot on foot
    var targets = Pedestrians.walkers;
    var res = Combat.shoot(scene, camera, Player.shootOrigin(), targets);
    if (res === 'empty') Hud.toast('Out of ammo — press R to reload or visit the shop.');
  }
  function handleInteract() {
    if (Game.state !== 'playing') return;
    if (Shops.open) { Shops.closeShop(); return; }
    var dShop = Utils.dist2D(Player.x, Player.z, Shops.shopPos.x, Shops.shopPos.z);
    if (dShop < 6) { AudioSys.ensure(); Shops.openShop(); return; }
    var dHome = Utils.dist2D(Player.x, Player.z, Shops.safehousePos.x, Shops.safehousePos.z);
    if (dHome < 6) {
      Game.health = 100;
      SaveGame.save(snapshot());
      Hud.toast('Safehouse: healed and game saved.');
      AudioSys.blip(880);
      return;
    }
    // mission pickup
    var o = Missions.objective();
    if (o && o.type === 'pickup') {
      var d = Utils.dist2D(Player.x, Player.z, o.x, o.z);
      if (d < (o.r || 6)) {
        Missions.update(0.016, scene, { x: Player.x, z: Player.z, inCar: Player.inCar, tryPickup: true });
      }
    }
  }
  function togglePause() {
    if (Game.state !== 'playing' || Shops.open) return;
    Game.setPaused(!Game.paused, false);
  }

  // ---------- buttons ----------
  document.getElementById('btn-start').onclick = function () { startGame(false); };
  document.getElementById('btn-continue').onclick = function () { startGame(true); };
  document.getElementById('btn-resume').onclick = function () { Game.setPaused(false, false); };
  document.getElementById('btn-save-quit').onclick = function () {
    SaveGame.save(snapshot());
    Game.setPaused(false, false);
    Game.state = 'menu';
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
    Hud.hideHud();
  };
  document.getElementById('btn-retry').onclick = function () {
    document.getElementById('dead-screen').classList.add('hidden');
    respawn();
  };
  document.getElementById('btn-free-roam').onclick = function () {
    document.getElementById('win-screen').classList.add('hidden');
    Game.state = 'playing';
    Hud.showHud();
  };
  document.getElementById('shop-close').onclick = function () { Shops.closeShop(); };

  function respawn() {
    Game.health = 100;
    Player.setPosition(0, 40, 0);
    Police.clearAll(scene);
    Game.state = 'playing';
    Hud.showHud();
    if (!Missions.active && Missions.index < Missions.STORY.length) Missions.startNext(scene);
  }
  function startGame(continueSave) {
    AudioSys.ensure();
    AudioSys.startRadio();
    document.getElementById('start-screen').classList.add('hidden');
    Hud.showHud();
    Game.state = 'playing';
    var savedPos = null;
    if (continueSave) {
      var d = SaveGame.load();
      if (d) savedPos = SaveGame.apply(d);
    }
    if (savedPos) {
      Player.setPosition(savedPos.x, savedPos.z, 0);
      Hud.toast('Save loaded — welcome back to Marisol Bay.');
    } else {
      Player.setPosition(0, 40, 0);
    }
    if (!Missions.active && Missions.index < Missions.STORY.length) Missions.startNext(scene);
    canvas.requestPointerLock && canvas.requestPointerLock();
  }

  // ---------- screenshot scenarios (?shot=...) ----------
  function applyShotMode() {
    if (!shotMode && !autostart) return;
    startGame(false);
    if (!shotMode) return;
    if (shotMode === 'cover') {
      // player in a sports car mid-chase, cops behind, wanted 3
      var car = Vehicles.spawnParkedCar(scene, 0, 30, 0);
      car.type = Vehicles.CAR_TYPES[2];
      Player.setPosition(0, 30, 0);
      Player.tryEnterCar(scene);
      car.speed = 26;
      Police.setWanted(3, 'shot');
      Hud.refresh(Game);
    } else if (shotMode === 'chase') {
      // on foot on the beach boardwalk, 5-star heat, helicopter overhead
      Player.setPosition(215, 40, -Math.PI / 2); // face the city, cops closing in
      Police.setWanted(5, 'shot');
      Hud.refresh(Game);
    } else if (shotMode === 'street') {
      Player.setPosition(-58, -40, Math.PI * 0.6);
      Police.setWanted(0);
    } else if (shotMode === 'mission') {
      Player.setPosition(-40, -60, Math.PI / 2);
      Missions.startMission(scene, 2); // Shakedown: gang members visible
      Police.setWanted(1, 'shot');
    }
    window.__shotReady = true;
  }

  // ---------- damage / death ----------
  function damagePlayer(amount) {
    if (Game.state !== 'playing') return;
    var absorbed = 0;
    if (Game.armor > 0) {
      absorbed = Math.min(Game.armor, amount * 0.5);
      Game.armor -= absorbed;
    }
    Game.health -= (amount - absorbed);
    Hud.damageFlash();
    if (Game.health <= 0) {
      Game.health = 0;
      Game.state = 'dead';
      Police.clearAll(scene);
      document.getElementById('dead-screen').classList.remove('hidden');
      Hud.hideHud();
    }
  }

  // ---------- main loop ----------
  var clock = new THREE.Clock();
  var hudTimer = 0;
  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    if (!isFinite(dt)) dt = 0.016;
    if (Game.state === 'playing' && !Game.paused && !Game.shopPaused) {
      Game.playTime += dt;
      var mph = Player.update(dt, camera, input);
      Game.carSpeed = mph;
      Game.playerX = Player.x; Game.playerZ = Player.z; Game.playerHeading = Player.heading;
      Game.playerInCar = Player.inCar;
      Game.aiming = Player.aiming;
      Vehicles.updateTraffic(dt, { x: Player.x, z: Player.z });
      Pedestrians.updateWalkers(dt, { x: Player.x, z: Player.z }, null);
      Police.update(dt, scene, { x: Player.x, z: Player.z }, Math.abs(mph));
      Combat.update(dt);
      Combat.enemyFire(dt, { x: Player.x, z: Player.z }, damagePlayer);
      var ev = Missions.update(dt, scene, { x: Player.x, z: Player.z, inCar: Player.inCar, tryPickup: false });
      if (ev === 'objective') Hud.toast('Objective complete!');
      // running over pedestrians raises heat
      for (var i = 0; i < Pedestrians.walkers.length; i++) {
        var w = Pedestrians.walkers[i];
        if (!w.alive || w.isEnemy) continue;
        if (Player.inCar && Utils.dist2D(Player.x, Player.z, w.mesh.position.x, w.mesh.position.z) < 2.2) {
          w.alive = false;
          w.mesh.rotation.x = -Math.PI / 2;
          Police.addHeat(10, 'hit pedestrian');
        }
      }
      hudTimer += dt;
      if (hudTimer > 0.12) { hudTimer = 0; Hud.refresh(Game); Hud.drawMinimap(Game); }
    } else if (Game.state === 'menu') {
      // slow orbit over the city behind the start screen
      var t = performance.now() * 0.00004;
      camera.position.set(Math.cos(t) * 150, 70, Math.sin(t) * 150);
      camera.lookAt(0, 0, 0);
      Vehicles.updateTraffic(dt, { x: 0, z: 0 });
      Pedestrians.updateWalkers(dt, { x: 0, z: 0 }, null);
    }
    renderer.render(scene, camera);
  }

  Hud.init();
  var saveNote = document.getElementById('save-note');
  if (SaveGame.hasSave()) {
    var d = SaveGame.load();
    saveNote.textContent = 'Saved game found — ' + Utils.fmtMoney(d.cash) + ', mission ' +
      Math.min(d.missionIndex + 1, 9) + ' of 9. Press CONTINUE to pick up where you left off.';
  } else {
    document.getElementById('btn-continue').style.display = 'none';
    saveNote.textContent = 'No save yet — your progress autosaves after every mission.';
  }
  animate();
  if (autostart) applyShotMode();
  window.__gameReady = true;
})();
