'use strict';
// ================================================================
// UI.JS — Start screen, overlays, HUD, dialogue, skills
// ================================================================
const UI = (() => {

  // ── Start screen canvas animation ───────────────────────────
  let startCanvas, startCtx, startGT = 0, startRAF = null;
  const startParticles = Array.from({length:80}, () => _mkParticle());
  const startTrees = Array.from({length:14}, (_,i) => ({
    x: 40+i*70+(Math.random()*30-15), h:80+Math.random()*120,
    w:18+Math.random()*20, sway:Math.random()*Math.PI*2,
  }));

  function _mkParticle() {
    return {
      x: Math.random()*1000, y: Math.random()*600,
      vx:(Math.random()-.5)*.4, vy:.4+Math.random()*.8,
      sz:1+Math.random()*2, op:Math.random()*.8+.2,
    };
  }

  function startScreenLoop() {
    startGT++;
    const W=startCanvas.width, H=startCanvas.height;
    startCtx.clearRect(0,0,W,H);

    // Sky gradient
    const g=startCtx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#050b14'); g.addColorStop(.5,'#0b1a1e'); g.addColorStop(1,'#080f08');
    startCtx.fillStyle=g; startCtx.fillRect(0,0,W,H);

    // Stars
    for (let i=0;i<80;i++) {
      const sx=(i*167+13)%W, sy=(i*91+7)%(H*.55);
      const br=(Math.sin(startGT*.015+i*1.4)+1)*.5;
      startCtx.globalAlpha=.06+br*.4;
      startCtx.fillStyle='#fff';
      startCtx.fillRect(sx,sy,i%7===0?2:1,i%7===0?2:1);
    }
    startCtx.globalAlpha=1;

    // Moon
    const mx=W*.78, my=55;
    startCtx.save();
    startCtx.shadowColor='rgba(180,220,255,.35)'; startCtx.shadowBlur=50;
    startCtx.fillStyle='rgba(215,235,255,.16)';
    startCtx.beginPath(); startCtx.arc(mx,my,30,0,Math.PI*2); startCtx.fill();
    startCtx.shadowBlur=0; startCtx.restore();

    // Scrolling tree silhouettes
    const scroll=startGT*.18;
    startCtx.fillStyle='rgba(5,12,6,.96)';
    for (const tr of startTrees) {
      const sx=(tr.x-scroll*(.04+tr.h/800)+W*2)%W;
      const sw=Math.sin(startGT*.018+tr.sway)*2;
      const sy=H-tr.h*.55;
      // trunk
      startCtx.fillRect(sx+tr.w*.42+sw*.2, sy+tr.h*.5, tr.w*.15, tr.h*.5);
      // canopy
      startCtx.beginPath();
      startCtx.moveTo(sx+tr.w/2+sw,sy);
      startCtx.lineTo(sx+tr.w+sw*.4,sy+tr.h*.6);
      startCtx.lineTo(sx+sw*.4,sy+tr.h*.6);
      startCtx.closePath(); startCtx.fill();
    }

    // Ground fog strip
    const fog=startCtx.createLinearGradient(0,H-80,0,H);
    fog.addColorStop(0,'rgba(5,14,6,0)'); fog.addColorStop(1,'rgba(2,8,2,.7)');
    startCtx.fillStyle=fog; startCtx.fillRect(0,0,W,H);

    // Snow / ash particles
    for (const p of startParticles) {
      p.x += p.vx+Math.sin(startGT*.012+p.y*.03)*.15;
      p.y += p.vy;
      if (p.y>H+10||p.x<-10||p.x>W+10) { Object.assign(p,_mkParticle()); p.y=-5; p.x=Math.random()*W; }
      startCtx.globalAlpha=p.op*.7;
      startCtx.fillStyle='#c8d8e8';
      startCtx.beginPath(); startCtx.arc(p.x,p.y,p.sz*.6,0,Math.PI*2); startCtx.fill();
    }
    startCtx.globalAlpha=1;

    // Ground sparkles
    for (let i=0;i<8;i++) {
      const gx=(startGT*.5+i*130)%W;
      const a=(Math.sin(startGT*.06+i)*+1)*.5;
      startCtx.globalAlpha=a*.25;
      startCtx.fillStyle='#80c0a0';
      startCtx.fillRect(gx, H-12, 2, 2);
    }
    startCtx.globalAlpha=1;

    startRAF = requestAnimationFrame(startScreenLoop);
  }

  function initStartScreen() {
    startCanvas = document.getElementById('startBg');
    if (!startCanvas) return;
    startCtx = startCanvas.getContext('2d');
    function rsz() {
      const wrap=document.getElementById('ovStart');
      startCanvas.width=wrap.offsetWidth||800;
      startCanvas.height=wrap.offsetHeight||600;
    }
    rsz(); window.addEventListener('resize',rsz);
    startScreenLoop();
  }

  function stopStartScreen() {
    if (startRAF) { cancelAnimationFrame(startRAF); startRAF=null; }
  }

  // ── Overlay helpers ──────────────────────────────────────────
  function show(id)   { const e=document.getElementById(id); if(e){e.classList.add('on');} }
  function hide(id)   { const e=document.getElementById(id); if(e){e.classList.remove('on');} }
  function isOn(id)   { const e=document.getElementById(id); return e&&e.classList.contains('on'); }
  function hideAll()  { ['ovStart','ovStory','ovPause','ovDeath','ovTransition','ovSkill'].forEach(hide); }

  // ── Story typewriter ─────────────────────────────────────────
  let storyTimer = null;
  function runStory(lines, onDone) {
    hide('ovStart'); show('ovStory');
    const el = document.getElementById('storyText');
    const btn = document.getElementById('btnPlay');
    el.textContent = ''; btn.style.display='none';
    const full = lines.join('\n');
    let i = 0;
    clearInterval(storyTimer);
    storyTimer = setInterval(() => {
      el.textContent += full[i]||'';
      i++;
      if (i >= full.length) { clearInterval(storyTimer); btn.style.display=''; }
    }, 28);
    // Click to skip
    document.getElementById('ovStory').addEventListener('click', () => {
      clearInterval(storyTimer); el.textContent=full; btn.style.display='';
    }, {once:true});
    if (onDone) document.getElementById('btnPlay').onclick = onDone;
  }

  // ── Level transition ─────────────────────────────────────────
  function showTransition(levelDef, onStart) {
    const wrap = document.getElementById('ovTransition');
    document.getElementById('transTitle').textContent = levelDef.name;
    document.getElementById('transZone').textContent  = levelDef.zone;
    wrap.classList.add('on');
    // Auto-proceed after 3s or click
    const proceed = () => { wrap.classList.remove('on'); if(onStart) onStart(); };
    wrap.onclick = proceed;
    setTimeout(proceed, 3400);
  }

  // ── Skill picker ─────────────────────────────────────────────
  const SKILL_POOL = {
    bayonetMaster: { icon:'🗡️',  name:'Мастер штыка',  desc:'Урон ножом ×1.6' },
    marksman:      { icon:'🎯',  name:'Снайпер',        desc:'ППШ: урон ×1.4, скорострельность +20%' },
    ironWill:      { icon:'🛡️',  name:'Железная воля', desc:'Максимальное ЗДР +60' },
    fieldMedic:    { icon:'❤️',  name:'Полевой медик',  desc:'Аптечки лечат ×1.8' },
    guerrilla:     { icon:'💨',  name:'Партизан',       desc:'Скорость движения +20%' },
    veteran:       { icon:'⭐',  name:'Ветеран',        desc:'Опыт за врагов +30%' },
  };

  function showSkillPicker(P, onPick) {
    // Pick 3 random skills that player doesn't have
    const avail = Object.keys(SKILL_POOL).filter(k => !P.skills[k]);
    const pick3 = [];
    while (pick3.length < 3 && avail.length > 0) {
      const i = Math.floor(Math.random()*avail.length);
      pick3.push(avail.splice(i,1)[0]);
    }

    // All skills already unlocked — just continue
    if (pick3.length === 0) { setTimeout(() => onPick(null), 50); return; }

    const wrap = document.getElementById('ovSkill');
    const cards = document.getElementById('skillCards');
    cards.innerHTML = '';
    for (const k of pick3) {
      const s = SKILL_POOL[k];
      const btn = document.createElement('button');
      btn.className = 'skill-card';
      btn.innerHTML = `<div class="sk-icon">${s.icon}</div>
        <div class="sk-name">${s.name}</div>
        <div class="sk-desc">${s.desc}</div>`;
      btn.onclick = () => { hide('ovSkill'); onPick(k); };
      cards.appendChild(btn);
    }
    show('ovSkill');
  }

  // ── Dialogue ─────────────────────────────────────────────────
  let dlgTimer = null;
  function showDialogue(name, text) {
    const box=document.getElementById('dlg');
    document.getElementById('dlgName').textContent=name;
    document.getElementById('dlgText').textContent='';
    box.style.display='block';
    let i=0; clearInterval(dlgTimer);
    dlgTimer=setInterval(()=>{
      document.getElementById('dlgText').textContent+=text[i]||'';
      i++;
      if(i>=text.length){ clearInterval(dlgTimer); setTimeout(()=>box.style.display='none',4000); }
    },28);
  }

  // ── Messages ─────────────────────────────────────────────────
  let msgTm = null;
  function showMsg(txt) {
    document.getElementById('msg').textContent=txt;
    clearTimeout(msgTm);
    msgTm=setTimeout(()=>document.getElementById('msg').textContent='↑ прыжок  X атака  Q оружие',5000);
  }

  // ── HUD update ───────────────────────────────────────────────
  function updateHUD(P) {
    document.getElementById('hpfg').style.width=(P.hp/P.maxhp*100)+'%';
    document.getElementById('xpfg').style.width=Math.min(100,P.xp/(P.lvl*120)*100)+'%';
    document.getElementById('mkfg').style.width=P.mke+'%';
    document.getElementById('lvlnum').textContent=P.lvl;
    // Weapon label
    const wlbl=document.getElementById('weaponLbl');
    if(wlbl) wlbl.textContent=P.weapon==='ppsh'&&P.hasPPSH?'ППШ':'ШТК';
  }

  function setAbilityOn(idx) {
    document.getElementById('ab'+idx)?.classList.add('on');
  }

  function showVictory() {
    const d=document.createElement('div');
    d.className='ov on';
    d.innerHTML=`<div style="font-size:48px;margin-bottom:14px">🎖️</div>
      <div class="ovt" style="color:#ffd700;font-size:30px">ПОБЕДА!</div>
      <div style="color:rgba(180,140,40,.55);font-size:12px;font-family:monospace;margin:10px 0 6px;text-align:center;line-height:2">
        Оберст Вольф уничтожен.<br>Все товарищи освобождены.<br>
        Партизанский отряд разгромил карателей.<br>
        <strong style="color:#ffd700">Слава советским героям!</strong>
      </div>
      <button class="ovb" style="margin-top:14px" onclick="location.reload()">↺ ИГРАТЬ СНОВА</button>`;
    document.getElementById('wrap').appendChild(d);
  }

  return {
    initStartScreen, stopStartScreen,
    show, hide, isOn, hideAll,
    runStory, showTransition,
    showSkillPicker, showDialogue, showMsg,
    updateHUD, setAbilityOn, showVictory,
  };
})();
