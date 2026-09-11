/**
 * Immutable nested update: returns a new object/array with the value at
 * `path` (e.g. ["system_architecture", "components", 2, "name"]) replaced,
 * cloning only the branches along the way. Used by the TDD editor so
 * editing one field doesn't require a full deep-clone-and-diff dance.
 */
export function setAtPath(obj, path, value) {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  clone[head] = setAtPath(obj?.[head], rest, value);
  return clone;
}
