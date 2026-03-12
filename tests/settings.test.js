/**
 * getSettings() 함수 유닛 테스트
 * chrome.storage.local 기반 설정 저장/불러오기
 */

// content.js의 getSettings 인라인
function getSettings() {
  return new Promise(function(resolve) {
    chrome.storage.local.get(['targetLang', 'outLang', 'autoTranslate', 'showOutgoingTranslation'], function(result) {
      resolve({
        targetLang:               result.targetLang    || 'ko',
        outLang:                  result.outLang       || 'en',
        autoTranslate:            result.autoTranslate !== false,
        showOutgoingTranslation:  result.showOutgoingTranslation === true
      });
    });
  });
}

// ── 기본값 테스트 ─────────────────────────────────────

describe('getSettings() - 기본값', () => {

  beforeEach(() => {
    chrome.storage.local.clear();
  });

  test('저장된 값 없으면 targetLang 기본값은 "ko"', async () => {
    const settings = await getSettings();
    expect(settings.targetLang).toBe('ko');
  });

  test('저장된 값 없으면 outLang 기본값은 "en"', async () => {
    const settings = await getSettings();
    expect(settings.outLang).toBe('en');
  });

  test('저장된 값 없으면 autoTranslate 기본값은 true', async () => {
    const settings = await getSettings();
    expect(settings.autoTranslate).toBe(true);
  });

  test('저장된 값 없으면 showOutgoingTranslation 기본값은 false', async () => {
    const settings = await getSettings();
    expect(settings.showOutgoingTranslation).toBe(false);
  });

  test('설정 객체에 네 가지 키가 모두 존재', async () => {
    const settings = await getSettings();
    expect(settings).toHaveProperty('targetLang');
    expect(settings).toHaveProperty('outLang');
    expect(settings).toHaveProperty('autoTranslate');
    expect(settings).toHaveProperty('showOutgoingTranslation');
  });
});

// ── 저장된 값 불러오기 테스트 ─────────────────────────

describe('getSettings() - 저장된 값 불러오기', () => {

  beforeEach(() => {
    chrome.storage.local.clear();
  });

  test('저장된 targetLang="ja" 불러오기', async () => {
    chrome.storage.local.set({ targetLang: 'ja' });
    const settings = await getSettings();
    expect(settings.targetLang).toBe('ja');
  });

  test('저장된 targetLang="en" 불러오기', async () => {
    chrome.storage.local.set({ targetLang: 'en' });
    const settings = await getSettings();
    expect(settings.targetLang).toBe('en');
  });

  test('저장된 outLang="ja" 불러오기', async () => {
    chrome.storage.local.set({ outLang: 'ja' });
    const settings = await getSettings();
    expect(settings.outLang).toBe('ja');
  });

  test('저장된 outLang="zh-CN" 불러오기', async () => {
    chrome.storage.local.set({ outLang: 'zh-CN' });
    const settings = await getSettings();
    expect(settings.outLang).toBe('zh-CN');
  });

  test('저장된 outLang="fr" 불러오기', async () => {
    chrome.storage.local.set({ outLang: 'fr' });
    const settings = await getSettings();
    expect(settings.outLang).toBe('fr');
  });

  test('저장된 outLang="de" 불러오기', async () => {
    chrome.storage.local.set({ outLang: 'de' });
    const settings = await getSettings();
    expect(settings.outLang).toBe('de');
  });

  test('저장된 autoTranslate=false 불러오기', async () => {
    chrome.storage.local.set({ autoTranslate: false });
    const settings = await getSettings();
    expect(settings.autoTranslate).toBe(false);
  });

  test('저장된 autoTranslate=true 불러오기', async () => {
    chrome.storage.local.set({ autoTranslate: true });
    const settings = await getSettings();
    expect(settings.autoTranslate).toBe(true);
  });

  test('저장된 showOutgoingTranslation=true 불러오기', async () => {
    chrome.storage.local.set({ showOutgoingTranslation: true });
    const settings = await getSettings();
    expect(settings.showOutgoingTranslation).toBe(true);
  });

  test('저장된 showOutgoingTranslation=false 불러오기', async () => {
    chrome.storage.local.set({ showOutgoingTranslation: false });
    const settings = await getSettings();
    expect(settings.showOutgoingTranslation).toBe(false);
  });

  test('네 가지 설정 모두 저장 후 불러오기', async () => {
    chrome.storage.local.set({
      targetLang: 'ja', outLang: 'fr',
      autoTranslate: false, showOutgoingTranslation: true
    });
    const settings = await getSettings();
    expect(settings.targetLang).toBe('ja');
    expect(settings.outLang).toBe('fr');
    expect(settings.autoTranslate).toBe(false);
    expect(settings.showOutgoingTranslation).toBe(true);
  });
});

// ── showOutgoingTranslation 엣지 케이스 ──────────────

describe('getSettings() - showOutgoingTranslation 엣지 케이스', () => {

  beforeEach(() => {
    chrome.storage.local.clear();
  });

  test('저장 안 하면 기본값 false (undefined === true 는 false)', async () => {
    const settings = await getSettings();
    expect(settings.showOutgoingTranslation).toBe(false);
  });

  test('true로 저장하면 정확히 true', async () => {
    chrome.storage.local.set({ showOutgoingTranslation: true });
    const settings = await getSettings();
    expect(settings.showOutgoingTranslation).toBe(true);
    expect(settings.showOutgoingTranslation).not.toBe(false);
  });

  test('true 저장 후 삭제하면 다시 기본 false', async () => {
    chrome.storage.local.set({ showOutgoingTranslation: true });
    var s1 = await getSettings();
    expect(s1.showOutgoingTranslation).toBe(true);

    chrome.storage.local.clear();
    var s2 = await getSettings();
    expect(s2.showOutgoingTranslation).toBe(false);
  });

  test('showOutgoingTranslation 변경 후 즉시 반영', async () => {
    chrome.storage.local.set({ showOutgoingTranslation: false });
    var s1 = await getSettings();
    expect(s1.showOutgoingTranslation).toBe(false);

    chrome.storage.local.set({ showOutgoingTranslation: true });
    var s2 = await getSettings();
    expect(s2.showOutgoingTranslation).toBe(true);
  });
});

// ── autoTranslate 엣지 케이스 ─────────────────────────

describe('getSettings() - autoTranslate 엣지 케이스', () => {

  beforeEach(() => {
    chrome.storage.local.clear();
  });

  test('autoTranslate=false 이면 정확히 false', async () => {
    chrome.storage.local.set({ autoTranslate: false });
    const settings = await getSettings();
    expect(settings.autoTranslate).toBe(false);
    expect(settings.autoTranslate).not.toBe(true);
  });

  test('autoTranslate 저장 안 하면 기본 true (undefined !== false)', async () => {
    // undefined !== false 이므로 true
    const settings = await getSettings();
    expect(settings.autoTranslate).toBe(true);
  });

  test('autoTranslate=false 저장 후 삭제하면 다시 기본 true', async () => {
    chrome.storage.local.set({ autoTranslate: false });
    var s1 = await getSettings();
    expect(s1.autoTranslate).toBe(false);

    chrome.storage.local.clear();
    var s2 = await getSettings();
    expect(s2.autoTranslate).toBe(true);
  });
});

// ── 설정 변경 후 재호출 테스트 ───────────────────────

describe('getSettings() - 설정 변경 반영', () => {

  beforeEach(() => {
    chrome.storage.local.clear();
  });

  test('outLang 변경 후 즉시 반영', async () => {
    chrome.storage.local.set({ outLang: 'en' });
    var s1 = await getSettings();
    expect(s1.outLang).toBe('en');

    chrome.storage.local.set({ outLang: 'ja' });
    var s2 = await getSettings();
    expect(s2.outLang).toBe('ja');
  });

  test('targetLang 변경 후 즉시 반영', async () => {
    chrome.storage.local.set({ targetLang: 'ko' });
    var s1 = await getSettings();
    expect(s1.targetLang).toBe('ko');

    chrome.storage.local.set({ targetLang: 'en' });
    var s2 = await getSettings();
    expect(s2.targetLang).toBe('en');
  });
});
