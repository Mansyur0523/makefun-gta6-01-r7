// missions.js — nine original story missions for Jax Marlowe in Marisol Bay.
// Each mission is a list of objectives: go to a marker, take out a count of
// gang members, hold a spot, or survive a timer against the police.
var Missions = (function () {
  var STORY = [
    { id: 'm1', title: 'FIRST WHEELS', intro: 'Nadia needs wheels. Steal any car and bring it to her garage.',
      reward: 300, objectives: [
        { type: 'stealCar', text: 'Steal a car (walk up to one and press E)' },
        { type: 'goto', text: 'Drive to Nadia\u2019s garage', x: -60, z: -60, r: 8 },
      ] },
    { id: 'm2', title: 'SUNSET DELIVERIES', intro: 'Nadia\u2019s cousin runs a taco truck. Three drops, no questions.',
      reward: 450, objectives: [
        { type: 'goto', text: 'Drop 1: Pier cafe', x: 180, z: 120, r: 8 },
        { type: 'goto', text: 'Drop 2: City Hall steps', x: -150, z: -150, r: 8 },
        { type: 'goto', text: 'Drop 3: Beach hotel', x: 180, z: -60, r: 8 },
      ] },
    { id: 'm3', title: 'SHAKEDOWN', intro: 'The Vipers are taxing Nadia\u2019s block. Send three of them home.',
      reward: 600, objectives: [
        { type: 'kill', text: 'Take out 3 Vipers near the garage', count: 3, x: -60, z: -60, spawnR: 26 },
      ] },
    { id: 'm4', title: 'THE PICKUP', intro: 'A package is waiting under the pier. Grab it, and mind the cops.',
      reward: 700, objectives: [
        { type: 'goto', text: 'Reach the package under the pier', x: 210, z: 120, r: 6 },
        { type: 'pickup', text: 'Pick up the package (press F)', x: 210, z: 120, r: 6 },
        { type: 'goto', text: 'Bring it back to Nadia\u2019s garage', x: -60, z: -60, r: 8 },
      ] },
    { id: 'm5', title: 'GETAWAY DRIVER', intro: 'Nadia\u2019s deal went loud. Drive her to the safehouse with the law on you.',
      reward: 900, objectives: [
        { type: 'goto', text: 'Pick up Nadia at the garage', x: -60, z: -60, r: 8 },
        { type: 'goto', text: 'Lose the cops and reach the safehouse', x: 120, z: 180, r: 8, wanted: 3 },
      ] },
    { id: 'm6', title: 'BEACH PARTY BUST', intro: 'The Vipers took over the beach bonfire. Clear them out.',
      reward: 1100, objectives: [
        { type: 'kill', text: 'Take out 5 Vipers on the beach', count: 5, x: 220, z: 60, spawnR: 30 },
      ] },
    { id: 'm7', title: 'THE VAULT JOB', intro: 'Marisol Trust Bank. Hold the lobby while the crew cracks the vault.',
      reward: 1800, objectives: [
        { type: 'goto', text: 'Reach the bank on Harbor Row', x: 60, z: 180, r: 8 },
        { type: 'hold', text: 'Hold the lobby while the vault cracks', x: 60, z: 180, r: 10, seconds: 25 },
        { type: 'goto', text: 'Escape to the pier', x: 210, z: -120, r: 8 },
      ] },
    { id: 'm8', title: 'HARBOR LIGHTS', intro: 'Kane Voss is shipping product through the harbor. Hit his crew.',
      reward: 2200, objectives: [
        { type: 'kill', text: 'Take out 6 of Voss\u2019s crew at the harbor', count: 6, x: 120, z: -180, spawnR: 30 },
        { type: 'goto', text: 'Steal Voss\u2019s truck and drive it to the garage', x: 120, z: -180, r: 8, stealTruck: true },
      ] },
    { id: 'm9', title: 'KING OF MARISOL', intro: 'Voss himself is coming to the boardwalk. End it. Survive the whole bay.',
      reward: 5000, objectives: [
        { type: 'goto', text: 'Meet Voss at the boardwalk', x: 220, z: 0, r: 10 },
        { type: 'kill', text: 'Take out Voss and his 4 guards', count: 5, x: 220, z: 0, spawnR: 24, boss: true },
        { type: 'survive', text: 'Survive the 5-star heat for 60 seconds', seconds: 60, wanted: 5 },
      ] },
  ];

  var index = 0;            // current mission index (0..8), 9 = story done
  var objIndex = 0;         // current objective within the mission
  var kills = 0;            // kills counted toward the current kill objective
  var timer = 0;            // hold / survive timer
  var active = false;       // a mission is running
  var marker = null;        // beacon mesh in the world
  var markerLight = null;
  var spawnedForObjective = false;
  var lastPickupPos = null;

  function mission() { return index < STORY.length ? STORY[index] : null; }
  function objective() {
    var m = mission();
    return m ? m.objectives[objIndex] : null;
  }
  function currentTarget() {
    var o = objective();
    if (!o) return null;
    return { x: o.x || 0, z: o.z || 0 };
  }

  function makeMarker(scene) {
    if (marker) scene.remove(marker);
    var g = new THREE.Group();
    var beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
    beam.position.y = 30; g.add(beam);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.3, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.4; g.add(ring);
    var arrow = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.4, 4),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    arrow.rotation.x = Math.PI; arrow.position.y = 8; g.add(arrow);
    marker = g; markerLight = arrow;
    scene.add(g);
    return g;
  }

  function startMission(scene, i) {
    index = i; objIndex = 0; kills = 0; timer = 0; active = true;
    spawnedForObjective = false;
    makeMarker(scene);
    var m = mission();
    if (window.Game) window.Game.showBanner(m.title, m.intro);
    if (window.Game) window.Game.onMissionStart(m);
    updateMarker(scene);
    return m;
  }
  function startNext(scene) {
    if (index >= STORY.length) return null;
    return startMission(scene, index);
  }
  function updateMarker(scene) {
    var o = objective();
    if (!marker) makeMarker(scene);
    if (!o || o.type === 'stealCar' || o.type === 'survive' || o.type === 'pickup') {
      marker.visible = (o && o.type === 'pickup');
    } else {
      marker.visible = true;
    }
    if (o && o.x !== undefined) {
      marker.position.set(o.x, 0, o.z);
    }
    if (o && o.type === 'kill' && !spawnedForObjective) {
      spawnObjectiveEnemies(scene, o);
      spawnedForObjective = true;
    }
  }
  function spawnObjectiveEnemies(scene, o) {
    var n = o.count || 3;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + Utils.rand(-0.4, 0.4);
      var r = Utils.rand(6, o.spawnR || 24);
      var x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r;
      var e = Pedestrians.spawnEnemy(scene, x, z, o.boss ? 0x5a0a5a : 0x8a1a1a);
      if (o.boss && i === 0) { e.health = 300; e.mesh.scale.setScalar(1.2); e.isBoss = true; }
      e.missionEnemy = true;
    }
  }

  // Called every frame; returns an event string when something completes, else null.
  function update(dt, scene, player) {
    if (!active) return null;
    var m = mission();
    if (!m) return null;
    var o = objective();
    if (!o) return null;
    var px = player.x, pz = player.z;
    var d = (o.x !== undefined) ? Utils.dist2D(px, pz, o.x, o.z) : 9999;

    if (o.type === 'stealCar') {
      if (player.inCar) { advance(scene); return 'objective'; }
    } else if (o.type === 'goto') {
      if (d < (o.r || 8)) {
        if (o.wanted) Police.setWanted(o.wanted, 'mission');
        advance(scene);
        return 'objective';
      }
    } else if (o.type === 'pickup') {
      if (d < (o.r || 6) && player.tryPickup) {
        advance(scene);
        return 'objective';
      }
    } else if (o.type === 'kill') {
      if (kills >= o.count) { advance(scene); return 'objective'; }
    } else if (o.type === 'hold') {
      if (d < (o.r || 10)) {
        timer += dt;
        if (timer >= o.seconds) { advance(scene); return 'objective'; }
      } else {
        timer = Math.max(0, timer - dt * 0.5);
      }
    } else if (o.type === 'survive') {
      if (o.wanted) Police.setWanted(Math.max(Police.wanted, o.wanted), 'mission');
      timer += dt;
      if (timer >= o.seconds) { advance(scene); return 'objective'; }
    }
    // animate the marker arrow
    if (marker && marker.visible && markerLight) {
      markerLight.position.y = 8 + Math.sin(performance.now() * 0.004) * 1.2;
      markerLight.rotation.y += dt * 2;
    }
    return null;
  }
  function advance(scene) {
    objIndex++;
    kills = 0; timer = 0; spawnedForObjective = false;
    var m = mission();
    if (objIndex >= m.objectives.length) {
      // mission complete
      active = false;
      if (window.Game) window.Game.onMissionComplete(m);
      index++;
      if (index < STORY.length) {
        setTimeout(function () { if (window.Game) window.Game.startNextMission(); }, 1200);
      } else if (window.Game) {
        window.Game.onStoryComplete();
      }
    } else {
      AudioSys.blip(990);
      updateMarker(scene);
    }
  }
  function onKill(enemy) {
    if (!active) return;
    var o = objective();
    if (o && o.type === 'kill' && enemy && enemy.missionEnemy) {
      kills++;
      if (window.Game) window.Game.onKillProgress(kills, o.count);
    }
  }
  function objectiveText() {
    var m = mission();
    if (!m) return { title: 'FREE ROAM', text: 'Marisol Bay is yours. Explore, earn, and stay out of trouble.', sub: '' };
    var o = objective();
    if (!o) return { title: m.title, text: '', sub: '' };
    var sub = '';
    if (o.type === 'kill') sub = kills + ' / ' + o.count + ' down';
    if (o.type === 'hold' || o.type === 'survive') sub = Math.ceil(Math.max(0, o.seconds - timer)) + 's left';
    return { title: 'MISSION ' + (index + 1) + ' / 9 — ' + m.title, text: o.text, sub: sub };
  }
  function hideMarker(scene) {
    if (marker) { scene.remove(marker); marker = null; }
  }

  return { STORY: STORY, startMission: startMission, startNext: startNext, update: update,
    onKill: onKill, objectiveText: objectiveText, hideMarker: hideMarker,
    get index() { return index; }, set index(v) { index = v; },
    get active() { return active; }, set active(v) { active = v; },
    get objIndex() { return objIndex; }, set objIndex(v) { objIndex = v; },
    get kills() { return kills; }, set kills(v) { kills = v; },
    get timer() { return timer; }, set timer(v) { timer = v; },
    currentTarget: currentTarget, mission: mission, objective: objective,
    updateMarker: updateMarker };
})();
