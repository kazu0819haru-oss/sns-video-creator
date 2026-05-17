import { initTimingTab } from './timing/timing-tab.js';
import { initCreatorTab } from './creator/creator-tab.js';
import { installGlobalDropGuard } from './shared/file-drop.js';

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
