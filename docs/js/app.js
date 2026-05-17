import { initTimingTab } from './timing/timing-tab.js';
import { initCreatorTab } from './creator/creator-tab.js';
import { installGlobalDropGuard } from './shared/file-drop.js';
import { startSession, endSession, isSessionActive, onSessionChange, isSupported } from './shared/session.js';

// タブ以外にファイルをドロップしてもブラウザが開かないようにガード
installGlobalDropGuard();

const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-panel');

tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    tabs.forEach(b => b.classList.toggle('is-active', b === btn));
    panels.forEach(p => p.classList.toggle('is-active', p.id === `panel-${target}`));
  });
});

initTimingTab();
initCreatorTab();

// ===== セッションフォルダ UI =====
const sessionBtn = document.getElementById('session-btn');
const sessionStatus = document.getElementById('session-status');

function updateSessionUI(label) {
  if (label) {
    sessionStatus.textContent = `保存先: 📁 ${label}`;
    sessionStatus.classList.add('is-active');
    sessionBtn.textContent = '× 終了';
    sessionBtn.title = 'セッションを終了して通常のダウンロードに戻す';
  } else {
    sessionStatus.textContent = '保存先: 📥 ダウンロード';
    sessionStatus.classList.remove('is-active');
    sessionBtn.textContent = '📁 セッションフォルダ…';
    sessionBtn.title = isSupported()
      ? 'フォルダを選んでセッション開始（録画・LRCがそこに保存される）'
      : 'このブラウザはフォルダ選択非対応（Chrome/Edge 86+ で利用可能）';
  }
}

sessionBtn.addEventListener('click', async () => {
  if (isSessionActive()) {
    endSession();
  } else {
    await startSession();
  }
});

onSessionChange(updateSessionUI);
updateSessionUI(null);
