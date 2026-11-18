// utils.js — small math and random helpers shared by every system.
// Every helper guards against NaN / Infinity so a bad value can never poison the frame.
var Utils = (function () {
  function clamp(v, lo, hi) {
    if (!isFinite(v)) return lo;
    return v < lo ? lo : (v > hi ? hi : v);
  }
  function lerp(a, b, t) { return a + (b - a) * clamp(t, 0, 1); }
  function safeDiv(a, b, fallback) {
    if (!isFinite(a) || !isFinite(b) || b === 0) return fallback === undefined ? 0 : fallback;
    var r = a / b;
    return isFinite(r) ? r : (fallback === undefined ? 0 : fallback);
  }
  function dist2D(ax, az, bx, bz) {
    var dx = ax - bx, dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  }
  function angleLerp(a, b, t) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * clamp(t, 0, 1);
  }
  function mulberry32(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rng = mulberry32(20261118);
  function rand(lo, hi) { return lo + rng() * (hi - lo); }
  function randInt(lo, hi) { return Math.floor(rand(lo, hi + 1)); }
  function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
  function fmtMoney(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  return { clamp: clamp, lerp: lerp, safeDiv: safeDiv, dist2D: dist2D, angleLerp: angleLerp,
    mulberry32: mulberry32, rand: rand, randInt: randInt, pick: pick, fmtMoney: fmtMoney, fmtTime: fmtTime };
})();
