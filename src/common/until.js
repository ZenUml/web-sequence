export default function until(arr, fn) {
	const l = arr.length;
	let i = 0;
	while (i < l && !fn(arr[i])) {
		i++;
	}
	return arr.slice(0, i);
}
