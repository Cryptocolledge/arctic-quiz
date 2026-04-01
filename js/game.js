'use strict';
// ================================================================
// GAME.JS — State machine, main loop, level management
// ================================================================
const Game = (() => {

  // ── State ────────────────────────────────────────────────────
  let state   = 'start';   // start|story|playing|paused|levelup|transition|dead|victory
  let levelIdx = 0;
  let gt      = 0;         // global game tick
  let paused  = false;
  let secretShown = false;
  let combo   = 0;         // kill combo counter
  let comboTimer = 0;      // frames since last kill
  let hurtFlashScreen = 0; // red screen flash on player damage

  // ── Game objects ─────────────────────────────────────────────
  let P       = null;
  let enemies = [];
  let bullets = [];
  let items   = [];
  let parts   = [];
  let ftexts  = [];
  let cam     = { x:0, y:0 };
  let shake   = 0;

  // Dialogues per level (reset on load)
  let dialogues = [];

  // ── Helpers ──────────────────────────────────────────────────
  function burst(x,y,col,n=8) {
    for (let i=0;i<n;i++) {
      const a=Math.random()*Math.PI*2, s=.8+Math.random()*3.5;
      parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,sz:2+Math.random()*4,col,life:14+Math.random()*18});
    }
  }
  function ftext(x,y,t,c) { ftexts.push({x,y,t,c,life:55}); }
  function shk(n)          { shake=Math.max(shake,n); }

  // ── Surface Y helper: first solid tile top in column tx ──────
  function spawnY(tx) {
    for (let ty = 0; ty < World.MY; ty++) {
      if (World.solid(World.getTile(tx, ty))) return ty * Engine.TS;
    }
    return (World.GY() - 1) * Engine.TS;
  }

  // ── Load level ───────────────────────────────────────────────
  function loadLevel(idx) {
    levelIdx  = idx;
    const def = Levels.defs[idx];
    secretShown = false;
    combo = 0; comboTimer = 0; hurtFlashScreen = 0;

    World.init(def.worldW);

    // Build ground
    const GY=World.GY(), MX=World.MX, MY=World.MY, MAP=World.MAP;
    for (let x=0;x<MX;x++) for (let y=GY;y<MY;y++) MAP[y][x]=1;

    // Build platforms / walls / pits defined by level
    def.build();

    // Music per level
    if (idx >= 2) Engine.playMusic('to_the_wire.ogg');
    else          Engine.playMusic('insidious_caven.mp3');

    // Spawn enemies above actual surface (avoids wall interiors)
    const gy=GY;
    enemies = def.enemies().map(ed => {
      const sy = spawnY(ed.tx) - 40;  // 40px above surface so gravity lands them
      const e = new Enemy(ed.tx*Engine.TS, sy, ed.type);
      e.sx = e.x;
      return e;
    });

    // Boss
    const bd = def.boss;
    const boss = new Enemy(bd.tx*Engine.TS, (gy-5)*Engine.TS, bd.type);
    boss.hp = bd.hp; boss.maxhp = bd.hp; boss.sx = boss.x;
    enemies.push(boss);

    // Items
    items = def.items().map(it => ({
      x: it.tx*Engine.TS,
      y: it.ty*Engine.TS,
      type: it.type,
      done: false,
      w:24, h:24,
      pulse: Math.random()*6,
    }));

    // Dialogues
    dialogues = def.dialogues.map(d => ({...d, done:false}));

    // Player position
    if (!P) P = new Player();
    P.x = 80; P.y = 400;
    P.vx=0; P.vy=0;
    P.dead=false; P.deathAnim=0; P.inv=0; P.acd=0;
    cam.x=0; cam.y=0;

    bullets=[]; parts=[]; ftexts=[];
    state='playing';
  }

  // ── Level-up ─────────────────────────────────────────────────
  function checkLevelUp() {
    const need = P.lvl * 120;   // was 65 — less frequent level-ups
    if (P.xp >= need) {
      P.xp -= need; P.lvl++;
      P.maxhp += P.skills.ironWill?35:25;
      P.hp = Math.min(P.hp+40, P.maxhp);
      ftext(P.x, P.y-30, `УРОВЕНЬ ${P.lvl}!`, '#ffd700');
      UI.showMsg(`⭐ Уровень ${P.lvl}! Здоровье +25`);
      burst(P.x+P.w/2, P.y+P.h/2, '#ffd700', 22); shk(6);
      Engine.snd('lvl');
      document.getElementById('lvlnum').textContent = P.lvl;
      // Pause for skill pick
      state = 'levelup';
      UI.showSkillPicker(P, k => {
        if (k) {
          P.skills[k] = true;
          if (k==='ironWill') { P.maxhp+=60; P.hp=Math.min(P.hp+30,P.maxhp); }
          UI.showMsg(`✅ Навык: ${k}`);
        }
        state='playing';
      });
    }
  }

  // ── Kill enemy ───────────────────────────────────────────────
  function killEnemy(i) {
    const e = enemies[i];

    // Combo: kills within 120 frames chain
    if (comboTimer > 0) {
      combo++;
      if (combo >= 2) {
        const bonus = combo * 10;
        P.gainXP(bonus);
        ftext(e.x+e.w/2, e.y-24, `×${combo} COMBO! +${bonus}`, '#ff9900');
      }
    } else {
      combo = 1;
    }
    comboTimer = 120;

    const xp = P.gainXP(e.boss?220:38);
    ftext(e.x+e.w/2, e.y-10, `+${xp} XP`, '#ffd700');
    burst(e.x+e.w/2, e.y+e.h/2, '#ffaa44', e.boss?24:14);
    if (e.boss) shk(12);
    checkLevelUp();
  }

  // ── Update enemies ───────────────────────────────────────────
  function updEnemies() {
    for (let i=enemies.length-1; i>=0; i--) {
      const e = enemies[i];
      e.update(P);

      // Remove after death animation finishes
      if (e.dead && e.deathAnim > 30) { enemies.splice(i,1); continue; }

      // Attack player
      if (!e.dead && !P.masked && P.inv<=0 && Engine.overlap(e,P) && e.acd<=0) {
        if (P.damage(e.dmg)) {
          P.vx = (P.x>e.x?2.5:-2.5); P.vy=-4;
          ftext(P.x, P.y, `-${e.dmg}`, '#ff6666'); shk(5);
          hurtFlashScreen = 18;  // red screen flash
          e.acd=60; e.attackAnim=8;
        }
      }

      // Was killed this frame?
      if (e.dead && e.deathAnim===1) killEnemy(i);
    }

    // Boss bar
    const b = enemies.find(e=>e.boss&&!e.dead);
    const bb = document.getElementById('bossbar');
    if (b) {
      bb.classList.add('on');
      document.getElementById('bossfg').style.width=(b.hp/b.maxhp*100)+'%';
      document.getElementById('bossnm').textContent=Levels.defs[levelIdx].boss.name;
    } else {
      bb.classList.remove('on');
    }
  }

  // ── Update bullets ───────────────────────────────────────────
  function updBullets() {
    for (let i=bullets.length-1; i>=0; i--) {
      const b=bullets[i];
      b.x+=b.vx; b.y+=b.vy; b.life--;
      if (b.life<=0) { bullets.splice(i,1); continue; }

      // Tile collision
      const tt=World.getTile(Math.floor((b.x+(b.vx>0?b.w:0))/Engine.TS), Math.floor((b.y+1)/Engine.TS));
      if (World.solid(tt)) { burst(b.x,b.y,'#ffcc44',4); bullets.splice(i,1); continue; }

      // Enemy collision
      let hit=false;
      for (let j=enemies.length-1; j>=0; j--) {
        const e=enemies[j];
        if (e.dead) continue;
        if (Engine.recOv(b.x,b.y,b.w,b.h, e.x,e.y,e.w,e.h)) {
          const dead = e.damage(b.dmg);
          ftext(e.x+e.w/2, e.y, `-${b.dmg}`, '#ffdd44');
          burst(b.x, b.y, '#ffee88', 5); shk(2);
          if (dead) killEnemy(j);
          hit=true; break;
        }
      }
      if (hit) bullets.splice(i,1);
    }
  }

  // ── Update items ─────────────────────────────────────────────
  function updItems() {
    for (const it of items) {
      if (it.done) continue;
      it.pulse += .08;
      if (!Engine.recOv(it.x,it.y,it.w,it.h, P.x,P.y,P.w,P.h)) continue;
      it.done=true; Engine.snd('pick');
      burst(it.x+it.w/2, it.y+it.h/2, '#ffdd44', 14);

      switch(it.type) {
        case 'wpn_ppsh':
          P.hasPPSH=true; P.weapon='ppsh';
          UI.showMsg('🔫 Нашёл ППШ! Q — смена оружия'); ftext(P.x,P.y-20,'ППШ НАЙДЕН!','#ffdd44'); shk(4); break;
        case 'ab_mask':
          P.ab.mask=true; UI.setAbilityOn(0);
          document.getElementById('mkbar').style.display='';
          UI.showMsg('🎭 Маскировка: ↓ чтобы скрыться'); break;
        case 'ab_radio':
          P.ab.radio=true; UI.setAbilityOn(2);
          UI.showMsg('📡 Радиосвязь установлена!'); break;
        case 'ab_sab':
          P.ab.sab=true; UI.setAbilityOn(3);
          UI.showMsg('💣 Взрывчатка готова!'); break;
        case 'medkit': {
          const h=P.heal(42);
          ftext(P.x, P.y-10, `+${h} ЗДР`, '#44ff88');
          UI.showMsg(`❤ Аптечка: +${h} здоровья`); break;
        }
        case 'comrade':
          P.comrades++;
          ftext(P.x, P.y-18, 'ТОВАРИЩ СПАСЁН!', '#ffd700');
          UI.showMsg(`⭐ Товарищ освобождён! ${P.comrades}/3`); break;
        case 'medal':
          ftext(P.x, P.y-18, 'МЕДАЛЬ НАЙДЕНА!', '#ffaa00');
          Engine.snd('secret');
          P.gainXP(120);
          UI.showMsg('🏅 Секретная медаль: +120 XP!'); break;
      }
    }
  }

  // ── Dialogues ────────────────────────────────────────────────
  function checkDialogues() {
    for (const d of dialogues) {
      if (!d.done && P.x > d.x) { d.done=true; UI.showDialogue(d.name,d.text); return; }
    }
  }

  // ── Secret areas ─────────────────────────────────────────────
  function checkSecret() {
    if (secretShown) return;
    const def = Levels.defs[levelIdx];
    if (!def.secret) return;
    if (P.x > def.secret.x && P.x < def.secret.x+400) {
      secretShown = true;
      UI.showMsg(`🔒 ${def.secret.label} — секретная зона!`);
      Engine.snd('secret');
      ftext(P.x, P.y-30, def.secret.label, def.secret.color);
    }
  }

  // ── Hazards ──────────────────────────────────────────────────
  function checkHazards() {
    const ftx = Math.floor((P.x+P.w/2)/Engine.TS);
    const fty = Math.floor((P.y+P.h+2)/Engine.TS);
    const ft  = World.getTile(ftx, fty);
    // Barbed wire (tile type 3)
    if (World.hazard(ft) && P.inv<=0) {
      P.damage(10); ftext(P.x, P.y, '-10', '#ff8888'); hurtFlashScreen = 14;
    }
    // Mine field (tile type 5) — one-shot explosion
    if (ft === 5 && P.grounded && P.inv<=0) {
      P.damage(45);
      burst(P.x+P.w/2, P.y+P.h, '#ff6600', 18); shk(14);
      ftext(P.x, P.y-10, '-45 МИНА!', '#ff4400');
      hurtFlashScreen = 25;
      World.set(ftx, fty, 1); // destroy mine after trigger
    }
    // Fall into pit
    if (P.y > World.WORLD_H+60 && P.inv<=0) {
      P.damage(30); P.x=Math.max(120,P.x-80); P.y=480; P.vy=0;
      ftext(P.x, P.y, '-30 ЯМА', '#ff4444');
    }
  }

  // ── Attack action ─────────────────────────────────────────────
  function doAttack() {
    const type = P.attack();
    if (!type) return;
    if (type==='ranged') {
      const bx = P.facR ? P.x+P.w/2+42 : P.x+P.w/2-52;
      const by = P.y+P.h-28;
      bullets.push({x:bx,y:by,vx:P.facR?16:-16,vy:0,dmg:P.skills.marksman?25:18,life:22,w:10,h:3});
      burst(bx, by, '#ffee88', 4);
    } else {
      const ax=P.facR?P.x+P.w-4:P.x-48, ay=P.y+5, aw=52, ah=30;
      const dmg = P.skills.bayonetMaster?72:45;
      burst(P.x+(P.facR?P.w:0), P.y+12, '#cc9944', 6);
      for (let i=enemies.length-1; i>=0; i--) {
        const e=enemies[i]; if(e.dead) continue;
        if (Engine.recOv(ax,ay,aw,ah, e.x,e.y,e.w,e.h)) {
          const dead=e.damage(dmg); ftext(e.x+e.w/2,e.y,`-${dmg}`,'#ff8844');
          burst(e.x+e.w/2,e.y+e.h/2,'#ff6644',12); shk(5);
          if(dead) killEnemy(i); break;
        }
      }
    }
  }

  // ── Main update ───────────────────────────────────────────────
  function update() {
    if (state!=='playing') return;
    gt++;

    P.update();
    checkHazards();

    updEnemies();
    updBullets();
    updItems();
    checkDialogues();
    checkSecret();

    // Combo timer
    if (comboTimer > 0) comboTimer--;
    else combo = 0;
    if (hurtFlashScreen > 0) hurtFlashScreen--;

    // Particles / ftexts decay
    parts   = parts.filter(p => { p.x+=p.vx;p.y+=p.vy;p.vy+=.1;p.vx*=.93;p.life--; return p.life>0; });
    ftexts  = ftexts.filter(t => { t.y-=1;t.life--; return t.life>0; });

    // Camera
    const tx=P.x-Engine.W()/2, ty=P.y-Engine.H()/2;
    cam.x += (tx-cam.x)*.09; cam.y += (ty-cam.y)*.09;
    cam.x = Math.max(0,Math.min(cam.x, World.WORLD_W-Engine.W()));
    cam.y = Math.max(0,Math.min(cam.y, World.WORLD_H-Engine.H()));
    if (shake>0) shake*=.82;

    // HUD
    UI.updateHUD(P);

    // Death
    if (P.dead && P.deathAnim>30) {
      state='dead';
      setTimeout(()=>UI.show('ovDeath'), 800);
    }

    // Level end condition: boss dead + reached endX
    const bossDead = !enemies.find(e=>e.boss&&!e.dead);
    if (bossDead && P.x > Levels.defs[levelIdx].endX) {
      levelComplete();
    }
  }

  // ── Level complete ────────────────────────────────────────────
  function levelComplete() {
    state = 'transition';
    if (levelIdx >= Levels.defs.length-1) {
      UI.showVictory(); return;
    }
    const msg = Levels.defs[levelIdx].nextLevelMsg;
    UI.showMsg(msg);
    const next = Levels.defs[levelIdx+1];
    setTimeout(() => {
      UI.showTransition(next, () => {
        UI.runStory(next.story, () => {
          UI.hide('ovStory');
          loadLevel(levelIdx+1);
        });
      });
    }, 1200);
  }

  // ── Draw ──────────────────────────────────────────────────────
  function draw() {
    const ctx = Engine.ctx;
    const def = Levels.defs[levelIdx];
    ctx.save();
    if (shake>0.4) ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);

    Renderer.updateAtmosphere(def.bgTheme);
    Renderer.drawBackground(cam, gt, def.bgTheme);
    Renderer.drawTiles(cam, gt);
    Renderer.drawRain(cam);
    Renderer.drawItems(items, cam, gt);

    for (const e of enemies) Renderer.drawEnemy(e, cam, gt);
    Renderer.drawPlayer(P, cam, gt);
    Renderer.drawBullets(bullets, cam);
    Renderer.drawParticles(parts, cam);
    Renderer.drawFTexts(ftexts, cam);
    Renderer.drawVignette();

    // Hurt flash overlay
    if (hurtFlashScreen > 0) {
      const ctx = Engine.ctx;
      ctx.save();
      ctx.globalAlpha = (hurtFlashScreen / 25) * 0.35;
      ctx.fillStyle = '#ff2200';
      ctx.fillRect(0, 0, Engine.W(), Engine.H());
      ctx.restore();
    }

    ctx.restore();
    Renderer.drawMinimap(P, enemies, items, cam);
  }

  // ── Input ─────────────────────────────────────────────────────
  function handleInput() {
    const K=Engine.K, JP=Engine.JP;

    if (JP['Escape']) togglePause();
    if (JP['KeyX'])   doAttack();
    if (JP['KeyQ'] && P.hasPPSH) {
      P.weapon = P.weapon==='ppsh'?'knife':'ppsh';
      UI.showMsg(P.weapon==='ppsh'?'🔫 ППШ':'🗡️ Штык нож');
    }
    if (JP['ArrowUp']||JP['Space']) P.jbuf=14;
    // Mask/crouch handled in Player.update() via entities.js
  }

  function togglePause() {
    if (state==='dead'||state==='start'||state==='story') return;
    if (state==='playing') { state='paused'; UI.show('ovPause'); }
    else if (state==='paused') { state='playing'; UI.hide('ovPause'); }
  }

  // ── Touch buttons ─────────────────────────────────────────────
  function setupTouch() {
    function tb(id,down,fn) {
      const el=document.getElementById(id); if(!el) return;
      el.addEventListener('touchstart',ev=>{ev.preventDefault();Engine.initAudio();if(fn)fn();else Engine.K[down]=true;},{passive:false});
      el.addEventListener('touchend',ev=>{ev.preventDefault();if(!fn)Engine.K[down]=false;},{passive:false});
    }
    tb('tb-l','ArrowLeft'); tb('tb-r','ArrowRight');
    tb('tb-j',null,()=>{P.jbuf=14;});
    tb('tb-a',null,()=>doAttack());
  }

  // ── Save / Load ───────────────────────────────────────────────
  const SAVE_KEY='partisan5';
  function saveGame() {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      level:levelIdx, player:P.save(),
      items:items.map(i=>i.done),
    }));
    UI.showMsg('💾 Игра сохранена!');
  }
  function loadGame() {
    try {
      const d=JSON.parse(localStorage.getItem(SAVE_KEY));
      if(!d) return UI.showMsg('⚠ Нет сохранений!');
      loadLevel(d.level);
      P.load(d.player);
      d.items.forEach((done,i)=>{ if(items[i]) items[i].done=done; });
      UI.updateHUD(P);
      UI.showMsg('📂 Загружено!');
    } catch(e) { UI.showMsg('⚠ Ошибка загрузки!'); }
  }

  function restart() {
    P.reset(); loadLevel(levelIdx);
    UI.hide('ovDeath'); UI.hide('ovPause');
    state='playing';
  }

  // ── Main loop ─────────────────────────────────────────────────
  function loop() {
    if (state==='playing'||state==='levelup') {
      handleInput();
      if (state==='playing') update();
      draw();
    } else if (state==='start'||state==='story') {
      // BG only
      if (P && levelIdx>=0) {
        const ctx=Engine.ctx;
        ctx.clearRect(0,0,Engine.W(),Engine.H());
      }
    }
    Engine.clearFrame();
    requestAnimationFrame(loop);
  }

  // ── Boot ──────────────────────────────────────────────────────
  function boot() {
    Engine.init();
    P = new Player();
    levelIdx = 0;

    // Pre-build world at level 0 for minimap (no render yet)
    loadLevel(0); state='start';

    UI.initStartScreen();
    // Start menu music immediately (works after any user gesture)
    Engine.playMusic('Justice.mp3');

    // Wire up buttons
    document.getElementById('btnStart').onclick = () => {
      Engine.initAudio();
      // Story uses the same menu track; level music starts in loadLevel()
      const def=Levels.defs[0];
      UI.runStory(def.story, () => {
        UI.hide('ovStory');
        UI.stopStartScreen();
        loadLevel(0);
        state='playing';
      });
    };
    document.getElementById('btnLoadStart')?.addEventListener('click',()=>{
      Engine.initAudio(); UI.stopStartScreen();
      UI.hide('ovStart'); loadGame(); state='playing';
    });
    document.getElementById('btnResume').onclick  = togglePause;
    document.getElementById('btnSave').onclick    = saveGame;
    document.getElementById('btnLoad').onclick    = () => { loadGame(); UI.hide('ovPause'); };
    document.getElementById('btnRestart').onclick = restart;
    document.getElementById('btnRespawn').onclick = restart;

    setupTouch();
    loop();
  }

  return { boot };
})();

// ── Start ────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => Game.boot());
