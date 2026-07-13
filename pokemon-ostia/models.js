// Procedural low-poly models.
// STYLE FORMULA (byte-identical, governs all visuals in this file):
// Low-poly faceted 3D render with flat shading and visible triangular facets, clean geometric
// silhouettes with no outlines, chunky rounded-edge forms. Environment in sun-baked ochre,
// eucalyptus green and warm sand tones with turquoise coastal water; hero and creatures in
// saturated coral, teal and golden accents that pop against the terrain; hazards and pickups
// marked with glowing amber. Bright open-air Australian summer light, soft long shadows,
// cheerful adventurous mood. High contrast between game elements and backgrounds, clean
// readable silhouettes, three-quarter isometric view.
import * as THREE from "./assets/vendor/three.module.js";

export const PAL = {
  ochre: 0xc98a4b, sand: 0xe8c28a, sandLight: 0xf0d9ae,
  euca: 0x7fa653, eucaDark: 0x5e8a46, eucaSilver: 0x9dbb8a,
  water: 0x35c4b5, waterDeep: 0x2aa8a4,
  trunk: 0x8a6b4d, rock: 0xb09a7e,
  coral: 0xe8654f, coralDark: 0xc44a38, teal: 0x3fa8a0, tealDark: 0x2f7e7a,
  amber: 0xffb13d, cream: 0xf5e8cf, dark: 0x3a3230,
  skin: 0xe8b58a, pants: 0x3e6e8e, path: 0xd9b27c,
  roofA: 0xe0705a, roofB: 0x3e8e8b, wall: 0xe6d2a8,
};

const mats = new Map();
export function mat(color, emissive = 0) {
  const key = color + ":" + emissive;
  if (!mats.has(key)) {
    mats.set(key, new THREE.MeshStandardMaterial({
      color, flatShading: true, roughness: 0.85, metalness: 0,
      emissive, emissiveIntensity: emissive ? 0.7 : 0,
    }));
  }
  return mats.get(key);
}

function m(geo, color, x = 0, y = 0, z = 0, opts = {}) {
  const mesh = new THREE.Mesh(geo, mat(color, opts.emissive || 0));
  mesh.position.set(x, y, z);
  if (opts.rx) mesh.rotation.x = opts.rx;
  if (opts.ry) mesh.rotation.y = opts.ry;
  if (opts.rz) mesh.rotation.z = opts.rz;
  if (opts.sx || opts.sy || opts.sz) mesh.scale.set(opts.sx || 1, opts.sy || 1, opts.sz || 1);
  mesh.castShadow = true;
  return mesh;
}

const G = {
  ico1: new THREE.IcosahedronGeometry(1, 0),
  sph1: new THREE.IcosahedronGeometry(1, 1),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 7),
  pyr4: new THREE.ConeGeometry(1, 1, 4),
};

function eyes(group, dx, y, z, r = 0.07) {
  group.add(m(G.sph1, PAL.dark, -dx, y, z, { sx: r, sy: r, sz: r }));
  group.add(m(G.sph1, PAL.dark, dx, y, z, { sx: r, sy: r, sz: r }));
}

// ---- Creatures (all face +Z) ----

function kangarouge() {
  const g = new THREE.Group();
  g.add(m(G.sph1, PAL.coral, 0, 0.62, 0, { sx: 0.42, sy: 0.55, sz: 0.38 }));           // body
  g.add(m(G.sph1, PAL.cream, 0, 0.55, 0.22, { sx: 0.26, sy: 0.36, sz: 0.2 }));          // belly
  g.add(m(G.sph1, PAL.coral, 0, 1.18, 0.1, { sx: 0.24, sy: 0.26, sz: 0.24 }));          // head
  g.add(m(G.sph1, PAL.coralDark, 0, 1.14, 0.33, { sx: 0.1, sy: 0.09, sz: 0.12 }));      // muzzle
  g.add(m(G.cone, PAL.coral, -0.14, 1.5, 0.02, { sx: 0.08, sy: 0.3, sz: 0.05, rz: 0.25 }));  // ears
  g.add(m(G.cone, PAL.coral, 0.14, 1.5, 0.02, { sx: 0.08, sy: 0.3, sz: 0.05, rz: -0.25 }));
  g.add(m(G.box, PAL.coralDark, -0.18, 0.12, 0.1, { sx: 0.14, sy: 0.1, sz: 0.42 }));    // feet
  g.add(m(G.box, PAL.coralDark, 0.18, 0.12, 0.1, { sx: 0.14, sy: 0.1, sz: 0.42 }));
  g.add(m(G.sph1, PAL.coral, -0.3, 0.78, 0.18, { sx: 0.09, sy: 0.2, sz: 0.09, rz: 0.4 })); // arms
  g.add(m(G.sph1, PAL.coral, 0.3, 0.78, 0.18, { sx: 0.09, sy: 0.2, sz: 0.09, rz: -0.4 }));
  g.add(m(G.cone, PAL.coralDark, 0, 0.3, -0.5, { sx: 0.14, sy: 0.7, sz: 0.14, rx: -2.1 })); // tail
  const flame = m(G.cone, PAL.amber, 0, 0.52, -0.85, { sx: 0.13, sy: 0.3, sz: 0.13, emissive: PAL.amber });
  g.add(flame); g.userData.flame = flame;                                                // ember tail tip
  eyes(g, 0.11, 1.24, 0.3);
  return g;
}

function dingoflam() {
  const g = new THREE.Group();
  g.add(m(G.box, 0xe88a3a, 0, 0.52, 0, { sx: 0.42, sy: 0.4, sz: 0.85 }));               // body
  g.add(m(G.box, 0xe88a3a, 0, 0.78, 0.5, { sx: 0.3, sy: 0.3, sz: 0.3 }));               // head
  g.add(m(G.box, PAL.cream, 0, 0.72, 0.72, { sx: 0.16, sy: 0.14, sz: 0.18 }));          // snout
  g.add(m(G.cone, 0xe88a3a, -0.1, 1.02, 0.44, { sx: 0.07, sy: 0.2, sz: 0.05 }));        // ears
  g.add(m(G.cone, 0xe88a3a, 0.1, 1.02, 0.44, { sx: 0.07, sy: 0.2, sz: 0.05 }));
  for (let i = 0; i < 3; i++)                                                            // flame mane
    g.add(m(G.cone, PAL.amber, 0, 0.86 - i * 0.05, 0.22 - i * 0.2, { sx: 0.1, sy: 0.28, sz: 0.08, rx: -0.4, emissive: PAL.amber }));
  const lp = [[-0.15, 0.32], [0.15, 0.32], [-0.15, -0.3], [0.15, -0.3]];
  for (const [x, z] of lp) g.add(m(G.cyl, 0xc9722e, x, 0.2, z, { sx: 0.07, sy: 0.4, sz: 0.07 }));
  g.add(m(G.cone, PAL.amber, 0, 0.62, -0.55, { sx: 0.09, sy: 0.4, sz: 0.09, rx: -2, emissive: PAL.amber })); // tail
  eyes(g, 0.09, 0.85, 0.66);
  return g;
}

function koalys() {
  const g = new THREE.Group();
  g.add(m(G.sph1, 0x8fbf6f, 0, 0.42, 0, { sx: 0.36, sy: 0.4, sz: 0.34 }));              // body
  g.add(m(G.sph1, 0x8fbf6f, 0, 0.92, 0.06, { sx: 0.32, sy: 0.3, sz: 0.3 }));            // big head
  g.add(m(G.sph1, PAL.cream, 0, 0.4, 0.24, { sx: 0.2, sy: 0.26, sz: 0.14 }));           // belly
  g.add(m(G.cone, 0x4f8a3d, -0.34, 1.08, 0, { sx: 0.16, sy: 0.34, sz: 0.05, rz: 1.0 })); // leaf ears
  g.add(m(G.cone, 0x4f8a3d, 0.34, 1.08, 0, { sx: 0.16, sy: 0.34, sz: 0.05, rz: -1.0 }));
  g.add(m(G.box, PAL.dark, 0, 0.9, 0.32, { sx: 0.1, sy: 0.14, sz: 0.08 }));             // nose
  g.add(m(G.sph1, 0x7aa85e, -0.28, 0.5, 0.12, { sx: 0.1, sy: 0.18, sz: 0.1 }));         // arms
  g.add(m(G.sph1, 0x7aa85e, 0.28, 0.5, 0.12, { sx: 0.1, sy: 0.18, sz: 0.1 }));
  g.add(m(G.sph1, 0x7aa85e, -0.14, 0.1, 0.08, { sx: 0.12, sy: 0.12, sz: 0.16 }));       // feet
  g.add(m(G.sph1, 0x7aa85e, 0.14, 0.1, 0.08, { sx: 0.12, sy: 0.12, sz: 0.16 }));
  eyes(g, 0.12, 0.98, 0.28);
  return g;
}

function eucalypin() {
  const g = new THREE.Group();
  g.add(m(G.cyl, 0x7d7248, 0, 0.5, 0, { sx: 0.16, sy: 1.0, sz: 0.16 }));                // trunk
  g.add(m(G.ico1, PAL.eucaSilver, 0, 1.3, 0, { sx: 0.5, sy: 0.42, sz: 0.5 }));          // canopy head
  g.add(m(G.ico1, PAL.eucaDark, 0.25, 1.52, 0.1, { sx: 0.25, sy: 0.2, sz: 0.25 }));
  g.add(m(G.ico1, PAL.eucaDark, -0.28, 1.45, -0.06, { sx: 0.22, sy: 0.18, sz: 0.22 }));
  g.add(m(G.cyl, 0x7d7248, -0.3, 0.6, 0, { sx: 0.05, sy: 0.5, sz: 0.05, rz: 0.7 }));    // branch arms
  g.add(m(G.cyl, 0x7d7248, 0.3, 0.6, 0, { sx: 0.05, sy: 0.5, sz: 0.05, rz: -0.7 }));
  g.add(m(G.box, 0x6b6140, -0.12, 0.04, 0.06, { sx: 0.14, sy: 0.08, sz: 0.3 }));        // root feet
  g.add(m(G.box, 0x6b6140, 0.12, 0.04, 0.06, { sx: 0.14, sy: 0.08, sz: 0.3 }));
  eyes(g, 0.14, 1.02, 0.17, 0.08);
  return g;
}

function ornithos() {
  const g = new THREE.Group();
  g.add(m(G.sph1, PAL.teal, 0, 0.3, 0, { sx: 0.4, sy: 0.26, sz: 0.5 }));                // body
  g.add(m(G.sph1, PAL.tealDark, 0, 0.42, 0.32, { sx: 0.22, sy: 0.18, sz: 0.2 }));       // head
  g.add(m(G.box, PAL.amber, 0, 0.36, 0.58, { sx: 0.26, sy: 0.07, sz: 0.3 }));           // bill
  g.add(m(G.box, PAL.tealDark, 0, 0.26, -0.52, { sx: 0.3, sy: 0.08, sz: 0.34 }));       // flat tail
  g.add(m(G.box, PAL.amber, -0.18, 0.05, 0.15, { sx: 0.18, sy: 0.06, sz: 0.22 }));      // webbed feet
  g.add(m(G.box, PAL.amber, 0.18, 0.05, 0.15, { sx: 0.18, sy: 0.06, sz: 0.22 }));
  eyes(g, 0.1, 0.5, 0.44, 0.06);
  return g;
}

function crocobleu() {
  const g = new THREE.Group();
  g.add(m(G.box, 0x3e7ec0, 0, 0.36, -0.1, { sx: 0.5, sy: 0.34, sz: 1.0 }));             // body
  g.add(m(G.box, 0x3e7ec0, 0, 0.42, 0.62, { sx: 0.34, sy: 0.24, sz: 0.5 }));            // snout top
  g.add(m(G.box, 0xa8cfe0, 0, 0.28, 0.6, { sx: 0.32, sy: 0.1, sz: 0.46 }));             // jaw
  g.add(m(G.box, 0x3e7ec0, 0, 0.3, -0.85, { sx: 0.2, sy: 0.16, sz: 0.6 }));             // tail
  for (let i = 0; i < 4; i++)                                                            // back ridges
    g.add(m(G.cone, 0x2f5e94, 0, 0.6, 0.3 - i * 0.28, { sx: 0.1, sy: 0.18, sz: 0.08 }));
  const lp = [[-0.28, 0.28], [0.28, 0.28], [-0.28, -0.42], [0.28, -0.42]];
  for (const [x, z] of lp) g.add(m(G.cyl, 0x2f5e94, x, 0.12, z, { sx: 0.09, sy: 0.24, sz: 0.09 }));
  eyes(g, 0.12, 0.58, 0.4, 0.08);
  return g;
}

const BUILDERS = { kangarouge, dingoflam, koalys, eucalypin, ornithos, crocobleu };

export function buildCreature(speciesId, scale = 1) {
  const g = BUILDERS[speciesId]();
  g.scale.setScalar(scale);
  g.userData.baseScale = scale;
  return g;
}

export function buildOrb(r = 0.16) {
  const g = new THREE.Group();
  g.add(m(G.sph1, PAL.cream, 0, 0, 0, { sx: r, sy: r, sz: r }));
  g.add(m(G.cyl, PAL.amber, 0, 0, 0, { sx: r * 1.02, sy: r * 0.36, sz: r * 1.02, emissive: PAL.amber }));
  g.add(m(G.sph1, PAL.dark, 0, 0, r * 0.95, { sx: r * 0.25, sy: r * 0.25, sz: r * 0.12 }));
  return g;
}

// ---- Hero (faces +Z), limbs exposed for the walk cycle ----
export function buildHero() {
  const g = new THREE.Group();
  const mk = (geo, c, x, y, z, o) => { const q = m(geo, c, x, y, z, o); g.add(q); return q; };
  mk(G.box, PAL.coral, 0, 0.85, 0, { sx: 0.4, sy: 0.45, sz: 0.26 });                    // shirt
  mk(G.sph1, PAL.skin, 0, 1.32, 0, { sx: 0.19, sy: 0.2, sz: 0.19 });                    // head
  mk(G.cyl, PAL.ochre, 0, 1.47, 0, { sx: 0.3, sy: 0.05, sz: 0.3 });                     // hat brim
  mk(G.cyl, PAL.ochre, 0, 1.56, 0, { sx: 0.17, sy: 0.14, sz: 0.17 });                   // hat top
  mk(G.box, 0x8a5a3a, 0, 0.9, -0.2, { sx: 0.3, sy: 0.34, sz: 0.14 });                   // backpack
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-0.26, 1.04, 0); armR.position.set(0.26, 1.04, 0);
  armL.add(m(G.box, PAL.skin, 0, -0.2, 0, { sx: 0.11, sy: 0.4, sz: 0.11 }));
  armR.add(m(G.box, PAL.skin, 0, -0.2, 0, { sx: 0.11, sy: 0.4, sz: 0.11 }));
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.11, 0.62, 0); legR.position.set(0.11, 0.62, 0);
  legL.add(m(G.box, PAL.pants, 0, -0.31, 0, { sx: 0.14, sy: 0.62, sz: 0.16 }));
  legR.add(m(G.box, PAL.pants, 0, -0.31, 0, { sx: 0.14, sy: 0.62, sz: 0.16 }));
  g.add(armL, armR, legL, legR);
  g.userData.limbs = { armL, armR, legL, legR };
  return g;
}

// Simple standing NPC with tinted shirt.
export function buildNpc(shirt = PAL.teal, hat = null) {
  const g = new THREE.Group();
  g.add(m(G.box, shirt, 0, 0.85, 0, { sx: 0.4, sy: 0.45, sz: 0.26 }));
  g.add(m(G.sph1, PAL.skin, 0, 1.32, 0, { sx: 0.19, sy: 0.2, sz: 0.19 }));
  g.add(m(G.box, shirt, -0.26, 0.84, 0, { sx: 0.11, sy: 0.4, sz: 0.11 }));
  g.add(m(G.box, shirt, 0.26, 0.84, 0, { sx: 0.11, sy: 0.4, sz: 0.11 }));
  g.add(m(G.box, 0x5a4a3a, -0.11, 0.31, 0, { sx: 0.14, sy: 0.62, sz: 0.16 }));
  g.add(m(G.box, 0x5a4a3a, 0.11, 0.31, 0, { sx: 0.14, sy: 0.62, sz: 0.16 }));
  if (hat) { g.add(m(G.cyl, hat, 0, 1.47, 0, { sx: 0.3, sy: 0.05, sz: 0.3 })); g.add(m(G.cyl, hat, 0, 1.56, 0, { sx: 0.17, sy: 0.14, sz: 0.17 })); }
  return g;
}

// ---- Buildings ----
export function buildHouse(w = 3, d = 3, roofColor = PAL.roofA) {
  const g = new THREE.Group();
  const h = 1.8;
  g.add(m(G.box, PAL.wall, 0, h / 2, 0, { sx: w, sy: h, sz: d }));
  g.add(m(G.pyr4, roofColor, 0, h + 0.65, 0, { sx: w * 0.78, sy: 1.3, sz: d * 0.78, ry: Math.PI / 4 }));
  g.add(m(G.box, 0x8a6b4d, 0, 0.55, d / 2 + 0.03, { sx: 0.7, sy: 1.1, sz: 0.08 }));     // door
  g.add(m(G.box, 0xbfe8f0, -w / 3, 1.1, d / 2 + 0.03, { sx: 0.5, sy: 0.5, sz: 0.06 })); // window
  g.add(m(G.box, 0xbfe8f0, w / 3, 1.1, d / 2 + 0.03, { sx: 0.5, sy: 0.5, sz: 0.06 }));
  return g;
}

export function buildHealCenter() {
  const g = buildHouse(3.6, 3.2, PAL.roofB);
  g.add(m(G.box, PAL.coral, 0, 2.0, 1.68, { sx: 0.5, sy: 0.14, sz: 0.1 }));             // teal-roof + coral cross
  g.add(m(G.box, PAL.coral, 0, 2.0, 1.68, { sx: 0.14, sy: 0.5, sz: 0.1 }));
  return g;
}

export function buildLab() {
  const g = new THREE.Group();
  g.add(m(G.box, PAL.cream, 0, 1.1, 0, { sx: 5, sy: 2.2, sz: 3.6 }));
  g.add(m(G.box, PAL.roofB, 0, 2.35, 0, { sx: 5.3, sy: 0.3, sz: 3.9 }));
  g.add(m(G.cyl, PAL.dark, 1.8, 3.1, 0, { sx: 0.05, sy: 1.5, sz: 0.05 }));              // antenna
  g.add(m(G.sph1, PAL.amber, 1.8, 3.9, 0, { sx: 0.14, sy: 0.14, sz: 0.14, emissive: PAL.amber }));
  g.add(m(G.box, 0x8a6b4d, 0, 0.65, 1.83, { sx: 0.9, sy: 1.3, sz: 0.08 }));
  return g;
}

// ---- Shared instancing geometries for vegetation ----
export const VEG = {
  trunk: new THREE.CylinderGeometry(0.14, 0.22, 2.2, 6),
  canopy: new THREE.IcosahedronGeometry(1.15, 0),
  grass: new THREE.ConeGeometry(0.28, 0.85, 5),
  rock: new THREE.IcosahedronGeometry(0.5, 0),
};
