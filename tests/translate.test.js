/**
 * googleTranslate() 함수 유닛 테스트
 */

// content.js에서 googleTranslate만 추출하여 테스트
async function googleTranslate(text, targetLang = 'en', sourceLang = 'auto') {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('번역 요청 실패');
  const data = await response.json();
  const translated = data[0].map(chunk => chunk[0]).join('');
  const detectedLang = data[2] || 'auto';
  return { translated, detectedLang };
}

// ── 모킹 헬퍼 ──────────────────────────────
function mockTranslateResponse(translatedText, detectedLang) {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => [
      [[translatedText, 'original', null, null, 1]],
      null,
      detectedLang
    ]
  });
}

// ── 기본 번역 테스트 ──────────────────────────────────

describe('googleTranslate() - 기본 번역', () => {

  beforeEach(() => {
    fetch.mockClear();
  });

  test('한글 → 영어 번역 성공', async () => {
    mockTranslateResponse('I want to get off work', 'ko');
    const result = await googleTranslate('퇴근하고 싶다', 'en');
    expect(result.translated).toBe('I want to get off work');
    expect(result.detectedLang).toBe('ko');
  });

  test('영어 → 한국어 번역 성공', async () => {
    mockTranslateResponse('안녕하세요', 'en');
    const result = await googleTranslate('Hello', 'ko');
    expect(result.translated).toBe('안녕하세요');
    expect(result.detectedLang).toBe('en');
  });

  test('한글 → 일본어 번역 성공', async () => {
    mockTranslateResponse('こんにちは', 'ko');
    const result = await googleTranslate('안녕하세요', 'ja');
    expect(result.translated).toBe('こんにちは');
    expect(result.detectedLang).toBe('ko');
  });

  test('영어 → 일본어 번역 성공', async () => {
    mockTranslateResponse('おはようございます', 'en');
    const result = await googleTranslate('Good morning', 'ja');
    expect(result.translated).toBe('おはようございます');
    expect(result.detectedLang).toBe('en');
  });

  test('한글 → 중국어 간체 번역 성공', async () => {
    mockTranslateResponse('你好', 'ko');
    const result = await googleTranslate('안녕', 'zh-CN');
    expect(result.translated).toBe('你好');
    expect(result.detectedLang).toBe('ko');
  });

  test('한글 → 프랑스어 번역 성공', async () => {
    mockTranslateResponse('Bonjour', 'ko');
    const result = await googleTranslate('안녕하세요', 'fr');
    expect(result.translated).toBe('Bonjour');
    expect(result.detectedLang).toBe('ko');
  });

  test('한글 → 독일어 번역 성공', async () => {
    mockTranslateResponse('Guten Morgen', 'ko');
    const result = await googleTranslate('좋은 아침', 'de');
    expect(result.translated).toBe('Guten Morgen');
    expect(result.detectedLang).toBe('ko');
  });

  test('이미 목표 언어인 경우 detectedLang = targetLang', async () => {
    mockTranslateResponse('Hello', 'en');
    const result = await googleTranslate('Hello', 'en');
    expect(result.detectedLang).toBe('en');
  });
});

// ── 응답 파싱 테스트 ──────────────────────────────────

describe('googleTranslate() - 응답 파싱', () => {

  beforeEach(() => {
    fetch.mockClear();
  });

  test('여러 청크(chunk)가 있는 응답 처리', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        [['Hello ', null], ['world', null], ['!', null]],
        null,
        'ko'
      ]
    });
    const result = await googleTranslate('안녕 세상!', 'en');
    expect(result.translated).toBe('Hello world!');
  });

  test('단일 청크 응답 처리', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        [['Good morning', null, null, null, 1]],
        null,
        'ko'
      ]
    });
    const result = await googleTranslate('좋은 아침', 'en');
    expect(result.translated).toBe('Good morning');
  });

  test('data[2]가 undefined이면 detectedLang은 "auto"', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        [['Hello', null]],
        null
        // data[2] 없음
      ]
    });
    const result = await googleTranslate('안녕', 'en');
    expect(result.detectedLang).toBe('auto');
  });

  test('data[2]가 null이면 detectedLang은 "auto"', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        [['Hello', null]],
        null,
        null
      ]
    });
    const result = await googleTranslate('안녕', 'en');
    expect(result.detectedLang).toBe('auto');
  });

  test('빈 텍스트도 API 호출은 됨 (호출자가 필터링 책임)', async () => {
    mockTranslateResponse('', 'auto');
    const result = await googleTranslate('', 'en');
    expect(result.translated).toBe('');
  });

  test('청크가 5개인 경우 join 처리', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        [['Do ', null], ['I ', null], ['need', null], [' to', null], [' test?', null]],
        null,
        'ko'
      ]
    });
    const result = await googleTranslate('테스트해야 하나요?', 'en');
    expect(result.translated).toBe('Do I need to test?');
  });
});

// ── 에러 처리 테스트 ──────────────────────────────────

describe('googleTranslate() - 에러 처리', () => {

  beforeEach(() => {
    fetch.mockClear();
  });

  test('API 오류(4xx/5xx) 시 예외 던짐', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 429 });
    await expect(googleTranslate('test', 'en')).rejects.toThrow('번역 요청 실패');
  });

  test('400 에러 시 예외 던짐', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 400 });
    await expect(googleTranslate('test', 'en')).rejects.toThrow('번역 요청 실패');
  });

  test('500 에러 시 예외 던짐', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(googleTranslate('test', 'en')).rejects.toThrow('번역 요청 실패');
  });

  test('503 에러 시 예외 던짐', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(googleTranslate('test', 'en')).rejects.toThrow('번역 요청 실패');
  });

  test('네트워크 오류 시 예외 던짐', async () => {
    fetch.mockRejectedValueOnce(new Error('Network Error'));
    await expect(googleTranslate('test', 'en')).rejects.toThrow('Network Error');
  });

  test('fetch timeout 시 예외 전파', async () => {
    fetch.mockRejectedValueOnce(new Error('AbortError: The operation was aborted'));
    await expect(googleTranslate('test', 'en')).rejects.toThrow('AbortError');
  });
});

// ── URL 구성 테스트 ───────────────────────────────────

describe('googleTranslate() - URL 구성', () => {

  beforeEach(() => {
    fetch.mockClear();
  });

  test('올바른 URL 형식으로 API 호출 (sl, tl 파라미터)', async () => {
    mockTranslateResponse('hello', 'ko');
    await googleTranslate('안녕', 'en', 'ko');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('sl=ko&tl=en')
    );
  });

  test('한글 텍스트 URL 인코딩 확인', async () => {
    mockTranslateResponse('hello', 'ko');
    await googleTranslate('안녕', 'en', 'ko');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('안녕'))
    );
  });

  test('client=gtx 파라미터 포함', async () => {
    mockTranslateResponse('hello', 'ko');
    await googleTranslate('안녕', 'en');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('client=gtx')
    );
  });

  test('dt=t 파라미터 포함', async () => {
    mockTranslateResponse('hello', 'ko');
    await googleTranslate('안녕', 'en');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('dt=t')
    );
  });

  test('sourceLang 기본값은 auto', async () => {
    mockTranslateResponse('hello', 'ko');
    await googleTranslate('안녕', 'en');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('sl=auto')
    );
  });

  test('sourceLang 명시 시 해당 값 사용', async () => {
    mockTranslateResponse('hello', 'ko');
    await googleTranslate('안녕', 'en', 'ko');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('sl=ko')
    );
  });

  test('targetLang=ja 일 때 tl=ja', async () => {
    mockTranslateResponse('こんにちは', 'ko');
    await googleTranslate('안녕', 'ja');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('tl=ja')
    );
  });

  test('targetLang=zh-CN 일 때 tl=zh-CN', async () => {
    mockTranslateResponse('你好', 'ko');
    await googleTranslate('안녕', 'zh-CN');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('tl=zh-CN')
    );
  });

  test('특수문자 포함 텍스트 URL 인코딩', async () => {
    mockTranslateResponse('hello world', 'ko');
    const text = '안녕 세상! & <test>';
    await googleTranslate(text, 'en');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(text))
    );
  });

  test('호출 횟수는 정확히 1회', async () => {
    mockTranslateResponse('hello', 'ko');
    await googleTranslate('안녕', 'en');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('translate.googleapis.com 도메인 사용', async () => {
    mockTranslateResponse('hello', 'ko');
    await googleTranslate('안녕', 'en');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('translate.googleapis.com')
    );
  });
});
