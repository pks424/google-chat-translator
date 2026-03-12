const outLangSelect              = document.getElementById('outLang');
const targetLangSelect           = document.getElementById('targetLang');
const autoTranslateChk           = document.getElementById('autoTranslate');
const showOutgoingTranslationChk = document.getElementById('showOutgoingTranslation');
const saveBtn                    = document.getElementById('saveBtn');
const statusEl                   = document.getElementById('status');
const setupBanner                = document.getElementById('setupBanner');

// 저장된 설정 불러오기
chrome.storage.local.get(['outLang', 'targetLang', 'autoTranslate', 'showOutgoingTranslation', 'initialized'], (result) => {
  // 최초 설치 여부 확인 → 안내 배너 표시
  if (!result.initialized) {
    setupBanner.classList.add('visible');
  }

  outLangSelect.value    = result.outLang    || 'en';
  targetLangSelect.value = result.targetLang || 'ko';
  autoTranslateChk.checked           = result.autoTranslate !== false;
  showOutgoingTranslationChk.checked  = result.showOutgoingTranslation === true;
});

// 저장 버튼
saveBtn.addEventListener('click', () => {
  const settings = {
    outLang:                  outLangSelect.value,
    targetLang:               targetLangSelect.value,
    autoTranslate:            autoTranslateChk.checked,
    showOutgoingTranslation:  showOutgoingTranslationChk.checked,
    initialized:              true
  };

  chrome.storage.local.set(settings, () => {
    setupBanner.classList.remove('visible');
    showStatus('✓ 설정이 저장되었습니다! 페이지를 새로고침해주세요.', 'success');
  });
});

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  setTimeout(() => { statusEl.className = 'status'; }, 4000);
}
