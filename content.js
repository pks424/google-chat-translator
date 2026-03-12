// Google Chat 번역 확장 프로그램 - Content Script
// chat.google.com + mail.google.com (Gmail 내장 Chat) 모두 지원

const KOREAN_REGEX = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
let currentInputBox = null;
let isTranslating = false;
let isSendingTranslated = false; // 시뮬레이션 Enter 재진입 방지
const attachedInputs = new WeakSet();
const processingMessages = new WeakSet(); // 중복 처리 방지

// 설정 불러오기
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['targetLang', 'outLang', 'autoTranslate', 'showOutgoingTranslation', 'cloudApiKey'], (result) => {
      resolve({
        targetLang:               result.targetLang    || 'ko',
        outLang:                  result.outLang       || 'en',
        autoTranslate:            result.autoTranslate !== false,
        showOutgoingTranslation:  result.showOutgoingTranslation === true,
        cloudApiKey:              result.cloudApiKey   || ''
      });
    });
  });
}

// Google Cloud Translation API (공식 - API 키 필요)
async function googleTranslateCloud(text, targetLang, sourceLang, apiKey) {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, target: targetLang, source: sourceLang === 'auto' ? undefined : sourceLang, format: 'text' })
  });
  if (!response.ok) throw new Error('Cloud 번역 요청 실패');
  const data = await response.json();
  const translated = data.data.translations[0].translatedText;
  const detectedLang = data.data.translations[0].detectedSourceLanguage || sourceLang;
  return { translated, detectedLang };
}

// Google 번역 (무료 API 폴백) - 감지된 언어코드도 함께 반환
async function googleTranslateFree(text, targetLang = 'en', sourceLang = 'auto') {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('번역 요청 실패');
  const data = await response.json();
  const translated = data[0].map(chunk => chunk[0]).join('');
  const detectedLang = data[2] || 'auto';
  return { translated, detectedLang };
}

// 번역 통합 함수: API 키 있으면 공식, 없으면 무료 사용
async function googleTranslate(text, targetLang = 'en', sourceLang = 'auto') {
  const settings = await getSettings();
  if (settings.cloudApiKey) {
    return googleTranslateCloud(text, targetLang, sourceLang, settings.cloudApiKey);
  }
  return googleTranslateFree(text, targetLang, sourceLang);
}

// Alt+T 수동 번역 (전송 없이 텍스트만 교체)
async function handleOutgoingTranslate() {
  if (isTranslating || !currentInputBox) return;
  const text = (currentInputBox.innerText || currentInputBox.textContent).trim();
  if (!text) return;

  isTranslating = true;
  try {
    const settings = await getSettings();
    const { translated, detectedLang } = await googleTranslate(text, settings.outLang, 'auto');
    if (detectedLang !== settings.outLang && translated) {
      replaceInputText(currentInputBox, translated);
    }
  } catch (err) {
    console.error('[GCT] 발신 번역 오류:', err);
  } finally {
    isTranslating = false;
  }
}

// 입력창인지 판별 (chat.google.com / Gmail 내장 Chat 공통)
function isChatInput(el) {
  if (el.getAttribute('contenteditable') !== 'true') return false;
  if (el.closest('.gct-translation')) return false; // 번역 뱃지 내부 제외

  const label  = (el.getAttribute('aria-label') || '').toLowerCase();
  const role   = (el.getAttribute('role') || '').toLowerCase();
  const tag    = el.tagName.toLowerCase();

  // aria-label 기반 판별
  if (label.includes('message') || label.includes('메시지') ||
      label.includes('reply')   || label.includes('답장')) return true;

  // 역할 기반 판별
  if (role === 'textbox') return true;

  // 부모 컨테이너 기반 판별 (chat.google.com)
  if (el.closest('[data-is-msg-input="true"]')) return true;

  // Gmail 내장 Chat: 채팅 패널 내부의 contenteditable
  if (el.closest('[jsname]') && tag === 'div') {
    // 충분한 크기의 입력 영역이면 채팅 입력으로 간주
    const rect = el.getBoundingClientRect();
    if (rect.width > 100 && rect.height > 20 && rect.height < 300) return true;
  }

  return false;
}

// 입력창 텍스트를 교체하는 공통 함수
function replaceInputText(inputBox, newText) {
  inputBox.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(inputBox);
  selection.removeAllRanges();
  selection.addRange(range);
  document.execCommand('insertText', false, newText);
  inputBox.dispatchEvent(new Event('input', { bubbles: true }));
}


function attachToInputBox(inputBox) {
  if (attachedInputs.has(inputBox)) return;
  attachedInputs.add(inputBox);

  inputBox.addEventListener('focus', () => {
    currentInputBox = inputBox;
  });

  // Enter 키 인터셉트: 언어 자동 감지 후 필요 시 번역 → 전송
  inputBox.addEventListener('keydown', async (e) => {
    // 우리가 직접 보낸 시뮬레이션 Enter는 무시
    if (isSendingTranslated) return;
    if (e.key !== 'Enter' || e.shiftKey || isTranslating) return;
    const text = (inputBox.innerText || inputBox.textContent).trim();
    if (!text) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    isTranslating = true;

    const sendEnter = () => {
      isSendingTranslated = true;
      inputBox.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13,
        bubbles: true, cancelable: true
      }));
      setTimeout(() => { isSendingTranslated = false; }, 200);
    };

    try {
      const settings = await getSettings();
      const { translated, detectedLang } = await googleTranslate(text, settings.outLang, 'auto');
      if (detectedLang !== settings.outLang) {
        replaceInputText(inputBox, translated);
      }
    } catch (err) {
      console.error('[GCT] 자동 번역 오류:', err);
    } finally {
      isTranslating = false;
      setTimeout(sendEnter, 80);
    }
  }, true);
}

// Alt+T 단축키 (버튼 방식 유지)
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key === 't' && currentInputBox) {
    e.preventDefault();
    handleOutgoingTranslate();
  }
});

// ─────────────────────────────────────────
// [수신] 상대방 메시지 자동 번역
// ─────────────────────────────────────────

function createTranslationBadge(translatedText) {
  const badge = document.createElement('div');
  badge.className = 'gct-translation';
  badge.textContent = translatedText;
  const icon = document.createElement('span');
  icon.className = 'gct-translation-icon';
  icon.textContent = '🌐 ';
  badge.prepend(icon);
  return badge;
}

async function translateIncomingMessage(msgElement) {
  // 이미 번역됐거나 현재 처리 중이면 스킵
  if (msgElement.dataset.gctDone) return;
  if (processingMessages.has(msgElement)) return;
  if (msgElement.querySelector('.gct-translation')) return;

  // 인용/답장 메시지: .wVNE5 quote 섹션을 제외하고 실제 메시지 텍스트만 추출
  // (인용 섹션에 "인용됨", "발신자" 등 한국어 UI 문자열이 포함되어 언어 감지 오류 방지)
  const quoteSection = msgElement.querySelector('.wVNE5');
  let text;
  if (quoteSection) {
    const clone = msgElement.cloneNode(true);
    const qs = clone.querySelector('.wVNE5');
    if (qs) qs.remove();
    text = (clone.innerText || clone.textContent || '').trim();
  } else {
    text = (msgElement.innerText || msgElement.textContent || '').trim();
  }

  // 텍스트가 없거나 짧으면 done 표시 없이 리턴 → 다음 MutationObserver 호출 때 재시도
  if (!text || text.length < 3) return;

  // 텍스트가 확인된 후에 처리 중 표시
  processingMessages.add(msgElement);
  msgElement.dataset.gctDone = '1';

  try {
    const settings = await getSettings();
    if (!settings.autoTranslate) return;

    const { translated, detectedLang } = await googleTranslate(text, settings.targetLang, 'auto');

    // 이미 목표 언어이면 번역 표시 안 함
    if (detectedLang === settings.targetLang) return;
    if (!translated || translated.trim().toLowerCase() === text.toLowerCase()) return;

    const badge = createTranslationBadge(translated);
    msgElement.appendChild(badge);
  } catch (err) {
    console.error('[GCT] 수신 번역 오류:', err);
    // 실패 시 done 해제해서 재시도 가능하게
    delete msgElement.dataset.gctDone;
  } finally {
    processingMessages.delete(msgElement);
  }
}

// 메시지 요소 판별
// chat.google.com, mail.google.com 내장 Chat 공통으로 동작하도록
// 실제 DOM 분석: jsname="bgckF" 가 메시지 텍스트 컨테이너
function findMessageElements() {
  const candidates = new Set();

  // 1순위: jsname="bgckF" — 실제 Google Chat 메시지 텍스트 컨테이너 (확인된 DOM 구조)
  document.querySelectorAll('div[jsname="bgckF"]').forEach(el => candidates.add(el));

  // 2순위: data-message-id 컨테이너 내부 — 다른 버전 대비 fallback
  document.querySelectorAll(
    '[data-message-id] [dir="auto"], [data-message-id] [dir="ltr"], [data-message-id] p'
  ).forEach(el => candidates.add(el));

  // 3순위: dir="auto" 일반 요소 — 기타 환경 / 독립형 chat.google.com 대비
  document.querySelectorAll('div[dir="auto"], span[dir="auto"]').forEach(el => candidates.add(el));

  const results = [];
  candidates.forEach((el) => {
    if (el.closest('.gct-translation') || el.classList.contains('gct-translation')) return;
    if (el.closest('[contenteditable]')) return;
    if (el.closest('button, a, [role="button"], [role="menuitem"]')) return;
    if (el.dataset.gctDone) return;
    // 내가 보낸 메시지 제외: jsname="Ne3sFf" 조상에 Pxe3Yd 클래스가 있으면 outgoing
    const bubble = el.closest('[jsname="Ne3sFf"]');
    if (bubble && bubble.classList.contains('Pxe3Yd')) return;
    const text = (el.innerText || el.textContent || '').trim();
    if (text.length === 0) return;
    results.push(el);
  });

  return results;
}

// 내가 보낸 메시지 요소만 반환 (Pxe3Yd 클래스 = outgoing)
function findOutgoingElements() {
  const results = [];
  document.querySelectorAll('div[jsname="bgckF"]').forEach((el) => {
    if (el.dataset.gctDone) return;
    if (el.closest('.gct-translation')) return;
    if (el.querySelector('.gct-translation')) return;
    const bubble = el.closest('[jsname="Ne3sFf"]');
    if (!bubble || !bubble.classList.contains('Pxe3Yd')) return;
    const text = (el.innerText || el.textContent || '').trim();
    if (!text) return;
    results.push(el);
  });
  return results;
}

async function processNewMessages() {
  findMessageElements().forEach(translateIncomingMessage);

  // showOutgoingTranslation 설정이 ON일 때만 발신 메시지도 번역 뱃지 표시
  const settings = await getSettings();
  if (settings.showOutgoingTranslation) {
    findOutgoingElements().forEach(translateIncomingMessage);
  }
}

// ─────────────────────────────────────────
// MutationObserver: 입력창 + 메시지 통합 감지
// ─────────────────────────────────────────

function scanInputs() {
  document.querySelectorAll('[contenteditable="true"]').forEach((el) => {
    if (isChatInput(el)) attachToInputBox(el);
  });
}

function observeChat() {
  const observer = new MutationObserver(() => {
    scanInputs();
    processNewMessages();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// 초기화
observeChat();
setTimeout(() => { scanInputs(); processNewMessages(); }, 2000);
console.log('[GCT] Google Chat 번역기 활성화 - chat.google.com + mail.google.com 지원');
