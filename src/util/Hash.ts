const hash = (str: string): string => {
	let hash = 0, i, chr;
	if (str.length === 0) return hash.toString();
	for (i = 0; i < str.length; i++) {
		chr   = str.charCodeAt(i);
		hash  = ((hash << 5) - hash) + chr;
		hash |= 0; // Convert to 32bit integer
	}
	return hash.toString();
}

export default hash;
