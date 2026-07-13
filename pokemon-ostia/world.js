// Ostia overworld: terrain, path, towns (Sydnera / Melbora / Canberry), vegetation, NPCs.
import * as THREE from "./assets/vendor/three.module.js";
import { PAL, mat, buildCreature, buildHero, buildNpc, buildHouse, buildHealCenter, buildLab, VEG } from "./models.js";

// Path polyline south (Sydnera) → north (Canberry).
const PATH = [[0, 78], [0, 55], [-3, 38], [0, 20], [0, 6], [0, -6], [3, -24], [-2, -42], [-4, -58], [-2, -70], [0, -78]];

export const TOWNS = [
  { key: "townSydnera", x: 0, z: 62, r: 14 },
  { key: "townMelbora", x: 0, z: 0, r: 13 },
  { key: "townCanberry", x: 0, z: -66, r: 15 },
];
export const ROUTES = [
  { key: "route1", x0: -22, x1: 22, z0: 20, z1: 52 },
  { key: "route2", x0: -22, x1: 22, z0: -52, z1: -20 },
];

function distToPath(x, z) {
  let best = 1e9;
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, az] = PATH[i], [bx, bz] = PATH[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const px = ax + dx * t, pz = az + dz * t;
    best = Math.min(best, Math.hypot(x - px, z - pz));
  }
  return best;
}

function townAt(x, z) {
  for (const t of TOWNS) if (Math.hypot(x - t.x, z - t.z) < t.r) return t;
  return null;
}

export function heightAt(x, z) {
  let h = 0.5 * Math.sin(x * 0.15) * Math.cos(z * 0.11) + 0.35 * Math.sin(x * 0.31 + z * 0.17);
  h *= 0.7;
  const dp = distToPath(x, z);
  if (dp < 6) h *= 0.15 + 0.85 * (dp / 6);          // flat along the path
  const t = townAt(x, z);
  if (t) h *= Math.min(1, Math.hypot(x - t.x, z - t.z) / t.r) * 0.3;  // flat plazas
  const r = Math.sqrt((x / 66) ** 2 + (z / 92) ** 2);
  if (r > 0.8) h -= (r - 0.8) * 22;                  // island falloff into the sea
  return h;
}

export function inGrassZone(x, z) {
  if (distToPath(x, z) < 3.5 || townAt(x, z)) return null;
  for (const zone of ROUTES)
    if (x > zone.x0 && x < zone.x1 && z > zone.z0 && z < zone.z1) return zone.key;
  return null;
}

export function routeAt(x, z) {
  for (const zone of ROUTES)
    if (x > zone.x0 && x < zone.x1 && z > zone.z0 && z < zone.z1) return zone.key;
  return null;
}

function buildTerrain() {
  const W = 160, D = 210, SX = 100, SZ = 130;
  let geo = new THREE.PlaneGeometry(W, D, SX, SZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo = geo.toNonIndexed();
  geo.computeVertexNormals();
  const p2 = geo.attributes.position;
  const colors = new Float32Array(p2.count * 3);
  const c = new THREE.Color(), euca = new THREE.Color(PAL.euca), dark = new THREE.Color(PAL.eucaDark),
    sand = new THREE.Color(PAL.sand), path = new THREE.Color(PAL.path), ochre = new THREE.Color(PAL.ochre);
  for (let f = 0; f < p2.count; f += 3) {           // one flat color per facet
    const x = (p2.getX(f) + p2.getX(f + 1) + p2.getX(f + 2)) / 3;
    const z = (p2.getZ(f) + p2.getZ(f + 1) + p2.getZ(f + 2)) / 3;
    const y = (p2.getY(f) + p2.getY(f + 1) + p2.getY(f + 2)) / 3;
    const r = Math.sqrt((x / 66) ** 2 + (z / 92) ** 2);
    if (y < 0.1 && r > 0.72) c.copy(sand);
    else if (distToPath(x, z) < 2.6) c.copy(path);
    else if (inGrassZone(x, z)) c.copy(dark);
    else {
      c.copy(euca);
      const n = Math.sin(x * 0.43 + 7) * Math.cos(z * 0.37 + 3);
      if (n > 0.55) c.lerp(ochre, 0.45); else if (n < -0.6) c.lerp(sand, 0.25);
    }
    for (let k = 0; k < 3; k++) { colors[(f + k) * 3] = c.r; colors[(f + k) * 3 + 1] = c.g; colors[(f + k) * 3 + 2] = c.b; }
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
  mesh.receiveShadow = true;
  return mesh;
}

export function buildWorld(scene, rand) {
  const world = { colliders: [], npcs: [], grassMeshes: [], animateFns: [] };

  scene.add(buildTerrain());

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400, 24, 24).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: PAL.water, flatShading: true, roughness: 0.4, transparent: true, opacity: 0.92 }));
  water.position.y = -0.55;
  scene.add(water);
  world.animateFns.push((t) => { water.position.y = -0.55 + Math.sin(t * 0.7) * 0.06; });

  // --- Vegetation (instanced: swarms are one draw call each) ---
  const spots = [];
  for (let i = 0; i < 900 && spots.length < 150; i++) {
    const x = (rand() * 2 - 1) * 62, z = (rand() * 2 - 1) * 88;
    const r = Math.sqrt((x / 66) ** 2 + (z / 92) ** 2);
    if (r > 0.72 || distToPath(x, z) < 5.5 || townAt(x, z) || inGrassZone(x, z) || heightAt(x, z) < 0.05) continue;
    spots.push([x, z]);
  }
  const trunkI = new THREE.InstancedMesh(VEG.trunk, mat(PAL.trunk), spots.length);
  const canA = [], canB = [];
  spots.forEach((s, i) => (i % 3 ? canA : canB).push(s));
  const canAI = new THREE.InstancedMesh(VEG.canopy, mat(PAL.euca), Math.max(1, canA.length));
  const canBI = new THREE.InstancedMesh(VEG.canopy, mat(PAL.eucaSilver), Math.max(1, canB.length));
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
  spots.forEach(([x, z], i) => {
    const y = heightAt(x, z), sc = 0.8 + rand() * 0.6;
    Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28);
    M.compose(P.set(x, y + 1.1 * sc, z), Q, S.set(sc, sc, sc));
    trunkI.setMatrixAt(i, M);
    world.colliders.push([x, z, 0.55]);
  });
  const setCan = (inst, list) => list.forEach(([x, z], i) => {
    const y = heightAt(x, z), sc = 0.8 + rand() * 0.7;
    Q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), rand() * 0.25);
    M.compose(P.set(x, y + 2.5, z), Q, S.set(sc, sc * (0.8 + rand() * 0.4), sc));
    inst.setMatrixAt(i, M);
  });
  setCan(canAI, canA); setCan(canBI, canB);
  trunkI.castShadow = canAI.castShadow = canBI.castShadow = true;
  scene.add(trunkI, canAI, canBI);

  // Rocks
  const rocks = [];
  for (let i = 0; i < 200 && rocks.length < 30; i++) {
    const x = (rand() * 2 - 1) * 60, z = (rand() * 2 - 1) * 86;
    if (Math.sqrt((x / 66) ** 2 + (z / 92) ** 2) > 0.7 || distToPath(x, z) < 4 || townAt(x, z) || inGrassZone(x, z)) continue;
    rocks.push([x, z]);
  }
  const rockI = new THREE.InstancedMesh(VEG.rock, mat(PAL.rock), Math.max(1, rocks.length));
  rocks.forEach(([x, z], i) => {
    const sc = 0.5 + rand() * 1.1;
    Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28);
    M.compose(P.set(x, heightAt(x, z) + 0.15 * sc, z), Q, S.set(sc, sc * 0.7, sc));
    rockI.setMatrixAt(i, M);
    if (sc > 0.9) world.colliders.push([x, z, 0.6 * sc]);
  });
  scene.add(rockI);

  // Tall grass tufts per route
  for (const zone of ROUTES) {
    const pts = [];
    for (let i = 0; i < 4000 && pts.length < 420; i++) {
      const x = zone.x0 + rand() * (zone.x1 - zone.x0), z = zone.z0 + rand() * (zone.z1 - zone.z0);
      if (!inGrassZone(x, z)) continue;
      pts.push([x, z]);
    }
    const gi = new THREE.InstancedMesh(VEG.grass, mat(PAL.eucaDark), pts.length);
    pts.forEach(([x, z], i) => {
      const sc = 0.8 + rand() * 0.7;
      Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28);
      M.compose(P.set(x, heightAt(x, z) + 0.4 * sc, z), Q, S.set(sc, sc, sc));
      gi.setMatrixAt(i, M);
    });
    scene.add(gi);
    world.grassMeshes.push(gi);
  }

  // --- Towns ---
  const addBuilding = (b, x, z, ry, hw, hd) => {
    b.position.set(x, heightAt(x, z), z); b.rotation.y = ry;
    scene.add(b);
    world.colliders.push({ x, z, hw: hw + 0.5, hd: hd + 0.5 });
  };
  // Sydnera (south): lab + houses
  addBuilding(buildLab(), 6, 66, Math.PI, 2.6, 1.9);
  addBuilding(buildHouse(3, 3, PAL.roofA), -6, 66, Math.PI, 1.6, 1.6);
  addBuilding(buildHouse(2.6, 3, PAL.roofB), -8, 58, Math.PI / 2, 1.6, 1.4);
  addBuilding(buildHouse(3, 2.6, PAL.roofA), 8, 58, -Math.PI / 2, 1.6, 1.4);
  // Melbora (center): heal center + houses
  addBuilding(buildHealCenter(), 6, -3, -Math.PI / 2, 1.9, 1.7);
  addBuilding(buildHouse(3, 3, PAL.roofA), -6, -3, Math.PI / 2, 1.6, 1.6);
  addBuilding(buildHouse(2.6, 2.6, PAL.roofB), -5, 5, Math.PI, 1.4, 1.4);
  addBuilding(buildHouse(3, 2.6, PAL.roofA), 6, 5, Math.PI, 1.6, 1.4);
  // Canberry (north): heal center + houses + champion plaza
  addBuilding(buildHealCenter(), 7, -63, -Math.PI / 2, 1.9, 1.7);
  addBuilding(buildHouse(3, 3, PAL.roofB), -7, -63, Math.PI / 2, 1.6, 1.6);
  addBuilding(buildHouse(3, 2.6, PAL.roofA), -6, -71, 0, 1.6, 1.4);
  addBuilding(buildHouse(2.6, 2.6, PAL.roofB), 6, -71, 0, 1.4, 1.4);
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.2, 12), mat(PAL.sandLight));
  plaza.position.set(0, heightAt(0, -66), -66);
  scene.add(plaza);

  // --- NPCs ---
  const addNpc = (id, mesh, x, z, facing = 0) => {
    mesh.position.set(x, heightAt(x, z), z); mesh.rotation.y = facing;
    scene.add(mesh);
    world.colliders.push([x, z, 0.7]);
    world.npcs.push({ id, x, z, mesh });
  };
  addNpc("prof", buildNpc(0xf5f5f0, PAL.cream), 0, 67, Math.PI);
  addNpc("villager", buildNpc(0x8fbf6f), -5, 61, Math.PI / 3);
  addNpc("healerMelbora", buildNpc(PAL.cream, PAL.coral), 4.2, -3, -Math.PI / 2);
  addNpc("healerCanberry", buildNpc(PAL.cream, PAL.coral), 5.2, -63, -Math.PI / 2);
  addNpc("matilda", buildNpc(PAL.roofA, PAL.ochre), 2, -26, Math.PI);
  addNpc("jack", buildNpc(PAL.tealDark, PAL.ochre), 0, -68, 0);

  // Starter podiums in front of the lab
  world.podiums = [];
  const starters = ["kangarouge", "koalys", "ornithos"];
  starters.forEach((sp, i) => {
    const x = -2.4 + i * 2.4, z = 64.4;
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.5, 8), mat(PAL.sandLight));
    pod.position.set(x, heightAt(x, z) + 0.25, z);
    const cr = buildCreature(sp, 0.8);
    cr.position.set(x, heightAt(x, z) + 0.5, z); cr.rotation.y = Math.PI;
    scene.add(pod, cr);
    world.colliders.push([x, z, 0.8]);
    world.podiums.push({ species: sp, x, z, pod, creature: cr });
    world.animateFns.push((t) => { cr.position.y = heightAt(x, z) + 0.5 + Math.sin(t * 2 + i) * 0.06; });
  });

  // Movement query: circle vs colliders + water + island bounds.
  world.canWalk = (x, z, pr = 0.45) => {
    if (Math.sqrt((x / 66) ** 2 + (z / 92) ** 2) > 0.76) return false;
    if (heightAt(x, z) < -0.12) return false;
    for (const c of world.colliders) {
      if (Array.isArray(c)) { if (Math.hypot(x - c[0], z - c[1]) < c[2] + pr) return false; }
      else if (Math.abs(x - c.x) < c.hw + pr && Math.abs(z - c.z) < c.hd + pr) return false;
    }
    return true;
  };
  return world;
}

// --- Animated title-menu diorama: a small floating island of Ostia ---
export function buildMenuDiorama(scene) {
  const g = new THREE.Group();
  const isle = new THREE.Mesh(new THREE.CylinderGeometry(6, 3.4, 3, 9), mat(PAL.ochre));
  isle.position.y = -1.8;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(6.05, 5.6, 0.7, 9), mat(PAL.euca));
  top.position.y = 0;
  const sea = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9.5, 0.4, 12), mat(PAL.water));
  sea.position.y = -0.45;
  g.add(isle, top, sea);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, r = 4.4 + (i % 2) * 0.7;
    const trunk = new THREE.Mesh(VEG.trunk, mat(PAL.trunk));
    trunk.position.set(Math.cos(a) * r, 1.3, Math.sin(a) * r);
    trunk.scale.setScalar(0.7);
    const can = new THREE.Mesh(VEG.canopy, mat(i % 2 ? PAL.euca : PAL.eucaSilver));
    can.position.set(Math.cos(a) * r, 2.6, Math.sin(a) * r);
    can.scale.setScalar(0.8);
    g.add(trunk, can);
  }
  const house = buildHouse(2.2, 2.2, PAL.roofA); house.position.set(-2.2, 0.35, 1.4); house.rotation.y = 0.6; house.scale.setScalar(0.8);
  g.add(house);
  const stars = [["kangarouge", 0.9, 0], ["koalys", 0.75, 2.1], ["ornithos", 0.7, 4.2]];
  const crs = [];
  for (const [sp, sc, a] of stars) {
    const cr = buildCreature(sp, sc);
    cr.position.set(Math.cos(a + 0.9) * 2.6, 0.35, Math.sin(a + 0.9) * 2.6);
    g.add(cr); crs.push(cr);
  }
  scene.add(g);
  return {
    group: g,
    animate(t) {
      g.rotation.y = t * 0.12;
      g.position.y = Math.sin(t * 0.6) * 0.15;
      crs.forEach((cr, i) => {
        cr.position.y = 0.35 + Math.abs(Math.sin(t * 2.2 + i * 1.7)) * 0.18;
        cr.rotation.y = -t * 0.12 + Math.sin(t * 0.8 + i) * 0.4;
      });
    },
  };
}
