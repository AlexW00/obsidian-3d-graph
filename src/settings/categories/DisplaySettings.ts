export class DisplaySettings {
	// graph options
	nodeSize = 4;
	linkThickness = 5;
	particleSize = 6;
	particleCount = 4;

	constructor(
		nodeSize?: number,
		linkThickness?: number,
		particleSize?: number,
		particleCount?: number
	) {
		this.nodeSize = nodeSize || this.nodeSize;
		this.linkThickness = linkThickness || this.linkThickness;
		this.particleSize = particleSize || this.particleSize;
		this.particleCount = particleCount || this.particleCount;
	}
}
