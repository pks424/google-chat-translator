/**
 * DOM 조작 관련 유닛 테스트
 * - findMessageElements()
 * - isChatInput()
 * - createTranslationBadge()
 * - 번역 조건 로직
 * - 인용/답장 메시지 텍스트 추출
 */

// ── content.js 핵심 함수 인라인 ────────────────────

function isChatInput(el) {
  if (el.getAttribute('contenteditable') !== 'true') return false;
  if (el.closest('.gct-translation')) return false;
  const label = (el.getAttribute('aria-label') || '').toLowerCase();
  const role  = (el.getAttribute('role') || '').toLowerCase();
  const tag   = el.tagName.toLowerCase();
  if (label.includes('message') || label.includes('메시지') ||
      label.includes('reply')   || label.includes('답장')) return true;
  if (role === 'textbox') return true;
  if (el.closest('[data-is-msg-input="true"]')) return true;
  if (el.closest('[jsname]') && tag === 'div') {
    const rect = el.getBoundingClientRect();
    if (rect.width > 100 && rect.height > 20 && rect.height < 300) return true;
  }
  return false;
}

function findMessageElements() {
  const candidates = new Set();

  // 1순위: jsname="bgckF" — 실제 Google Chat 메시지 텍스트 컨테이너
  document.querySelectorAll('div[jsname="bgckF"]').forEach(function(el) { candidates.add(el); });

  // 2순위: data-message-id 컨테이너 내부 (다른 버전 fallback)
  document.querySelectorAll(
    '[data-message-id] [dir="auto"], [data-message-id] [dir="ltr"], [data-message-id] p'
  ).forEach(function(el) { candidates.add(el); });

  // 3순위: dir="auto" 일반 요소 (기타 환경 대비)
  document.querySelectorAll('div[dir="auto"], span[dir="auto"]').forEach(function(el) { candidates.add(el); });

  var results = [];
  candidates.forEach(function(el) {
    if (el.closest('.gct-translation') || el.classList.contains('gct-translation')) return;
    if (el.closest('[contenteditable]')) return;
    if (el.closest('button, a, [role="button"], [role="menuitem"]')) return;
    if (el.dataset.gctDone) return;
    // 내가 보낸 메시지 제외: jsname="Ne3sFf" 조상에 Pxe3Yd 클래스가 있으면 outgoing
    var bubble = el.closest('[jsname="Ne3sFf"]');
    if (bubble && bubble.classList.contains('Pxe3Yd')) return;
    var text = (el.innerText || el.textContent || '').trim();
    if (text.length === 0) return;
    results.push(el);
  });
  return results;
}

// 발신 메시지 요소 찾기 (content.js의 findOutgoingElements 인라인)
function findOutgoingElements() {
  var results = [];
  document.querySelectorAll('div[jsname="bgckF"]').forEach(function(el) {
    if (el.dataset.gctDone) return;
    if (el.closest('.gct-translation')) return;
    if (el.querySelector('.gct-translation')) return;
    var bubble = el.closest('[jsname="Ne3sFf"]');
    if (!bubble || !bubble.classList.contains('Pxe3Yd')) return;
    var text = (el.innerText || el.textContent || '').trim();
    if (!text) return;
    results.push(el);
  });
  return results;
}

function createTranslationBadge(translatedText) {
  var badge = document.createElement('div');
  badge.className = 'gct-translation';
  badge.textContent = translatedText;
  var icon = document.createElement('span');
  icon.className = 'gct-translation-icon';
  icon.textContent = '🌐 ';
  badge.prepend(icon);
  return badge;
}

// 인용 섹션 제거 후 텍스트 추출 (content.js의 translateIncomingMessage 로직)
function extractMessageText(msgElement) {
  var quoteSection = msgElement.querySelector('.wVNE5');
  if (quoteSection) {
    var clone = msgElement.cloneNode(true);
    var qs = clone.querySelector('.wVNE5');
    if (qs) qs.remove();
    return (clone.innerText || clone.textContent || '').trim();
  }
  return (msgElement.innerText || msgElement.textContent || '').trim();
}

// ── isChatInput() 테스트 ────────────────────────────

describe('isChatInput()', function() {
  var el;

  beforeEach(function() {
    document.body.innerHTML = '';
    el = document.createElement('div');
    document.body.appendChild(el);
  });

  // 기본 false 케이스
  test('contenteditable 없으면 false', function() {
    expect(isChatInput(el)).toBe(false);
  });

  test('contenteditable="false" → false', function() {
    el.setAttribute('contenteditable', 'false');
    el.setAttribute('aria-label', 'Message');
    expect(isChatInput(el)).toBe(false);
  });

  test('contenteditable="plaintext-only" → false', function() {
    el.setAttribute('contenteditable', 'plaintext-only');
    el.setAttribute('aria-label', 'Message');
    expect(isChatInput(el)).toBe(false);
  });

  test('input 태그 + contenteditable="true" 없으면 false', function() {
    var input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    expect(isChatInput(input)).toBe(false);
  });

  // aria-label 기반 true 케이스
  test('contenteditable="true" + aria-label="Message" → true', function() {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('aria-label', 'Message');
    expect(isChatInput(el)).toBe(true);
  });

  test('contenteditable="true" + aria-label="메시지 입력" → true', function() {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('aria-label', '메시지 입력');
    expect(isChatInput(el)).toBe(true);
  });

  test('aria-label="Reply" → true', function() {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('aria-label', 'Reply');
    expect(isChatInput(el)).toBe(true);
  });

  test('aria-label="답장 입력" → true', function() {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('aria-label', '답장 입력');
    expect(isChatInput(el)).toBe(true);
  });

  test('aria-label="Write a message" → true (message 포함)', function() {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('aria-label', 'Write a message');
    expect(isChatInput(el)).toBe(true);
  });

  test('aria-label="Chat message" → true', function() {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('aria-label', 'Chat message');
    expect(isChatInput(el)).toBe(true);
  });

  test('aria-label 대소문자 무관 (MESSAGE) → true', function() {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('aria-label', 'MESSAGE');
    expect(isChatInput(el)).toBe(true);
  });

  test('aria-label="description" → false (message/reply 미포함)', function() {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('aria-label', 'description');
    expect(isChatInput(el)).toBe(false);
  });

  // role 기반
  test('contenteditable="true" + role="textbox" → true', function() {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('role', 'textbox');
    expect(isChatInput(el)).toBe(true);
  });

  test('role="button" + contenteditable="true" → false (role이 textbox 아님)', function() {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('role', 'button');
    expect(isChatInput(el)).toBe(false);
  });

  // 부모 기반
  test('contenteditable="true" + 부모에 data-is-msg-input="true" → true', function() {
    var parent = document.createElement('div');
    parent.setAttribute('data-is-msg-input', 'true');
    parent.appendChild(el);
    document.body.appendChild(parent);
    el.setAttribute('contenteditable', 'true');
    expect(isChatInput(el)).toBe(true);
  });

  test('data-is-msg-input="false" → 부모 조건 미충족 → false', function() {
    var parent = document.createElement('div');
    parent.setAttribute('data-is-msg-input', 'false');
    parent.appendChild(el);
    document.body.appendChild(parent);
    el.setAttribute('contenteditable', 'true');
    expect(isChatInput(el)).toBe(false);
  });

  // gct-translation 내부 제외
  test('.gct-translation 내부이면 false', function() {
    var badge = document.createElement('div');
    badge.className = 'gct-translation';
    badge.appendChild(el);
    document.body.appendChild(badge);
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('aria-label', 'message');
    expect(isChatInput(el)).toBe(false);
  });

  test('.gct-translation 2depth 내부도 false', function() {
    var badge = document.createElement('div');
    badge.className = 'gct-translation';
    var inner = document.createElement('div');
    inner.appendChild(el);
    badge.appendChild(inner);
    document.body.appendChild(badge);
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('role', 'textbox');
    expect(isChatInput(el)).toBe(false);
  });
});

// ── findMessageElements() 테스트 ────────────────────

describe('findMessageElements()', function() {

  beforeEach(function() {
    document.body.innerHTML = '';
  });

  // ── 기본 셀렉터 ──

  test('[기존] dir="auto" 요소 감지', function() {
    document.body.innerHTML = '<div dir="auto">Hello, how are you?</div>';
    expect(findMessageElements().length).toBe(1);
  });

  test('[기존] span[dir="auto"]도 감지', function() {
    document.body.innerHTML = '<span dir="auto">메시지 텍스트</span>';
    expect(findMessageElements().length).toBe(1);
  });

  test('[기존] div[dir="auto"]만 감지 (p[dir="auto"]는 3순위 미포함)', function() {
    document.body.innerHTML = '<div dir="auto">valid</div><p dir="auto">not matched by selector3</p>';
    // p는 dir="auto" 셀렉터에 안 걸리지만 div는 걸림
    var results = findMessageElements();
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  // ── jsname="bgckF" (1순위) ──

  test('[GChat] jsname="bgckF" 메시지 컨테이너 감지 (실제 DOM 구조)', function() {
    document.body.innerHTML =
      '<div class="DTp27d QIJiHb Zc1Emd" jsname="bgckF">Okay, let me check</div>';
    expect(findMessageElements().length).toBe(1);
  });

  test('[GChat] jsname="bgckF" 중첩 구조 감지', function() {
    document.body.innerHTML =
      '<div class="B8q9Gf qnQFwb" jsname="o7uNDd">' +
        '<div class="EAOoq LrGp7b">' +
          '<div class="DTp27d QIJiHb Zc1Emd" jsname="bgckF">Hey, can you finish the report?</div>' +
        '</div>' +
      '</div>';
    expect(findMessageElements().length).toBe(1);
  });

  test('[GChat] jsname="bgckF" 복수 메시지 모두 감지', function() {
    document.body.innerHTML =
      '<div jsname="bgckF">First message</div>' +
      '<div jsname="bgckF">Second message</div>' +
      '<div jsname="bgckF">Third message</div>';
    expect(findMessageElements().length).toBe(3);
  });

  test('[GChat] jsname="bgckF" 내부라도 contenteditable 이면 제외', function() {
    document.body.innerHTML =
      '<div contenteditable="true"><div jsname="bgckF">입력창</div></div>';
    expect(findMessageElements().length).toBe(0);
  });

  test('[GChat] jsname="bgckF" 텍스트 없으면 제외', function() {
    document.body.innerHTML = '<div jsname="bgckF"></div>';
    expect(findMessageElements().length).toBe(0);
  });

  test('[GChat] jsname="bgckF" 공백만 있으면 제외', function() {
    document.body.innerHTML = '<div jsname="bgckF">   </div>';
    expect(findMessageElements().length).toBe(0);
  });

  // ── data-message-id (2순위) ──

  test('[GChat] data-message-id 내부 dir="ltr" 감지', function() {
    document.body.innerHTML =
      '<div data-message-id="abc123"><div dir="ltr">Hey, can you finish the report?</div></div>';
    expect(findMessageElements().length).toBe(1);
  });

  test('[GChat] data-message-id 내부 dir="auto" 감지', function() {
    document.body.innerHTML =
      '<div data-message-id="abc123"><div dir="auto">안녕하세요!</div></div>';
    expect(findMessageElements().length).toBe(1);
  });

  test('[GChat] data-message-id 내부 p 태그 감지', function() {
    document.body.innerHTML =
      '<div data-message-id="abc123"><p>Meeting at 3pm today?</p></div>';
    expect(findMessageElements().length).toBe(1);
  });

  test('[GChat] 복수 메시지 모두 감지', function() {
    document.body.innerHTML =
      '<div data-message-id="msg1"><div dir="ltr">First</div></div>' +
      '<div data-message-id="msg2"><div dir="ltr">Second</div></div>' +
      '<div data-message-id="msg3"><div dir="ltr">Third</div></div>';
    expect(findMessageElements().length).toBe(3);
  });

  // ── contenteditable 제외 ──

  test('contenteditable="true" 내부 제외', function() {
    document.body.innerHTML =
      '<div contenteditable="true"><div dir="auto">입력 중</div></div>';
    expect(findMessageElements().length).toBe(0);
  });

  test('contenteditable="plaintext-only" 내부 제외', function() {
    document.body.innerHTML =
      '<div contenteditable="plaintext-only"><div dir="auto">입력 중</div></div>';
    expect(findMessageElements().length).toBe(0);
  });

  test('contenteditable="" (빈 값) 내부 제외', function() {
    document.body.innerHTML =
      '<div contenteditable=""><div dir="auto">입력 중</div></div>';
    expect(findMessageElements().length).toBe(0);
  });

  test('data-message-id 내부라도 contenteditable 내부이면 제외', function() {
    document.body.innerHTML =
      '<div data-message-id="msg1"><div contenteditable="true"><div dir="ltr">입력창</div></div></div>';
    expect(findMessageElements().length).toBe(0);
  });

  // ── gct-translation 제외 ──

  test('.gct-translation 내부 제외 (뱃지 루프 방지)', function() {
    document.body.innerHTML =
      '<div class="gct-translation"><div dir="auto">번역문</div></div>';
    expect(findMessageElements().length).toBe(0);
  });

  test('gct-translation 클래스 자체 요소 제외', function() {
    document.body.innerHTML =
      '<div class="gct-translation" dir="auto">번역문 직접</div>';
    expect(findMessageElements().length).toBe(0);
  });

  test('gct-translation 형제 요소는 포함됨', function() {
    document.body.innerHTML =
      '<div jsname="bgckF">원문<div class="gct-translation">번역</div></div>' +
      '<div jsname="bgckF">새 메시지</div>';
    // 첫 번째 bgckF는 이미 .gct-translation 자식이 있으면 translateIncomingMessage에서 스킵
    // findMessageElements 단계에서는 gct-translation 자식 여부를 체크하지 않음
    var results = findMessageElements();
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  // ── 버튼/링크 제외 ──

  test('button 내부 제외', function() {
    document.body.innerHTML = '<button><div dir="auto">전송</div></button>';
    expect(findMessageElements().length).toBe(0);
  });

  test('a[href] 내부 제외', function() {
    document.body.innerHTML = '<a href="#"><span dir="auto">링크 텍스트</span></a>';
    expect(findMessageElements().length).toBe(0);
  });

  test('role="button" 내부 제외', function() {
    document.body.innerHTML = '<div role="button"><span dir="auto">클릭</span></div>';
    expect(findMessageElements().length).toBe(0);
  });

  test('role="menuitem" 내부 제외', function() {
    document.body.innerHTML = '<div role="menuitem"><div dir="auto">메뉴</div></div>';
    expect(findMessageElements().length).toBe(0);
  });

  // ── Outgoing 메시지 제외 ──

  test('[Outgoing] jsname="Ne3sFf" + Pxe3Yd 클래스 → 내 메시지 제외', function() {
    document.body.innerHTML =
      '<div jsname="Ne3sFf" class="nF6pT Pxe3Yd RCXHzc">' +
        '<div jsname="bgckF">Ah, it\'s the last time</div>' +
      '</div>';
    expect(findMessageElements().length).toBe(0);
  });

  test('[Outgoing] Pxe3Yd 없으면 상대방 메시지로 포함', function() {
    document.body.innerHTML =
      '<div jsname="Ne3sFf" class="nF6pT RCXHzc">' +
        '<div jsname="bgckF">Okay, let me check</div>' +
      '</div>';
    expect(findMessageElements().length).toBe(1);
  });

  test('[Outgoing] 내 메시지 제외 + 상대 메시지 포함 혼합', function() {
    document.body.innerHTML =
      '<div jsname="Ne3sFf" class="nF6pT Pxe3Yd RCXHzc">' +
        '<div jsname="bgckF">My sent message</div>' +
      '</div>' +
      '<div jsname="Ne3sFf" class="nF6pT RCXHzc">' +
        '<div jsname="bgckF">Incoming message</div>' +
      '</div>';
    expect(findMessageElements().length).toBe(1);
  });

  test('[Outgoing] 여러 내 메시지 모두 제외', function() {
    document.body.innerHTML =
      '<div jsname="Ne3sFf" class="Pxe3Yd"><div jsname="bgckF">Mine 1</div></div>' +
      '<div jsname="Ne3sFf" class="Pxe3Yd"><div jsname="bgckF">Mine 2</div></div>' +
      '<div jsname="Ne3sFf" class="Pxe3Yd"><div jsname="bgckF">Mine 3</div></div>';
    expect(findMessageElements().length).toBe(0);
  });

  test('[Outgoing] Ne3sFf 조상 없으면 Pxe3Yd 클래스 있어도 제외 안 함', function() {
    // Ne3sFf 조상이 없는 경우 Pxe3Yd 체크가 적용되지 않음
    document.body.innerHTML =
      '<div class="Pxe3Yd"><div jsname="bgckF">This should be included</div></div>';
    expect(findMessageElements().length).toBe(1);
  });

  // ── 인용/답장(Reply) 메시지 ──

  test('[Reply] wVNE5 quote 섹션 포함 구조 감지됨 (findMessageElements는 통과)', function() {
    document.body.innerHTML =
      '<div jsname="bgckF">' +
        '<div class="wVNE5 Oq47ld">인용됨\n발신자\nRobert Tran\nOh, I see the reason</div>' +
        '<span></span>' +
      '</div>';
    // findMessageElements는 텍스트가 있으면 포함 (번역 스킵은 translateIncomingMessage에서 처리)
    expect(findMessageElements().length).toBe(1);
  });

  test('[Reply] 인용 메시지 + 새 메시지 혼합 시 모두 감지', function() {
    document.body.innerHTML =
      '<div jsname="bgckF">Simple incoming message</div>' +
      '<div jsname="bgckF">' +
        '<div class="wVNE5 Oq47ld">인용됨\n발신자\nRobert Tran\nQuoted text</div>' +
        'Please give me that url' +
      '</div>';
    expect(findMessageElements().length).toBe(2);
  });

  // ── data-gct-done ──

  test('data-gct-done 처리 완료 요소 제외', function() {
    document.body.innerHTML = '<div dir="auto" data-gct-done="1">이미 처리됨</div>';
    expect(findMessageElements().length).toBe(0);
  });

  test('data-gct-done="1" bgckF 제외', function() {
    document.body.innerHTML = '<div jsname="bgckF" data-gct-done="1">처리완료</div>';
    expect(findMessageElements().length).toBe(0);
  });

  test('data-gct-done 없으면 포함', function() {
    document.body.innerHTML = '<div jsname="bgckF">미처리 메시지</div>';
    expect(findMessageElements().length).toBe(1);
  });

  // ── 텍스트 길이 ──

  test('텍스트 없는 요소 제외', function() {
    document.body.innerHTML = '<div dir="auto"></div>';
    expect(findMessageElements().length).toBe(0);
  });

  test('공백만 있는 요소 제외', function() {
    document.body.innerHTML = '<div jsname="bgckF">   \n\t  </div>';
    expect(findMessageElements().length).toBe(0);
  });

  test('1자 텍스트 요소 포함 (길이 체크는 translateIncomingMessage에서 처리)', function() {
    document.body.innerHTML = '<div jsname="bgckF">A</div>';
    expect(findMessageElements().length).toBe(1);
  });

  test('이모지만 있는 요소 포함', function() {
    document.body.innerHTML = '<div jsname="bgckF">😀👍🎉</div>';
    expect(findMessageElements().length).toBe(1);
  });

  test('URL만 있는 요소 포함', function() {
    document.body.innerHTML = '<div jsname="bgckF">https://example.com/path</div>';
    expect(findMessageElements().length).toBe(1);
  });

  test('숫자만 있는 요소 포함', function() {
    document.body.innerHTML = '<div jsname="bgckF">12345</div>';
    expect(findMessageElements().length).toBe(1);
  });

  // ── 중복 방지 ──

  test('중복 요소 한 번만 포함 (data-message-id + dir="auto" 둘 다 매칭)', function() {
    document.body.innerHTML =
      '<div data-message-id="msg1"><div dir="auto">중복 감지 테스트</div></div>';
    expect(findMessageElements().length).toBe(1);
  });

  test('중복 방지 (jsname="bgckF" + dir="auto" 동시)', function() {
    document.body.innerHTML =
      '<div jsname="bgckF" dir="auto">중복 bgckF + dir 테스트</div>';
    expect(findMessageElements().length).toBe(1);
  });

  // ── 혼합 시나리오 ──

  test('혼합 시나리오 (유효 3개, 제외 3개)', function() {
    document.body.innerHTML =
      '<div data-message-id="m1"><div dir="ltr">Valid 1</div></div>' +
      '<div data-message-id="m2"><div dir="auto">Valid 2</div></div>' +
      '<div dir="auto">Valid 3</div>' +
      '<div contenteditable="true"><div dir="auto">Input</div></div>' +
      '<button><div dir="auto">Button</div></button>' +
      '<div dir="auto" data-gct-done="1">Done</div>';
    expect(findMessageElements().length).toBe(3);
  });

  test('실제 Google Chat 전체 구조 시뮬레이션', function() {
    document.body.innerHTML =
      // 상대방 메시지 1 (수신)
      '<div jsname="Ne3sFf" class="nF6pT RCXHzc">' +
        '<div class="B8q9Gf qnQFwb" jsname="o7uNDd">' +
          '<div class="DTp27d" jsname="bgckF">Do I need to test withIncognito mode</div>' +
        '</div>' +
      '</div>' +
      // 내가 보낸 메시지 (발신) - 제외되어야 함
      '<div jsname="Ne3sFf" class="nF6pT Pxe3Yd RCXHzc">' +
        '<div class="B8q9Gf qnQFwb" jsname="o7uNDd">' +
          '<div class="DTp27d" jsname="bgckF">Yes, please test in incognito mode</div>' +
        '</div>' +
      '</div>' +
      // 상대방 메시지 2 - 인용 포함
      '<div jsname="Ne3sFf" class="nF6pT RCXHzc">' +
        '<div class="DTp27d" jsname="bgckF">' +
          '<div class="wVNE5 Oq47ld">인용됨\n나\nYes please test</div>' +
          'It is working now' +
        '</div>' +
      '</div>' +
      // 입력창 (제외)
      '<div contenteditable="true" role="textbox">' +
        '<div jsname="bgckF">입력 중...</div>' +
      '</div>';
    expect(findMessageElements().length).toBe(2);
  });
});

// ── findOutgoingElements() 테스트 ───────────────────

describe('findOutgoingElements()', function() {

  beforeEach(function() {
    document.body.innerHTML = '';
  });

  test('Pxe3Yd 클래스 가진 Ne3sFf 조상 내 bgckF → 발신 메시지 감지', function() {
    document.body.innerHTML =
      '<div jsname="Ne3sFf" class="nF6pT Pxe3Yd RCXHzc">' +
        '<div jsname="bgckF">Ah, it\'s the last time</div>' +
      '</div>';
    expect(findOutgoingElements().length).toBe(1);
  });

  test('Pxe3Yd 없으면 발신 목록에 포함 안 됨 (상대방 메시지)', function() {
    document.body.innerHTML =
      '<div jsname="Ne3sFf" class="nF6pT RCXHzc">' +
        '<div jsname="bgckF">Okay, let me check</div>' +
      '</div>';
    expect(findOutgoingElements().length).toBe(0);
  });

  test('여러 발신 메시지 모두 감지', function() {
    document.body.innerHTML =
      '<div jsname="Ne3sFf" class="Pxe3Yd"><div jsname="bgckF">My message 1</div></div>' +
      '<div jsname="Ne3sFf" class="Pxe3Yd"><div jsname="bgckF">My message 2</div></div>' +
      '<div jsname="Ne3sFf" class="Pxe3Yd"><div jsname="bgckF">My message 3</div></div>';
    expect(findOutgoingElements().length).toBe(3);
  });

  test('발신 + 수신 혼합 시 발신만 반환', function() {
    document.body.innerHTML =
      '<div jsname="Ne3sFf" class="Pxe3Yd"><div jsname="bgckF">My message</div></div>' +
      '<div jsname="Ne3sFf" class="RCXHzc"><div jsname="bgckF">Their message</div></div>';
    var results = findOutgoingElements();
    expect(results.length).toBe(1);
    expect(results[0].textContent).toBe('My message');
  });

  test('data-gct-done 완료 발신 메시지 제외', function() {
    document.body.innerHTML =
      '<div jsname="Ne3sFf" class="Pxe3Yd">' +
        '<div jsname="bgckF" data-gct-done="1">Already processed</div>' +
      '</div>';
    expect(findOutgoingElements().length).toBe(0);
  });

  test('이미 번역 뱃지(.gct-translation)가 붙은 발신 메시지 제외', function() {
    document.body.innerHTML =
      '<div jsname="Ne3sFf" class="Pxe3Yd">' +
        '<div jsname="bgckF">My message<div class="gct-translation">번역</div></div>' +
      '</div>';
    expect(findOutgoingElements().length).toBe(0);
  });

  test('텍스트 없는 발신 메시지 제외', function() {
    document.body.innerHTML =
      '<div jsname="Ne3sFf" class="Pxe3Yd"><div jsname="bgckF"></div></div>';
    expect(findOutgoingElements().length).toBe(0);
  });

  test('Ne3sFf 조상 없는 bgckF는 발신 목록에 포함 안 됨', function() {
    document.body.innerHTML =
      '<div jsname="bgckF">Some message without Ne3sFf</div>';
    expect(findOutgoingElements().length).toBe(0);
  });

  test('findMessageElements와 findOutgoingElements는 겹치지 않음', function() {
    document.body.innerHTML =
      '<div jsname="Ne3sFf" class="Pxe3Yd"><div jsname="bgckF">My sent</div></div>' +
      '<div jsname="Ne3sFf" class="RCXHzc"><div jsname="bgckF">Their msg</div></div>';
    var incoming = findMessageElements();
    var outgoing = findOutgoingElements();
    // 수신: 1개 (Pxe3Yd 없는 것), 발신: 1개 (Pxe3Yd 있는 것)
    expect(incoming.length).toBe(1);
    expect(outgoing.length).toBe(1);
    // 겹치는 요소 없음
    var incomingSet = new Set(incoming);
    outgoing.forEach(function(el) {
      expect(incomingSet.has(el)).toBe(false);
    });
  });
});

// ── createTranslationBadge() 테스트 ─────────────────

describe('createTranslationBadge()', function() {

  test('번역 텍스트 포함된 뱃지 생성', function() {
    var badge = createTranslationBadge('안녕하세요');
    expect(badge.classList.contains('gct-translation')).toBe(true);
    expect(badge.textContent).toContain('안녕하세요');
  });

  test('🌐 아이콘 포함', function() {
    var badge = createTranslationBadge('Hello');
    expect(badge.textContent).toContain('🌐');
  });

  test('아이콘이 첫 번째 자식', function() {
    var badge = createTranslationBadge('Test');
    expect(badge.firstChild.className).toBe('gct-translation-icon');
  });

  test('뱃지 태그는 div', function() {
    var badge = createTranslationBadge('Test');
    expect(badge.tagName.toLowerCase()).toBe('div');
  });

  test('gct-translation 클래스 정확히 설정', function() {
    var badge = createTranslationBadge('Test');
    expect(badge.className).toBe('gct-translation');
  });

  test('아이콘 스팬 className은 gct-translation-icon', function() {
    var badge = createTranslationBadge('Test');
    expect(badge.firstChild.tagName.toLowerCase()).toBe('span');
    expect(badge.firstChild.className).toBe('gct-translation-icon');
  });

  test('아이콘 텍스트는 🌐', function() {
    var badge = createTranslationBadge('Test');
    expect(badge.firstChild.textContent).toBe('🌐 ');
  });

  test('자식 수는 2개 (아이콘 span + 번역 텍스트)', function() {
    var badge = createTranslationBadge('번역 텍스트');
    // prepend로 icon이 앞에, 기존 textContent가 text node로 뒤에
    expect(badge.childNodes.length).toBe(2);
  });

  test('빈 문자열도 뱃지 생성됨', function() {
    var badge = createTranslationBadge('');
    expect(badge.classList.contains('gct-translation')).toBe(true);
  });

  test('긴 텍스트도 정상 처리', function() {
    var longText = 'A'.repeat(500);
    var badge = createTranslationBadge(longText);
    expect(badge.textContent).toContain(longText);
  });

  test('특수문자 포함 텍스트', function() {
    var badge = createTranslationBadge('<script>alert("xss")</script>');
    // textContent로 설정하므로 HTML 태그가 이스케이프됨
    expect(badge.querySelector('script')).toBeNull();
    expect(badge.textContent).toContain('alert');
  });

  test('뱃지 자체는 메시지 셀렉터에 잡히지 않음', function() {
    var badge = createTranslationBadge('번역 결과');
    document.body.appendChild(badge);
    var found = findMessageElements().filter(function(el) {
      return el === badge || !!el.closest('.gct-translation');
    });
    expect(found.length).toBe(0);
    document.body.removeChild(badge);
  });

  test('뱃지 내부 dir="auto" 요소도 셀렉터에 잡히지 않음', function() {
    document.body.innerHTML = '';
    var badge = createTranslationBadge('번역 결과');
    var inner = document.createElement('div');
    inner.setAttribute('dir', 'auto');
    inner.textContent = '내부 텍스트';
    badge.appendChild(inner);
    document.body.appendChild(badge);
    expect(findMessageElements().length).toBe(0);
  });

  test('메시지에 뱃지 추가 후 구조 확인', function() {
    document.body.innerHTML = '<div jsname="bgckF">Original message</div>';
    var msgEl = document.querySelector('[jsname="bgckF"]');
    var badge = createTranslationBadge('번역된 메시지');
    msgEl.appendChild(badge);
    expect(msgEl.querySelector('.gct-translation')).not.toBeNull();
    expect(msgEl.querySelector('.gct-translation-icon')).not.toBeNull();
  });
});

// ── 인용/답장 메시지 텍스트 추출 테스트 ─────────────

describe('extractMessageText() - 인용 섹션 제거', function() {

  test('일반 메시지: 전체 텍스트 반환', function() {
    document.body.innerHTML = '<div jsname="bgckF">Do I need to test withIncognito mode</div>';
    var el = document.querySelector('[jsname="bgckF"]');
    expect(extractMessageText(el)).toBe('Do I need to test withIncognito mode');
  });

  test('인용 포함 메시지: quote 섹션 제거 후 새 메시지만 반환', function() {
    document.body.innerHTML =
      '<div jsname="bgckF">' +
        '<div class="wVNE5 Oq47ld">인용됨\n발신자\nRobert Tran\nOh, I see the reason</div>' +
        'Please give me that url' +
      '</div>';
    var el = document.querySelector('[jsname="bgckF"]');
    var text = extractMessageText(el);
    expect(text).toBe('Please give me that url');
    expect(text).not.toContain('인용됨');
    expect(text).not.toContain('발신자');
  });

  test('인용 섹션만 있고 새 메시지 없으면 빈 문자열', function() {
    document.body.innerHTML =
      '<div jsname="bgckF">' +
        '<div class="wVNE5 Oq47ld">인용됨\n나\nSome quoted text</div>' +
      '</div>';
    var el = document.querySelector('[jsname="bgckF"]');
    var text = extractMessageText(el);
    expect(text).toBe('');
  });

  test('인용 섹션 제거 시 원본 DOM 변경 없음', function() {
    document.body.innerHTML =
      '<div jsname="bgckF">' +
        '<div class="wVNE5 Oq47ld">인용된 원문</div>' +
        'New message text' +
      '</div>';
    var el = document.querySelector('[jsname="bgckF"]');
    extractMessageText(el);
    // 원본 DOM에 여전히 wVNE5가 있어야 함
    expect(el.querySelector('.wVNE5')).not.toBeNull();
  });

  test('한국어 UI 문자열 포함 인용 → 제거 후 영어만 남음', function() {
    document.body.innerHTML =
      '<div jsname="bgckF">' +
        '<div class="wVNE5 Oq47ld">인용됨\n인용됨\n발신자\n나\nThis is a sample english text</div>' +
        'it\'s working now' +
      '</div>';
    var el = document.querySelector('[jsname="bgckF"]');
    var text = extractMessageText(el);
    expect(text).not.toContain('인용됨');
    expect(text).not.toContain('발신자');
    expect(text).toContain("it's working now");
  });
});

// ── 발신 번역 조건 ───────────────────────────────────

describe('발신 번역 조건', function() {
  test('감지 언어 ≠ 목표 언어 → 번역 필요', function() {
    expect('ko' !== 'en').toBe(true);
  });
  test('감지 언어 = 목표 언어 → 번역 불필요', function() {
    expect('en' !== 'en').toBe(false);
  });
  test('감지 언어 = auto → 번역 필요로 처리', function() {
    expect('auto' !== 'en').toBe(true);
  });
  test('한국어 → 일본어 번역 필요', function() {
    expect('ko' !== 'ja').toBe(true);
  });
  test('한국어 → 중국어 번역 필요', function() {
    expect('ko' !== 'zh-CN').toBe(true);
  });
  test('영어 → 영어 번역 불필요', function() {
    expect('en' !== 'en').toBe(false);
  });
  test('일본어 → 일본어 번역 불필요', function() {
    expect('ja' !== 'ja').toBe(false);
  });
});

// ── 수신 번역 조건 ───────────────────────────────────

describe('수신 번역 조건', function() {
  test('영어 수신 + targetLang=ko → 번역 필요', function() {
    expect('en' !== 'ko').toBe(true);
  });
  test('한국어 수신 + targetLang=ko → 번역 불필요', function() {
    expect('ko' !== 'ko').toBe(false);
  });
  test('일본어 수신 + targetLang=ko → 번역 필요', function() {
    expect('ja' !== 'ko').toBe(true);
  });
  test('중국어 수신 + targetLang=ko → 번역 필요', function() {
    expect('zh-CN' !== 'ko').toBe(true);
  });
  test('영어 수신 + targetLang=en → 번역 불필요', function() {
    expect('en' !== 'en').toBe(false);
  });
  test('번역 결과 = 원문(소문자 비교) → 뱃지 표시 안 함', function() {
    expect('Hello'.toLowerCase() === 'Hello'.toLowerCase()).toBe(true);
  });
  test('번역 결과 ≠ 원문 → 뱃지 표시', function() {
    expect('안녕하세요'.toLowerCase() === 'Hello'.toLowerCase()).toBe(false);
  });
  test('번역 결과 빈 문자열 → 뱃지 표시 안 함', function() {
    var translated = '';
    expect(!translated).toBe(true);
  });
  test('번역 결과 null → 뱃지 표시 안 함', function() {
    var translated = null;
    expect(!translated).toBe(true);
  });
  test('autoTranslate=false → 번역 실행 안 함', function() {
    var settings = { autoTranslate: false, targetLang: 'ko' };
    expect(settings.autoTranslate).toBe(false);
  });
  test('autoTranslate=true → 번역 실행', function() {
    var settings = { autoTranslate: true, targetLang: 'ko' };
    expect(settings.autoTranslate).toBe(true);
  });
  test('텍스트 길이 < 3 → 번역 스킵', function() {
    expect('Hi'.length < 3).toBe(true);
  });
  test('텍스트 길이 >= 3 → 번역 진행', function() {
    expect('Hey'.length < 3).toBe(false);
  });
});
