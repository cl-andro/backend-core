import * as THREE from "three";

/** Hackathon trophy — cup with handles + star. Extracted from SolanaHackathonBuilding. */
export function createTrophy(accent: string): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: accent, emissive: accent, emissiveIntensity: 2.5, toneMapped: false,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: accent, emissive: accent, emissiveIntensity: 1.2, toneMapped: false,
    roughness: 0.3, metalness: 0.8,
  });

  const cup = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 12, 6), mat);
  cup.position.y = 6;
  g.add(cup);

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 1.5, 6), mat);
  rim.position.y = 12;
  g.add(rim);

  for (const xSign of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(3.5, 1, 6, 6, Math.PI), darkMat);
    handle.position.set(xSign * 9, 7, 0);
    handle.rotation.z = xSign * Math.PI / 2;
    g.add(handle);
  }

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 5, 4), darkMat);
  stem.position.y = -2;
  g.add(stem);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 2, 6), mat);
  base.position.y = -5;
  g.add(base);

  const star = new THREE.Mesh(new THREE.OctahedronGeometry(2.5, 0), mat);
  star.position.set(0, 8, 7);
  star.scale.set(1, 1, 0.4);
  g.add(star);

  return g;
}
