// three is bundled through 3d-force-graph and ships no type declarations at
// this version; these cover only what the label sprites use.
declare module "three" {
	export class Object3D {
		position: { set(x: number, y: number, z: number): void };
		scale: { set(x: number, y: number, z: number): void };
		visible: boolean;
		renderOrder: number;
		add(...objects: Object3D[]): this;
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
