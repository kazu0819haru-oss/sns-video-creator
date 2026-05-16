const REGISTRY = [];

export function registerStyle(id, label, drawFn) {
  REGISTRY.push({ id, label, drawFn });
}

export function getStyles() {
  return REGISTRY.slice();
}

export function getStyleById(id) {
  return REGISTRY.find(s => s.id === id);
}
