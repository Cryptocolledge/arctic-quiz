'use strict';
// ================================================================
// RENDERER.JS — All drawing with full animations
// ================================================================
const Renderer = (() => {

  // ── Atmospheric objects ─────────────────────────────────────
  const fireflies = Array.from({length:28}, () => ({
    x: Math.random()*10400, y: 300+Math.random()*220,
    phase: Math.random()*Math.PI*2, speed: .2+Math.random()*.4,
    drift: .15+Math.random()*.3, br: 0,
  }));
  const rain = Array.from({length:80}, () => ({
    x: Math.random()*10400, y: Math.random()*720,
    spd: 6+Math.random()*6, len: 8+Math.random()*12,
  }));
  const leaves = Array.from({length:20}, () => ({
    x: Math.random()*10400, y: Math.random()*400+50,
    vx: -.3-Math.random()*.4, vy: .1+Math.random()*.2,
    ph: Math.random()*Math.PI*2, sz: 3+Math.random()*3,
  }));

  // Background trees (shared across levels)
  const bgTrees = Array.from({length:140}, () => ({
    x: Math.random()*10400,
    h: 55+Math.random()*140, w: 20+Math.random()*28,
    layer: Math.floor(Math.random()*3),
    sway: Math.random()*Math.PI*2,
  })).sort((a,b) => a.layer-b.layer);

  // Aircraft silhouettes
  const aircraft = Array.from({length:4}, (_,i) => ({
    x: 800 + i*2600 + Math.random()*800,
    y: 35 + Math.random()*70,
    spd: -(0.35 + Math.random()*0.25) * (i%2===0?1:-1),
    biplane: i%3===0,
  }));
  let warFlash = 0, warFlashX = 400;

  // Embers for fire theme
  const embers = Array.from({length:40}, () => ({
    x: Math.random()*8800, y: 400+Math.random()*200,
    vx: (Math.random()-.5)*.8, vy: -1-Math.random()*1.5,
    ph: Math.random()*Math.PI*2, sz: 1+Math.random()*2,
  }));

  // ── Atmosphere update ───────────────────────────────────────
  function updateAtmosphere(theme) {
    for (const f of fireflies) {
      f.phase += f.speed*.05;
      f.x += Math.sin(f.phase*.7)*f.drift;
      f.y += Math.cos(f.phase)*f.drift*.5;
      if (f.x < 0) f.x = World.WORLD_W;
      if (f.x > World.WORLD_W) f.x = 0;
      f.y = Math.max(200, Math.min(560, f.y));
      f.br = (Math.sin(f.phase)+1)*.5;
    }
    for (const l of leaves) {
      l.ph += .03;
      l.x += l.vx+Math.sin(l.ph)*.15; l.y += l.vy;
      if (l.y > 580) { l.y = 60; l.x = Math.random()*World.WORLD_W; }
      if (l.x < 0) l.x = World.WORLD_W;
    }
    for (const r of rain) {
      r.y += r.spd; r.x -= 1.5;
      if (r.y > 740) { r.y = -20; r.x = Math.random()*World.WORLD_W; }
      if (r.x < 0) r.x = World.WORLD_W;
    }
    if (theme === 1) {
      for (const e of embers) {
        e.ph += .05; e.x += e.vx+Math.sin(e.ph)*.3; e.y += e.vy;
        if (e.y < 100) { e.y = 400+Math.random()*200; e.x = Math.random()*8800; }
      }
    }
  }

  // ── Background / sky ────────────────────────────────────────
  function drawBackground(cam, gt, theme) {
    const ctx = Engine.ctx, W = Engine.W(), H = Engine.H();

    // Sky per theme
    const skies = [
      ['#060c16','#0e1c1f','#091408'],  // 0 forest night
      ['#1c0806','#2e1408','#0c0a04'],  // 1 burning village
      ['#07070f','#0e0e18','#08080c'],  // 2 industrial
    ];
    const sk = ctx.createLinearGradient(0,0,0,H);
    const s = skies[theme]||skies[0];
    sk.addColorStop(0,s[0]); sk.addColorStop(.45,s[1]); sk.addColorStop(1,s[2]);
    ctx.fillStyle = sk; ctx.fillRect(0,0,W,H);

    // Moon or fire glow
    if (theme !== 1) {
      const mx = W*.72 - cam.x*.007, my = 52;
      ctx.save();
      ctx.shadowColor = 'rgba(180,210,255,.3)'; ctx.shadowBlur = 40;
      ctx.fillStyle = 'rgba(210,230,255,.14)';
      ctx.beginPath(); ctx.arc(mx,my,32,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(220,240,255,.08)';
      ctx.beginPath(); ctx.arc(mx,my,48,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0; ctx.restore();
    } else {
      // Orange fire glow from village
      const g = ctx.createRadialGradient(W*.5,H,0,W*.5,H,H*.9);
      g.addColorStop(0,'rgba(220,70,20,.22)'); g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    }

    // Stars (twinkling)
    for (let i = 0; i < 60; i++) {
      const sx = (i*163+17)%W, sy = (i*97+11)%(H*.5);
      const br = (Math.sin(gt*.012+i*1.3)+1)*.5;
      ctx.globalAlpha = .08+br*.35;
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx,sy,i%5===0?2:1,i%5===0?2:1);
    }
    ctx.globalAlpha = 1;

    // ── Horizon perspective lines (slight tilt / depth) ──────
    {
      const hy = H * 0.62;
      const vp = W * 0.5 - cam.x * 0.005;  // vanishing point drifts slightly
      ctx.save();
      ctx.globalAlpha = theme === 1 ? 0.07 : 0.05;
      ctx.strokeStyle = theme === 1 ? '#bb5522' : theme === 2 ? '#334466' : '#3a5040';
      ctx.lineWidth = 1;
      for (let i = -7; i <= 7; i++) {
        ctx.beginPath();
        ctx.moveTo(vp, hy);
        ctx.lineTo(vp + i * W * 0.22, H + 20);
        ctx.stroke();
      }
      // Subtle horizon accent line
      ctx.globalAlpha = theme === 1 ? 0.14 : 0.08;
      ctx.strokeStyle = theme === 1 ? '#cc6633' : '#445566';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke();
      ctx.restore();
    }

    // Parallax rain
    ctx.save(); ctx.globalAlpha = theme===1?.04:.09;
    ctx.strokeStyle = theme===1?'rgba(255,180,100,1)':'rgba(180,210,255,1)';
    ctx.lineWidth = .5;
    for (const r of rain) {
      const rx = (r.x-cam.x*.2+W*2)%W;
      const ry = (r.y-cam.y*.2+H*2)%H;
      ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(rx-4,ry+r.len); ctx.stroke();
    }
    ctx.restore();

    // Parallax trees
    const speeds = [.04,.15,.35];
    const tcols = [
      [['rgba(5,14,7,.96)','rgba(7,20,9,.86)'],
       ['rgba(7,20,9,.88)','rgba(9,26,11,.78)'],
       ['rgba(9,25,11,.82)','rgba(12,32,14,.72)']],
      [['rgba(20,8,4,.90)','rgba(28,10,5,.80)'],
       ['rgba(24,10,5,.85)','rgba(30,12,6,.75)'],
       ['rgba(28,12,6,.80)','rgba(34,14,7,.70)']],
      [['rgba(10,10,18,.92)','rgba(14,14,22,.82)'],
       ['rgba(12,12,20,.88)','rgba(16,16,24,.78)'],
       ['rgba(14,14,22,.84)','rgba(18,18,26,.74)']],
    ];
    const tc = tcols[theme]||tcols[0];
    for (const tr of bgTrees) {
      const lx = cam.x*speeds[tr.layer];
      let sx = (tr.x-lx)%(World.WORLD_W*speeds[tr.layer]+W);
      if (sx < -tr.w) sx += World.WORLD_W*speeds[tr.layer]+W;
      if (sx > W+tr.w) continue;
      const sw = Math.sin(gt*.018+tr.sway)*2*(tr.layer+1);
      const sy = H-tr.h*(.38+tr.layer*.28);
      ctx.fillStyle = tc[tr.layer][1];
      ctx.fillRect(sx+tr.w*.42+sw*.3, sy+tr.h*.55, tr.w*.16, tr.h*.45);
      ctx.fillStyle = tc[tr.layer][0];
      ctx.beginPath();
      ctx.moveTo(sx+tr.w/2+sw,sy);
      ctx.lineTo(sx+tr.w+sw*.5,sy+tr.h*.6);
      ctx.lineTo(sx+sw*.5,sy+tr.h*.6);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx+tr.w/2+sw*.8,sy+tr.h*.25);
      ctx.lineTo(sx+tr.w*.95+sw*.3,sy+tr.h*.78);
      ctx.lineTo(sx+tr.w*.05+sw*.3,sy+tr.h*.78);
      ctx.closePath(); ctx.fill();
    }

    // Fireflies
    for (const f of fireflies) {
      const fx = f.x-cam.x*.95, fy = f.y-cam.y*.95;
      if (fx<-10||fx>W+10) continue;
      ctx.save(); ctx.globalAlpha = f.br*.85;
      ctx.shadowColor = 'rgba(120,255,140,.9)'; ctx.shadowBlur = 10;
      ctx.fillStyle = 'rgba(160,255,160,1)';
      ctx.beginPath(); ctx.arc(fx,fy,1.5,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // Leaves
    ctx.globalAlpha = .55;
    for (const l of leaves) {
      const lx = l.x-cam.x, ly = l.y-cam.y;
      if (lx<-10||lx>W+10) continue;
      ctx.fillStyle = theme===1
        ? `hsl(${30+Math.sin(l.ph)*10},65%,${20+Math.sin(l.ph*1.3)*5}%)`
        : `hsl(${100+Math.sin(l.ph)*20},55%,${22+Math.sin(l.ph*1.3)*6}%)`;
      ctx.save(); ctx.translate(lx,ly); ctx.rotate(l.ph);
      ctx.fillRect(-l.sz/2,-l.sz/4,l.sz,l.sz/2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Embers (fire theme)
    if (theme === 1) {
      for (const e of embers) {
        const ex = e.x-cam.x, ey = e.y-cam.y;
        if (ex<-10||ex>W+10) continue;
        const a = (Math.sin(e.ph)+1)*.5;
        ctx.save(); ctx.globalAlpha = a*.8;
        ctx.fillStyle = `hsl(${20+a*20},90%,60%)`;
        ctx.beginPath(); ctx.arc(ex,ey,e.sz,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }
    }

    // ── Aircraft silhouettes ──────────────────────────────────
    for (const ac of aircraft) {
      ac.x += ac.spd;
      if (ac.x < -200) ac.x = World.WORLD_W + 100;
      if (ac.x > World.WORLD_W + 200) ac.x = -100;
      const ax = ac.x - cam.x * 0.10;
      if (ax < -200 || ax > W + 200) continue;
      ctx.save(); ctx.globalAlpha = 0.30; ctx.fillStyle = '#06090f';
      ctx.translate(ax, 0);
      if (ac.spd > 0) ctx.scale(-1, 1); // flip when flying right
      ctx.fillRect(0,   ac.y,     30, 5); // fuselage
      ctx.fillRect(8,   ac.y-6,   14, 3); // top wing
      ctx.fillRect(22,  ac.y-3,   8,  3); // tail fin
      ctx.fillRect(0,   ac.y,     5,  5); // nose
      if (ac.biplane) {
        ctx.fillRect(8,  ac.y+5,   12, 3); // lower wing
        ctx.fillRect(10, ac.y-6,   2,  14); // front strut
        ctx.fillRect(18, ac.y-6,   2,  14); // rear strut
      }
      ctx.restore();
    }

    // ── Distant war flashes (explosions on horizon) ───────────
    warFlash--;
    if (warFlash <= 0) {
      warFlash  = 150 + Math.floor(Math.random() * 200);
      warFlashX = W * 0.08 + Math.random() * W * 0.84;
    }
    if (warFlash > 125) {
      const fa = (warFlash - 125) / 25;
      ctx.save(); ctx.globalAlpha = fa * (theme === 1 ? 0.55 : 0.35);
      const wg = ctx.createRadialGradient(warFlashX, H * 0.72, 0, warFlashX, H * 0.72, 90);
      wg.addColorStop(0, theme === 1 ? 'rgba(255,180,60,1)' : 'rgba(255,210,100,1)');
      wg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = wg; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Ground fog
    const fog = ctx.createLinearGradient(0,H-100,0,H);
    fog.addColorStop(0,'rgba(8,20,8,0)'); fog.addColorStop(1,'rgba(3,10,3,.55)');
    ctx.fillStyle = fog; ctx.fillRect(0,0,W,H);
  }

  // ── Tiles ────────────────────────────────────────────────────
  function drawTiles(cam, gt) {
    const ctx = Engine.ctx, TS = Engine.TS;
    const W = Engine.W(), H = Engine.H();
    const MAP = World.MAP;
    const x1=Math.max(0,Math.floor(cam.x/TS));
    const x2=Math.min(World.MX-1,Math.ceil((cam.x+W)/TS));
    const y1=Math.max(0,Math.floor(cam.y/TS));
    const y2=Math.min(World.MY-1,Math.ceil((cam.y+H)/TS));

    for (let ty=y1; ty<=y2; ty++) {
      for (let tx=x1; tx<=x2; tx++) {
        const t=MAP[ty][tx]; if(!t) continue;
        const px=tx*TS-cam.x, py=ty*TS-cam.y;
        const above=ty>0&&!MAP[ty-1][tx];

        if (t===1) {
          // Earth tile
          ctx.fillStyle='#1e2c12'; ctx.fillRect(px,py,TS,TS);
          ctx.fillStyle='#273819'; ctx.fillRect(px+1,py+1,TS-2,TS-2);
          ctx.fillStyle='#1a2410';
          ctx.fillRect(px+5,py+8,4,2); ctx.fillRect(px+TS-10,py+TS-12,6,2);
          ctx.fillRect(px+TS-6,py+6,3,3); ctx.fillRect(px+8,py+TS-9,5,2);
          if (above) {
            ctx.fillStyle='#3d5e1e'; ctx.fillRect(px,py,TS-1,6);
            ctx.fillStyle='#4f7828'; ctx.fillRect(px,py,TS-1,3);
            // Animated grass blades
            ctx.fillStyle='#5a8830';
            const sw=Math.sin(gt*.04+tx*.7)*1.8;
            for (let b=0;b<5;b++) {
              const bx=px+3+b*7;
              ctx.fillRect(bx+sw,py-5,1,6); ctx.fillRect(bx-1+sw*.5,py-3,1,4);
            }
            if (tx%7===2) { ctx.fillStyle='#ddaa44'; ctx.fillRect(px+18+sw,py-6,2,2); }
            if (tx%11===4){ ctx.fillStyle='#ff6666'; ctx.fillRect(px+30+sw*.5,py-5,2,2); }
          }
        } else if (t===2) {
          // Wood platform
          ctx.fillStyle='#3c2408'; ctx.fillRect(px,py,TS,TS);
          ctx.fillStyle='#5c3810'; ctx.fillRect(px,py,TS-1,TS-3);
          ctx.fillStyle='#4a2e0c';
          for (let i=0;i<3;i++) ctx.fillRect(px+2+i*13,py+3,2,TS-6);
          ctx.fillStyle='#7a5020'; ctx.fillRect(px,py,TS-1,3);
          ctx.fillStyle='#8a6030'; ctx.fillRect(px,py,TS-1,1);
          ctx.fillStyle='#6a4018'; ctx.fillRect(px+6,py+6,2,2); ctx.fillRect(px+TS-9,py+6,2,2);
        } else if (t===3) {
          // Barbed wire
          ctx.fillStyle='#150c02'; ctx.fillRect(px,py,TS,TS);
          ctx.strokeStyle='rgba(160,130,60,.8)'; ctx.lineWidth=1;
          ctx.beginPath();
          for (let i=0;i<4;i++) {
            ctx.moveTo(px+i*11,py+TS/2); ctx.lineTo(px+i*11+8,py+TS/2-7);
            ctx.moveTo(px+i*11+4,py+TS/2-3); ctx.lineTo(px+i*11+12,py+TS/2+4);
          }
          ctx.stroke();
          ctx.fillStyle=`rgba(200,45,45,${.06+Math.sin(gt*.12)*.03})`; ctx.fillRect(px,py,TS,TS);
        } else if (t===4) {
          // Secret hint — glowing tile edge
          ctx.fillStyle=`rgba(80,255,160,${.08+Math.sin(gt*.08)*.05})`;
          ctx.fillRect(px,py,TS,TS);
          ctx.strokeStyle=`rgba(80,255,160,${.3+Math.sin(gt*.08)*.2})`;
          ctx.lineWidth=1; ctx.strokeRect(px,py,TS,TS);
        } else if (t===5) {
          // Mine tile — looks like ground with buried mine symbol
          ctx.fillStyle='#1e2c12'; ctx.fillRect(px,py,TS,TS);
          ctx.fillStyle='#273819'; ctx.fillRect(px+1,py+1,TS-2,TS-2);
          if (above) {
            ctx.fillStyle='#3d5e1e'; ctx.fillRect(px,py,TS-1,6);
            ctx.fillStyle='#4f7828'; ctx.fillRect(px,py,TS-1,3);
          }
          // Mine disc embedded in ground surface
          const mg=`rgba(220,80,20,${.55+Math.sin(gt*.08+tx)*.2})`;
          ctx.fillStyle='#1a1a14'; ctx.beginPath(); ctx.arc(px+TS/2,py+5,7,0,Math.PI*2); ctx.fill();
          ctx.fillStyle=mg;        ctx.beginPath(); ctx.arc(px+TS/2,py+5,5,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#ff4400'; ctx.beginPath(); ctx.arc(px+TS/2,py+5,2,0,Math.PI*2); ctx.fill();
          // Warning ticks around disc
          ctx.strokeStyle=`rgba(255,100,0,${.4+Math.sin(gt*.1+tx)*.2})`; ctx.lineWidth=1;
          for(let ti=0;ti<4;ti++){
            const a=ti*Math.PI/2, r1=7, r2=10;
            ctx.beginPath(); ctx.moveTo(px+TS/2+Math.cos(a)*r1,py+5+Math.sin(a)*r1);
            ctx.lineTo(px+TS/2+Math.cos(a)*r2,py+5+Math.sin(a)*r2); ctx.stroke();
          }
        }
      }
    }
  }

  // ── PLAYER drawing ──────────────────────────────────────────
  function drawPlayer(P, cam, gt) {
    if (P.dead && P.deathAnim > 45) return;
    const ctx = Engine.ctx;
    const px = Math.round(P.x-cam.x), py = Math.round(P.y-cam.y);

    // Invincibility flicker
    if (P.inv > 0 && Math.floor(P.inv/4)%2===1) return;

    ctx.save();
    if (P.masked) { ctx.shadowColor='#44ff88'; ctx.shadowBlur=20; ctx.globalAlpha=.62; }

    // Pivot at feet-center
    ctx.translate(px+P.w/2, py+P.h);
    if (!P.facR) ctx.scale(-1,1);

    // Roll: rotate body forward (rollDir*scale cancel gives correct direction)
    if (P.animState==='roll') {
      const rf = 1 - (P.rolling||0) / 18;
      ctx.rotate(rf * Math.PI * 0.60);
    }

    // Death: rotate fall
    if (P.animState==='die') {
      const df = Math.min(P.deathAnim/22,1);
      ctx.translate(0,-P.h/2);
      ctx.rotate(df*Math.PI*.52);
      ctx.globalAlpha = Math.max(0,1-df*1.6);
      ctx.translate(0,P.h/2);
    }

    const st = P.animState, wt = P.walkTime;
    const s = Math.sin(wt*.28);

    // Offsets per state
    let bOY=0, lLY=0, rLY=0, lAX=0, rAX=0, lAY=0, rAY=0;

    if (st==='idle') {
      bOY = Math.sin(gt*.04)*1.5;
    } else if (st==='run') {
      bOY = -Math.abs(s)*2.5;
      lLY = s*8; rLY = -s*8;
      lAX = s*3; rAX = -s*3;
      lAY = -s*4; rAY = s*4;
    } else if (st==='jump') {
      bOY=-3; lLY=-4; rLY=4; lAY=-8; rAY=8;
    } else if (st==='fall') {
      lLY=6; rLY=2; lAY=8; rAY=4;
    } else if (st==='hurt') {
      bOY=3; lAX=-5; rAX=5;
    } else if (st==='attack') {
      const af=P.atkanim/13;
      rAX = af>.5?(1-af)*2*7:af*2*7;
      rAY = af>.5?-(1-af)*16:-af*16;
    } else if (st==='shoot') {
      const sf=P.atkanim/8;
      rAX = sf<.3?-4:0; bOY = sf<.3?-1.5:0;
    } else if (st==='crouch') {
      // Body squats down, legs bent
      bOY=15; lLY=7; rLY=7; lAX=-3; rAX=3; lAY=4; rAY=4;
    } else if (st==='roll') {
      // Tucked roll
      bOY=12; lLY=8; rLY=5; lAX=4; rAX=-4; lAY=6; rAY=6;
    }

    // ── Boots ──────────────────────────────────────────────
    ctx.fillStyle='#121820';
    ctx.fillRect(-10,-10+lLY,9,10); ctx.fillRect(1,-10+rLY,9,10);
    ctx.fillStyle='#1c2430';
    ctx.fillRect(-10,-2+lLY,10,2); ctx.fillRect(1,-2+rLY,10,2);
    // Boot highlight
    ctx.fillStyle='#22303e';
    ctx.fillRect(-9,-9+lLY,3,2); ctx.fillRect(2,-9+rLY,3,2);

    // ── Pants ───────────────────────────────────────────────
    ctx.fillStyle='#2d4422';
    ctx.fillRect(-9,-22+bOY+lLY,8,13);
    ctx.fillRect(2,-22+bOY+rLY,8,13);
    // Knee patch
    ctx.fillStyle='#243818';
    ctx.fillRect(-8,-16+bOY+lLY,7,4);
    ctx.fillRect(3,-16+bOY+rLY,7,4);

    // ── Jacket / body ───────────────────────────────────────
    ctx.fillStyle='#1e3828';
    ctx.fillRect(-9,-34+bOY,18,14);
    ctx.fillStyle='#1a2218'; ctx.fillRect(-9,-22+bOY,18,3);   // belt
    ctx.fillStyle='#b89020'; ctx.fillRect(-2,-22+bOY,4,3);    // buckle
    ctx.fillStyle='#162c1e'; ctx.fillRect(-1,-34+bOY,2,12);   // seam
    ctx.fillStyle='#2a4830';
    ctx.fillRect(-8,-32+bOY,5,4); ctx.fillRect(4,-32+bOY,5,4); // pockets
    ctx.fillStyle='#1e3828';
    // Collar
    ctx.fillRect(-3,-34+bOY,6,2);

    // ── Left arm ────────────────────────────────────────────
    ctx.fillStyle='#1e3828';
    ctx.fillRect(-15+lAX,-33+bOY+lAY,6,12);
    ctx.fillStyle='#c0885a';
    ctx.fillRect(-15+lAX,-22+bOY+lAY,6,4);  // hand

    // ── Right arm ───────────────────────────────────────────
    ctx.fillStyle='#1e3828';
    ctx.fillRect(9+rAX,-33+bOY+rAY,6,12);
    ctx.fillStyle='#c0885a';
    ctx.fillRect(9+rAX,-22+bOY+rAY,6,4);

    // ── WEAPON ──────────────────────────────────────────────
    if (P.weapon==='ppsh' && P.hasPPSH) {
      _drawPPSH(ctx, rAX, rAY, bOY, st, P.atkanim);
    } else {
      _drawKnife(ctx, rAX, rAY, bOY, st, P.atkanim);
    }

    // ── Head ────────────────────────────────────────────────
    ctx.fillStyle='#c0885a';
    ctx.fillRect(-5,-44+bOY,12,11);
    ctx.fillStyle='#a0704a';  // nose
    ctx.fillRect(3,-39+bOY,2,1);
    ctx.fillStyle='#1a1828';  // eye
    ctx.fillRect(5,-41+bOY,2,2);
    // Eye glint
    ctx.fillStyle='rgba(255,255,255,.5)';
    ctx.fillRect(6,-41+bOY,1,1);
    // Mustache
    ctx.fillStyle='#7a5030';
    ctx.fillRect(-1,-35+bOY,9,1);

    // ── Pilotka ─────────────────────────────────────────────
    ctx.fillStyle = P.masked?'#1c4528':'#1e2848';
    ctx.fillRect(-5,-50+bOY,13,7);
    ctx.fillRect(-3,-54+bOY,10,5);
    // Red star
    ctx.fillStyle='#cc2222';
    ctx.fillRect(-1,-54+bOY,4,4);
    ctx.fillRect(0,-56+bOY,2,2);
    ctx.fillStyle='#ffdd44';
    ctx.fillRect(0,-55+bOY,2,2);

    ctx.restore();
  }

  function _drawPPSH(ctx, rAX, rAY, bOY, st, atkanim) {
    ctx.fillStyle='#556600';
    ctx.fillRect(12+rAX,-30+bOY+rAY,24,5);   // body
    ctx.fillStyle='#334400';
    ctx.fillRect(24+rAX,-29+bOY+rAY,14,3);   // barrel shroud
    ctx.fillStyle='#aaa';
    ctx.fillRect(38+rAX,-31+bOY+rAY,6,9);    // muzzle
    // Drum magazine
    ctx.fillStyle='#776600';
    ctx.beginPath(); ctx.arc(20+rAX,-22+bOY+rAY,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#998800';
    ctx.beginPath(); ctx.arc(20+rAX,-22+bOY+rAY,3,0,Math.PI*2); ctx.fill();
    // Stock
    ctx.fillStyle='#5a4020';
    ctx.fillRect(9+rAX,-29+bOY+rAY,5,8);
    // Muzzle flash
    if (st==='shoot' && atkanim > 5) {
      ctx.save();
      ctx.globalAlpha=.95;
      ctx.fillStyle='rgba(255,230,80,1)';
      ctx.beginPath(); ctx.arc(44+rAX,-28+bOY+rAY,5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,140,40,.7)';
      ctx.fillRect(38+rAX,-34+bOY+rAY,12,12);
      ctx.restore();
    }
  }

  function _drawKnife(ctx, rAX, rAY, bOY, st, atkanim) {
    ctx.fillStyle='#553300';  // handle
    ctx.fillRect(10+rAX,-32+bOY+rAY,5,6);
    ctx.fillStyle='#888';     // guard
    ctx.fillRect(8+rAX,-33+bOY+rAY,9,2);
    ctx.fillStyle= st==='attack'?'#e8e8e8':'#888';
    ctx.fillRect(14+rAX,-45+bOY+rAY,3,14);  // blade
    ctx.fillStyle='#ccc';
    ctx.fillRect(16+rAX,-45+bOY+rAY,1,12);  // shine
    // Slash arc
    if (st==='attack' && atkanim > 6) {
      ctx.save();
      ctx.globalAlpha=.65;
      ctx.strokeStyle='rgba(255,255,200,.9)'; ctx.lineWidth=3;
      ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(10+rAX,-44+bOY); ctx.lineTo(28+rAX,-20+bOY);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── ENEMY drawing ────────────────────────────────────────────
  function drawEnemy(e, cam, gt) {
    const ctx = Engine.ctx;
    const px = Math.round(e.x-cam.x), py = Math.round(e.y-cam.y);
    if (px<-80||px>Engine.W()+80) return;

    ctx.save();
    if (e.flash > 0) ctx.globalAlpha=.3+Math.random()*.7;

    // Death fall animation
    if (e.dead) {
      const df = Math.min(e.deathAnim/16,1);
      ctx.translate(px+e.w/2, py+e.h/2);
      ctx.rotate(df*Math.PI*.55*(e.dir>0?1:-1));
      ctx.globalAlpha = Math.max(0,1-df*1.5);
      ctx.translate(-(px+e.w/2),-(py+e.h/2));
    }

    ctx.translate(px+e.w/2, py+e.h);
    if (e.dir < 0) ctx.scale(-1,1);

    const st = e.animState, wt = e.walkTime;
    const s = Math.sin(wt*.32);
    let bOY=0, lLY=0, rLY=0, lAY=0, rAY=0;

    if (st==='walk') {
      bOY=-Math.abs(s)*2; lLY=s*7; rLY=-s*7; lAY=-s*4; rAY=s*4;
    } else if (st==='idle') {
      bOY=Math.sin(gt*.035)*1.2;
    } else if (st==='attack') {
      lAY=-7; rAY=-9; bOY=-3;
    } else if (st==='hurt') {
      bOY=2; rAY=5; lAY=-5;
    }

    if      (e.type==='dog')    _drawDog(ctx,e,s,bOY,lLY,rLY,lAY,rAY,gt);
    else if (e.type==='boss')   _drawBoss(ctx,e,s,bOY,lLY,rLY,gt);
    else                        _drawSoldier(ctx,e,s,bOY,lLY,rLY,lAY,rAY);

    // HP bar
    if (e.hp < e.maxhp && !e.dead) {
      ctx.save();
      if (e.dir<0) ctx.scale(-1,1);
      const bw=e.w;
      ctx.fillStyle='rgba(0,0,0,.75)'; ctx.fillRect(-bw/2,-e.h-14,bw,6);
      ctx.fillStyle=e.boss?'#ff3333':'#33bb33';
      ctx.fillRect(-bw/2,-e.h-14,bw*(e.hp/e.maxhp),6);
      ctx.restore();
    }

    // Alert — German phrase
    if (e.alert===2 && !e.dead) {
      const phrases = ['Achtung!','Feuer!','Alarm!','Nein!','Hilfe!'];
      const phrase  = phrases[Math.floor(e.sx/120+e.type.length)%phrases.length];
      ctx.save(); if (e.dir<0) ctx.scale(-1,1);
      ctx.fillStyle='#ffcc44'; ctx.font='bold 10px monospace';
      ctx.shadowColor='#000'; ctx.shadowBlur=4;
      const bob=Math.sin(gt*.12)*2;
      ctx.fillText(phrase, -Math.floor(phrase.length*3), -e.h-16+bob);
      ctx.restore();
    }

    ctx.restore();
  }

  function _drawSoldier(ctx,e,s,bOY,lLY,rLY,lAY,rAY) {
    const off = e.type==='officer';
    const H = e.h;
    // Jackboots (tall German boots)
    ctx.fillStyle='#1a1814';
    ctx.fillRect(-9,-13+lLY,8,13); ctx.fillRect(1,-13+rLY,8,13);
    ctx.fillStyle='#252018';
    ctx.fillRect(-9,-3+lLY,9,3); ctx.fillRect(1,-3+rLY,9,3);
    // Legs — feldgrau
    ctx.fillStyle='#3e4438';
    ctx.fillRect(-8,-22+bOY+lLY,7,10); ctx.fillRect(1,-22+bOY+rLY,7,10);
    // Body — feldgrau
    ctx.fillStyle= off?'#35382e':'#3a3f34';
    ctx.fillRect(-9,-H+10+bOY,18,12);
    ctx.fillStyle='#1e1e18'; ctx.fillRect(-9,-H+22+bOY,18,2);  // belt
    ctx.fillStyle='#aaaaaa'; ctx.fillRect(-1,-H+22+bOY,4,2);   // buckle
    if (off) {
      // Officer collar tabs & epaulettes
      ctx.fillStyle='#888800';
      ctx.fillRect(-8,-H+11+bOY,5,2); ctx.fillRect(-8,-H+14+bOY,5,2);
      ctx.fillStyle='#cccc44';
      ctx.fillRect(-9,-H+10+bOY,3,5); ctx.fillRect(7,-H+10+bOY,3,5);
    } else {
      // Eagle breast insignia
      ctx.fillStyle='#aaaaaa';
      ctx.fillRect(-2,-H+13+bOY,6,1); ctx.fillRect(-1,-H+12+bOY,4,2);
    }
    // Arms
    ctx.fillStyle=off?'#35382e':'#3a3f34';
    ctx.fillRect(-13,-H+11+bOY+lAY,5,10); ctx.fillRect(8,-H+11+bOY+rAY,5,10);
    // Karabiner 98k rifle
    ctx.fillStyle='#5a4020'; ctx.fillRect(12,-H+15+bOY+rAY,12,3);  // stock/body
    ctx.fillStyle='#555'; ctx.fillRect(22,-H+14+bOY+rAY,10,2);     // barrel
    ctx.fillStyle='#777'; ctx.fillRect(32,-H+13+bOY+rAY,2,6);      // bayonet
    // Head / skin
    ctx.fillStyle='#c8905e'; ctx.fillRect(-5,-H+2+bOY,12,9);
    // Stahlhelm
    ctx.fillStyle= off?'#2e2e2e':'#3a3e44';
    ctx.fillRect(-7,-H-1+bOY,16,4);     // wide brim
    ctx.fillRect(-5,-H-5+bOY,12,5);     // dome
    ctx.fillRect(-3,-H-8+bOY,8,4);      // dome top
    ctx.fillStyle=off?'#444':'#505660';
    ctx.fillRect(-1,-H-9+bOY,4,2);      // ventilation ridge (Stahlhelm detail)
    if (off) {
      ctx.fillStyle='#cc0000'; ctx.fillRect(-4,-H-1+bOY,14,1);  // rank stripe on brim
    }
    ctx.fillStyle='#1a1a28'; ctx.fillRect(4,-H+4+bOY,2,2);  // eye
  }

  function _drawDog(ctx,e,s,bOY,lLY,rLY,lAY,rAY,gt) {
    const H = e.h;
    // Body
    ctx.fillStyle='#8a6a3a';
    ctx.fillRect(-12,-H+8+bOY,26,10);
    // Head
    ctx.fillRect(10,-H+4+bOY,10,10);
    // Ears
    ctx.fillStyle='#6a4a28';
    ctx.fillRect(14,-H+bOY,4,6); ctx.fillRect(18,-H+1+bOY,4,5);
    // Eyes + nose
    ctx.fillStyle='#111'; ctx.fillRect(16,-H+5+bOY,2,2);
    ctx.fillStyle='#220000'; ctx.fillRect(20,-H+6+bOY,3,3);
    // Legs (4)
    ctx.fillStyle='#6a4a28';
    ctx.fillRect(-10,-H+17+bOY+lLY,5,6); ctx.fillRect(-3,-H+17+bOY+rLY,5,6);
    ctx.fillRect(6,-H+17+bOY+lLY,5,6);  ctx.fillRect(13,-H+17+bOY+rLY,5,6);
    // Collar
    ctx.fillStyle='#884400'; ctx.fillRect(8,-H+10+bOY,12,3);
    // Tail sway
    const tw = Math.sin(gt*.18)*5;
    ctx.fillStyle='#8a6a3a';
    ctx.fillRect(-16,-H+8+bOY+tw,6,4);
  }

  function _drawBoss(ctx,e,s,bOY,lLY,rLY,gt) {
    const H = e.h;
    const bs = Math.sin(e.walkTime*.2);
    const bbOY = -Math.abs(bs)*3;
    const blLY = bs*10, brLY = -bs*10;

    // Big boots
    ctx.fillStyle='#0a1010';
    ctx.fillRect(-14,-14+blLY,12,14); ctx.fillRect(2,-14+brLY,12,14);
    // Thick legs
    ctx.fillStyle='#2a1818';
    ctx.fillRect(-13,-H+26+bbOY+blLY,10,14); ctx.fillRect(3,-H+26+bbOY+brLY,10,14);
    // Massive body
    ctx.fillStyle='#2a1a1a';
    ctx.fillRect(-17,-H+10+bbOY,34,18);
    // Armor
    ctx.fillStyle='#1a0a0a';
    ctx.fillRect(-15,-H+12+bbOY,12,8); ctx.fillRect(4,-H+12+bbOY,12,8);
    // Medal ribbons
    ctx.fillStyle='#ffd700';
    ctx.fillRect(-15,-H+26+bbOY,30,3);  // belt
    ctx.fillRect(-10,-H+14+bbOY,4,4); ctx.fillRect(-4,-H+14+bbOY,4,4); ctx.fillRect(2,-H+14+bbOY,4,4);
    // Epaulettes
    ctx.fillStyle='#550000';
    ctx.fillRect(-17,-H+10+bbOY,10,5); ctx.fillRect(8,-H+10+bbOY,10,5);
    ctx.fillStyle='#ffd700';
    ctx.fillRect(-17,-H+10+bbOY,10,2); ctx.fillRect(8,-H+10+bbOY,10,2);
    // Arms
    ctx.fillStyle='#2a1a1a';
    ctx.fillRect(-22,-H+11+bbOY,8,18); ctx.fillRect(14,-H+11+bbOY,8,18);
    // Pistol
    ctx.fillStyle='#333'; ctx.fillRect(20,-H+18+bbOY,20,5);
    ctx.fillStyle='#555'; ctx.fillRect(39,-H+16+bbOY,3,9);
    // Head
    ctx.fillStyle='#c0885a'; ctx.fillRect(-8,-H+2+bbOY,20,10);
    // Officer cap
    ctx.fillStyle='#111'; ctx.fillRect(-10,-H-4+bbOY,24,7); ctx.fillRect(-8,-H-8+bbOY,20,5);
    ctx.fillStyle='#cc0000'; ctx.fillRect(-10,-H-4+bbOY,24,3);
    ctx.fillStyle='#ffd700'; ctx.fillRect(-2,-H-4+bbOY,8,4);
    // Eyes
    ctx.fillStyle='#1a1a28';
    ctx.fillRect(4,-H+4+bbOY,3,3); ctx.fillRect(-4,-H+4+bbOY,2,2);

    // Rage glow when low HP
    if (e.hp < e.maxhp*.4) {
      ctx.save();
      ctx.globalAlpha=.25+Math.sin(gt*.2)*.15;
      ctx.fillStyle='#ff1100';
      ctx.fillRect(-17,-H+bbOY,34,H);
      ctx.restore();
    }
  }

  // ── Items ────────────────────────────────────────────────────
  function drawItems(items, cam, gt) {
    const ctx = Engine.ctx;
    for (const it of items) {
      if (it.done) continue;
      const px=it.x-cam.x, py=it.y-cam.y;
      if (px<-40||px>Engine.W()+40) continue;
      const bob=Math.sin(it.pulse)*5;
      const glow=(Math.sin(it.pulse)*.4+.6);
      ctx.save(); ctx.shadowBlur=18;
      _drawItem(ctx, it.type, px, py, bob, glow, it.pulse);
      ctx.restore();
    }
  }

  function _drawItem(ctx,type,px,py,bob,glow,pulse) {
    switch(type) {
      case 'wpn_ppsh': {
        ctx.shadowColor='#ffdd00'; ctx.globalAlpha=glow*.9;
        ctx.fillStyle='#556600'; ctx.fillRect(px+2,py+bob+10,22,7);
        ctx.fillStyle='#334400'; ctx.fillRect(px+18,py+bob+11,10,4);
        ctx.fillStyle='#aaa'; ctx.fillRect(px+26,py+bob+12,5,2);
        ctx.fillStyle='#776600';
        ctx.beginPath(); ctx.arc(px+12,py+bob+20,7,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#998800';
        ctx.beginPath(); ctx.arc(px+12,py+bob+20,4,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#334400'; ctx.fillRect(px+6,py+bob+16,5,8);
        ctx.fillStyle='#5a4020'; ctx.fillRect(px,py+bob+10,4,10);
        ctx.globalAlpha=.85; ctx.fillStyle='#ffd700'; ctx.font='bold 9px monospace';
        ctx.fillText('ППШ',px+2,py+bob+6); break;
      }
      case 'medkit': {
        ctx.shadowColor='#ff4444'; ctx.globalAlpha=glow*.95;
        ctx.fillStyle='#dddddd'; ctx.fillRect(px+1,py+bob+2,22,20);
        ctx.fillStyle='#cccccc'; ctx.fillRect(px+1,py+bob+2,22,4);
        ctx.strokeStyle='#aaa'; ctx.lineWidth=1; ctx.strokeRect(px+1,py+bob+2,22,20);
        ctx.fillStyle='#cc1111';
        ctx.fillRect(px+10,py+bob+5,4,14); ctx.fillRect(px+5,py+bob+10,14,4);
        ctx.fillStyle='rgba(255,255,255,.6)'; ctx.fillRect(px+3,py+bob+3,6,2);
        ctx.fillStyle='#999'; ctx.fillRect(px+8,py+bob+1,8,2); break;
      }
      case 'comrade': {
        ctx.shadowColor='#ffd700'; ctx.globalAlpha=glow;
        ctx.fillStyle='#c8945a'; ctx.fillRect(px+8,py+bob+1,8,8);
        ctx.fillStyle='#1e3040'; ctx.fillRect(px+7,py+bob-1,10,4);
        ctx.fillStyle='#cc2222'; ctx.fillRect(px+10,py+bob-1,4,2);
        ctx.fillStyle='#2a4030'; ctx.fillRect(px+6,py+bob+9,12,10);
        ctx.fillStyle='#2a4030'; ctx.fillRect(px+3,py+bob+10,4,7); ctx.fillRect(px+17,py+bob+10,4,7);
        ctx.fillStyle='#1a2838'; ctx.fillRect(px+7,py+bob+19,4,5); ctx.fillRect(px+13,py+bob+19,4,5);
        ctx.fillStyle='#ffd700'; ctx.font='6px sans-serif'; ctx.fillText('★',px+10,py+bob+2);
        ctx.fillStyle='#ffd700'; ctx.font='7px monospace'; ctx.fillText('ТВАРЩ',px-2,py+bob+28); break;
      }
      case 'medal': {
        ctx.shadowColor='#ffaa00'; ctx.globalAlpha=glow;
        ctx.fillStyle='#cc8800';
        ctx.beginPath(); ctx.arc(px+12,py+bob+12,10,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#ffcc44';
        ctx.beginPath(); ctx.arc(px+12,py+bob+12,7,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#ff4444';
        ctx.beginPath(); ctx.arc(px+12,py+bob+12,4,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='rgba(255,200,50,.6)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(px+12,py+bob+2); ctx.lineTo(px+12,py+bob-4); ctx.stroke();
        ctx.fillStyle='#ffaa00'; ctx.font='7px monospace'; ctx.fillText('МЕДАЛЬ',px-4,py+bob+28); break;
      }
      case 'ab_mask': {
        ctx.shadowColor='#44ff88'; ctx.globalAlpha=glow;
        ctx.fillStyle='#1a4420'; ctx.fillRect(px+3,py+bob+2,18,16);
        ctx.fillStyle='#226630'; ctx.fillRect(px+3,py+bob+2,18,8);
        ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(px+6,py+bob+5,4,3); ctx.fillRect(px+14,py+bob+5,4,3);
        ctx.fillStyle='#cc2222'; ctx.fillRect(px+10,py+bob+10,4,2); ctx.fillRect(px+11,py+bob+9,2,4);
        ctx.fillStyle='#44ff88'; ctx.font='8px monospace'; ctx.fillText('МАСКА',px,py+bob+25); break;
      }
      case 'ab_radio': {
        ctx.shadowColor='#44aaff'; ctx.globalAlpha=glow;
        ctx.fillStyle='#223355'; ctx.fillRect(px+2,py+bob+4,20,18);
        ctx.fillStyle='#334466'; ctx.fillRect(px+2,py+bob+4,20,8);
        ctx.strokeStyle='#aaaaff'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(px+18,py+bob+4); ctx.lineTo(px+22,py+bob-4); ctx.stroke();
        ctx.fillStyle='#ff4444'; ctx.fillRect(px+4,py+bob+14,4,3);
        ctx.fillStyle='#44ff44'; ctx.fillRect(px+10,py+bob+14,4,3);
        ctx.fillStyle='#111'; ctx.fillRect(px+4,py+bob+7,8,4);
        ctx.fillStyle='#44aaff'; ctx.font='8px monospace'; ctx.fillText('РАЦИЯ',px,py+bob+26); break;
      }
      case 'ab_sab': {
        ctx.shadowColor='#ff4444'; ctx.globalAlpha=glow;
        ctx.fillStyle='#883300'; ctx.fillRect(px+4,py+bob+6,16,14);
        ctx.fillStyle='#aa4400'; ctx.fillRect(px+4,py+bob+6,16,5);
        ctx.strokeStyle='#cc6600'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(px+4,py+bob+11); ctx.lineTo(px+20,py+bob+11); ctx.stroke();
        ctx.fillStyle='#ff4444'; ctx.fillRect(px+10,py+bob+2,4,5);
        ctx.strokeStyle='#ffaa00';
        ctx.beginPath(); ctx.moveTo(px+12,py+bob+2); ctx.lineTo(px+16,py+bob-2); ctx.stroke();
        ctx.fillStyle='#ff6644'; ctx.font='8px monospace'; ctx.fillText('ВЗРЫВ',px,py+bob+26); break;
      }
    }
  }

  // ── Bullets ──────────────────────────────────────────────────
  function drawBullets(bullets, cam) {
    const ctx = Engine.ctx;
    for (const b of bullets) {
      ctx.save(); ctx.globalAlpha=.9;
      ctx.shadowColor='#ffcc00'; ctx.shadowBlur=7;
      ctx.fillStyle='#ffee44';
      ctx.fillRect(b.x-cam.x, b.y-cam.y, b.w, b.h);
      // Tracer trail
      ctx.globalAlpha=.35; ctx.fillStyle='#fff';
      ctx.fillRect(b.x-cam.x+(b.vx<0?b.w:0)-b.vx*.3, b.y-cam.y+1, Math.abs(b.vx)*.3, 1);
      ctx.restore();
    }
  }

  // ── Particles ────────────────────────────────────────────────
  function drawParticles(parts, cam) {
    const ctx = Engine.ctx;
    for (const p of parts) {
      ctx.globalAlpha=p.life/38; ctx.fillStyle=p.col;
      ctx.fillRect(p.x-cam.x-p.sz/2, p.y-cam.y-p.sz/2, p.sz, p.sz);
    }
    ctx.globalAlpha=1;
  }

  function drawFTexts(ftexts, cam) {
    const ctx = Engine.ctx;
    for (const t of ftexts) {
      ctx.globalAlpha=t.life/55; ctx.fillStyle=t.c;
      ctx.font='bold 12px monospace';
      ctx.shadowColor='rgba(0,0,0,.95)'; ctx.shadowBlur=5;
      ctx.fillText(t.t, t.x-cam.x, t.y-cam.y);
    }
    ctx.globalAlpha=1; ctx.shadowBlur=0;
  }

  // ── Minimap ──────────────────────────────────────────────────
  function drawMinimap(P, enemies, items, cam) {
    const mc = document.getElementById('mm').getContext('2d');
    mc.fillStyle='rgba(4,12,6,.95)'; mc.fillRect(0,0,150,90);
    const sx=150/World.WORLD_W, sy=90/World.WORLD_H;
    mc.fillStyle='rgba(30,60,20,.6)'; mc.fillRect(0,70,150,20);
    for (const e of enemies) {
      mc.fillStyle= e.boss?'#ff5555':'#dd2222';
      mc.fillRect(e.x*sx-1, e.y*sy-1, 3, 3);
    }
    for (const it of items) {
      if (it.done) continue;
      mc.fillStyle= it.type.startsWith('ab')||it.type==='wpn_ppsh'?'#44ff88':'#ffdd44';
      mc.fillRect(it.x*sx, it.y*sy, 2, 2);
    }
    mc.fillStyle='#ffd700'; mc.fillRect(P.x*sx-2, P.y*sy-2, 5, 5);
    mc.strokeStyle='rgba(180,140,40,.5)'; mc.lineWidth=.6;
    mc.strokeRect(cam.x*sx, cam.y*sy, Engine.W()*sx, Engine.H()*sy);
  }

  // ── Rain overlay ─────────────────────────────────────────────
  function drawRain(cam) {
    const ctx = Engine.ctx, W = Engine.W(), H = Engine.H();
    ctx.save(); ctx.globalAlpha=.10;
    ctx.strokeStyle='rgba(180,220,255,1)'; ctx.lineWidth=.8;
    for (const r of rain) {
      const rx=(r.x-cam.x*.98+W*2)%W, ry=(r.y-cam.y*.98+H*2)%H;
      ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(rx-4,ry+r.len*.6); ctx.stroke();
    }
    ctx.restore();
  }

  // ── Vignette ─────────────────────────────────────────────────
  function drawVignette() {
    const ctx = Engine.ctx, W = Engine.W(), H = Engine.H();
    const v = ctx.createRadialGradient(W/2,H/2,H*.2,W/2,H/2,H*.9);
    v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,.58)');
    ctx.fillStyle=v; ctx.fillRect(0,0,W,H);
  }

  return {
    updateAtmosphere, drawBackground, drawTiles,
    drawPlayer, drawEnemy, drawItems,
    drawBullets, drawParticles, drawFTexts,
    drawMinimap, drawRain, drawVignette,
  };
})();
