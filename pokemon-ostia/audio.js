// Music + SFX manager. Music sits quietly under SFX (mix levels baked into MUSIC_LEVEL).
const MUSIC_LEVEL = 0.35, SFX_LEVEL = 0.8;
// Audio clips live on Higgsfield's permanent media CDN (same infra that hosts the game).
const CDN = "https://d8j0ntlcm91z4.cloudfront.net/user_3GQ3DXp2sY5nkunqilZsUO1Masl/";
const MUSIC = {
  overworld: CDN + "hf_20260713_005559_872f8a60-f94d-4b9f-86f4-64bf489f1f8a.m4a",
  battle: CDN + "hf_20260713_005600_e7cee950-e63c-4c81-a4c7-37e10594528f.m4a",
};
const SFX = {
  click: CDN + "hf_20260713_005601_4d17fb67-27fa-454d-a66c-86be66e005fa.mp3",
  hit: CDN + "hf_20260713_005603_b749d4bf-c48c-4101-b376-fda68b1d5f48.mp3",
  throw: CDN + "hf_20260713_005604_de2bdce8-aff8-4120-b34a-a6fb3fc4abf7.mp3",
  capture: CDN + "hf_20260713_005606_af7ae27d-f02e-4662-bf72-94acb578ad03.mp3",
  victory: CDN + "hf_20260713_005607_194a8683-803d-4d38-97dc-97cfb0ffc2e3.mp3",
};

export class AudioMan {
  constructor() {
    this.musicVol = 0.7; this.sfxVol = 0.8;
    this.current = null; this.currentName = null;
    this.unlocked = false;
    this.sfxPool = {};
    for (const [k, src] of Object.entries(SFX)) {
      const a = new Audio(src); a.preload = "auto";
      this.sfxPool[k] = a;
    }
    this.musicEls = {};
    for (const [k, src] of Object.entries(MUSIC)) {
      const a = new Audio(src); a.preload = "auto"; a.loop = true;
      this.musicEls[k] = a;
    }
  }
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.pendingMusic) this.playMusic(this.pendingMusic);
  }
  setVolumes(music, sfx) {
    this.musicVol = music; this.sfxVol = sfx;
    if (this.current) this.current.volume = this.musicVol * MUSIC_LEVEL;
  }
  playMusic(name) {
    if (!this.unlocked) { this.pendingMusic = name; return; }
    if (this.currentName === name) return;
    if (this.current) { this.current.pause(); this.current.currentTime = 0; }
    this.currentName = name;
    this.current = name ? this.musicEls[name] : null;
    if (this.current) {
      this.current.volume = this.musicVol * MUSIC_LEVEL;
      this.current.play().catch(() => {});
    }
  }
  sfx(name) {
    if (!this.unlocked) return;
    const a = this.sfxPool[name];
    if (!a) return;
    const el = a.paused ? a : a.cloneNode();
    el.volume = this.sfxVol * SFX_LEVEL;
    el.play().catch(() => {});
  }
}
