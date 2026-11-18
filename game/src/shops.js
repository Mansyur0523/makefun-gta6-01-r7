// shops.js — weapon shop (Ammu-Nation Marisol), safehouse healing and garage
// upgrades. The shop is a DOM overlay; the minimap canvas keeps its own high
// z-index so it stays visible above the shop panel.
var Shops = (function () {
  var open = false;
  var shopPos = { x: -60, z: -120 };   // Ammu-Nation, near Nadia's garage
  var safehousePos = { x: 120, z: 180 };
  var ITEMS = [
    { id: 'shotgun', name: 'SHOTGUN', desc: 'Close-range crowd control. 6 pellets per shell.', price: 450, kind: 'weapon' },
    { id: 'smg', name: 'SMG', desc: 'Fast fire, 30-round mag. Spray the block.', price: 900, kind: 'weapon' },
    { id: 'rifle', name: 'RIFLE', desc: 'Long-range precision. Drops Vipers in one hit.', price: 1600, kind: 'weapon' },
    { id: 'ammo', name: 'AMMO RESTOCK', desc: 'Refill every owned weapon to full.', price: 200, kind: 'ammo' },
    { id: 'armor', name: 'BODY ARMOR', desc: 'Absorbs half of all damage until it breaks.', price: 350, kind: 'armor' },
    { id: 'engine', name: 'ENGINE TUNE', desc: 'Garage upgrade: +20% top speed on every car you drive.', price: 800, kind: 'upgrade' },
    { id: 'brakes', name: 'RACE BRAKES', desc: 'Garage upgrade: sharper handling on every car you drive.', price: 600, kind: 'upgrade' },
  ];

  function buildList() {
    var list = document.getElementById('shop-list');
    list.innerHTML = '';
    for (var i = 0; i < ITEMS.length; i++) {
      (function (item) {
        var card = document.createElement('div');
        card.className = 'shop-card';
        var owned = item.kind === 'weapon' && Combat.WEAPONS.filter(function (w) { return w.id === item.id; })[0].owned;
        var tuned = (item.id === 'engine' && window.Game && window.Game.upgrades.engine) ||
                    (item.id === 'brakes' && window.Game && window.Game.upgrades.brakes);
        card.innerHTML = '<h3>' + item.name + '</h3><p>' + item.desc + '</p><div class="price">' +
          (owned || tuned ? 'OWNED' : Utils.fmtMoney(item.price)) + '</div>';
        card.onclick = function () { buy(item); };
        list.appendChild(card);
      })(ITEMS[i]);
    }
  }
  function buy(item) {
    if (!window.Game) return;
    var owned = item.kind === 'weapon' && Combat.WEAPONS.filter(function (w) { return w.id === item.id; })[0].owned;
    var tuned = (item.id === 'engine' && window.Game.upgrades.engine) ||
                (item.id === 'brakes' && window.Game.upgrades.brakes);
    if (owned || tuned) { window.Game.toast('Already yours.'); return; }
    if (window.Game.cash < item.price) { window.Game.toast('Not enough cash.'); return; }
    window.Game.cash -= item.price;
    if (item.kind === 'weapon') { Combat.buyWeapon(item.id); window.Game.toast(item.name + ' purchased! Press ' + (Combat.WEAPONS.findIndex(function (w) { return w.id === item.id; }) + 1) + ' to equip.'); }
    if (item.kind === 'ammo') { Combat.refillAmmo(); window.Game.toast('Ammo restocked.'); }
    if (item.kind === 'armor') { window.Game.armor = 100; window.Game.toast('Body armor equipped.'); }
    if (item.id === 'engine') { window.Game.upgrades.engine = true; window.Game.toast('Engine tune installed.'); }
    if (item.id === 'brakes') { window.Game.upgrades.brakes = true; window.Game.toast('Race brakes installed.'); }
    AudioSys.blip(1200);
    buildList();
    if (window.Game) window.Game.refreshHud();
  }
  function openShop() {
    open = true;
    buildList();
    document.getElementById('shop-screen').classList.remove('hidden');
    if (window.Game) window.Game.setPaused(true, true);
  }
  function closeShop() {
    open = false;
    document.getElementById('shop-screen').classList.add('hidden');
    if (window.Game) window.Game.setPaused(false, true);
  }
  return { openShop: openShop, closeShop: closeShop, buildList: buildList,
    get open() { return open; }, shopPos: shopPos, safehousePos: safehousePos, ITEMS: ITEMS };
})();
