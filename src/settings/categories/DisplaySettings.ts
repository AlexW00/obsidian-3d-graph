export class DisplaySettings {
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
		this.nodeSize = nodeSize ?? this.nodeSize;
		this.linkThickness = linkThickness ?? this.linkThickness;
		this.particleSize = particleSize ?? this.particleSize;
		this.particleCount = particleCount ?? this.particleCount;
	}

	public static fromStore(store: any) {
		return new DisplaySettings(
			store?.nodeSize,
			store?.linkThickness,
			store?.particleSize,
			store?.particleCount
		);
	}

	public toObject() {
		return {
			nodeSize: this.nodeSize,
			linkThickness: this.linkThickness,
			particleSize: this.particleSize,
			particleCount: this.particleCount,
		};
	}
}
