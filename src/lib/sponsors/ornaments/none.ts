import * as THREE from "three";

/** Empty group — renders nothing. Used when `roof_ornament='none'`. */
export function createNone(): THREE.Group {
  return new THREE.Group();
}
