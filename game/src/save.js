// save.js — localStorage save / load for cash, mission progress, weapons,
// upgrades, health and the player's position.
var SaveGame = (function () {
  var KEY = 'sunset-streets-marisol-save-v1';
  function save(state) {
    try {
      var data = {
        cash: state.cash, missionIndex: Missions.index, health: state.health, armor: state.armor,
        weapons: Combat.WEAPONS.map(function (w) { return w.owned; }),
        upgrades: state.upgrades,
        x: state.x, z: state.z, savedAt: Date.now(),
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || typeof d.cash !== 'number') return null;
      return d;
    } catch (e) { return null; }
  }
  function apply(d) {
    if (!d) return false;
    if (window.Game) {
      window.Game.cash = d.cash || 0;
      window.Game.health = d.health || 100;
      window.Game.armor = d.armor || 0;
      window.Game.upgrades = d.upgrades || { engine: false, brakes: false };
    }
    if (d.weapons) {
      for (var i = 0; i < d.weapons.length && i < Combat.WEAPONS.length; i++) {
        Combat.WEAPONS[i].owned = !!d.weapons[i];
      }
    }
    Missions.index = Math.min(d.missionIndex || 0, Missions.STORY.length - 1);
    return { x: d.x || 0, z: d.z || 0 };
  }
  function hasSave() { return !!load(); }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  return { save: save, load: load, apply: apply, hasSave: hasSave, clear: clear, KEY: KEY };
})();
