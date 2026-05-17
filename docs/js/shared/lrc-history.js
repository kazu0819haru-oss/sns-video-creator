// LRC ファイルの履歴を localStorage に保持
const KEY = 'av_lrc_history';
const MAX_ENTRIES = 12;

export function getLrcHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function addToLrcHistory(name, content) {
  if (!name || !content) return;
  const hist = getLrcHistory().filter(h => h.name !== name);
  hist.unshift({ name, content, date: new Date().toISOString() });
  while (hist.length > MAX_ENTRIES) hist.pop();
  try {
    localStorage.setItem(KEY, JSON.stringify(hist));
  } catch (e) {
    console.warn('LRC history save failed:', e);
  }
}

export function clearLrcHistory() {
  localStorage.removeItem(KEY);
}

export function getLrcEntry(idx) {
  const hist = getLrcHistory();
  return hist[idx] || null;
}
