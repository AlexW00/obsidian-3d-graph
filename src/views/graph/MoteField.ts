import * as THREE from "three";
import Link from "../../graph/Link";
import Node from "../../graph/Node";

// Motes of light flowing along links, like iron filings tracing the field
// between two magnetic poles. Each link gets a few field lines: arcs from the
// source to the target, each bowed out by its own amount in its own direction
// around the link, together forming a spindle. Motes travel each line in an
// evenly spaced train, so the lines read as dotted arcs of light.

type Positioned = Node & { x?: number; y?: number; z?: number };
type Endpoint = string | Positioned;

export interface MoteStyle {
	// motes per link (0 hides the link's motes)
	count: (link: Link) => number;
	// color at the source and target end (any CSS color)
	colors: (link: Link) => [string, string];
	// brightness multiplier, 0..1
	brightness: (link: Link) => number;
	size: number; // world units
	speed: number; // fraction of the link per second
	spread: number; // max bow, as a fraction of the link length
	solidity: number; // 0 = soft glow, 1 = solid dot
	// two-way links: 0 = both streams share the spindle, 1 = each stream
	// keeps to its own side of the link
	coalescence: number;
	additive: boolean; // glow on dark backgrounds; normal blending on light
}

// Stable pseudo-random number in [0, 1) for a string
const hash01 = (text: string): number => {
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	// final avalanche (murmur3 fmix32) so near-identical strings, like
	// "…#1" and "…#2", still give unrelated values
	h ^= h >>> 16;
	h = Math.imul(h, 0x85ebca6b);
	h ^= h >>> 13;
	h = Math.imul(h, 0xc2b2ae35);
	h ^= h >>> 16;
	return (h >>> 0) / 4294967296;
};

const endId = (end: Endpoint) => (typeof end === "string" ? end : end.id);

const VERTEX = `
attribute float aAlpha;
attribute float aSize;
attribute vec3 aColor;
uniform float uScale;
varying float vAlpha;
varying vec3 vColor;
void main() {
	vAlpha = aAlpha;
	vColor = aColor;
	vec4 mv = modelViewMatrix * vec4(position, 1.0);
	gl_PointSize = aSize * uScale / -mv.z;
	gl_Position = projectionMatrix * mv;
}`;

const FRAGMENT = `
uniform float uSolid;
varying float vAlpha;
varying vec3 vColor;
void main() {
	float d = length(gl_PointCoord - vec2(0.5));
	if (d > 0.5) discard;
	// soft: a bright core inside a glow, the core a little whiter, like a
	// point of light
	float glow = pow(1.0 - d * 2.0, 2.0) * 0.55;
	float core = smoothstep(0.16, 0.0, d);
	float soft = min(1.0, glow + core);
	// solid: an opaque dot with a crisp edge, about the glow's visible size
	float solid = 1.0 - smoothstep(0.24, 0.3, d);
	vec3 color = mix(vColor, vec3(1.0), core * 0.35 * (1.0 - uSolid));
	gl_FragColor = vec4(color, vAlpha * mix(soft, solid, uSolid));
}`;

interface Mote {
	link: number; // index into links
	phase: number;
	speed: number;
	angle: number;
	bow: number; // 0..1, scaled by spread
	minBow: number; // least bow as a fraction of the link length, whatever the spread
	reverse: boolean; // flows target -> source (half the lines of a two-way link)
	size: number;
	twinkle: number;
}

export class MoteField {
	private readonly scene: THREE.Object3D;
	private points: THREE.Points | null = null;
	private geometry: THREE.BufferGeometry | null = null;
	private material: THREE.ShaderMaterial | null = null;
	private links: Link[] = [];
	private motes: Mote[] = [];
	// each link's motes are contiguous: motes[linkStart[i] .. linkStart[i + 1])
	private linkStart: number[] = [0];
	private capacity = 0;
	private time = 0;
	private cleared = false; // every mote was hidden on the last frame
	private readonly colorCache = new Map<string, THREE.Color>();

	constructor(scene: THREE.Object3D) {
		this.scene = scene;
	}

	// Lays out motes for the given links (call when links or counts change)
	public setLinks(links: Link[], style: MoteStyle) {
		this.links = links;
		this.motes = [];
		this.linkStart = [0];
		const golden = Math.PI * (3 - Math.sqrt(5));
		links.forEach((link, index) => {
			const key = `${endId(link.source as Endpoint)}|${endId(link.target as Endpoint)}`;
			const n = Math.max(0, Math.round(style.count(link)));
			if (n === 0) {
				this.linkStart.push(this.motes.length);
				return;
			}
			// a few field lines per link; motes are shared out between them.
			// Notes that link to each other get lines flowing both ways, so a
			// two-way link needs an even number of lines, half each way.
			const mutual = link.mutual === true && n >= 2;
			let lineCount = Math.max(1, Math.min(n, Math.round(Math.sqrt(n) * 0.9)));
			if (mutual) lineCount = Math.min(n - (n % 2), lineCount + (lineCount % 2));
			const turn = hash01(`${key}#turn`) * Math.PI * 2;
			const sep = mutual ? Math.min(1, Math.max(0, style.coalescence)) : 0;
			const lines = Array.from({ length: lineCount }, (_, l) => {
				const r = (salt: string) => hash01(`${key}#line${l}${salt}`);
				// alternate lines run the other way on a two-way link
				const reverse = mutual && l % 2 === 1;
				// spread evenly around the link, with a little jitter
				let angle = turn + l * golden + (r("a") - 0.5) * 0.6;
				// most lines bow a little, a few bow a lot: a spindle
				let bow = 0.15 + 0.85 * Math.pow(r("b"), 0.8);
				if (sep > 0) {
					// each stream gathers around its own anchor, on opposite
					// sides of the link: angles narrow toward the anchor and
					// the least-bowed lines move out, off the shared axis;
					const anchor = turn + (reverse ? Math.PI : 0);
					const relative = Math.atan2(Math.sin(angle - anchor), Math.cos(angle - anchor));
					// (square root: the streams stop overlapping from about halfway)
					angle = anchor + relative * (1 - 0.8 * Math.sqrt(sep));
					bow = bow + (1 - bow) * 0.35 * sep;
					// and the streams loop further out, up to 2.5x the bow at 1,
					// like two field loops on either side of the link
					bow *= 1 + 1.5 * sep;
				}
				return {
					angle,
					bow,
					speed: 0.8 + 0.4 * r("s"),
					offset: r("o"),
					reverse,
				};
			});
			const perLine = new Array(lineCount).fill(0);
			for (let i = 0; i < n; i++) perLine[i % lineCount]++;
			for (let i = 0; i < n; i++) {
				const line = lines[i % lineCount];
				const slot = Math.floor(i / lineCount);
				const r = (salt: string) => hash01(`${key}#${i}${salt}`);
				this.motes.push({
					link: index,
					// an evenly spaced train along the line, slightly jittered
					phase: line.offset + (slot + (r("j") - 0.5) * 0.15) / perLine[i % lineCount],
					speed: line.speed,
					angle: line.angle,
					bow: line.bow,
					// keeps the streams apart even with a small spread
					minBow: line.bow * sep * 0.12,
					reverse: line.reverse,
					size: 0.6 + 0.7 * r("z"),
					twinkle: r("t") * Math.PI * 2,
				});
			}
			this.linkStart.push(this.motes.length);
		});
		this.cleared = false;
		this.ensureCapacity(this.motes.length, style);
		// update() fills the buffers and draw range with the visible motes
		this.geometry?.setDrawRange(0, 0);
	}

	private ensureCapacity(n: number, style: MoteStyle) {
		if (this.points && n <= this.capacity && this.material) {
			this.material.blending = style.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
			return;
		}
		this.disposeObjects();
		this.capacity = Math.max(64, Math.ceil(n * 1.25));
		const geometry = new THREE.BufferGeometry();
		const attr = (size: number) => {
			const a = new THREE.BufferAttribute(new Float32Array(this.capacity * size), size);
			a.setUsage(THREE.DynamicDrawUsage);
			return a;
		};
		geometry.setAttribute("position", attr(3));
		geometry.setAttribute("aColor", attr(3));
		geometry.setAttribute("aAlpha", attr(1));
		geometry.setAttribute("aSize", attr(1));
		this.material = new THREE.ShaderMaterial({
			uniforms: { uScale: { value: 400 }, uSolid: { value: style.solidity } },
			vertexShader: VERTEX,
			fragmentShader: FRAGMENT,
			transparent: true,
			depthWrite: false,
			blending: style.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
		});
		this.geometry = geometry;
		this.points = new THREE.Points(geometry, this.material);
		this.points.frustumCulled = false;
		this.points.renderOrder = 5;
		this.scene.add(this.points);
	}

	private color(css: string): THREE.Color {
		let c = this.colorCache.get(css);
		if (!c) {
			c = new THREE.Color();
			// THREE.Color ignores alpha; strip it to avoid warnings
			c.setStyle(css.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, "rgb($1,$2,$3)"));
			this.colorCache.set(css, c);
		}
		return c;
	}

	// Moves every mote along its arc; dt in seconds
	public update(dt: number, style: MoteStyle, viewportHeight: number) {
		if (!this.geometry || !this.material) return;
		this.time += dt;
		this.material.uniforms.uScale.value = viewportHeight / 2;
		this.material.uniforms.uSolid.value = style.solidity;
		this.material.blending = style.additive ? THREE.AdditiveBlending : THREE.NormalBlending;

		const pos = this.geometry.attributes.position.array as Float32Array;
		const col = this.geometry.attributes.aColor.array as Float32Array;
		const alpha = this.geometry.attributes.aAlpha.array as Float32Array;
		const size = this.geometry.attributes.aSize.array as Float32Array;

		// per-link geometry and colors, computed once per frame; links with
		// no visible motes (e.g. lines mode with nothing hovered) are skipped
		let anyVisible = false;
		const frames = this.links.map((link) => {
			const bright = style.brightness(link);
			if (bright <= 0) return null;
			const s = link.source as Endpoint;
			const t = link.target as Endpoint;
			if (typeof s === "string" || typeof t === "string" || s.x === undefined || t.x === undefined)
				return null;
			const a = [s.x ?? 0, s.y ?? 0, s.z ?? 0];
			const b = [t.x ?? 0, t.y ?? 0, t.z ?? 0];
			const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
			const len = Math.hypot(d[0], d[1], d[2]) || 1;
			const u = [d[0] / len, d[1] / len, d[2] / len];
			// two unit vectors perpendicular to the link
			const ref = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
			let v = [u[1] * ref[2] - u[2] * ref[1], u[2] * ref[0] - u[0] * ref[2], u[0] * ref[1] - u[1] * ref[0]];
			const vl = Math.hypot(v[0], v[1], v[2]) || 1;
			v = [v[0] / vl, v[1] / vl, v[2] / vl];
			const w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
			const [from, to] = style.colors(link);
			anyVisible = true;
			return { a, b, len, v, w, from: this.color(from), to: this.color(to), bright };
		});
		// all hidden, and already cleared last frame: nothing to do
		if (!anyVisible && this.cleared) return;
		this.cleared = !anyVisible;

		// only the visible links' motes are written, packed at the start of
		// the buffers, and only those are uploaded and drawn: hovering one
		// link in lines mode costs that link's motes, not the whole vault's
		let i = 0;
		const write = (m: Mote, f: NonNullable<(typeof frames)[number]>) => {
			const o = i * 3;
			const progress = (((m.phase + this.time * style.speed * m.speed) % 1) + 1) % 1;
			// position along the arc, source (0) to target (1); color follows
			// it, so a reversed mote starts in the target's color
			const t = m.reverse ? 1 - progress : progress;
			const bow = Math.max(m.bow * style.spread, m.minBow) * f.len;
			const cos = Math.cos(m.angle) * bow;
			const sin = Math.sin(m.angle) * bow;
			// control point: the midpoint pushed out around the link
			const c = [
				(f.a[0] + f.b[0]) / 2 + f.v[0] * cos + f.w[0] * sin,
				(f.a[1] + f.b[1]) / 2 + f.v[1] * cos + f.w[1] * sin,
				(f.a[2] + f.b[2]) / 2 + f.v[2] * cos + f.w[2] * sin,
			];
			const k0 = (1 - t) * (1 - t);
			const k1 = 2 * (1 - t) * t;
			const k2 = t * t;
			pos[o] = k0 * f.a[0] + k1 * c[0] + k2 * f.b[0];
			pos[o + 1] = k0 * f.a[1] + k1 * c[1] + k2 * f.b[1];
			pos[o + 2] = k0 * f.a[2] + k1 * c[2] + k2 * f.b[2];

			col[o] = f.from.r + (f.to.r - f.from.r) * t;
			col[o + 1] = f.from.g + (f.to.g - f.from.g) * t;
			col[o + 2] = f.from.b + (f.to.b - f.from.b) * t;

			// fade in at the source, out at the target, with a gentle twinkle
			// solid dots hold steady; soft motes twinkle
			const twinkle = 1 - 0.25 * (1 - style.solidity) * (1 - Math.sin(this.time * 3 + m.twinkle));
			alpha[i] = Math.sin(Math.PI * t) * twinkle * f.bright;
			size[i] = style.size * m.size;
			i++;
		};
		frames.forEach((f, link) => {
			if (!f) return;
			for (let m = this.linkStart[link]; m < this.linkStart[link + 1]; m++)
				write(this.motes[m], f);
		});

		this.geometry.setDrawRange(0, i);
		// an empty range would upload the whole buffer (WebGL2 reads a zero
		// length as "to the end"), and nothing is drawn anyway
		if (i === 0) return;
		const attributes = this.geometry.attributes;
		(
			[
				["position", 3],
				["aColor", 3],
				["aAlpha", 1],
				["aSize", 1],
			] as const
		).forEach(([name, itemSize]) => {
			const attribute = attributes[name];
			attribute.updateRange.offset = 0;
			attribute.updateRange.count = i * itemSize;
			attribute.needsUpdate = true;
		});
	}

	// forget cached colors (theme or cluster colors changed)
	public clearColors() {
		this.colorCache.clear();
	}

	private disposeObjects() {
		if (this.points) this.scene.remove(this.points);
		this.geometry?.dispose();
		this.material?.dispose();
		this.points = null;
		this.geometry = null;
		this.material = null;
		this.capacity = 0;
	}

	public dispose() {
		this.disposeObjects();
		this.links = [];
		this.motes = [];
		this.linkStart = [0];
	}
}
