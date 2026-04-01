'use strict';
// ================================================================
// ENGINE.JS — Canvas, Input, Audio, Physics
// ================================================================
const Engine = (() => {
  let canvas, ctx;
  const K = {}, JP = {}, JR = {};

  // ── Resize ──────────────────────────────────────────────────
  function resize() {
    const mw = Math.min(window.innerWidth - 4, 1020);
    const mh = Math.min(window.innerHeight - 4, 600);
    let w = mw, h = w / 1.72;
    if (h > mh) { h = mh; w = h * 1.72; }
    canvas.width  = Math.floor(w);
    canvas.height = Math.floor(h);
    const wrap = document.getElementById('wrap');
    wrap.style.width  = canvas.width  + 'px';
    wrap.style.height = canvas.height + 'px';
  }

  function init() {
    canvas = document.getElementById('gc');
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    resize();
    window.addEventListener('resize', resize);

    // Keyboard
    document.addEventListener('keydown', e => {
      if (!K[e.code]) JP[e.code] = true;
      K[e.code] = true;
      if (['ArrowUp','Space','ArrowDown','KeyX','KeyQ'].includes(e.code)) e.preventDefault();
    });
    document.addEventListener('keyup', e => {
      K[e.code] = false;
      JR[e.code] = true;
    });

    // Touch
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      document.getElementById('touch').style.display = 'block';
      const hint = document.getElementById('hint');
      if (hint) hint.style.display = 'none';
    }
  }

  function clearFrame() {
    for (const k in JP) delete JP[k];
    for (const k in JR) delete JR[k];
  }

  // ── Audio ────────────────────────────────────────────────────
  let AC = null, musicStarted = false;

  function initAudio() {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
  }

  const SFX_DEF = {
    jump:  [210, 380, .10, .14, 'square'],
    ppsh:  [540, 130, .09, .07, 'square'],
    knife: [170,  52, .20, .13, 'sawtooth'],
    hit:   [140,  70, .24, .16, 'sine'],
    pick:  [430, 880, .10, .28, 'sine'],
    die:   [360,  40, .30, .65, 'sawtooth'],
    lvl:   [320, 660, .14, .42, 'sine'],
    boss:  [120,  40, .28, .50, 'sawtooth'],
    step:  [180, 140, .04, .06, 'sine'],
    secret:[600, 900, .10, .60, 'sine'],
  };

  function snd(type) {
    if (!AC) return;
    const c = SFX_DEF[type]; if (!c) return;
    const o = AC.createOscillator(), g = AC.createGain();
    o.connect(g); g.connect(AC.destination);
    const t = AC.currentTime;
    o.type = c[4];
    o.frequency.setValueAtTime(c[0], t);
    o.frequency.exponentialRampToValueAtTime(c[1], t + c[3]);
    g.gain.setValueAtTime(c[2], t);
    g.gain.exponentialRampToValueAtTime(.001, t + c[3]);
    o.start(); o.stop(t + c[3] + .04);
  }

  // ── File-based music ─────────────────────────────────────────
  let currentAudio = null;
  function playMusic(src) {
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
    const a = new Audio(src);
    a.loop = true; a.volume = 0.55;
    a.play().catch(() => {});
    currentAudio = a;
  }
  function stopMusic() {
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; currentAudio = null; }
  }

  let masterGain = null;
  function startMusic() {
    playMusic('insidious_caven.mp3');
  }
  function _startProceduralMusic() {
    if (!AC || musicStarted) return;
    musicStarted = true;
    const master = AC.createGain();
    masterGain = master;
    master.gain.value = 0;
    master.connect(AC.destination);
    master.gain.linearRampToValueAtTime(1, AC.currentTime + 3);

    // Drone
    const mkDrone = (freq, type, vol) => {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g); g.connect(master); o.start();
    };
    mkDrone(55,  'sawtooth', .04);
    mkDrone(82.4,'sine',     .025);
    mkDrone(110, 'sine',     .012);

    const BPM = 72, B = 60 / BPM;
    let bt = AC.currentTime + .2;

    function drum(t, freq, dur, vol) {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * .24, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(.001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
    }
    function snare(t) {
      const buf = AC.createBuffer(1, AC.sampleRate * .15, AC.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/d.length, 2);
      const s = AC.createBufferSource(), g = AC.createGain();
      s.buffer = buf; g.gain.value = .07;
      s.connect(g); g.connect(master); s.start(t);
    }
    function drumLoop() {
      while (bt < AC.currentTime + 3) {
        drum(bt, 90, .28, .12);
        snare(bt + B);
        drum(bt + B*1.5, 75, .20, .08);
        bt += B * 2;
      }
      setTimeout(drumLoop, 800);
    }
    drumLoop();

    const scale  = [220, 247, 261, 294, 330, 349, 392, 440];
    const melody = [0, 2, 3, 5, 3, 2, 0, null, 5, 7, 6, 5, 3, 2, 0, null];
    let mt = AC.currentTime + .5, mi = 0;
    function melLoop() {
      while (mt < AC.currentTime + 3) {
        const idx = melody[mi % melody.length];
        if (idx !== null) {
          const o = AC.createOscillator(), g = AC.createGain();
          o.type = 'triangle'; o.frequency.value = scale[idx];
          g.gain.setValueAtTime(.055, mt);
          g.gain.exponentialRampToValueAtTime(.001, mt + .45);
          o.connect(g); g.connect(master); o.start(mt); o.stop(mt + .5);
        }
        mt += B * .75; mi++;
      }
      setTimeout(melLoop, 600);
    }
    melLoop();
  }

  // ── Physics ──
  // (end of _startProceduralMusic — kept for fallback)────────────────────────────────────────────────
  const TS = 40;
  const GRAVITY  = 0.55;
  const MAX_FALL = 14;

  function colRect(ent) {
    const tx1 = Math.floor(ent.x / TS);
    const tx2 = Math.floor((ent.x + ent.w - 1) / TS);
    const ty1 = Math.floor(ent.y / TS);
    const ty2 = Math.floor((ent.y + ent.h - 1) / TS);
    for (let ty = ty1; ty <= ty2; ty++)
      for (let tx = tx1; tx <= tx2; tx++)
        if (World.solid(World.getTile(tx, ty))) return true;
    return false;
  }

  function moveX(ent) {
    ent.x += ent.vx;
    if (colRect(ent)) { ent.x -= ent.vx; ent.vx = 0; }
  }

  function moveY(ent) {
    ent.grounded = false;
    ent.y += ent.vy;
    if (colRect(ent)) {
      ent.y -= ent.vy;
      if (ent.vy > 0) ent.grounded = true;
      ent.vy = 0;
    }
  }

  function overlap(a, b) {
    return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  }
  function recOv(ax,ay,aw,ah, bx,by,bw,bh) {
    return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
  }

  return {
    get canvas() { return canvas; },
    get ctx()    { return ctx; },
    get K()  { return K; },
    get JP() { return JP; },
    get JR() { return JR; },
    W() { return canvas.width; },
    H() { return canvas.height; },
    init, initAudio, clearFrame, snd, startMusic, playMusic, stopMusic,
    colRect, moveX, moveY, overlap, recOv,
    TS, GRAVITY, MAX_FALL,
  };
})();
