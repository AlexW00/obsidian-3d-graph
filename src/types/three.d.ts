// three is bundled through 3d-force-graph and ships no type declarations at
// this version; these cover only what the label sprites, reverse arrows and motes use.
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

	export class BufferAttribute {
		constructor(array: Float32Array, itemSize: number);
		array: Float32Array;
		needsUpdate: boolean;
		// the part of the array to upload on the next render; reset afterwards
		updateRange: { offset: number; count: number };
		setUsage(usage: number): this;
	}
	export class BufferGeometry {
		attributes: Record<string, BufferAttribute>;
		setAttribute(name: string, attribute: BufferAttribute): this;
		setDrawRange(start: number, count: number): void;
		dispose(): void;
	}
	export class ShaderMaterial {
		constructor(params: {
			uniforms?: Record<string, { value: unknown }>;
			vertexShader?: string;
			fragmentShader?: string;
			transparent?: boolean;
			depthWrite?: boolean;
			blending?: number;
		});
		uniforms: Record<string, { value: number }>;
		blending: number;
		dispose(): void;
	}
	export class Points extends Object3D {
		constructor(geometry: BufferGeometry, material: ShaderMaterial);
		frustumCulled: boolean;
	}
	export class Color {
		constructor(color?: string);
		r: number;
		g: number;
		b: number;
		setStyle(style: string): this;
	}
	export interface Object3D {
		remove(...objects: Object3D[]): this;
	}
	export const AdditiveBlending: number;
	export const NormalBlending: number;
	export const DynamicDrawUsage: number;
}
