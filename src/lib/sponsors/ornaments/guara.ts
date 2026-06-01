import * as THREE from "three";

/** Guará wolf face — head + snout + ears. Extracted from GuaraCloudBuilding. */
export function createGuaraMascot(accent: string): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: accent, emissive: accent, emissiveIntensity: 2, toneMapped: false,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: "#111", roughness: 0.5, metalness: 0.2,
  });

  const head = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 12), mat);
  head.scale.set(1, 0.95, 0.85);
  g.add(head);

  const snout = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 8), mat);
  snout.position.set(0, -3, 8);
  snout.scale.set(1, 0.7, 1.2);
  g.add(snout);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.5, 6, 6), darkMat);
  nose.position.set(0, -2, 12.5);
  g.add(nose);

  for (const xSign of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1.8, 6, 6), darkMat);
    eye.position.set(xSign * 4, 2, 8);
    g.add(eye);
  }

  for (const xSign of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(3, 8, 4), mat);
    ear.position.set(xSign * 6, 11, -1);
    ear.rotation.z = xSign * -0.3;
    g.add(ear);
  }

  return g;
}
