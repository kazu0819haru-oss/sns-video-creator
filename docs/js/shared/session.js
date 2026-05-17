// セッションフォルダ管理。
// File System Access API（Chrome/Edge 86+）でユーザーが選んだフォルダ配下に
// 「session-YYYYMMDD-HHmmss」サブフォルダを作り、録画ファイル・LRC を保存する。
// 非対応ブラウザではダウンロードフォルダにフォールバック。

let rootHandle = null;
let sessionHandle = null;
let sessionLabel = null;
const listeners = new Set();

export function isSupported() {
  return typeof window.showDirectoryPicker === 'function';
}

export function getSessionLabel() {
  return sessionLabel;
}

export function isSessionActive() {
  return sessionHandle !== null;
}

export function onSessionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn(sessionLabel);
}

function formatTs(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export async function startSession() {
  if (!isSupported()) {
    alert('このブラウザはフォルダ選択に対応していません。\nChrome / Edge 86+ をお使いください。\n（通常のダウンロードは引き続き動作します）');
    return false;
  }
  try {
    rootHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    const ts = formatTs(new Date());
    const folderName = `session-${ts}`;
    sessionHandle = await rootHandle.getDirectoryHandle(folderName, { create: true });
    sessionLabel = `${rootHandle.name}/${folderName}`;
    notify();
    return true;
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error('Session start failed:', e);
      alert('セッションフォルダの作成に失敗しました: ' + e.message);
    }
    return false;
  }
}

export function endSession() {
  rootHandle = null;
  sessionHandle = null;
  sessionLabel = null;
  notify();
}

// Blob をセッションフォルダに保存。失敗時 or セッションなしならダウンロードにフォールバック
export async function saveBlob(blob, filename) {
  if (sessionHandle) {
    try {
      const fileHandle = await sessionHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { savedTo: 'session', path: `${sessionLabel}/${filename}` };
    } catch (e) {
      console.error('Session save failed, falling back to download:', e);
    }
  }
  // Fallback to download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { savedTo: 'download', path: filename };
}
