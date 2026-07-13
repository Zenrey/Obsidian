// Ostia Monsters — bootstrap, state machine, overworld, input, save, menu.
import * as THREE from "./assets/vendor/three.module.js";
import { STR } from "./strings.js";
import { SPECIES, BAL, WILD, TRAINERS, makeMon } from "./data.js";
import { buildHero, preloadGlb } from "./models.js";
import { buildWorld, buildMenuDiorama, heightAt, inGrassZone, routeAt, TOWNS } from "./world.js";
import { Battle } from "./battle.js";
import { AudioMan } from "./audio.js";

const $ = (id) => document.getElementById(id);
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Options ----------
const OPT_KEY = "ostia_options", SAVE_KEY = "ostia_save1";
let opt = { music: 0.7, sfx: 0.8, lang: "fr", quality: "high", fx: true };
try { Object.assign(opt, JSON.parse(localStorage.getItem(OPT_KEY) || "{}")); } catch {}
const saveOpt = () => { try { localStorage.setItem(OPT_KEY, JSON.stringify(opt)); } catch {} };

function t(key, vars) {
  let s = (STR[opt.lang] || STR.fr)[key] || key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace("{" + k + "}", v);
  return s;
}
Object.defineProperty(t, "lang", { get: () => opt.lang });

function applyStrings() {
  document.querySelectorAll("[data-str]").forEach((el) => { el.textContent = t(el.dataset.str); });
  $("subtitle").textContent = t("subtitle");
  $("btn-play").textContent = t("play");
  $("btn-continue").textContent = t("continue");
  $("btn-options").textContent = t("options");
  $("menu-note").textContent = t("creditsNote");
  $("btn-victory-continue").textContent = t("victoryContinue");
  const title = $("title");
  if (title.dataset.done !== opt.lang) {
    title.dataset.done = opt.lang;
    title.innerHTML = "";
    [...t("title")].forEach((ch, i) => {
      const sp = document.createElement("span");
      if (ch === " ") sp.className = "sp"; else sp.textContent = ch;
      sp.style.animationDelay = 0.08 * i + "s";
      title.appendChild(sp);
    });
  }
  document.documentElement.lang = opt.lang;
}

// ---------- Audio ----------
const audio = new AudioMan();
audio.setVolumes(opt.music, opt.sfx);
addEventListener("pointerdown", () => audio.unlock(), { once: true });
addEventListener("keydown", () => audio.unlock(), { once: true });

// ---------- Renderer & scenes ----------
const canvas = $("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = opt.quality === "high";
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const menuScene = new THREE.Scene();
menuScene.background = new THREE.Color(0x9fd9ec);
menuScene.fog = new THREE.Fog(0x9fd9ec, 20, 55);
menuScene.add(new THREE.HemisphereLight(0xbfeaf5, 0xe8c28a, 1.0));
const menuSun = new THREE.DirectionalLight(0xffe9c4, 1.6);
menuSun.position.set(8, 12, 6);
menuScene.add(menuSun);
const menuCam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
menuCam.position.set(0, 6.5, 14.5);
menuCam.lookAt(0, 0.5, 0);
let diorama = null; // built at boot, after the Higgsfield GLB meshes have loaded

const worldScene = new THREE.Scene();
worldScene.background = new THREE.Color(0x9fd9ec);
worldScene.fog = new THREE.Fog(0x9fd9ec, 45, 115);
worldScene.add(new THREE.HemisphereLight(0xbfeaf5, 0xe8c28a, 0.95));
const sun = new THREE.DirectionalLight(0xffe9c4, 1.7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 80 });
worldScene.add(sun, sun.target);
const worldCam = new THREE.PerspectiveCamera(50, 1, 0.1, 300);

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, opt.quality === "high" ? 1.5 : 1);
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight);
  for (const cam of [menuCam, worldCam, battle.camera]) {
    cam.aspect = innerWidth / innerHeight;
    cam.updateProjectionMatrix();
  }
}
addEventListener("resize", resize);
addEventListener("orientationchange", resize);

// ---------- Game state ----------
let state = "menu";          // menu | world | dialog | battle | victory
let world = null, hero = null;
let save = null;
let rng = mulberry32(1);     // gameplay rng, reseeded on load
let encounterGrace = 0, lastZoneKey = null, bannerTimer = 0;

const hasSave = () => { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } };
function writeSave() {
  if (!save) return;
  save.pos = { x: hero.position.x, z: hero.position.z };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {}
}
function newSave() {
  return {
    seed: (Math.random() * 1e9) | 0,
    party: [], orbs: 0, potions: 0, dex: [],
    flags: {}, pos: { x: 0, z: 69 }, lastHeal: { x: 0, z: 69 },
  };
}

function ensureWorld() {
  if (world) return;
  world = buildWorld(worldScene, mulberry32(20260713));
  hero = buildHero();
  worldScene.add(hero);
}

// ---------- HUD ----------
function refreshHud() {
  if (!save) return;
  const party = $("party");
  party.innerHTML = "";
  for (const mon of save.party) {
    const s = SPECIES[mon.species];
    const chip = document.createElement("div");
    chip.className = "chip";
    const pct = Math.max(0, mon.hp / mon.maxHp * 100);
    chip.innerHTML = `<span></span><div class="hpline"><div class="hpfill"></div></div>`;
    chip.querySelector("span").textContent = `${opt.lang === "en" ? s.en : s.fr}  ${t("lvl")}${mon.lvl}`;
    const fill = chip.querySelector(".hpfill");
    fill.style.width = pct + "%";
    fill.style.background = pct > 50 ? "#7fa653" : pct > 20 ? "#ffb13d" : "#e8654f";
    party.appendChild(chip);
  }
  $("inv").innerHTML = "";
  for (const txt of [`${t("orbs")} ${save.orbs}`, `${t("potions")} ${save.potions}`, `${t("dex")} ${save.dex.length}/6`]) {
    const c = document.createElement("div");
    c.className = "inv-chip"; c.textContent = txt;
    $("inv").appendChild(c);
  }
}
let toastTimer = 0;
function toast(msg) { const el = $("toast"); el.textContent = msg; el.classList.add("show"); toastTimer = 2.2; }

// ---------- Dialog ----------
let dlgQueue = [], dlgDone = null;
function dialog(nameKey, lines, done) {
  state = "dialog";
  dlgQueue = lines.slice();
  dlgDone = done || null;
  $("ui-dialog").classList.remove("hidden");
  $("dlg-name").textContent = nameKey ? t(nameKey) : "";
  advanceDialog(true);
}
function advanceDialog(first = false) {
  if (!first && dlgQueue.length === 0) {
    $("ui-dialog").classList.add("hidden");
    state = "world";
    const cb = dlgDone; dlgDone = null;
    if (cb) cb();
    return;
  }
  const line = dlgQueue.shift();
  $("dlg-text").textContent = typeof line === "string" ? t(line) : t(line.key, line.vars);
}
$("dlg-box").addEventListener("click", () => { audio.sfx("click"); advanceDialog(); });

// ---------- Confirm ----------
function confirmBox(text) {
  return new Promise((resolve) => {
    $("confirm-text").textContent = text;
    const btns = $("confirm-btns");
    btns.innerHTML = "";
    for (const [label, val, cls] of [[t("yes"), true, "warn"], [t("no"), false, ""]]) {
      const b = document.createElement("button");
      b.className = "pbtn focusable " + cls;
      b.textContent = label;
      b.addEventListener("click", () => {
        audio.sfx("click");
        $("ui-confirm").classList.add("hidden");
        resolve(val);
      });
      btns.appendChild(b);
    }
    $("ui-confirm").classList.remove("hidden");
    requestAnimationFrame(() => btns.firstChild.focus());
  });
}

// ---------- Battle ----------
const battle = new Battle({
  t, audio, rng: () => rng(),
  ui: { panel: $("ui-battle"), msg: $("battle-msg"), actions: $("battle-actions"),
        ally: $("ally-bar"), enemy: $("enemy-bar") },
  refreshHud,
  fxEnabled: () => opt.fx,
  onCaught: (mon) => {
    if (!save.dex.includes(mon.species)) save.dex.push(mon.species);
    if (save.party.length < BAL.partyMax) { mon.hp = Math.max(1, mon.hp); save.party.push(mon); }
    refreshHud();
  },
});

function fade(on) {
  return new Promise((r) => {
    $("fade").classList.toggle("in", on);
    setTimeout(r, 580);
  });
}

async function runBattle(setup) {
  state = "battle";
  $("ui-hud").classList.add("hidden");
  await fade(true);
  await fade(false);
  const inv = { get orbs() { return save.orbs; }, set orbs(v) { save.orbs = v; },
                get potions() { return save.potions; }, set potions(v) { save.potions = v; } };
  const res = await battle.start({ party: save.party, inventory: inv, ...setup });
  await fade(true);
  $("ui-hud").classList.remove("hidden");
  audio.playMusic("overworld");
  state = "world";
  encounterGrace = BAL.encounterGraceSec;
  if (res.outcome === "lose") {
    for (const m of save.party) m.hp = m.maxHp;
    hero.position.set(save.lastHeal.x, heightAt(save.lastHeal.x, save.lastHeal.z), save.lastHeal.z);
  }
  writeSave();
  refreshHud();
  await fade(false);
  return res;
}

function makeWild(zoneKey) {
  const table = WILD[zoneKey] || WILD.route1;
  const total = table.reduce((s, e) => s + e[1], 0);
  let roll = rng() * total;
  let entry = table[0];
  for (const e of table) { roll -= e[1]; if (roll <= 0) { entry = e; break; } }
  const lvl = entry[2] + Math.floor(rng() * (entry[3] - entry[2] + 1));
  return makeMon(entry[0], lvl);
}

// ---------- NPC interactions ----------
async function interact(target) {
  if (target.kind === "podium") {
    const s = SPECIES[target.p.species];
    const name = opt.lang === "en" ? s.en : s.fr;
    if (await confirmBox(t("starterConfirm", { name }))) {
      save.party = [makeMon(target.p.species, 3)];
      save.dex.push(target.p.species);
      save.orbs = BAL.startOrbs;
      save.potions = BAL.startPotions;
      save.flags.starter = target.p.species;
      for (const p of world.podiums) { worldScene.remove(p.pod, p.creature); }
      world.colliders = world.colliders.filter((c) => !(Array.isArray(c) && world.podiums.some((p) => p.x === c[0] && p.z === c[1])));
      world.podiums = [];
      refreshHud();
      writeSave();
      audio.sfx("capture");
      dialog("profName", ["profGave", "profTip", "profAfter"]);
    }
    return;
  }
  const id = target.npc.id;
  if (id === "prof") {
    if (!save.flags.starter) dialog("profName", ["profIntro1", "profIntro2", "profChoose"]);
    else dialog("profName", ["profTip", "profAfter"]);
  } else if (id === "villager") {
    dialog("villagerName", ["villagerTip"]);
  } else if (id.startsWith("healer")) {
    for (const m of save.party) m.hp = m.maxHp;
    save.lastHeal = { x: target.npc.x, z: target.npc.z + 2 };
    refreshHud();
    writeSave();
    audio.sfx("capture");
    dialog("healerName", ["healerHeal"]);
  } else if (id === "matilda") {
    if (save.flags.matilda) { dialog("matildaName", ["matildaAfter"]); return; }
    dialog("matildaName", ["matildaBefore"], async () => {
      const res = await runBattle({ trainer: TRAINERS.matilda });
      if (res.outcome === "win") {
        save.flags.matilda = true;
        save.orbs += BAL.matildaOrbReward;
        refreshHud(); writeSave();
        dialog("matildaName", ["matildaLost"]);
      }
    });
  } else if (id === "jack") {
    if (save.flags.champion) { dialog("jackName", ["jackAfter"]); return; }
    dialog("jackName", ["jackBefore"], async () => {
      const res = await runBattle({ trainer: TRAINERS.jack });
      if (res.outcome === "win") {
        save.flags.champion = true;
        writeSave();
        dialog("jackName", ["jackLost"], showVictory);
      }
    });
  }
}

function nearestInteractable() {
  if (!world || !save) return null;
  const hx = hero.position.x, hz = hero.position.z;
  let best = null, bd = 2.1;
  for (const npc of world.npcs) {
    const d = Math.hypot(hx - npc.x, hz - npc.z);
    if (d < bd) { bd = d; best = { kind: "npc", npc }; }
  }
  if (!save.flags.starter) {
    for (const p of world.podiums) {
      const d = Math.hypot(hx - p.x, hz - p.z);
      if (d < bd) { bd = d; best = { kind: "podium", p }; }
    }
  }
  return best;
}

// ---------- Victory ----------
function showVictory() {
  state = "victory";
  audio.sfx("victory");
  $("victory-title").textContent = t("victoryTitle");
  $("victory-body").textContent = t("victoryBody");
  $("victory-dex").textContent = t("victoryDex", { n: save.dex.length });
  const ov = $("ui-victory");
  ov.classList.remove("hidden");
  const colors = ["#e8654f", "#3fa8a0", "#ffb13d", "#7fa653", "#f0d9ae"];
  for (let i = 0; i < 40; i++) {
    const c = document.createElement("div");
    c.className = "confetti";
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = 2.5 + Math.random() * 3 + "s";
    c.style.animationDelay = Math.random() * 2 + "s";
    ov.appendChild(c);
  }
  requestAnimationFrame(() => $("btn-victory-continue").focus());
}
$("btn-victory-continue").addEventListener("click", () => {
  audio.sfx("click");
  $("ui-victory").classList.add("hidden");
  document.querySelectorAll(".confetti").forEach((c) => c.remove());
  state = "world";
});

// ---------- Menu / options / pause ----------
function showMenu() {
  state = "menu";
  $("ui-menu").classList.remove("hidden");
  $("ui-hud").classList.add("hidden");
  $("btn-continue").classList.toggle("hidden", !hasSave());
  audio.playMusic("overworld");
  requestAnimationFrame(() => ($("btn-continue").classList.contains("hidden") ? $("btn-play") : $("btn-continue")).focus());
}
async function startGame(fresh) {
  if (fresh && hasSave() && !(await confirmBox(t("newGameOverwrite")))) return;
  await fade(true);
  ensureWorld();
  if (fresh) { try { localStorage.removeItem(SAVE_KEY); } catch {} save = newSave(); }
  else { try { save = Object.assign(newSave(), JSON.parse(localStorage.getItem(SAVE_KEY))); } catch { save = newSave(); } }
  rng = mulberry32(save.seed);
  hero.position.set(save.pos.x, heightAt(save.pos.x, save.pos.z), save.pos.z);
  hero.rotation.y = Math.PI;
  $("ui-menu").classList.add("hidden");
  $("ui-hud").classList.remove("hidden");
  refreshHud();
  state = "world";
  lastZoneKey = null;
  audio.playMusic("overworld");
  await fade(false);
}
$("btn-play").addEventListener("click", () => { audio.sfx("click"); startGame(true); });
$("btn-continue").addEventListener("click", () => { audio.sfx("click"); startGame(false); });

let optionsFrom = "menu";
function openOptions(from) {
  optionsFrom = from;
  $("opt-music").value = opt.music;
  $("opt-sfx").value = opt.sfx;
  syncSeg("opt-lang", opt.lang);
  syncSeg("opt-quality", opt.quality);
  syncSeg("opt-fx", opt.fx ? "on" : "off");
  $("ui-options").classList.remove("hidden");
  requestAnimationFrame(() => $("opt-music").focus());
}
function closeOptions() {
  $("ui-options").classList.add("hidden");
  saveOpt();
  if (optionsFrom === "pause") $("ui-pause").classList.remove("hidden");
}
function syncSeg(id, val) {
  $(id).querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === String(val)));
}
$("btn-options").addEventListener("click", () => { audio.sfx("click"); openOptions("menu"); });
$("btn-opt-back").addEventListener("click", () => { audio.sfx("click"); closeOptions(); });
$("opt-music").addEventListener("input", (e) => { opt.music = +e.target.value; audio.setVolumes(opt.music, opt.sfx); });
$("opt-sfx").addEventListener("input", (e) => { opt.sfx = +e.target.value; audio.setVolumes(opt.music, opt.sfx); audio.sfx("click"); });
$("opt-lang").addEventListener("click", (e) => {
  if (!e.target.dataset.v) return;
  opt.lang = e.target.dataset.v;
  syncSeg("opt-lang", opt.lang);
  applyStrings(); refreshHud(); audio.sfx("click");
});
$("opt-quality").addEventListener("click", (e) => {
  if (!e.target.dataset.v) return;
  opt.quality = e.target.dataset.v;
  syncSeg("opt-quality", opt.quality);
  renderer.shadowMap.enabled = opt.quality === "high";
  worldScene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  resize(); audio.sfx("click");
});
$("opt-fx").addEventListener("click", (e) => {
  if (!e.target.dataset.v) return;
  opt.fx = e.target.dataset.v === "on";
  syncSeg("opt-fx", opt.fx ? "on" : "off");
  audio.sfx("click");
});

function openPause() {
  if (state !== "world") return;
  state = "pause";
  $("ui-pause").classList.remove("hidden");
  requestAnimationFrame(() => $("btn-resume").focus());
}
function closePause() {
  $("ui-pause").classList.add("hidden");
  if (state === "pause") state = "world";
}
$("btn-pause").addEventListener("click", () => { audio.sfx("click"); openPause(); });
$("btn-resume").addEventListener("click", () => { audio.sfx("click"); closePause(); });
$("btn-pause-options").addEventListener("click", () => {
  audio.sfx("click");
  $("ui-pause").classList.add("hidden");
  openOptions("pause");
});
$("btn-quit").addEventListener("click", async () => {
  audio.sfx("click");
  if (!(await confirmBox(t("confirmQuit")))) { $("ui-pause").classList.remove("hidden"); return; }
  writeSave();
  closePause();
  await fade(true);
  showMenu();
  await fade(false);
});

// ---------- Input ----------
const BIND = {
  KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right",
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  Space: "action", Enter: "action", KeyE: "action", Escape: "back",
};
const held = new Set();
addEventListener("keydown", (e) => {
  const cmd = BIND[e.code];
  if (!cmd) return;
  const uiOpen = state === "menu" || state === "pause" || state === "victory" ||
    !$("ui-options").classList.contains("hidden") || !$("ui-confirm").classList.contains("hidden") ||
    (state === "battle" && $("battle-actions").classList.contains("open"));
  if (uiOpen) {
    if (cmd === "up" || cmd === "down") { moveFocus(cmd === "down" ? 1 : -1); e.preventDefault(); }
    if (cmd === "back") { onBack(); e.preventDefault(); }
    return; // action = native Enter/Space on the focused button
  }
  e.preventDefault();
  if (cmd === "back") { onBack(); return; }
  if (cmd === "action") { onAction(); return; }
  held.add(cmd);
});
addEventListener("keyup", (e) => { const c = BIND[e.code]; if (c) held.delete(c); });
addEventListener("blur", () => held.clear());

function onBack() {
  if (!$("ui-options").classList.contains("hidden")) closeOptions();
  else if (state === "pause") closePause();
  else if (state === "world") openPause();
}
function onAction() {
  if (state === "dialog") { audio.sfx("click"); advanceDialog(); return; }
  if (state === "battle") { battle.onAction(); return; }
  if (state === "world") {
    const tgt = nearestInteractable();
    if (tgt) { audio.sfx("click"); interact(tgt); }
  }
}
function moveFocus(dir) {
  const root = ["ui-confirm", "ui-options", "ui-pause", "ui-victory", "ui-menu"]
    .map($).find((el) => !el.classList.contains("hidden")) ||
    ($("battle-actions").classList.contains("open") ? $("battle-actions") : null);
  if (!root) return;
  const items = [...root.querySelectorAll("button, input")].filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const i = items.indexOf(document.activeElement);
  items[(i + dir + items.length) % items.length].focus();
}

// Touch: joystick + action button
const joyVec = { x: 0, z: 0 };
addEventListener("touchstart", () => document.body.classList.add("touch"), { once: true, passive: true });
const joy = $("joy"), stick = $("joy-stick");
let joyId = null;
joy.addEventListener("touchstart", (e) => { joyId = e.changedTouches[0].identifier; joyMove(e); e.preventDefault(); }, { passive: false });
joy.addEventListener("touchmove", (e) => { joyMove(e); e.preventDefault(); }, { passive: false });
joy.addEventListener("touchend", () => { joyId = null; joyVec.x = joyVec.z = 0; stick.style.left = "38px"; stick.style.top = "38px"; });
function joyMove(e) {
  for (const tch of e.changedTouches) {
    if (tch.identifier !== joyId) continue;
    const r = joy.getBoundingClientRect();
    let dx = tch.clientX - (r.left + 60), dy = tch.clientY - (r.top + 60);
    const len = Math.hypot(dx, dy) || 1, cl = Math.min(len, 42);
    dx = dx / len * cl; dy = dy / len * cl;
    stick.style.left = 38 + dx + "px"; stick.style.top = 38 + dy + "px";
    joyVec.x = dx / 42; joyVec.z = dy / 42;
  }
}
$("btn-act").addEventListener("touchstart", (e) => { onAction(); e.preventDefault(); }, { passive: false });

// Gamepad
let prevPad = [];
function pollPad() {
  const pads = navigator.getGamepads?.() || [];
  let ax = 0, az = 0;
  for (const gp of pads) {
    if (!gp) continue;
    if (Math.abs(gp.axes[0]) > 0.25) ax = gp.axes[0];
    if (Math.abs(gp.axes[1]) > 0.25) az = gp.axes[1];
    if (gp.buttons[14]?.pressed) ax = -1;
    if (gp.buttons[15]?.pressed) ax = 1;
    if (gp.buttons[12]?.pressed) az = -1;
    if (gp.buttons[13]?.pressed) az = 1;
    const now = gp.buttons.map((b) => b.pressed);
    const was = prevPad[gp.index] || [];
    const uiOpen = state !== "world" && state !== "dialog";
    if (now[0] && !was[0]) {
      if (uiOpen && document.activeElement?.click) document.activeElement.click();
      else onAction();
    }
    if (now[9] && !was[9]) (state === "pause" ? closePause : openPause)();
    if (uiOpen) {
      if (now[12] && !was[12]) moveFocus(-1);
      if (now[13] && !was[13]) moveFocus(1);
      ax = az = 0;
    }
    prevPad[gp.index] = now;
  }
  return { ax, az };
}

// ---------- Overworld update ----------
const camTarget = new THREE.Vector3();
function updateWorld(dt) {
  const pad = pollPad();
  let vx = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0) + joyVec.x + pad.ax;
  let vz = (held.has("down") ? 1 : 0) - (held.has("up") ? 1 : 0) + joyVec.z + pad.az;
  const len = Math.hypot(vx, vz);
  const moving = len > 0.15 && state === "world";
  if (moving) {
    vx /= Math.max(1, len); vz /= Math.max(1, len);
    const nx = hero.position.x + vx * BAL.moveSpeed * dt;
    const nz = hero.position.z + vz * BAL.moveSpeed * dt;
    if (world.canWalk(nx, nz)) { hero.position.x = nx; hero.position.z = nz; }
    else if (world.canWalk(nx, hero.position.z)) hero.position.x = nx;
    else if (world.canWalk(hero.position.x, nz)) hero.position.z = nz;
    hero.rotation.y = Math.atan2(vx, vz);
    // walk cycle (procedural hero has limbs; a generated GLB hero hops instead)
    hero.userData.phase = (hero.userData.phase || 0) + dt * 11;
    const ph = Math.sin(hero.userData.phase) * 0.65;
    const L = hero.userData.limbs;
    if (L) {
      L.legL.rotation.x = ph; L.legR.rotation.x = -ph;
      L.armL.rotation.x = -ph * 0.8; L.armR.rotation.x = ph * 0.8;
    } else {
      hero.rotation.z = Math.sin(hero.userData.phase * 0.5) * 0.06;
    }
  } else {
    const L = hero.userData.limbs;
    if (L) for (const k of ["legL", "legR", "armL", "armR"]) L[k].rotation.x *= 0.8;
    else hero.rotation.z *= 0.85;
  }
  const walkBounce = hero.userData.limbs ? 0 :
    (len > 0.15 && state === "world" ? Math.abs(Math.sin((hero.userData.phase || 0) * 0.5)) * 0.1 : 0);
  hero.position.y = Math.max(-0.1, heightAt(hero.position.x, hero.position.z)) + walkBounce;

  // encounters
  encounterGrace = Math.max(0, encounterGrace - dt);
  const zone = inGrassZone(hero.position.x, hero.position.z);
  if (zone && moving && encounterGrace <= 0 && state === "world") {
    if (rng() < BAL.encounterPerSec * dt) {
      runBattle({ wild: makeWild(zone) });
      return;
    }
  }

  // location banner
  let zk = null;
  for (const town of TOWNS) if (Math.hypot(hero.position.x - town.x, hero.position.z - town.z) < town.r) zk = town.key;
  if (!zk) zk = routeAt(hero.position.x, hero.position.z);
  if (zk && zk !== lastZoneKey) {
    $("location-banner").textContent = t(zk);
    $("location-banner").classList.add("show");
    bannerTimer = 2.6;
  }
  lastZoneKey = zk || lastZoneKey;
  if (bannerTimer > 0 && (bannerTimer -= dt) <= 0) $("location-banner").classList.remove("show");

  // interact hint
  const tgt = state === "world" ? nearestInteractable() : null;
  $("interact-hint").textContent = t("interact");
  $("interact-hint").classList.toggle("show", !!tgt);

  if (toastTimer > 0 && (toastTimer -= dt) <= 0) $("toast").classList.remove("show");

  // camera + sun follow
  camTarget.set(hero.position.x, hero.position.y + 8.6, hero.position.z + 9.6);
  worldCam.position.lerp(camTarget, 1 - Math.pow(0.001, dt));
  worldCam.lookAt(hero.position.x, hero.position.y + 1.2, hero.position.z - 1);
  sun.position.set(hero.position.x + 14, 24, hero.position.z + 8);
  sun.target.position.copy(hero.position);
}

// ---------- Main loop (fixed timestep) ----------
const STEP = 1 / 60;
let acc = 0, last = performance.now(), paused = false;
let frames = 0, fpsAt = last, fps = 0;
addEventListener("blur", () => (paused = true));
addEventListener("focus", () => { paused = false; last = performance.now(); });
const dev = new URLSearchParams(location.search).has("dev");
if (dev) {
  $("dev").style.display = "block";
  // Programmatic state access + input feeding for automated verification.
  window.__ostia = {
    get state() { return state; },
    get save() { return save; },
    teleport: (x, z) => { hero.position.set(x, heightAt(x, z), z); },
    battle: (zone) => runBattle({ wild: makeWild(zone || "route1") }),
    calls: () => renderer.info.render.calls,
    debug: () => ({ x: hero.position.x, z: hero.position.z, near: nearestInteractable() ? nearestInteractable().kind + ":" + (nearestInteractable().npc?.id || nearestInteractable().p?.species) : null }),
  };
}
let clock = 0;

function frame(now) {
  requestAnimationFrame(frame);
  if (paused) { last = now; return; }
  acc = Math.min(0.25, acc + (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    clock += STEP;
    if (diorama && state === "menu") diorama.animate(clock);
    if (state === "menu") pollPad();
    if (world && (state === "world" || state === "dialog" || state === "pause" || state === "victory")) {
      if (state === "world" || state === "dialog") updateWorld(state === "world" ? STEP : 0.0001);
      for (const fn of world.animateFns) fn(clock);
    }
    if (state === "battle") { battle.update(STEP); pollPad(); }
    acc -= STEP;
  }
  if (state === "menu") renderer.render(menuScene, menuCam);
  else if (state === "battle") renderer.render(battle.scene, battle.camera);
  else if (world) renderer.render(worldScene, worldCam);
  if (dev && (frames++, now - fpsAt >= 500)) {
    fps = Math.round(frames * 1000 / (now - fpsAt));
    frames = 0; fpsAt = now;
    $("dev").textContent = `${fps} fps\ncalls ${renderer.info.render.calls}\ntris ${renderer.info.render.triangles}`;
  }
}

// ---------- Boot ----------
// Creature/hero meshes generated with Higgsfield (sam_3_3d), served from its media CDN.
// Heights match the procedural fallbacks so every call site keeps its proportions.
const GLB_BASE = "https://d3u0tzju9qaucj.cloudfront.net/7d051b5a-7bfe-49fe-a484-24e7b3a9458a/";
const GLB_ASSETS = [
  { id: "hero", url: GLB_BASE + "c48df27f-8cdb-4b5d-8e56-8fa6611291f5.glb", height: 1.7 },
  { id: "kangarouge", url: GLB_BASE + "f08827ae-33bf-4580-aa31-258cf1ea0d2f.glb", height: 1.7 },
  { id: "dingoflam", url: GLB_BASE + "2b4cfd1b-52c9-4dfc-b5ba-05c4f7907436.glb", height: 1.1 },
  { id: "koalys", url: GLB_BASE + "ee0eb69f-1fd2-44cf-8350-9fe3a66b7de0.glb", height: 1.25 },
  { id: "eucalypin", url: GLB_BASE + "451bd5e5-0f27-4116-9c2c-fe8dc4e83b2f.glb", height: 1.7 },
  { id: "ornithos", url: GLB_BASE + "db17b04e-f4e6-4e68-9f03-cbcdf707d078.glb", height: 0.65 },
  { id: "crocobleu", url: GLB_BASE + "61ed29a3-8361-4092-a0c8-539c0e590aab.glb", height: 0.7 },
];
applyStrings();
resize();
$("loading").textContent = t("loading");
preloadGlb(GLB_ASSETS).finally(() => {
  diorama = buildMenuDiorama(menuScene);
  showMenu();
  $("loading").remove();
});
requestAnimationFrame(frame);
