// Shallow compare for nested objects
/* eslint-disable @typescript-eslint/no-explicit-any */
const shallowCompare = (obj1: any, obj2: any): boolean => {
	if (!obj1 || !obj2) return obj1 == obj2;
	else if (obj1 instanceof Object && obj2 instanceof Object) {
		return (
			Object.keys(obj1).length === Object.keys(obj2).length &&
			Object.keys(obj1).every(
				(key) =>
					obj2.hasOwnProperty(key) &&
					shallowCompare(obj1[key], obj2[key])
			)
		);
	} else return obj1 == obj2;
};

export default shallowCompare;
