// Small in-memory LRU for search responses. A Map keeps insertion order, so
// re-inserting on a hit moves the entry to the end and the first key is
// always the least recently used one.
export function createQueryCache(max = 50) {
	const entries = new Map();
	return {
		get(key) {
			if (!entries.has(key)) return undefined;
			const value = entries.get(key);
			entries.delete(key);
			entries.set(key, value);
			return value;
		},
		set(key, value) {
			entries.delete(key);
			entries.set(key, value);
			if (entries.size > max) entries.delete(entries.keys().next().value);
		},
		get size() {
			return entries.size;
		},
	};
}

// "  Robotics  Club " and "robotics club" are the same search.
export const normalizeQuery = (query) =>
	String(query ?? "").trim().toLowerCase().replace(/\s+/g, " ");
