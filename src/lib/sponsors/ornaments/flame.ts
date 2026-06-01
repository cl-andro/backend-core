import * as THREE from "three";

// Voxel flame bitmap (7×11) — extracted from FirecrawlBuilding.
const VOXEL_FLAME_BM: number[][] = [
  [0,0,0,1,0,0,0],
  [0,0,0,1,1,0,0],
  [0,0,1,1,1,0,0],
  [0,0,1,1,1,0,0],
  [0,1,1,1,1,1,0],
  [0,1,1,1,1,1,1],
  [0,1,1,1,1,1,1],
  [1,1,1,0,1,1,1],
  [1,1,1,0,1,1,1],
  [1,1,0,0,0,1,1],
  [0,1,0,0,0,1,0],
];
const VOXEL_CORE_BM: number[][] = [
  [0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0],
  [0,0,0,1,0,0,0],
  [0,0,1,1,1,0,0],
  [0,1,1,1,1,1,0],
  [0,1,1,1,1,1,0],
  [0,1,1,1,1,1,0],
  [0,0,1,0,1,0,0],
  [0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0],
];

/** Voxel flame — outer body + hot yellow core. Extracted from FirecrawlBuilding. */
export function createFlame(accent: string): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: accent, emissive: accent, emissiveIntensity: 2.6, toneMapped: false,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: "#ffe27a", emissive: "#ffe27a", emissiveIntensity: 3.6, toneMapped: false,
  });

  const CUBE = 2.4;
  const CORE_CUBE = 1.6;
  const geo = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
  const coreGeo = new THREE.BoxGeometry(CORE_CUBE, CORE_CUBE, CORE_CUBE);
  const cols = VOXEL_FLAME_BM[0].length;
  const rows = VOXEL_FLAME_BM.length;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!VOXEL_FLAME_BM[r][c]) continue;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (c - (cols - 1) / 2) * CUBE,
        ((rows - 1 - r) - (rows - 1) / 2) * CUBE,
        0,
      );
      group.add(mesh);
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!VOXEL_CORE_BM[r][c]) continue;
      const mesh = new THREE.Mesh(coreGeo, coreMat);
      mesh.position.set(
        (c - (cols - 1) / 2) * CUBE,
        ((rows - 1 - r) - (rows - 1) / 2) * CUBE,
        CUBE * 0.55,
      );
      group.add(mesh);
    }
  }

  return group;
}
