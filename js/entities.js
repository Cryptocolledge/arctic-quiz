'use strict';
// ================================================================
// ENTITIES.JS — Player and Enemy classes with animation state machines
// ================================================================

// ── PLAYER ───────────────────────────────────────────────────────
class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = 80; this.y = 400;
    this.w = 22; this.h = 34;
    this.vx = 0; this.vy = 0;
    this.grounded = false;
    this.coyote = 0; this.jbuf = 0;
    this.facR = true;

    // Walk animation accumulator
    this.walkTime = 0;

    // Stats
    this.hp = 120; this.maxhp = 120;
    this.xp = 0; this.lvl = 1; this.dmg = 15;
    this.inv = 0; this.acd = 0; this.atkanim = 0;
    this.dead = false; this.deathAnim = 0;
    this.hurtFlash = 0;

    // Abilities
    this.ab = { mask:false, lock:false, radio:false, sab:false };
    this.masked = false; this.mke = 100;
    this.comrades = 0;

    // Weapon
    this.weapon = 'knife';
    this.hasPPSH = false;

    // Skills (picked on level-up)
    this.skills = {
      bayonetMaster: false, // knife dmg ×1.6
      marksman:      false, // ppsh dmg ×1.4, cooldown ×0.8
      ironWill:      false, // maxhp +60
      fieldMedic:    false, // heals ×1.8
      guerrilla:     false, // speed +20%
      veteran:       false, // xp ×1.3
    };

    // Animation state machine
    this.animState = 'idle';

    // Crouch & roll
    this.crouching = false;
    this.rolling   = 0;     // frames left in roll
    this.rollDir   = 1;
    this.lastLeft  = 0;     // tick of last ArrowLeft press (double-tap detection)
    this.lastRight = 0;
    this.tick      = 0;
  }

  // ── Determine current animation state ──────────────────────
  _updateAnimState() {
    if (this.dead)          return 'die';
    if (this.hurtFlash > 0) return 'hurt';
    if (this.rolling > 0)   return 'roll';
    if (this.atkanim > 0)   return this.weapon === 'ppsh' ? 'shoot' : 'attack';
    if (this.crouching && this.grounded) return 'crouch';
    if (!this.grounded)     return this.vy < 0 ? 'jump' : 'fall';
    if (Math.abs(this.vx) > 0.5) return 'run';
    return 'idle';
  }

  // ── Per-frame update ────────────────────────────────────────
  update() {
    if (this.dead) { this.deathAnim++; return; }

    const K = Engine.K;
    const JP = Engine.JP;
    this.tick++;

    // ── Double-tap roll ───────────────────────────────────────
    if (JP['ArrowLeft']) {
      if (this.grounded && this.rolling <= 0 && (this.tick - this.lastLeft) < 13) {
        this.rolling = 18; this.rollDir = -1;
        this.inv = Math.max(this.inv, 18); // brief dodge invincibility
        Engine.snd('jump');
      }
      this.lastLeft = this.tick;
    }
    if (JP['ArrowRight']) {
      if (this.grounded && this.rolling <= 0 && (this.tick - this.lastRight) < 13) {
        this.rolling = 18; this.rollDir = 1;
        this.inv = Math.max(this.inv, 18);
        Engine.snd('jump');
      }
      this.lastRight = this.tick;
    }

    // ── Crouch (ArrowDown while grounded, not rolling) ────────
    this.crouching = K['ArrowDown'] && this.grounded && this.rolling <= 0;

    // Mask: activate while crouching if ability owned
    if (this.crouching && this.ab.mask) this.masked = true;
    else if (!K['ArrowDown'])           this.masked = false;

    // ── Movement ──────────────────────────────────────────────
    const spd = this.skills.guerrilla ? 4.2 : 3.0;
    if (this.rolling > 0) {
      this.vx = this.rollDir * spd * 2.2;
      this.rolling--;
      this.facR = this.rollDir > 0;
    } else if (K['ArrowLeft'])       { this.vx = -(this.crouching ? spd * 0.4 : spd); this.facR = false; }
    else if (K['ArrowRight'])        { this.vx =  (this.crouching ? spd * 0.4 : spd); this.facR = true;  }
    else                               this.vx *= 0.78;

    // ── Coyote + jump buffer ──────────────────────────────────
    if (this.grounded) this.coyote = 10;
    else if (this.coyote > 0) this.coyote--;
    if (this.jbuf > 0) this.jbuf--;

    if (this.jbuf > 0 && this.coyote > 0 && !this.crouching) {
      this.vy = -13;
      this.coyote = 0; this.jbuf = 0;
      Engine.snd('jump');
    }

    // Variable jump: release early = shorter arc
    if (Engine.JR['ArrowUp'] || Engine.JR['Space']) {
      if (this.vy < -4) this.vy *= 0.5;
    }

    this.vy = Math.min(this.vy + Engine.GRAVITY, Engine.MAX_FALL);
    Engine.moveX(this);
    Engine.moveY(this);

    // Walk accumulator
    if (Math.abs(this.vx) > 0.5 && this.grounded) this.walkTime++;

    // Timers
    if (this.inv > 0)       this.inv--;
    if (this.acd > 0)       this.acd--;
    if (this.atkanim > 0)   this.atkanim--;
    if (this.hurtFlash > 0) this.hurtFlash--;

    // Mask drain
    if (this.masked && this.ab.mask) {
      this.mke -= 0.55;
      if (this.mke <= 0) { this.masked = false; this.mke = 0; }
    } else if (!this.masked && this.mke < 100) {
      this.mke = Math.min(100, this.mke + 0.32);
    }

    this.animState = this._updateAnimState();
  }

  // ── Attack ──────────────────────────────────────────────────
  attack() {
    if (this.acd > 0 || this.dead) return null;
    if (this.weapon === 'ppsh' && this.hasPPSH) {
      this.acd = this.skills.marksman ? 9 : 12;
      this.atkanim = 8;
      Engine.snd('ppsh');
      return 'ranged';
    } else {
      this.acd = 22; this.atkanim = 13;
      Engine.snd('knife');
      return 'melee';
    }
  }

  // ── Receive damage ──────────────────────────────────────────
  damage(dmg) {
    if (this.inv > 0) return false;
    this.hp -= dmg;
    this.inv = 55; this.hurtFlash = 10;
    Engine.snd('hit');
    if (this.hp <= 0) { this.hp = 0; this.dead = true; Engine.snd('die'); }
    return true;
  }

  // ── Healing (skill-aware) ───────────────────────────────────
  heal(amt) {
    const h = this.skills.fieldMedic ? Math.round(amt * 1.8) : amt;
    this.hp = Math.min(this.maxhp, this.hp + h);
    return h;
  }

  // ── XP gain (skill-aware) ───────────────────────────────────
  gainXP(xp) {
    const gain = this.skills.veteran ? Math.round(xp * 1.3) : xp;
    this.xp += gain;
    return gain;
  }

  // ── Serialise/deserialise for save ──────────────────────────
  save() {
    return {
      x:this.x, y:this.y, hp:this.hp, maxhp:this.maxhp,
      xp:this.xp, lvl:this.lvl, dmg:this.dmg,
      ab:this.ab, comrades:this.comrades, mke:this.mke,
      weapon:this.weapon, hasPPSH:this.hasPPSH, skills:this.skills,
    };
  }
  load(d) {
    Object.assign(this, d);
  }
}

// ── ENEMY ────────────────────────────────────────────────────────
class Enemy {
  constructor(x, y, type) {
    this.x = x; this.y = y; this.type = type;
    this.boss = type === 'boss';

    const S = {
      soldier: { w:24, h:32, hp: 28, dmg:10, spd:0.75, pr:200 },
      dog:     { w:28, h:22, hp: 16, dmg: 7, spd:1.30, pr:160 },
      officer: { w:24, h:34, hp: 45, dmg:14, spd:0.60, pr:230 },
      boss:    { w:42, h:50, hp:200, dmg:20, spd:0.90, pr:9999 },
    }[type] || { w:24, h:32, hp:28, dmg:10, spd:0.7, pr:200 };

    Object.assign(this, S);
    this.maxhp = this.hp;
    this.sx = x; this.dir = 1;
    this.acd = 0; this.flash = 0; this.alert = 0;
    this.vy = 0; this.vx = 0; this.grounded = false;

    // Animation
    this.walkTime  = 0;
    this.animState = 'idle';
    this.attackAnim = 0;
    this.dead       = false;
    this.deathAnim  = 0;
  }

  // ── Per-frame update ────────────────────────────────────────
  update(P) {
    if (this.dead) { this.deathAnim++; return; }

    this.flash--;
    if (this.acd   > 0) this.acd--;
    if (this.attackAnim > 0) this.attackAnim--;

    const dx   = P.x - this.x;
    const dist = Math.sqrt(dx*dx + (P.y-this.y)**2);

    // ── AI movement ──────────────────────────────────────────
    let mx = 0;
    if (this.boss) {
      mx = Math.sign(dx) * this.spd;
      this.dir = Math.sign(dx) || 1;
    } else if (!P.masked && dist < 300) {
      this.alert = 2;
      mx = Math.sign(dx) * this.spd;
      this.dir = Math.sign(dx) || 1;
    } else {
      this.alert = 0;
      mx = this.dir * (this.spd * 0.45);
      if (Math.abs(this.x - this.sx) > this.pr) this.dir *= -1;
    }

    // Horizontal with tile collision
    this.x += mx;
    if (Engine.colRect(this)) { this.x -= mx; this.dir *= -1; }

    // Gravity + vertical tile collision
    this.vy = Math.min((this.vy||0) + Engine.GRAVITY, Engine.MAX_FALL);
    this.grounded = false;
    this.y += this.vy;
    if (Engine.colRect(this)) {
      this.y -= this.vy;
      if (this.vy > 0) this.grounded = true;
      this.vy = 0;
    }

    this.x = Math.max(0, Math.min(this.x, World.WORLD_W - this.w));

    if (Math.abs(mx) > 0.05) this.walkTime++;

    // Animation state
    if (this.attackAnim > 0)       this.animState = 'attack';
    else if (this.flash > 0)       this.animState = 'hurt';
    else if (Math.abs(mx) > 0.05)  this.animState = 'walk';
    else                           this.animState = 'idle';
  }

  // ── Receive damage ──────────────────────────────────────────
  damage(dmg) {
    this.hp -= dmg;
    this.flash = 12;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; return true; }
    return false;
  }
}
