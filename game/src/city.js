// city.js — builds Marisol Bay: a sunset coastal grid city with roads, sidewalks,
// buildings (never inside a road corridor), a beach, the sea, palms, lamps and props.
// Exports the road graph and building colliders the other systems drive on.
var City = (function () {
  var ROAD_HALF = 6;          // half width of a road lane pair
  var BLOCK = 60;             // distance between road centerlines
  var ROAD_LINES = [-180, -120, -60, 0, 60, 120, 180];
  var CITY_HALF = 215;        // playable land edge (beach starts here)
  var SEA_X = 262;            // sea plane begins
  var colliders = [];         // {minX,maxX,minZ,maxZ} building AABBs
  var roadMeshes = [];
  var sunLight = null;

  function isOnRoad(x, z) {
    for (var i = 0; i < ROAD_LINES.length; i++) {
      if (Math.abs(x - ROAD_LINES[i]) < ROAD_HALF + 2) return true;
      if (Math.abs(z - ROAD_LINES[i]) < ROAD_HALF + 2) return true;
    }
    return false;
  }
  function nearestRoadCoord(v) {
    var best = ROAD_LINES[0], bd = 1e9;
    for (var i = 0; i < ROAD_LINES.length; i++) {
      var d = Math.abs(v - ROAD_LINES[i]);
      if (d < bd) { bd = d; best = ROAD_LINES[i]; }
    }
    return best;
  }
  function boxCollides(x, z, r) {
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
    }
    return false;
  }
  // Push a circle out of building AABBs; returns corrected {x,z}.
  function resolveCollision(x, z, r) {
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
        var dxl = x - (c.minX - r), dxr = (c.maxX + r) - x;
        var dzl = z - (c.minZ - r), dzr = (c.maxZ + r) - z;
        var m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) x = c.minX - r; else if (m === dxr) x = c.maxX + r;
        else if (m === dzl) z = c.minZ - r; else z = c.maxZ + r;
      }
    }
    return { x: Utils.clamp(x, -CITY_HALF - 40, SEA_X - 4), z: Utils.clamp(z, -CITY_HALF, CITY_HALF) };
  }

  function makeBox(w, h, d, color, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: color }));
    m.position.set(x, y, z);
    return m;
  }

  function buildCity(scene) {
    // --- sky, fog and sunset lighting ---
    scene.background = new THREE.Color(0xff8c42);
    scene.fog = new THREE.Fog(0xff9a52, 120, 620);
    var hemi = new THREE.HemisphereLight(0xffd9a0, 0x2a1a3a, 0.75);
    scene.add(hemi);
    sunLight = new THREE.DirectionalLight(0xffb347, 1.15);
    sunLight.position.set(-140, 90, -60);
    scene.add(sunLight);
    var amb = new THREE.AmbientLight(0x604060, 0.35);
    scene.add(amb);

    // --- ground: grass/concrete base, then roads ---
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700),
      new THREE.MeshLambertMaterial({ color: 0x3d5a3a }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(20, -0.05, 0);
    scene.add(ground);

    var roadMat = new THREE.MeshLambertMaterial({ color: 0x2b2b33 });
    var sideMat = new THREE.MeshLambertMaterial({ color: 0x8a8578 });
    for (var i = 0; i < ROAD_LINES.length; i++) {
      var c = ROAD_LINES[i];
      var rx = new THREE.Mesh(new THREE.PlaneGeometry(440, ROAD_HALF * 2), roadMat);
      rx.rotation.x = -Math.PI / 2; rx.position.set(0, 0, c); scene.add(rx);
      var rz = new THREE.Mesh(new THREE.PlaneGeometry(440, ROAD_HALF * 2), roadMat);
      rz.rotation.x = -Math.PI / 2; rz.rotation.z = Math.PI / 2; rz.position.set(c, 0, 0); scene.add(rz);
      // sidewalks: lighter strips flanking each road
      var sx = new THREE.Mesh(new THREE.PlaneGeometry(440, 3), sideMat);
      sx.rotation.x = -Math.PI / 2; sx.position.set(0, 0.02, c + ROAD_HALF + 1.5); scene.add(sx);
      var sx2 = sx.clone(); sx2.position.z = c - ROAD_HALF - 1.5; scene.add(sx2);
      var sz = new THREE.Mesh(new THREE.PlaneGeometry(3, 440), sideMat);
      sz.rotation.x = -Math.PI / 2; sz.position.set(c + ROAD_HALF + 1.5, 0.02, 0); scene.add(sz);
      var sz2 = sz.clone(); sz2.position.x = c - ROAD_HALF - 1.5; scene.add(sz2);
      // dashed center line
      for (var d = -210; d < 210; d += 12) {
        var dash = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 5), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
        dash.rotation.x = -Math.PI / 2; dash.position.set(d, 0.03, c); scene.add(dash);
        var dash2 = dash.clone(); dash2.rotation.z = Math.PI / 2; dash2.position.set(c, 0.03, d); scene.add(dash2);
      }
    }

    // --- beach and sea (east side, +X) ---
    var sand = new THREE.Mesh(new THREE.PlaneGeometry(90, 470),
      new THREE.MeshLambertMaterial({ color: 0xe8c98a }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(CITY_HALF + 42, 0.02, 0);
    scene.add(sand);
    var sea = new THREE.Mesh(new THREE.PlaneGeometry(320, 700),
      new THREE.MeshLambertMaterial({ color: 0x0e4d6e }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(SEA_X + 150, -0.4, 0);
    scene.add(sea);
    // sun glitter strip on the sea
    var glitter = new THREE.Mesh(new THREE.PlaneGeometry(60, 700),
      new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.35 }));
    glitter.rotation.x = -Math.PI / 2; glitter.position.set(SEA_X + 40, -0.2, 0);
    scene.add(glitter);

    // --- buildings: one or two per block, always inside the block, never on a road ---
    var palette = [0xd8b48a, 0xc98a6b, 0xa8b8c8, 0xe0cfa8, 0x9a7b8a, 0x7a9ab8, 0xd8a03c, 0xb8a898, 0x8a6a5a, 0x6a8a7a];
    var rng = Utils.mulberry32(777);
    var roofMat = new THREE.MeshLambertMaterial({ color: 0x333340 });
    var winMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (var bx = 0; bx < ROAD_LINES.length - 1; bx++) {
      for (var bz = 0; bz < ROAD_LINES.length - 1; bz++) {
        var x0 = ROAD_LINES[bx] + ROAD_HALF + 4, x1 = ROAD_LINES[bx + 1] - ROAD_HALF - 4;
        var z0 = ROAD_LINES[bz] + ROAD_HALF + 4, z1 = ROAD_LINES[bz + 1] - ROAD_HALF - 4;
        if (x1 - x0 < 14 || z1 - z0 < 14) continue;
        var n = rng() < 0.45 ? 2 : 1;
        for (var k = 0; k < n; k++) {
          var w = 12 + rng() * 16, d = 12 + rng() * 16;
          var cx = x0 + w / 2 + rng() * Math.max(0, (x1 - x0) - w);
          var cz = z0 + d / 2 + rng() * Math.max(0, (z1 - z0) - d);
          var h = 8 + rng() * rng() * 46;
          var col = palette[Math.floor(rng() * palette.length)];
          var b = makeBox(w, h, d, col, cx, h / 2, cz);
          scene.add(b);
          var roof = makeBox(w * 0.7, 1.2, d * 0.7, 0x333340, cx, h + 0.6, cz);
          scene.add(roof);
          // lit windows on the street-facing sides
          var rows = Math.max(1, Math.floor(h / 6));
          for (var r = 0; r < rows; r++) {
            for (var ww = -1; ww <= 1; ww++) {
              if (rng() < 0.5) continue;
              var win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), winMat);
              win.position.set(cx + ww * w * 0.28, 3 + r * 6, cz + d / 2 + 0.06);
              scene.add(win);
            }
          }
          colliders.push({ minX: cx - w / 2 - 0.5, maxX: cx + w / 2 + 0.5, minZ: cz - d / 2 - 0.5, maxZ: cz + d / 2 + 0.5 });
        }
      }
    }

    // --- landmarks: city hall tower, hotel, pier ---
    var tower = makeBox(26, 78, 26, 0xc98a6b, -150, 39, -150); scene.add(tower);
    colliders.push({ minX: -163.5, maxX: -136.5, minZ: -163.5, maxZ: -136.5 });
    var hotel = makeBox(30, 34, 18, 0x7a9ab8, 196, 17, -60); scene.add(hotel);
    colliders.push({ minX: 180.5, maxX: 211.5, minZ: -69.5, maxZ: -50.5 });
    // pier planks into the sea
    for (var p = 0; p < 14; p++) {
      var plank = makeBox(4, 0.6, 10, 0x8a6a4a, SEA_X - 6 + p * 4, 0.4, 120);
      scene.add(plank);
    }

    // --- palms along the beach and street lamps ---
    var trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
    var leafMat = new THREE.MeshLambertMaterial({ color: 0x2a8a4a });
    for (var py = -200; py <= 200; py += 26) {
      var px = CITY_HALF + 12 + (py % 52 === 0 ? 6 : 0);
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 9, 6), trunkMat);
      trunk.position.set(px, 4.5, py); scene.add(trunk);
      var leaves = new THREE.Mesh(new THREE.ConeGeometry(3.4, 4, 7), leafMat);
      leaves.position.set(px, 10.5, py); scene.add(leaves);
    }
    var lampMat = new THREE.MeshLambertMaterial({ color: 0x222226 });
    var lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (var lx = -180; lx <= 180; lx += 60) {
      for (var lz = -180; lz <= 180; lz += 60) {
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), lampMat);
        pole.position.set(lx + ROAD_HALF + 2.5, 3.5, lz + ROAD_HALF + 2.5); scene.add(pole);
        var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampGlow);
        bulb.position.set(lx + ROAD_HALF + 2.5, 7.2, lz + ROAD_HALF + 2.5); scene.add(bulb);
      }
    }

    // --- the sun itself, low on the horizon over the sea ---
    var sun = new THREE.Mesh(new THREE.CircleGeometry(26, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, fog: false }));
    sun.position.set(420, 55, 40); sun.lookAt(0, 20, 0);
    scene.add(sun);
  }

  function randomRoadPoint() {
    var along = Utils.pick(ROAD_LINES);
    var across = Utils.rand(-200, 200);
    if (Utils.rand(0, 1) < 0.5) return { x: along, z: across };
    return { x: across, z: along };
  }
  function randomSidewalkPoint() {
    var p = randomRoadPoint();
    var off = Utils.pick([-1, 1]) * (ROAD_HALF + 2.5);
    if (Utils.rand(0, 1) < 0.5) p.x += off; else p.z += off;
    return p;
  }

  return { buildCity: buildCity, isOnRoad: isOnRoad, nearestRoadCoord: nearestRoadCoord,
    boxCollides: boxCollides, resolveCollision: resolveCollision,
    randomRoadPoint: randomRoadPoint, randomSidewalkPoint: randomSidewalkPoint,
    ROAD_LINES: ROAD_LINES, ROAD_HALF: ROAD_HALF, CITY_HALF: CITY_HALF, SEA_X: SEA_X,
    colliders: colliders };
})();
