// hud.js — the 2D HUD: wanted stars, cash, clock, weapon, speed, objective
// text, toasts, banners, and the circular minimap rendered every frame on its
// own canvas (it keeps rendering even while the shop overlay is open).
var Hud = (function () {
  var els = {};
  var toastTimer = null;
  var bannerTimer = null;

  function init() {
    var ids = ['hud', 'wanted', 'cash', 'clock', 'radio', 'weapon-name', 'ammo', 'speedo',
      'health-fill', 'armor-fill', 'objective-title', 'objective-text', 'objective-sub',
      'mission-banner', 'banner-title', 'banner-sub', 'toast', 'crosshair', 'hint',
      'damage-flash', 'minimap', 'start-screen', 'pause-screen', 'shop-screen',
      'dead-screen', 'win-screen', 'save-note'];
    for (var i = 0; i < ids.length; i++) els[ids[i]] = document.getElementById(ids[i]);
    els.minimapCtx = els.minimap.getContext('2d');
  }
  function showHud() { els.hud.classList.remove('hidden'); }
  function hideHud() { els.hud.classList.add('hidden'); }

  function refresh(game) {
    // wanted stars
    var stars = '';
    for (var i = 0; i < 5; i++) stars += i < Police.wanted ? '★' : '<span class="off">★</span>';
    els.wanted.innerHTML = stars;
    els.cash.textContent = Utils.fmtMoney(game.cash);
    els['weapon-name'].textContent = Combat.weapon().name;
    els.ammo.innerHTML = Combat.ammoText();
    var hp = Utils.clamp(game.health, 0, 100);
    els['health-fill'].style.width = hp + '%';
    els['health-fill'].style.background = hp > 50 ? 'linear-gradient(90deg,#37d67a,#a5e635)' : hp > 25 ? 'linear-gradient(90deg,#f0a832,#f0d832)' : 'linear-gradient(90deg,#e83232,#f06a32)';
    els['armor-fill'].style.width = Utils.clamp(game.armor, 0, 100) + '%';
    els.radio.innerHTML = '&#9834; ' + AudioSys.currentStation();
    var obj = Missions.objectiveText();
    els['objective-title'].textContent = obj.title;
    els['objective-text'].textContent = obj.text;
    els['objective-sub'].textContent = obj.sub || '';
    // clock: sunset drifts slowly from 18:30 toward night
    var mins = 18 * 60 + 30 + Math.floor(game.playTime / 8);
    var hh = Math.floor(mins / 60) % 24, mm = mins % 60;
    els.clock.innerHTML = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm +
      ' &middot; ' + (hh < 19 ? 'SUNSET' : hh < 21 ? 'DUSK' : 'NIGHT');
    els.speedo.classList.toggle('hidden', !game.playerInCar);
    if (game.playerInCar) els.speedo.innerHTML = Math.round(game.carSpeed) + ' <small>MPH</small>';
    els.crosshair.style.display = game.aiming ? 'block' : 'none';
  }

  function toast(msg, ms) {
    els.toast.textContent = msg;
    els.toast.style.display = 'block';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.style.display = 'none'; }, ms || 2600);
  }
  function showBanner(title, sub) {
    els['banner-title'].textContent = title;
    els['banner-sub'].textContent = sub || '';
    els['mission-banner'].style.display = 'block';
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { els['mission-banner'].style.display = 'none'; }, 3600);
  }
  function damageFlash() {
    els['damage-flash'].style.opacity = '1';
    setTimeout(function () { els['damage-flash'].style.opacity = '0'; }, 130);
  }

  // Minimap: circular, city roads + beach + sea, player arrow, mission marker,
  // cops (red), traffic (white), shop (green $), safehouse (blue house).
  function drawMinimap(game) {
    var ctx = els.minimapCtx;
    if (!ctx) return;
    var S = 190, C = S / 2, R = 96;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(C, C, R, 0, Math.PI * 2); ctx.clip();
    // background: land, sea on the right
    ctx.fillStyle = '#12283a'; ctx.fillRect(0, 0, S, S);
    var scale = S / 520; // world -260..260 -> 190px
    function wx(x) { return C + x * scale; }
    function wz(z) { return C + z * scale; }
    // sea
    ctx.fillStyle = '#0e4d6e';
    ctx.fillRect(wx(215), 0, S, S);
    ctx.fillStyle = '#e8c98a';
    ctx.fillRect(wx(215), 0, wx(262) - wx(215), S);
    // roads
    ctx.strokeStyle = '#5a5a66'; ctx.lineWidth = 5;
    for (var i = 0; i < City.ROAD_LINES.length; i++) {
      var c = City.ROAD_LINES[i];
      ctx.beginPath(); ctx.moveTo(wx(-215), wz(c)); ctx.lineTo(wx(215), wz(c)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wx(c), wz(-215)); ctx.lineTo(wx(c), wz(215)); ctx.stroke();
    }
    // shop + safehouse
    ctx.fillStyle = '#7dff9a';
    ctx.beginPath(); ctx.arc(wx(Shops.shopPos.x), wz(Shops.shopPos.z), 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5bc8ff';
    ctx.beginPath(); ctx.arc(wx(Shops.safehousePos.x), wz(Shops.safehousePos.z), 4, 0, Math.PI * 2); ctx.fill();
    // traffic
    ctx.fillStyle = '#ffffff';
    for (var t = 0; t < Vehicles.traffic.length; t++) {
      ctx.fillRect(wx(Vehicles.traffic[t].mesh.position.x) - 1.5, wz(Vehicles.traffic[t].mesh.position.z) - 1.5, 3, 3);
    }
    // cops
    ctx.fillStyle = '#ff4040';
    for (var c2 = 0; c2 < Police.copCars.length; c2++) {
      ctx.beginPath(); ctx.arc(wx(Police.copCars[c2].mesh.position.x), wz(Police.copCars[c2].mesh.position.z), 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // mission marker
    var tgt = Missions.currentTarget();
    if (Missions.active && tgt) {
      ctx.fillStyle = '#ffd23e';
      var mx = wx(tgt.x), mz = wz(tgt.z);
      ctx.beginPath(); ctx.arc(mx, mz, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx, mz, 8 + Math.sin(performance.now() * 0.006) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    // player arrow (rotates with heading)
    var px = wx(game.playerX), pz = wz(game.playerZ);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(game.playerHeading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    ctx.restore();
    // rim
    ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(C, C, R - 1, 0, Math.PI * 2); ctx.stroke();
  }

  return { init: init, showHud: showHud, hideHud: hideHud, refresh: refresh, toast: toast,
    showBanner: showBanner, damageFlash: damageFlash, drawMinimap: drawMinimap, els: els };
})();
