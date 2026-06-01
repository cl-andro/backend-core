import * as THREE from "three";

/**
 * Growth chart — 5 ascending bars. Represents developer analytics / "HIRED".
 * New ornament, no extracted reference.
 */
export function createChart(accent: string): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: accent, emissive: accent, emissiveIntensity: 2.2, toneMapped: false,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: "#ffffff", emissive: accent, emissiveIntensity: 2.8, toneMapped: false,
  });

  const barW = 2.6;
  const gap = 1.1;
  const heights = [4, 7, 10, 13, 17];
  const totalW = heights.length * barW + (heights.length - 1) * gap;
  const startX = -totalW / 2 + barW / 2;

  heights.forEach((h, i) => {
    const geo = new THREE.BoxGeometry(barW, h, barW);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(startX + i * (barW + gap), h / 2, 0);
    g.add(mesh);

    // top cap glow
    const capGeo = new THREE.BoxGeometry(barW + 0.3, 0.4, barW + 0.3);
    const cap = new THREE.Mesh(capGeo, glowMat);
    cap.position.set(startX + i * (barW + gap), h + 0.2, 0);
    g.add(cap);
  });

  // Base plate
  const baseGeo = new THREE.BoxGeometry(totalW + 2, 0.6, barW + 2);
  const base = new THREE.Mesh(baseGeo, mat);
  base.position.y = -0.3;
  g.add(base);

  return g;
}
