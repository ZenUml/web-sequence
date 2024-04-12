export default function ensure(condition, message) {
  if (typeof condition === 'function') {
    if (!condition()) {
      throw new Error(message);
    }
  } else {
    throw new Error('`condition` must be a function.');
  }
}
