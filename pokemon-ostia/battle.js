// Turn-based battle: own 3D arena scene + DOM action UI, driven by an async step queue.
import * as THREE from "./assets/vendor/three.module.js";
import { PAL, mat, buildCreature, buildOrb, VEG } from "./models.js";
import { SPECIES, MOVES, BAL, typeMult, makeMon, levelUp } from "./data.js";

const TYPE_COLORS = { feu: "#e8654f", plante: "#7fa653", eau: "#3fa8a0", normal: "#d9b27c" };

export class Battle {
  // hooks: { t(key, vars), audio, rng, ui: {panel,msg,actions,ally,enemy}, refreshHud, fxEnabled(), onCaught(mon) }
  constructor(hooks) {
    this.h = hooks;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9fd9ec);
    this.scene.fog = new THREE.Fog(0x9fd9ec, 18, 42);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    const hemi = new THREE.HemisphereLight(0xbfeaf5, 0xe8c28a, 1.0);
    const sun = new THREE.DirectionalLight(0xffe9c4, 1.6);
    sun.position.set(6, 10, 4);
    this.scene.add(hemi, sun);
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 0.6, 14), mat(PAL.sand));
    ground.position.y = -0.3;
    this.scene.add(ground);
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2, r = 7.5 + (i % 3);
      const tuft = new THREE.Mesh(VEG.grass, mat(PAL.eucaDark));
      tuft.position.set(Math.cos(a) * r, 0.4, Math.sin(a) * r);
      this.scene.add(tuft);
    }
    this.timers = []; this.tweens = []; this.time = 0;
    this.skipReq = false;
    this.active = false;
  }

  update(dt) {
    this.time += dt;
    for (const tm of this.timers) tm.left -= dt;
    this.timers = this.timers.filter((tm) => (tm.left > 0 && !(tm.skippable && this.skipReq)) || (tm.resolve(), false));
    if (this.skipReq) this.skipReq = false;
    for (const tw of this.tweens) {
      tw.el = Math.min(tw.dur, tw.el + dt);
      const k = tw.el / tw.dur;
      tw.fn(tw.ease ? k * k * (3 - 2 * k) : k);
      if (tw.el >= tw.dur) { tw.done = true; tw.resolve(); }
    }
    this.tweens = this.tweens.filter((tw) => !tw.done);
    if (this.allyMesh && !this.allyMesh.userData.frozen)
      this.allyMesh.position.y = this.allyBaseY + Math.sin(this.time * 2.2) * 0.05;
    if (this.enemyMesh && !this.enemyMesh.userData.frozen)
      this.enemyMesh.position.y = this.enemyBaseY + Math.sin(this.time * 2.2 + 1.4) * 0.05;
    if (this.shake > 0.005) {
      this.shake *= Math.pow(0.001, dt);
      this.camera.position.set(this.camBase.x + (Math.random() - 0.5) * this.shake,
        this.camBase.y + (Math.random() - 0.5) * this.shake, this.camBase.z);
    }
  }

  wait(ms, skippable = false) { return new Promise((resolve) => this.timers.push({ left: ms / 1000, skippable, resolve })); }
  tween(fn, ms, ease = true) { return new Promise((resolve) => this.tweens.push({ fn, dur: ms / 1000, el: 0, ease, resolve, done: false })); }
  onAction() { this.skipReq = true; }

  async say(key, vars) {
    this.h.ui.msg.textContent = this.h.t(key, vars);
    await this.wait(350);
    await this.wait(1000, true);
  }

  monName(mon) { const s = SPECIES[mon.species]; return this.h.t.lang === "en" ? s.en : s.fr; }

  spawnMesh(mon, side) {
    const sc = SPECIES[mon.species].scale * 1.5;
    const g = buildCreature(mon.species, sc);
    if (side === "ally") { g.position.set(-2.7, 0, 1.9); g.rotation.y = 0.95; }
    else { g.position.set(2.7, 0, -1.9); g.rotation.y = Math.PI + 0.95; }
    this.scene.add(g);
    return g;
  }

  bar(el, mon) {
    const pct = Math.max(0, mon.hp / mon.maxHp * 100);
    el.querySelector(".bfill").style.width = pct + "%";
    el.querySelector(".bfill").style.background = pct > 50 ? "#7fa653" : pct > 20 ? "#ffb13d" : "#e8654f";
    el.querySelector(".bname").textContent = this.monName(mon);
    el.querySelector(".blvl").textContent = this.h.t("lvl") + " " + mon.lvl;
    el.querySelector(".bhp").textContent = Math.max(0, Math.ceil(mon.hp)) + "/" + mon.maxHp;
  }
  refreshBars() {
    if (this.ally) this.bar(this.h.ui.ally, this.ally);
    if (this.enemy) this.bar(this.h.ui.enemy, this.enemy);
    this.h.refreshHud();
  }

  clearActions() { this.h.ui.actions.innerHTML = ""; this.h.ui.actions.classList.remove("open"); }
  askButtons(defs) {
    // defs: [{label, cls?, value}] — resolves chosen value (keyboard/gamepad nav handled by main via .bbtn focus)
    return new Promise((resolve) => {
      const box = this.h.ui.actions;
      box.innerHTML = ""; box.classList.add("open");
      defs.forEach((d, i) => {
        const b = document.createElement("button");
        b.className = "bbtn " + (d.cls || "");
        b.textContent = d.label;
        if (d.sub) { const s = document.createElement("span"); s.className = "bsub"; s.textContent = d.sub; b.appendChild(s); }
        if (d.color) b.style.setProperty("--tc", d.color);
        b.addEventListener("click", () => { this.h.audio.sfx("click"); this.clearActions(); resolve(d.value); });
        box.appendChild(b);
        if (i === 0) requestAnimationFrame(() => b.focus());
      });
    });
  }

  aliveParty() { return this.party.filter((p) => p.hp > 0); }

  async start({ party, inventory, wild = null, trainer = null }) {
    this.party = party; this.inv = inventory;
    this.trainer = trainer; this.trainerIdx = 0;
    this.active = true;
    this.result = null; this.caught = null;
    this.h.ui.panel.classList.add("show");
    this.clearActions();
    this.ally = this.aliveParty()[0];
    this.enemy = wild || makeMon(...trainer.party[0]);
    this.allyMesh = this.spawnMesh(this.ally, "ally");
    this.enemyMesh = this.spawnMesh(this.enemy, "enemy");
    this.allyBaseY = 0; this.enemyBaseY = 0;
    this.shake = 0;
    this.camBase = new THREE.Vector3(0, 3.4, 8.2);
    this.camera.position.set(0, 6, 14);
    this.camera.lookAt(0, 1, 0);
    this.tween((k) => {
      this.camera.position.lerpVectors(new THREE.Vector3(0, 6, 14), this.camBase, k);
      this.camera.lookAt(0, 1, 0);
    }, 900);
    this.refreshBars();
    this.h.audio.playMusic("battle");
    if (trainer) {
      await this.say("battleTrainer", { name: this.h.t(trainer.nameKey) });
      await this.say("battleSend", { name: this.h.t(trainer.nameKey), mon: this.monName(this.enemy) });
    } else {
      await this.say("battleWild", { name: this.monName(this.enemy) });
    }
    await this.say("battleGo", { mon: this.monName(this.ally) });
    await this.turnLoop();
    // teardown
    this.scene.remove(this.allyMesh, this.enemyMesh);
    if (this.orbMesh) this.scene.remove(this.orbMesh);
    this.orbMesh = null;
    this.h.ui.panel.classList.remove("show");
    this.clearActions();
    this.active = false;
    return { outcome: this.result, caught: this.caught };
  }

  async turnLoop() {
    while (!this.result) {
      const defs = [{ label: this.h.t("actAttack"), value: "attack", cls: "primary" }];
      if (!this.trainer) defs.push({ label: this.h.t("actCatch"), value: "catch" });
      defs.push({ label: this.h.t("actPotion", { n: this.inv.potions }), value: "potion" });
      if (this.aliveParty().length > 1) defs.push({ label: this.h.t("actSwitch"), value: "switch" });
      defs.push({ label: this.h.t("actFlee"), value: "flee" });
      const choice = await this.askButtons(defs);
      if (choice === "attack") {
        const mv = await this.askMove();
        if (mv === null) continue;
        await this.execRound(mv);
      } else if (choice === "catch") {
        if (this.inv.orbs <= 0) { await this.say("noOrbs"); continue; }
        await this.tryCatch();
        if (!this.result && this.enemy.hp > 0) await this.enemyAttack();
      } else if (choice === "potion") {
        if (this.inv.potions <= 0) { await this.say("noPotions"); continue; }
        if (this.ally.hp >= this.ally.maxHp) { await this.say("hpFull"); continue; }
        this.inv.potions--;
        const heal = Math.min(BAL.potionHeal, this.ally.maxHp - this.ally.hp);
        this.ally.hp += heal;
        this.h.audio.sfx("capture");
        this.refreshBars();
        await this.say("usedPotion", { mon: this.monName(this.ally), n: heal });
        await this.enemyAttack();
      } else if (choice === "switch") {
        const next = await this.askSwitch(true);
        if (!next) continue;
        await this.swapAlly(next);
        await this.enemyAttack();
      } else if (choice === "flee") {
        if (this.trainer) { await this.say("cantFlee"); continue; }
        await this.say("fled");
        this.result = "flee";
      }
      if (!this.result && this.ally.hp <= 0) await this.handleAllyFaint();
      if (!this.result && this.enemy.hp <= 0) await this.handleEnemyFaint();
    }
  }

  askMove() {
    const defs = this.ally.moves.map((id) => {
      const mv = MOVES[id];
      return { label: this.h.t.lang === "en" ? mv.en : mv.fr, sub: this.h.t("type" + mv.type[0].toUpperCase() + mv.type.slice(1)) + " · " + mv.power, value: id, color: TYPE_COLORS[mv.type] };
    });
    defs.push({ label: this.h.t("back"), value: null });
    return this.askButtons(defs);
  }

  askSwitch(cancellable) {
    const defs = this.party.filter((p) => p.hp > 0 && p !== this.ally)
      .map((p) => ({ label: this.monName(p), sub: this.h.t("lvl") + p.lvl + " · " + Math.ceil(p.hp) + this.h.t("hp"), value: p }));
    if (cancellable) defs.push({ label: this.h.t("back"), value: null });
    return this.askButtons(defs);
  }

  async swapAlly(next) {
    this.scene.remove(this.allyMesh);
    this.ally = next;
    this.allyMesh = this.spawnMesh(next, "ally");
    this.refreshBars();
    await this.say("battleGo", { mon: this.monName(next) });
  }

  enemyMove() {
    const moves = this.enemy.moves;
    return moves[Math.floor(this.h.rng() * moves.length)];
  }

  async execRound(playerMoveId) {
    const eMove = this.enemyMove();
    const first = this.ally.spd >= this.enemy.spd ? "ally" : "enemy";
    const order = first === "ally" ? [["ally", playerMoveId], ["enemy", eMove]] : [["enemy", eMove], ["ally", playerMoveId]];
    for (const [side, mvId] of order) {
      if (this.ally.hp <= 0 || this.enemy.hp <= 0) break;
      await this.doAttack(side, mvId);
    }
  }

  async enemyAttack() {
    if (this.enemy.hp > 0 && this.ally.hp > 0) await this.doAttack("enemy", this.enemyMove());
    if (!this.result && this.ally.hp <= 0) await this.handleAllyFaint();
  }

  async doAttack(side, mvId) {
    const atkMon = side === "ally" ? this.ally : this.enemy;
    const defMon = side === "ally" ? this.enemy : this.ally;
    const atkMesh = side === "ally" ? this.allyMesh : this.enemyMesh;
    const defMesh = side === "ally" ? this.enemyMesh : this.allyMesh;
    const mv = MOVES[mvId];
    await this.say("usedMove", { mon: this.monName(atkMon), move: this.h.t.lang === "en" ? mv.en : mv.fr });
    const from = atkMesh.position.clone();
    const to = defMesh.position.clone().lerp(from, 0.45);
    atkMesh.userData.frozen = true;
    await this.tween((k) => { const kk = k < 0.5 ? k * 2 : (1 - k) * 2; atkMesh.position.lerpVectors(from, to, kk); }, 380);
    atkMesh.userData.frozen = false;
    this.h.audio.sfx("hit");
    if (this.h.fxEnabled()) this.shake = 0.35;
    const mult = typeMult(mv.type, SPECIES[defMon.species].type);
    const dmg = BAL.damage(atkMon.atk, mv.power, defMon.def, mult, this.h.rng());
    defMon.hp = Math.max(0, defMon.hp - dmg);
    // hit flash
    const flashes = [];
    defMesh.traverse((o) => { if (o.isMesh) flashes.push(o); });
    const origMats = flashes.map((o) => o.material);
    const red = origMats.map((mm) => { const c = mm.clone(); c.emissive = new THREE.Color(0xff3020); c.emissiveIntensity = 0.8; return c; });
    flashes.forEach((o, i) => (o.material = red[i]));
    await this.wait(140);
    flashes.forEach((o, i) => (o.material = origMats[i]));
    this.refreshBars();
    if (mult > 1) await this.say("superEffective");
    else if (mult < 1) await this.say("notEffective");
    else await this.wait(200);
  }

  async faintAnim(mesh) {
    mesh.userData.frozen = true;
    const y0 = mesh.position.y;
    await this.tween((k) => { mesh.position.y = y0 - k * 1.4; mesh.rotation.z = k * 0.9; mesh.scale.setScalar(mesh.userData.baseScale * (1 - k * 0.4)); }, 600);
  }

  async handleEnemyFaint() {
    await this.faintAnim(this.enemyMesh);
    await this.say("fainted", { mon: this.monName(this.enemy) });
    await this.grantXp();
    if (this.trainer && ++this.trainerIdx < this.trainer.party.length) {
      this.scene.remove(this.enemyMesh);
      this.enemy = makeMon(...this.trainer.party[this.trainerIdx]);
      this.enemyMesh = this.spawnMesh(this.enemy, "enemy");
      this.refreshBars();
      await this.say("trainerNext", { name: this.h.t(this.trainer.nameKey), mon: this.monName(this.enemy) });
      return;
    }
    if (this.trainer) { this.h.audio.sfx("victory"); await this.say("playerWon"); }
    this.result = "win";
  }

  async handleAllyFaint() {
    await this.faintAnim(this.allyMesh);
    await this.say("fainted", { mon: this.monName(this.ally) });
    if (this.aliveParty().length === 0) {
      await this.say("playerLost");
      this.result = "lose";
      return;
    }
    this.h.ui.msg.textContent = this.h.t("chooseNext");
    const next = await this.askSwitch(false);
    await this.swapAlly(next);
  }

  async grantXp() {
    const xp = BAL.xpGain(this.enemy.lvl);
    this.ally.xp += xp;
    await this.say("gainedXp", { mon: this.monName(this.ally), n: xp });
    while (this.ally.xp >= BAL.xpNext(this.ally.lvl)) {
      this.ally.xp -= BAL.xpNext(this.ally.lvl);
      const learned = levelUp(this.ally);
      this.h.audio.sfx("victory");
      this.refreshBars();
      await this.say("levelUp", { mon: this.monName(this.ally), n: this.ally.lvl });
      if (learned) {
        const mv = MOVES[learned];
        await this.say("learnedMove", { mon: this.monName(this.ally), move: this.h.t.lang === "en" ? mv.en : mv.fr });
      }
    }
  }

  async tryCatch() {
    this.inv.orbs--;
    this.h.refreshHud();
    await this.say("threwOrb");
    this.h.audio.sfx("throw");
    const orb = buildOrb(0.22);
    this.orbMesh = orb;
    const from = this.allyMesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    const to = this.enemyMesh.position.clone().add(new THREE.Vector3(0, 0.9, 0));
    orb.position.copy(from);
    this.scene.add(orb);
    await this.tween((k) => {
      orb.position.lerpVectors(from, to, k);
      orb.position.y += Math.sin(k * Math.PI) * 1.6;
      orb.rotation.z = -k * 9;
    }, 550);
    // creature sucked into the orb
    this.enemyMesh.userData.frozen = true;
    const sc0 = this.enemyMesh.userData.baseScale;
    await this.tween((k) => { this.enemyMesh.scale.setScalar(sc0 * (1 - k)); this.enemyMesh.position.y = k * 0.9; }, 350);
    // shakes
    for (let i = 0; i < 3; i++) {
      await this.tween((k) => { orb.rotation.z = Math.sin(k * Math.PI * 2) * 0.5; }, 320);
      await this.wait(160);
    }
    const ok = this.h.rng() < BAL.catchChance(this.enemy.hp, this.enemy.maxHp);
    if (ok) {
      this.h.audio.sfx("capture");
      await this.tween((k) => { orb.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.4); }, 300);
      const full = this.party.length >= BAL.partyMax;
      await this.say(full ? "caughtFull" : "caught", { name: this.monName(this.enemy) });
      this.caught = this.enemy;
      this.h.onCaught(this.enemy);
      await this.grantXp();
      this.result = "caught";
      this.scene.remove(orb); this.orbMesh = null;
    } else {
      this.scene.remove(orb); this.orbMesh = null;
      await this.tween((k) => { this.enemyMesh.scale.setScalar(sc0 * k); this.enemyMesh.position.y = (1 - k) * 0.9; }, 250);
      this.enemyMesh.userData.frozen = false;
      await this.say("brokeFree");
    }
  }
}
