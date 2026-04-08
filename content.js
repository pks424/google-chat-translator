// Google Chat 번역 확장 프로그램 - Content Script
// chat.google.com + mail.google.com (Gmail 내장 Chat) 모두 지원

const KOREAN_REGEX = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
let currentInputBox = null;
let isTranslating = false;
let isSendingTranslated = false; // 시뮬레이션 Enter 재진입 방지
const attachedInputs = new WeakSet();
const processingMessages = new WeakSet(); // 중복 처리 방지

// ─── 채팅방별 번역 ON/OFF ───
let roomTranslateEnabled = true;
const disabledRooms = new Set();

function getCurrentRoomId() {
  // 1. chat.google.com: /chat/ROOM_ID 또는 /space/ROOM_ID
  const pathMatch = location.href.match(/\/chat\/([^/?#]+)|\/space\/([^/?#]+)/);
  if (pathMatch) return pathMatch[1] || pathMatch[2];

  // 2. Gmail 해시: #chat/space/ROOM_ID 또는 #chat/dm/USER_ID
  const hashMatch = location.hash.match(/chat\/(?:space|dm)\/([^/?#&]+)/);
  if (hashMatch) return hashMatch[1];

  // 3. iframe 내부: 부모 프레임 URL에서 추출 시도
  try {
    const parentHash = window.parent?.location?.hash || '';
    const parentMatch = parentHash.match(/chat\/(?:space|dm)\/([^/?#&]+)/);
    if (parentMatch) return parentMatch[1];
  } catch (e) { /* cross-origin iframe */ }

  return location.href;
}

function isRoomTranslateEnabled() {
  return !disabledRooms.has(getCurrentRoomId());
}

function toggleRoomTranslate() {
  const roomId = getCurrentRoomId();
  if (disabledRooms.has(roomId)) {
    disabledRooms.delete(roomId);
    showToast('이 채팅방 번역 ON', 'info', 2000);
    // 관찰 목록 초기화 → 화면 내 메시지 재번역
    observedElements = new WeakSet();
    processNewMessages();
  } else {
    disabledRooms.add(roomId);
    showToast('이 채팅방 번역 OFF', 'error', 2000);
    // OFF 시 기존 번역 뱃지 즉시 제거
    document.querySelectorAll('.gct-translation').forEach(el => el.remove());
    document.querySelectorAll('[data-gct-done]').forEach(el => delete el.dataset.gctDone);
  }
  updateToggleButton();
  try { chrome.storage?.local?.set({ disabledRooms: Array.from(disabledRooms) }); } catch (e) { /* context invalidated */ }
}

function updateToggleButton() {
  const btn = document.getElementById('gct-room-toggle');
  if (!btn) return;
  const enabled = isRoomTranslateEnabled();
  btn.textContent = enabled ? '🌐 번역 ON' : '🚫 번역 OFF';
  btn.style.background = enabled ? '#1a73e8' : '#5f6368';
}

// 플로팅 버튼: 설정에 따라 생성/제거 통합 함수
function syncToggleButton(show) {
  // 최상위 Gmail 프레임에서는 동작 안 함
  if (location.hostname === 'mail.google.com' && window === window.top) return;

  const existing = document.getElementById('gct-room-toggle');
  if (!show) {
    if (existing) existing.remove();
    return;
  }
  if (existing) return; // 이미 있으면 생성 안 함

  const btn = document.createElement('button');
  btn.id = 'gct-room-toggle';
  btn.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:999999;padding:6px 12px;color:#fff;border:none;border-radius:20px;font-size:12px;font-family:"Google Sans",sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);transition:background 0.2s;';
  btn.onclick = toggleRoomTranslate;
  document.body.appendChild(btn);
  updateToggleButton();

  // Gmail: 부모 프레임 해시 변경 시 토글 상태 갱신
  try {
    if (window.parent && window.parent !== window) {
      window.parent.addEventListener('hashchange', () => updateToggleButton());
    }
  } catch (e) { /* cross-origin */ }
}

function ensureToggleButton() {
  try {
    chrome.storage?.local?.get(['showFloatingBtn', 'disabledRooms'], (r) => {
      if (r?.disabledRooms) r.disabledRooms.forEach(id => disabledRooms.add(id));
      syncToggleButton(r?.showFloatingBtn !== false);
    });
  } catch (e) { /* context invalidated */ }
}

// ─── 번역 캐시 (메모리 내, 최대 500건) ───
const translationCache = new Map();
const CACHE_MAX_SIZE = 500;

function getCacheKey(text, targetLang, sourceLang) {
  return `${targetLang}|${sourceLang}|${text}`;
}

function getCachedTranslation(text, targetLang, sourceLang) {
  const key = getCacheKey(text, targetLang, sourceLang);
  return translationCache.get(key) || null;
}

function setCachedTranslation(text, targetLang, sourceLang, result) {
  const key = getCacheKey(text, targetLang, sourceLang);
  if (translationCache.size >= CACHE_MAX_SIZE) {
    // 가장 오래된 항목 삭제
    const firstKey = translationCache.keys().next().value;
    translationCache.delete(firstKey);
  }
  translationCache.set(key, result);
}

// 설정 불러오기
const DEFAULT_SETTINGS = { targetLang: 'ko', outLang: 'en', autoTranslate: true, autoOutgoing: true, showOutgoingTranslation: false, cloudApiKey: '', aiProvider: 'google_free', aiApiKey: '', glossary: [], translationTone: 'natural', showFloatingBtn: true };
async function getSettings() {
  return new Promise((resolve) => {
    if (!chrome.runtime?.id) return resolve({ ...DEFAULT_SETTINGS });
    try {
      chrome.storage.local.get(['targetLang', 'outLang', 'autoTranslate', 'autoOutgoing', 'showOutgoingTranslation', 'cloudApiKey', 'aiProvider', 'aiApiKey', 'glossary', 'translationTone', 'showFloatingBtn'], (result) => {
        if (chrome.runtime.lastError) return resolve({ ...DEFAULT_SETTINGS });
        resolve({
          targetLang:               result.targetLang    || 'ko',
          outLang:                  result.outLang       || 'en',
          autoTranslate:            result.autoTranslate !== false,
          autoOutgoing:             result.autoOutgoing !== false,
          showOutgoingTranslation:  result.showOutgoingTranslation === true,
          cloudApiKey:              result.cloudApiKey   || '',
          aiProvider:               result.aiProvider    || 'google_free',
          aiApiKey:                 result.aiApiKey      || '',
          glossary:                 result.glossary      || [],
          translationTone:          result.translationTone || 'natural',
          showFloatingBtn:          result.showFloatingBtn !== false
        });
      });
    } catch (e) {
      resolve({ ...DEFAULT_SETTINGS });
    }
  });
}

// ─── 용어 사전: 번역 전 치환 → 번역 후 복원 ───
function applyGlossary(text, glossary) {
  if (!glossary || glossary.length === 0) return { text, placeholders: [] };
  const placeholders = [];
  let processed = text;
  glossary.forEach((entry, i) => {
    const regex = new RegExp(entry.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const placeholder = `§§${i}§§`;
    if (regex.test(processed)) {
      placeholders.push({ placeholder, to: entry.to || entry.from });
      processed = processed.replace(regex, placeholder);
    }
  });
  return { text: processed, placeholders };
}

function restoreGlossary(translated, placeholders) {
  let result = translated;
  placeholders.forEach(({ placeholder, to }) => {
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
  });
  return result;
}

// ─── 언어 자동 감지 (스크립트/문자 기반) ───
function detectLanguageByScript(text) {
  const cleaned = text.replace(/[\s\d\p{P}\p{S}]/gu, '');
  if (!cleaned) return 'unknown';

  let ko = 0, ja = 0, zhSimp = 0, zhTrad = 0, latin = 0, cyrillic = 0, arabic = 0, thai = 0;
  for (const ch of cleaned) {
    const code = ch.codePointAt(0);
    if (code >= 0xAC00 && code <= 0xD7AF) ko++;        // 한글 음절
    else if (code >= 0x3040 && code <= 0x30FF) ja++;    // 히라가나/가타카나
    else if (code >= 0x4E00 && code <= 0x9FFF) zhSimp++;// CJK (중국어/한자)
    else if (code >= 0x0041 && code <= 0x024F) latin++;  // 라틴
    else if (code >= 0x0400 && code <= 0x04FF) cyrillic++;
    else if (code >= 0x0600 && code <= 0x06FF) arabic++;
    else if (code >= 0x0E00 && code <= 0x0E7F) thai++;
  }

  const total = cleaned.length;
  if (ko / total > 0.3) return 'ko';
  if (ja / total > 0.2) return 'ja';
  if (zhSimp / total > 0.3) return 'zh-CN';
  if (latin / total > 0.5) return 'latin'; // en/de/fr/es 등 구분 불가 → 'latin'
  if (cyrillic / total > 0.3) return 'ru';
  if (arabic / total > 0.3) return 'ar';
  if (thai / total > 0.3) return 'th';
  return 'unknown';
}

// 컨텍스트 수집: 현재 메시지 주변의 최근 메시지 텍스트
function getConversationContext(msgElement, maxMessages = 3) {
  const allMessages = document.querySelectorAll('[data-message-id], div[jsname="bgckF"], [role="row"] [dir="auto"]');
  const msgs = Array.from(allMessages);
  const idx = msgs.indexOf(msgElement);
  if (idx <= 0) return '';

  const context = [];
  const start = Math.max(0, idx - maxMessages);
  for (let i = start; i < idx; i++) {
    const text = (msgs[i].innerText || msgs[i].textContent || '').trim();
    // 번역 뱃지 제외
    if (text && !msgs[i].classList.contains('gct-translation') && text.length < 500) {
      context.push(text);
    }
  }
  return context.length > 0 ? context.join('\n') : '';
}

// 톤 프롬프트 생성
function getToneInstruction(tone) {
  const toneMap = {
    natural: '',
    formal: 'Use formal, polite language (존댓말/경어). ',
    informal: 'Use casual, informal language (반말). ',
    business: 'Use professional business tone. ',
    friendly: 'Use friendly, warm conversational tone. '
  };
  return toneMap[tone] || '';
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

// 공통 언어 이름 매핑
const LANG_NAMES = { ko: '한국어', en: 'English', ja: '日本語', 'zh-CN': '简体中文', 'zh-TW': '繁體中文', de: 'Deutsch', fr: 'Français', es: 'Español' };

// AI 번역 공통: rate limit 자동 재시도 (최대 3회, 지수 백오프)
async function fetchWithRetry(fetchFn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetchFn();
    if (response.ok) return response;
    if (response.status === 429 || response.status === 529 || response.status >= 500) {
      const waitMs = Math.min(2000 * Math.pow(2, attempt), 10000); // 2s, 4s, 8s (최대 10s)
      // 재시도 로그 생략 (chrome://extensions 오류 페이지 노출 방지)
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    throw new Error(`API 요청 실패: ${response.status}`);
  }
  throw new Error('API rate limit 초과 - 최대 재시도 횟수 도달');
}

// AI 언어 감지 헬퍼
function detectLangFromResult(text, translated, targetLang, sourceLang) {
  return translated.toLowerCase() === text.toLowerCase() ? targetLang : (sourceLang === 'auto' ? 'unknown' : sourceLang);
}

// Gemini API 번역
async function geminiTranslate(text, targetLang, sourceLang, apiKey, tone = 'natural', context = '') {
  const targetName = LANG_NAMES[targetLang] || targetLang;
  const toneInst = getToneInstruction(tone);
  const contextInst = context ? `Previous messages for context:\n${context}\n\nNow translate this message:\n` : '';
  const prompt = `Translate the following text to ${targetName}. ${toneInst}Return ONLY the translated text, nothing else.\n\n${contextInst}${text}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetchWithRetry(() => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  }));
  const data = await response.json();
  const translated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!translated) throw new Error('Gemini 응답 없음');
  return { translated, detectedLang: detectLangFromResult(text, translated, targetLang, sourceLang) };
}

// Claude API 번역
async function claudeTranslate(text, targetLang, sourceLang, apiKey, tone = 'natural', context = '') {
  const targetName = LANG_NAMES[targetLang] || targetLang;
  const toneInst = getToneInstruction(tone);
  const contextInst = context ? `Previous messages for context:\n${context}\n\nNow translate this message:\n` : '';
  const prompt = `Translate the following text to ${targetName}. ${toneInst}Return ONLY the translated text, nothing else.\n\n${contextInst}${text}`;

  const response = await fetchWithRetry(() => fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  }));
  const data = await response.json();
  const translated = data.content?.[0]?.text?.trim();
  if (!translated) throw new Error('Claude 응답 없음');
  return { translated, detectedLang: detectLangFromResult(text, translated, targetLang, sourceLang) };
}

// OpenAI API 번역
async function openaiTranslate(text, targetLang, sourceLang, apiKey, tone = 'natural', context = '') {
  const targetName = LANG_NAMES[targetLang] || targetLang;
  const toneInst = getToneInstruction(tone);
  const contextInst = context ? ` Use this conversation context for better translation:\n${context}` : '';

  const response = await fetchWithRetry(() => fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `You are a translator. Translate the user's text to ${targetName}. ${toneInst}Return ONLY the translated text, nothing else.${contextInst}` },
        { role: 'user', content: text }
      ],
      max_tokens: 1024
    })
  }));
  const data = await response.json();
  const translated = data.choices?.[0]?.message?.content?.trim();
  if (!translated) throw new Error('OpenAI 응답 없음');
  return { translated, detectedLang: detectLangFromResult(text, translated, targetLang, sourceLang) };
}

// Google Cloud Translation에도 재시도 적용
async function googleTranslateCloudRetry(text, targetLang, sourceLang, apiKey) {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
  const response = await fetchWithRetry(() => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, target: targetLang, source: sourceLang === 'auto' ? undefined : sourceLang, format: 'text' })
  }));
  const data = await response.json();
  const translated = data.data.translations[0].translatedText;
  const detectedLang = data.data.translations[0].detectedSourceLanguage || sourceLang;
  return { translated, detectedLang };
}

// 번역 통합 함수: 캐시 → 용어 사전 → AI 프로바이더 분기
async function googleTranslate(text, targetLang = 'en', sourceLang = 'auto', msgElement = null) {
  // 캐시 확인
  const cached = getCachedTranslation(text, targetLang, sourceLang);
  if (cached) return cached;

  const settings = await getSettings();

  // 용어 사전 적용: 번역 전 치환
  const { text: processedText, placeholders } = applyGlossary(text, settings.glossary);

  const tone = settings.translationTone || 'natural';
  // AI 엔진일 때만 컨텍스트 수집
  const isAI = ['gemini', 'claude', 'openai'].includes(settings.aiProvider);
  const context = (isAI && msgElement) ? getConversationContext(msgElement) : '';

  let result;
  switch (settings.aiProvider) {
    case 'gemini':
      if (settings.aiApiKey) { result = await geminiTranslate(processedText, targetLang, sourceLang, settings.aiApiKey, tone, context); break; }
      break;
    case 'claude':
      if (settings.aiApiKey) { result = await claudeTranslate(processedText, targetLang, sourceLang, settings.aiApiKey, tone, context); break; }
      break;
    case 'openai':
      if (settings.aiApiKey) { result = await openaiTranslate(processedText, targetLang, sourceLang, settings.aiApiKey, tone, context); break; }
      break;
    case 'google_cloud':
      if (settings.cloudApiKey) { result = await googleTranslateCloudRetry(processedText, targetLang, sourceLang, settings.cloudApiKey); break; }
      break;
  }
  if (!result) result = await googleTranslateFree(processedText, targetLang, sourceLang);

  // 용어 사전 복원
  if (placeholders.length > 0) {
    result = { ...result, translated: restoreGlossary(result.translated, placeholders) };
  }

  // 캐시 저장
  setCachedTranslation(text, targetLang, sourceLang, result);
  return result;
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

  // 이메일 작성창 제외 (Gmail compose)
  if (el.closest('[role="dialog"] [aria-label]')) {
    const dialogLabel = (el.closest('[role="dialog"]')?.getAttribute('aria-label') || '').toLowerCase();
    if (dialogLabel.includes('new message') || dialogLabel.includes('compose')) return false;
  }
  if (el.closest('.Am.Al.editable')) return false; // Gmail 이메일 본문

  const label  = (el.getAttribute('aria-label') || '').toLowerCase();
  const role   = (el.getAttribute('role') || '').toLowerCase();
  const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();

  // aria-label 기반 판별 (chat.google.com)
  if (label.includes('message') || label.includes('메시지') ||
      label.includes('reply')   || label.includes('답장')) return true;

  // placeholder 기반 (일부 Gmail Chat 빌드)
  if (placeholder.includes('message') || placeholder.includes('메시지')) return true;

  // 역할 기반 판별 — role="textbox" 는 거의 확실히 입력창
  if (role === 'textbox') {
    // 단, Gmail 이메일 검색창/To 필드 등 제외
    if (el.closest('[role="search"]')) return false;
    if (el.closest('header')) return false;
    return true;
  }

  // 부모 컨테이너 기반 판별 (chat.google.com)
  if (el.closest('[data-is-msg-input="true"]')) return true;

  // Gmail 내장 Chat: jsaction 이나 jsname 부모 안에 있는 div contenteditable
  if (el.closest('[jsname]') && el.tagName.toLowerCase() === 'div') {
    const rect = el.getBoundingClientRect();
    if (rect.width > 100 && rect.height > 10 && rect.height < 300) {
      // 채팅 패널 영역 내부인지 확인 (화면 우측 하단 채팅 창)
      if (rect.left > window.innerWidth * 0.4 || rect.top > window.innerHeight * 0.5) return true;
    }
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
    // 채팅방별 번역 OFF면 원본 전송
    if (!isRoomTranslateEnabled()) return;

    const text = (inputBox.innerText || inputBox.textContent).trim();
    if (!text) return;

    // preventDefault는 반드시 동기적으로 먼저 호출 (async 이후에는 효과 없음)
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
      // 발신 자동 번역 OFF면 번역 없이 그대로 전송
      if (!settings.autoOutgoing) {
        isTranslating = false;
        sendEnter();
        return;
      }
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

// 토스트 알림 (중복 방지)
let toastTimer = null;
function showToast(message, type = 'info', duration = 3000) {
  let toast = document.querySelector('.gct-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'gct-toast';
    document.body.appendChild(toast);
  }
  if (toastTimer) clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = 'gct-toast' + (type === 'error' ? ' error' : '');
  requestAnimationFrame(() => toast.classList.add('show'));
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    toastTimer = null;
  }, duration);
}

// ─────────────────────────────────────────
// [수신] 상대방 메시지 자동 번역
// ─────────────────────────────────────────

function createTranslationBadge(translatedText, isError = false) {
  const badge = document.createElement('div');
  badge.className = 'gct-translation' + (isError ? ' gct-error' : '');
  badge.textContent = translatedText;
  const icon = document.createElement('span');
  icon.className = 'gct-translation-icon';
  icon.textContent = isError ? '⚠️ ' : '🌐 ';
  badge.prepend(icon);

  return badge;
}

async function translateIncomingMessage(msgElement, isOutgoing = false) {
  // 채팅방별 번역 OFF 체크
  if (!isRoomTranslateEnabled()) return;
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
    if (!isOutgoing && !settings.autoTranslate) return;

    // 사전 언어 감지: 이미 목표 언어면 API 호출 자체를 스킵
    const preDetected = detectLanguageByScript(text);
    if (preDetected === settings.targetLang) return;

    const { translated, detectedLang } = await googleTranslate(text, settings.targetLang, 'auto', msgElement);

    // API 감지 결과로도 이미 목표 언어이면 번역 표시 안 함
    if (detectedLang === settings.targetLang) return;
    if (!translated || translated.trim().toLowerCase() === text.toLowerCase()) return;

    const badge = createTranslationBadge(translated);
    msgElement.appendChild(badge);
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('rate limit') || msg.includes('429')) {
      showToast('⚠️ API 사용량 초과 - 잠시 후 자동 재시도됩니다', 'error', 3000);
      setTimeout(() => { delete msgElement.dataset.gctDone; }, 30000);
    } else if (msg.includes('401') || msg.includes('403')) {
      showToast('⚠️ API 키 인증 실패 - 팝업에서 키를 확인하세요', 'error', 4000);
      console.log('[GCT] API 인증 오류:', msg);
    } else {
      showToast('⚠️ 번역 오류 발생', 'error', 2000);
      console.log('[GCT] 수신 번역 오류:', msg);
      delete msgElement.dataset.gctDone;
    }
  } finally {
    processingMessages.delete(msgElement);
  }
}

// 메시지 요소 판별
// chat.google.com, mail.google.com 내장 Chat 공통으로 동작하도록
function findMessageElements() {
  const candidates = new Set();

  // 1순위: jsname="bgckF" — chat.google.com 메시지 텍스트 컨테이너 (확인된 DOM 구조)
  document.querySelectorAll('div[jsname="bgckF"]').forEach(el => candidates.add(el));

  // 2순위: data-message-id 컨테이너 내부 — 다른 버전 대비 fallback
  document.querySelectorAll(
    '[data-message-id] [dir="auto"], [data-message-id] [dir="ltr"], [data-message-id] p'
  ).forEach(el => candidates.add(el));

  // 3순위: Gmail 내장 Chat / role="row" 내부
  document.querySelectorAll('[role="row"] [dir="auto"]').forEach(el => candidates.add(el));

  // 4순위: dir="auto" 일반 요소 — 기타 환경 / 독립형 chat.google.com 대비
  document.querySelectorAll('div[dir="auto"], span[dir="auto"]').forEach(el => candidates.add(el));

  // 5순위: jsname="r4nke" — Gmail Chat 패널 메시지 텍스트 (알려진 일부 DOM)
  document.querySelectorAll('div[jsname="r4nke"], div[jsname="K7OJed"]').forEach(el => candidates.add(el));

  const results = [];
  candidates.forEach((el) => {
    if (el.closest('.gct-translation') || el.classList.contains('gct-translation')) return;
    if (el.closest('[contenteditable]')) return;
    if (el.closest('button, a, [role="button"], [role="menuitem"], [role="option"]')) return;
    if (el.dataset.gctDone) return;
    // 사이드바 / 채팅 목록 / 네비게이션 영역 제외
    if (el.closest('nav, [role="navigation"], aside')) return;
    // Google Chat 대화 목록 아이템 제외 (확인된 DOM: .wzx93, .ajDw2c, [role="link"].LoYJxb)
    if (el.closest('.wzx93, .ajDw2c, .LoYJxb, .Y2L8Ee, .teTAFe, .n5yyEc')) return;
    // Gmail 이메일 본문 제외
    if (el.closest('.a3s, .Am.Al.editable, [role="main"] .ii')) return;
    // 내가 보낸 메시지 제외: jsname="Ne3sFf" 조상에 Pxe3Yd 클래스가 있으면 outgoing
    const bubble = el.closest('[jsname="Ne3sFf"]');
    if (bubble && bubble.classList.contains('Pxe3Yd')) return;
    const text = (el.innerText || el.textContent || '').trim();
    if (text.length === 0) return;
    results.push(el);
  });

  return results;
}

// 내가 보낸 메시지 요소만 반환
function findOutgoingElements() {
  const results = [];
  const candidates = new Set();

  // chat.google.com: Pxe3Yd 클래스 = outgoing
  document.querySelectorAll('div[jsname="bgckF"]').forEach((el) => {
    const bubble = el.closest('[jsname="Ne3sFf"]');
    if (bubble && bubble.classList.contains('Pxe3Yd')) candidates.add(el);
  });

  // Gmail Chat: 발신 메시지는 보통 오른쪽 정렬 또는 특정 클래스
  // data-self-message, data-is-self, 또는 align-self: flex-end 등
  document.querySelectorAll('[data-self-message] [dir="auto"], [data-is-self] [dir="auto"]').forEach(el => candidates.add(el));

  // Gmail Chat fallback: 전체 dir="auto" 중 outgoing 스타일 감지
  document.querySelectorAll('[role="row"] [dir="auto"]').forEach(el => {
    const row = el.closest('[role="row"]');
    if (!row) return;
    // Gmail outgoing 메시지는 오른쪽에 배치됨 (justify-content: flex-end 등)
    const style = window.getComputedStyle(row);
    if (style.justifyContent === 'flex-end' || style.textAlign === 'right') candidates.add(el);
  });

  candidates.forEach(el => {
    if (el.dataset.gctDone) return;
    if (el.closest('.gct-translation') || el.querySelector('.gct-translation')) return;
    if (el.closest('.wzx93, .ajDw2c, .LoYJxb')) return;
    const text = (el.innerText || el.textContent || '').trim();
    if (!text) return;
    results.push(el);
  });
  return results;
}

// ─── IntersectionObserver: 뷰포트에 보이는 메시지만 번역 ───
const translateQueue = [];
let isQueueProcessing = false;
let observedElements = new WeakSet();

const visibilityObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting && !entry.target.dataset.gctDone) {
      translateQueue.push(entry.target);
      visibilityObserver.unobserve(entry.target);
      processTranslateQueue();
    }
  }
}, { threshold: 0.1 });

async function processTranslateQueue() {
  if (isQueueProcessing) return;
  isQueueProcessing = true;

  try {
    const settings = await getSettings();
    const isAI = ['gemini', 'claude', 'openai'].includes(settings.aiProvider);
    const delay = settings.aiProvider === 'gemini' ? 4000 : (isAI ? 1000 : 0);

    while (translateQueue.length > 0) {
      const el = translateQueue.shift();
      if (el.dataset.gctDone) continue;
      const isOutgoing = el.dataset.gctOutgoing === '1';
      await translateIncomingMessage(el, isOutgoing);
      if (delay && translateQueue.length > 0) await new Promise(r => setTimeout(r, delay));
    }
  } finally {
    isQueueProcessing = false;
  }
}

function processNewMessages() {
  const incoming = findMessageElements();
  for (const el of incoming) {
    if (!observedElements.has(el)) {
      observedElements.add(el);
      visibilityObserver.observe(el);
    }
  }

  // 발신 메시지도 동일하게 뷰포트 기반
  getSettings().then(settings => {
    if (settings.showOutgoingTranslation) {
      const outgoing = findOutgoingElements();
      for (const el of outgoing) {
        if (!observedElements.has(el)) {
          observedElements.add(el);
          el.dataset.gctOutgoing = '1'; // 발신 표시
          visibilityObserver.observe(el);
        }
      }
    }
  });
}

// ─────────────────────────────────────────
// MutationObserver: 입력창 + 메시지 통합 감지
// ─────────────────────────────────────────

function scanInputs() {
  const all = document.querySelectorAll('[contenteditable="true"]');
  let attached = 0;
  all.forEach((el) => {
    if (isChatInput(el)) {
      attachToInputBox(el);
      attached++;
    }
  });
  if (all.length > 0) {
    console.log(`[GCT] contenteditable 요소 ${all.length}개 발견, 채팅 입력 감지: ${attached}개`);
  }
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
ensureToggleButton();

// 단축키 메시지 수신 (background → content)
chrome.runtime?.onMessage?.addListener((msg) => {
  if (msg.action === 'toggleRoomTranslate') toggleRoomTranslate();
});

// 설정 변경 실시간 반영 (플로팅 버튼 표시/숨김)
try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.showFloatingBtn) {
      syncToggleButton(changes.showFloatingBtn.newValue !== false);
    }
  });
} catch (e) { /* extension context invalidated */ }
