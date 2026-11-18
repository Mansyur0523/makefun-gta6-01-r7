// audio.js — all sound is synthesized with WebAudio: three radio stations of
// original generative music plus engine, gunshot, siren and pickup effects.
// No audio files, no licensed music.
var AudioSys = (function () {
  var ctx = null, master = null, musicGain = null, sfxGain = null;
  var muted = false, stationIndex = 0, musicTimer = null, step = 0;
  var STATIONS = [
    { name: 'WAVE 88.5', desc: 'Sunset synthwave', root: 55,  scale: [0, 3, 5, 7, 10], tempo: 132, wave: 'sawtooth', bass: true },
    { name: 'BAY FM 101', desc: 'Coast funk',      root: 49,  scale: [0, 3, 5, 7, 10, 12], tempo: 104, wave: 'square', bass: true },
    { name: 'STATIC 99',  desc: 'Lo-fi dusk',      root: 65.4, scale: [0, 2, 3, 7, 9], tempo: 78, wave: 'triangle', bass: false },
  ];
  var engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null, sirenLFO = null;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master);
      startEngineHum();
      return true;
    } catch (e) { return false; }
  }
  function midiToFreq(root, semitone) { return root * Math.pow(2, semitone / 12); }

  function playNote(freq, when, dur, type, vol, dest) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(dest || musicGain);
    o.start(when); o.stop(when + dur + 0.05);
  }
  function scheduleStep() {
    if (!ctx || muted) return;
    var st = STATIONS[stationIndex];
    var stepDur = 60 / st.tempo / 2;
    var when = ctx.currentTime + 0.05;
    var s = step % 16;
    var scale = st.scale;
    // lead arp: notes on steps 0,2,4,6,8,10,12,14 with a wandering pattern
    if (s % 2 === 0) {
      var idx = [0, 2, 1, 3, 2, 4, 3, 1][(s / 2) | 0];
      var semi = scale[idx % scale.length] + 12 * (step % 64 < 32 ? 1 : 2);
      playNote(midiToFreq(st.root, semi), when, stepDur * 1.8, st.wave, 0.10);
    }
    // bass on beats
    if (st.bass && s % 4 === 0) {
      var bSemi = scale[(s / 4) % 3];
      playNote(midiToFreq(st.root, bSemi - 12), when, stepDur * 3.2, 'sine', 0.22);
    }
    // hat tick
    if (s % 2 === 1) {
      var buf = noiseBuffer(0.03);
      var src = ctx.createBufferSource(); src.buffer = buf;
      var g = ctx.createGain(); g.gain.value = 0.05;
      var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
      src.connect(f); f.connect(g); g.connect(musicGain); src.start(when);
    }
    step++;
  }
  var _noiseBuf = null;
  function noiseBuffer(dur) {
    if (_noiseBuf) return _noiseBuf;
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    _noiseBuf = buf;
    return buf;
  }
  function startRadio() {
    if (!ctx || musicTimer) return;
    musicTimer = setInterval(scheduleStep, (60 / STATIONS[stationIndex].tempo / 2) * 1000);
  }
  function stopRadio() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }
  function nextStation() {
    stationIndex = (stationIndex + 1) % STATIONS.length;
    step = 0;
    if (musicTimer) { stopRadio(); startRadio(); }
    return STATIONS[stationIndex].name;
  }
  function currentStation() { return STATIONS[stationIndex].name; }

  function startEngineHum() {
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
    engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
    engineOsc.start();
  }
  function setEngine(speed01, driving) {
    if (!ctx || !engineGain) return;
    var target = driving ? 0.03 + speed01 * 0.06 : 0.0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(45 + speed01 * 140, ctx.currentTime, 0.1);
  }
  function startSiren() {
    if (!ctx || sirenOsc) return;
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine'; sirenOsc.frequency.value = 700;
    sirenLFO = ctx.createOscillator(); sirenLFO.type = 'square'; sirenLFO.frequency.value = 0.6;
    var lfoGain = ctx.createGain(); lfoGain.gain.value = 220;
    sirenLFO.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0.045;
    sirenOsc.connect(sirenGain); sirenGain.connect(master);
    sirenOsc.start(); sirenLFO.start();
  }
  function stopSiren() {
    if (!sirenOsc) return;
    try { sirenOsc.stop(); sirenLFO.stop(); } catch (e) {}
    sirenOsc = null; sirenLFO = null; sirenGain = null;
  }
  function gunshot() {
    if (!ctx) return;
    var src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.18);
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.5, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    src.connect(f); f.connect(g); g.connect(sfxGain); src.start();
  }
  function blip(freq) {
    if (!ctx) return;
    playNote(freq || 880, ctx.currentTime, 0.12, 'sine', 0.25, sfxGain);
  }
  function thud() {
    if (!ctx) return;
    playNote(70, ctx.currentTime, 0.2, 'sine', 0.4, sfxGain);
  }
  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.9;
    return muted;
  }
  return { ensure: ensure, startRadio: startRadio, nextStation: nextStation, currentStation: currentStation,
    setEngine: setEngine, startSiren: startSiren, stopSiren: stopSiren, gunshot: gunshot,
    blip: blip, thud: thud, toggleMute: toggleMute, isMuted: function () { return muted; } };
})();
