import * as THREE from "three";

/** Simple pulsing beacon sphere. */
export function createBeacon(accent: string): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 2.5,
    toneMapped: false,
    transparent: true,
    opacity: 0.85,
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(4, 10, 10), mat);
  g.add(sphere);
  return g;
}
