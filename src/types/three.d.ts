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

	export class BufferAttribute {
		constructor(array: Float32Array, itemSize: number);
		array: Float32Array;
		needsUpdate: boolean;
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
