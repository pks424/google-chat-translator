/**
 * googleTranslateFree() / googleTranslateCloud() / googleTranslate() 함수 유닛 테스트
 */

// content.js에서 무료 API 함수 추출
async function googleTranslateFree(text, targetLang = 'en', sourceLang = 'auto') {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('번역 요청 실패');
  const data = await response.json();
  const translated = data[0].map(chunk => chunk[0]).join('');
  const detectedLang = data[2] || 'auto';
  return { translated, detectedLang };
}

// content.js에서 Cloud API 함수 추출
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

// content.js에서 통합 번역 함수 추출 (테스트용으로 apiKey 직접 인자 전달)
async function googleTranslate(text, targetLang = 'en', sourceLang = 'auto', apiKey = '') {
  if (apiKey) {
    return googleTranslateCloud(text, targetLang, sourceLang, apiKey);
  }
  return googleTranslateFree(text, targetLang, sourceLang);
}

// ── 모킹 헬퍼 ──────────────────────────────
function mockFreeResponse(translatedText, detectedLang) {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => [
      [[translatedText, 'original', null, null, 1]],
      null,
      detectedLang
    ]
  });
}

function mockCloudResponse(translatedText, detectedLang) {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      data: {
        translations: [{ translatedText, detectedSourceLanguage: detectedLang }]
      }
    })
  });
}

// 이전 코드 호환성을 위한 별칭
var mockTranslateResponse = mockFreeResponse;

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

  test('translate.googleapis.com 도메인 사용 (무료 API)', async () => {
    mockTranslateResponse('hello', 'ko');
    await googleTranslate('안녕', 'en');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('translate.googleapis.com')
    );
  });
});

// ── Cloud API 테스트 ──────────────────────────────────

describe('googleTranslateCloud() - 기본 번역', () => {

  beforeEach(() => {
    fetch.mockClear();
  });

  test('Cloud API: 한글 → 영어 번역 성공', async () => {
    mockCloudResponse('I want to get off work', 'ko');
    const result = await googleTranslateCloud('퇴근하고 싶다', 'en', 'auto', 'AIzaSyTEST');
    expect(result.translated).toBe('I want to get off work');
    expect(result.detectedLang).toBe('ko');
  });

  test('Cloud API: 영어 → 한국어 번역 성공', async () => {
    mockCloudResponse('안녕하세요', 'en');
    const result = await googleTranslateCloud('Hello', 'ko', 'auto', 'AIzaSyTEST');
    expect(result.translated).toBe('안녕하세요');
    expect(result.detectedLang).toBe('en');
  });

  test('Cloud API: 한글 → 일본어 번역 성공', async () => {
    mockCloudResponse('こんにちは', 'ko');
    const result = await googleTranslateCloud('안녕하세요', 'ja', 'auto', 'AIzaSyTEST');
    expect(result.translated).toBe('こんにちは');
  });

  test('Cloud API: POST 방식으로 호출', async () => {
    mockCloudResponse('Hello', 'ko');
    await googleTranslateCloud('안녕', 'en', 'auto', 'AIzaSyTEST');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('translation.googleapis.com'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('Cloud API: URL에 API 키 포함', async () => {
    mockCloudResponse('Hello', 'ko');
    await googleTranslateCloud('안녕', 'en', 'auto', 'AIzaSyTEST');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('key=AIzaSyTEST'),
      expect.anything()
    );
  });

  test('Cloud API: Content-Type 헤더 설정', async () => {
    mockCloudResponse('Hello', 'ko');
    await googleTranslateCloud('안녕', 'en', 'auto', 'AIzaSyTEST');
    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' }
      })
    );
  });

  test('Cloud API: sourceLang=auto 일 때 body에 source 없음', async () => {
    mockCloudResponse('Hello', 'ko');
    await googleTranslateCloud('안녕', 'en', 'auto', 'AIzaSyTEST');
    const callBody = JSON.parse(fetch.mock.calls[0][1].body);
    expect(callBody.source).toBeUndefined();
  });

  test('Cloud API: sourceLang 명시 시 body에 source 포함', async () => {
    mockCloudResponse('Hello', 'ko');
    await googleTranslateCloud('안녕', 'en', 'ko', 'AIzaSyTEST');
    const callBody = JSON.parse(fetch.mock.calls[0][1].body);
    expect(callBody.source).toBe('ko');
  });

  test('Cloud API: 4xx 에러 시 예외 던짐', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 403 });
    await expect(googleTranslateCloud('test', 'en', 'auto', 'BAD_KEY')).rejects.toThrow('Cloud 번역 요청 실패');
  });

  test('Cloud API: 429 에러 시 예외 던짐', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 429 });
    await expect(googleTranslateCloud('test', 'en', 'auto', 'AIzaSyTEST')).rejects.toThrow('Cloud 번역 요청 실패');
  });
});

// ── googleTranslate() API 키 유무에 따른 분기 테스트 ──

describe('googleTranslate() - API 키 분기', () => {

  beforeEach(() => {
    fetch.mockClear();
  });

  test('API 키 없으면 translate.googleapis.com (무료) 호출', async () => {
    mockFreeResponse('Hello', 'ko');
    await googleTranslate('안녕', 'en', 'auto', '');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('translate.googleapis.com/translate_a/single')
    );
  });

  test('API 키 있으면 translation.googleapis.com (공식) 호출', async () => {
    mockCloudResponse('Hello', 'ko');
    await googleTranslate('안녕', 'en', 'auto', 'AIzaSyTEST');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('translation.googleapis.com'),
      expect.anything()
    );
  });

  test('API 키 있을 때 POST 방식 사용', async () => {
    mockCloudResponse('Hello', 'ko');
    await googleTranslate('안녕', 'en', 'auto', 'AIzaSyTEST');
    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('API 키 없을 때 GET 방식 사용 (fetch에 두 번째 인자 없음)', async () => {
    mockFreeResponse('Hello', 'ko');
    await googleTranslate('안녕', 'en', 'auto', '');
    // 무료 API는 fetch(url) 단일 인자 호출
    expect(fetch.mock.calls[0].length).toBe(1);
  });

  test('API 키 있을 때 번역 결과 올바르게 반환', async () => {
    mockCloudResponse('Good morning', 'ko');
    const result = await googleTranslate('좋은 아침', 'en', 'auto', 'AIzaSyTEST');
    expect(result.translated).toBe('Good morning');
    expect(result.detectedLang).toBe('ko');
  });

  test('API 키 없을 때 번역 결과 올바르게 반환', async () => {
    mockFreeResponse('Good morning', 'ko');
    const result = await googleTranslate('좋은 아침', 'en', 'auto', '');
    expect(result.translated).toBe('Good morning');
    expect(result.detectedLang).toBe('ko');
  });
});
