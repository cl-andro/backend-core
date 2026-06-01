import * as THREE from "three";

/** Rocket silhouette — pointy nose + side fins. Extracted from ArkiBuilding. */
export function createRocket(accent: string): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: accent, emissive: accent, emissiveIntensity: 3, toneMapped: false,
  });

  const shape = new THREE.Shape();
  shape.moveTo(0, 15);
  shape.lineTo(5, 8);
  shape.lineTo(5, -5);
  shape.lineTo(9, -12);
  shape.lineTo(5, -8);
  shape.lineTo(5, -10);
  shape.lineTo(-5, -10);
  shape.lineTo(-5, -8);
  shape.lineTo(-9, -12);
  shape.lineTo(-5, -5);
  shape.lineTo(-5, 8);
  shape.closePath();

  const extrudeSettings = {
    depth: 5,
    bevelEnabled: true,
    bevelThickness: 1,
    bevelSize: 0.5,
    bevelSegments: 2,
  };
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.center();
  g.add(new THREE.Mesh(geo, mat));

  const windowMat = new THREE.MeshStandardMaterial({
    color: "#fff", emissive: "#fff", emissiveIntensity: 2, toneMapped: false,
  });
  const porthole = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), windowMat);
  porthole.position.set(0, 3, 3);
  g.add(porthole);

  return g;
}
