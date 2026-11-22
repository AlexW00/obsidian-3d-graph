// three is bundled through 3d-force-graph and ships no type declarations at
// this version; these cover only what the label sprites and reverse arrows use.
declare module "three" {
	export class Object3D {
		position: { set(x: number, y: number, z: number): void };
		scale: { set(x: number, y: number, z: number): void };
		visible: boolean;
		renderOrder: number;
		parent: Object3D | null;
		add(...objects: Object3D[]): this;
		localToWorld(vector: Vector3): Vector3;
		lookAt(vector: Vector3): void;
	}
	export class Vector3 {
		constructor(x?: number, y?: number, z?: number);
	}
	export class Color {
		constructor(color: string);
	}
	export class ConeGeometry {
		constructor(radius: number, height: number, radialSegments?: number);
		translate(x: number, y: number, z: number): this;
		rotateX(angle: number): this;
	}
	export class MeshLambertMaterial {
		constructor(params: { color?: Color; transparent?: boolean });
	}
	export class Mesh extends Object3D {
		constructor(geometry: ConeGeometry, material: MeshLambertMaterial);
	}
	export class Group extends Object3D {}
	export class CanvasTexture {
		constructor(canvas: HTMLCanvasElement);
		minFilter: number;
		generateMipmaps: boolean;
	}
	export class SpriteMaterial {
		constructor(params: { map?: CanvasTexture; transparent?: boolean; depthWrite?: boolean });
		opacity: number;
	}
	export class Sprite extends Object3D {
		constructor(material: SpriteMaterial);
		material: SpriteMaterial;
	}
	export const LinearFilter: number;
}
