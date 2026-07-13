// Balance data — every tunable number lives here (game-design data, not code).

export const TYPES = { FEU: "feu", PLANTE: "plante", EAU: "eau", NORMAL: "normal" };

// Non-transitive triangle: feu > plante > eau > feu.
export function typeMult(atkType, defType) {
  if (atkType === TYPES.NORMAL) return 1;
  if (atkType === defType) return 1;
  const beats = { feu: "plante", plante: "eau", eau: "feu" };
  if (beats[atkType] === defType) return 1.5;
  if (beats[defType] === atkType) return 0.75;
  return 1;
}

export const MOVES = {
  charge:    { id: "charge",    type: TYPES.NORMAL, power: 10,  fr: "Charge",        en: "Tackle" },
  morsure:   { id: "morsure",   type: TYPES.NORMAL, power: 11,  fr: "Morsure",       en: "Bite" },
  flammeche: { id: "flammeche", type: TYPES.FEU,    power: 13,  fr: "Flammèche",     en: "Ember" },
  brasier:   { id: "brasier",   type: TYPES.FEU,    power: 20, fr: "Brasier",       en: "Blaze" },
  fouet:     { id: "fouet",     type: TYPES.PLANTE, power: 13,  fr: "Fouet Feuille", en: "Vine Whip" },
  canopee:   { id: "canopee",   type: TYPES.PLANTE, power: 20, fr: "Canopée",       en: "Canopy Crush" },
  aquajet:   { id: "aquajet",   type: TYPES.EAU,    power: 13,  fr: "Aquajet",       en: "Aqua Jet" },
  torrent:   { id: "torrent",   type: TYPES.EAU,    power: 20, fr: "Torrent",       en: "Torrent" },
};

// 6 original species, Australian fauna & flora inspired.
export const SPECIES = {
  kangarouge: { id: "kangarouge", fr: "Kangarouge", en: "Kangarouge", type: TYPES.FEU,
    baseHp: 22, baseAtk: 7, baseDef: 5, baseSpd: 7, scale: 0.9,
    moves: ["charge", "flammeche"], learn: { 5: "brasier" }, starter: true },
  dingoflam:  { id: "dingoflam", fr: "Dingoflam", en: "Dingoflam", type: TYPES.FEU,
    baseHp: 20, baseAtk: 7, baseDef: 4, baseSpd: 8, scale: 0.8,
    moves: ["morsure", "flammeche"], learn: { 6: "brasier" } },
  koalys:     { id: "koalys", fr: "Koalys", en: "Koalys", type: TYPES.PLANTE,
    baseHp: 24, baseAtk: 6, baseDef: 6, baseSpd: 5, scale: 0.7,
    moves: ["charge", "fouet"], learn: { 5: "canopee" }, starter: true },
  eucalypin:  { id: "eucalypin", fr: "Eucalypin", en: "Eucalypin", type: TYPES.PLANTE,
    baseHp: 21, baseAtk: 6, baseDef: 6, baseSpd: 4, scale: 1.1,
    moves: ["charge", "fouet"], learn: { 6: "canopee" } },
  ornithos:   { id: "ornithos", fr: "Ornithos", en: "Ornithos", type: TYPES.EAU,
    baseHp: 23, baseAtk: 6, baseDef: 5, baseSpd: 7, scale: 0.6,
    moves: ["charge", "aquajet"], learn: { 5: "torrent" }, starter: true },
  crocobleu:  { id: "crocobleu", fr: "Crocobleu", en: "Crocobleu", type: TYPES.EAU,
    baseHp: 26, baseAtk: 8, baseDef: 6, baseSpd: 4, scale: 1.2,
    moves: ["morsure", "aquajet"], learn: { 6: "torrent" } },
};

export const BAL = {
  partyMax: 4,
  startOrbs: 8,
  startPotions: 3,
  matildaOrbReward: 5,
  potionHeal: 12,
  damageVar: 0.2,          // roll in [1-var/2, 1+var/2]
  xpNext: (lvl) => 10 + lvl * 10,
  xpGain: (enemyLvl) => 8 + enemyLvl * 5,
  statHp:  (s, lvl) => s.baseHp + (lvl - 1) * 3,
  statAtk: (s, lvl) => s.baseAtk + Math.floor((lvl - 1) * 1.2),
  statDef: (s, lvl) => s.baseDef + (lvl - 1),
  statSpd: (s, lvl) => s.baseSpd + Math.floor((lvl - 1) * 0.8),
  damage: (atk, power, def, mult, roll) =>
    Math.max(1, Math.round((atk * power / (def + 10)) * mult * (0.9 + roll * 0.2))),
  catchChance: (hp, maxHp) => Math.min(0.95, Math.max(0.2, 0.2 + 0.75 * (1 - hp / maxHp))),
  encounterPerSec: 0.35,   // probability per second walked inside tall grass
  encounterGraceSec: 1.5,  // no encounter right after a battle
  moveSpeed: 6.5,          // hero units/sec
};

// Wild encounter tables per zone: [speciesId, weight, minLvl, maxLvl]
export const WILD = {
  route1: [["eucalypin", 5, 2, 3], ["ornithos", 3, 2, 3], ["dingoflam", 2, 2, 3]],
  route2: [["dingoflam", 4, 4, 6], ["crocobleu", 4, 4, 6], ["eucalypin", 2, 4, 5]],
};

// Trainer parties: [speciesId, lvl]
export const TRAINERS = {
  matilda: { nameKey: "matildaName", party: [["eucalypin", 3], ["crocobleu", 4]] },
  jack:    { nameKey: "jackName",    party: [["dingoflam", 6], ["eucalypin", 6], ["crocobleu", 7]] },
};

export function makeMon(speciesId, lvl) {
  const s = SPECIES[speciesId];
  const moves = s.moves.slice();
  for (const [l, m] of Object.entries(s.learn || {})) if (lvl >= +l && !moves.includes(m)) moves.push(m);
  return {
    species: speciesId, lvl, xp: 0,
    maxHp: BAL.statHp(s, lvl), hp: BAL.statHp(s, lvl),
    atk: BAL.statAtk(s, lvl), def: BAL.statDef(s, lvl), spd: BAL.statSpd(s, lvl),
    moves: moves.slice(0, 4),
  };
}

// Applies one level-up to a mon; returns the learned move id or null.
export function levelUp(mon) {
  const s = SPECIES[mon.species];
  mon.lvl += 1;
  const hpGain = BAL.statHp(s, mon.lvl) - mon.maxHp;
  mon.maxHp = BAL.statHp(s, mon.lvl);
  mon.hp = Math.min(mon.maxHp, mon.hp + hpGain);
  mon.atk = BAL.statAtk(s, mon.lvl);
  mon.def = BAL.statDef(s, mon.lvl);
  mon.spd = BAL.statSpd(s, mon.lvl);
  const learned = (s.learn || {})[mon.lvl];
  if (learned && !mon.moves.includes(learned)) {
    if (mon.moves.length < 4) mon.moves.push(learned); else mon.moves[mon.moves.length - 1] = learned;
    return learned;
  }
  return null;
}
