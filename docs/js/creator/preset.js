// Creator のスタイル設定一式を名前付きで localStorage に保存・読込・削除
const KEY = 'av_creator_presets';

export function getAllPresets() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

export function listPresetNames() {
  return Object.keys(getAllPresets()).sort();
}

export function savePreset(name, data) {
  if (!name) return false;
  const presets = getAllPresets();
  presets[name] = { ...data, _savedAt: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(presets));
    return true;
  } catch (e) {
    console.error('preset save failed:', e);
    alert('プリセット保存に失敗しました（容量超過の可能性）');
    return false;
  }
}

export function loadPreset(name) {
  const presets = getAllPresets();
  return presets[name] || null;
}

export function deletePreset(name) {
  const presets = getAllPresets();
  delete presets[name];
  try {
    localStorage.setItem(KEY, JSON.stringify(presets));
    return true;
  } catch (_) {
    return false;
  }
}
