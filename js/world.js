'use strict';
// ================================================================
// WORLD.JS — Tile map management
// ================================================================
const World = (() => {
  const TS = 40;
  const WORLD_H = 720;

  let MAP = [], MX = 0, MY = 0, WORLD_W = 0;

  function init(worldW) {
    WORLD_W = worldW;
    MX = Math.ceil(WORLD_W / TS);
    MY = Math.ceil(WORLD_H / TS); // 18
    MAP = Array.from({length: MY}, () => new Uint8Array(MX));
  }

  // Tile types: 0=air, 1=solid earth, 2=wood platform, 3=barbed wire, 4=secret hint, 5=mine
  function getTile(tx, ty) {
    if (tx < 0 || tx >= MX || ty < 0 || ty >= MY) return 1;
    return MAP[ty][tx];
  }

  function solid(t)  { return t === 1 || t === 2 || t === 5; }
  function hazard(t) { return t === 3; }

  // Mine field — places type-5 tiles on the ground surface row
  function mineField(x, w) {
    const gy = GY();
    for (let i = 0; i < w && x+i < MX; i++) MAP[gy][x+i] = 5;
  }

  function set(x, y, t) {
    if (y < 0 || y >= MY || x < 0 || x >= MX) return;
    MAP[y][x] = t;
  }

  // Horizontal platform (type 2 = wood)
  function plat(x, y, w) {
    if (y < 0 || y >= MY) return;
    for (let i = 0; i < w && x+i < MX; i++) MAP[y][x+i] = 2;
  }

  // Solid wall block
  function wall(x, y, w, h) {
    for (let dx = 0; dx < w; dx++)
      for (let dy = 0; dy < h; dy++)
        set(x+dx, y+dy, 1);
  }

  // Pit — carve out ground rows
  function pit(x, w) {
    const gy = GY();
    for (let i = 0; i < w && x+i < MX; i++) {
      MAP[gy][x+i]   = 0;
      if (gy+1 < MY) MAP[gy+1][x+i] = 0;
    }
  }

  // Barbed wire row
  function wire(x, w) {
    const gy = GY();
    if (gy-1 >= 0)
      for (let i = 0; i < w && x+i < MX; i++) MAP[gy-1][x+i] = 3;
  }

  // Ground level row index
  function GY() { return MY - 4; }

  return {
    get MAP()     { return MAP; },
    get MX()      { return MX; },
    get MY()      { return MY; },
    get WORLD_W() { return WORLD_W; },
    WORLD_H,
    init, getTile, solid, hazard, set, plat, wall, pit, wire, mineField, GY,
  };
})();
