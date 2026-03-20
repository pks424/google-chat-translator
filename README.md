# GChat Auto Translator

Google Chat에서 외국어로 대화할 때 자동으로 번역해주는 Chrome 확장 프로그램입니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **발신 자동 번역** | 한글로 입력 후 Enter를 누르면 자동으로 설정 언어로 번역하여 전송 |
| **수신 자동 번역** | 상대방 메시지를 받으면 원문 아래에 한국어 번역을 자동으로 표시 |
| **언어 자동 감지** | 목표 언어로 이미 작성된 경우 번역 건너뜀 |
| **발신 수동 번역** | `Alt + T` 단축키로 전송 없이 입력창 텍스트만 번역 |
| **AI 번역 엔진 지원** | Gemini, Claude, ChatGPT 등 AI 기반 고품질 번역 선택 가능 |
| **번역 캐시** | 동일 텍스트 재번역 방지 (최대 500건) — API 비용 절감 + 속도 향상 |
| **용어 사전** | 고유명사/전문용어 번역 방지 또는 커스텀 번역 지정 |
| **채팅방별 번역 ON/OFF** | 플로팅 버튼 또는 `Alt+T`로 채팅방별 번역 토글 |
| **번역 뱃지 클릭 토글** | 번역 뱃지 클릭 시 원문 ↔ 번역 전환 |
| **AI 번역 톤 설정** | 격식체/비격식체/비즈니스/친근한 톤 선택 (AI 엔진 전용) |
| **뷰포트 기반 번역** | 화면에 보이는 메시지만 번역 — API 호출 최소화 |
| **Gmail 내장 Chat 지원** | `mail.google.com` 내장 Chat에서도 동작 |
| **토스트 알림** | API 사용량 초과 등 오류 시 화면 상단에 알림 표시 |

---

## 지원 번역 엔진

| 엔진 | API 키 | 비용 | 특징 |
|------|--------|------|------|
| **Google 번역 (무료)** | 불필요 | 무료 | 기본값, 빠른 속도 |
| **Google Cloud Translation** | 필요 | 유료 | 공식 API, 안정적 |
| **Gemini (Google AI)** | 필요 | 무료 티어 있음 | AI 기반, 자연스러운 번역 |
| **Claude (Anthropic)** | 필요 | 유료 | 고품질 AI 번역 |
| **ChatGPT (OpenAI)** | 필요 | 유료 | GPT-4o-mini 기반 |

---

## 설치 방법

### Chrome Web Store (권장)
[Chrome Web Store에서 설치하기](https://chromewebstore.google.com/detail/gchat-auto-translator/fafpmpkhaeaklibkoklhalcghiopfjlk)

### 수동 설치 (개발자 모드)

1. 이 저장소를 다운로드하거나 `git clone`
2. Chrome 주소창에 `chrome://extensions` 입력
3. 우측 상단 **개발자 모드** 토글 ON
4. **압축 해제된 확장 프로그램을 로드합니다** 클릭
5. 다운로드한 폴더 선택

필요한 파일:
```
google-chat-translator/
├── manifest.json
├── content.js
├── background.js
├── popup.html
├── popup.js
├── styles.css
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 초기 설정

1. Chrome 우측 상단 퍼즐 아이콘(🧩) → **GChat Auto Translator** 클릭
2. 번역 엔진 선택 (기본: Google 무료)
3. AI 엔진 선택 시 해당 API 키 입력
4. 발신/수신 언어 설정
5. **저장하기** 클릭

---

## 사용 방법

### 메시지 보내기 (발신 번역)
1. 채팅 입력창에 **한글**로 메시지 입력
2. **Enter** 키를 누르면 자동으로 설정 언어로 번역되어 전송
3. 이미 목표 언어로 입력한 경우 번역 없이 그대로 전송

**수동 번역:** `Alt + T` — 전송 없이 입력창 내용만 번역

### 메시지 받기 (수신 번역)
상대방이 메시지를 보내면 원문 아래에 🌐 아이콘과 함께 번역이 자동 표시됩니다.

```
Okay, let me check
🌐 알았어 확인해 볼게
```

---

## 지원 환경

- `https://chat.google.com` (Google Chat)
- `https://mail.google.com` (Gmail 내장 Chat)

---

## 지원 언어

| 언어 | 코드 |
|------|------|
| 한국어 | ko |
| 영어 | en |
| 일본어 | ja |
| 중국어 간체 | zh-CN |
| 중국어 번체 | zh-TW |
| 독일어 | de |
| 프랑스어 | fr |
| 스페인어 | es |

---

## 업데이트 방법

1. 새 버전의 파일로 폴더 내용 교체
2. `chrome://extensions` → 확장 프로그램 새로고침(↺) 클릭
3. Google Chat 탭 새로고침

---

## FAQ

**Q. 번역이 동작하지 않아요**
A. `chrome://extensions`에서 확장 프로그램이 활성화되어 있는지 확인하고, Google Chat 탭을 새로고침(`Ctrl + Shift + R`)해 주세요.

**Q. "API 사용량 초과" 알림이 나타나요**
A. Gemini 무료 티어는 분당 15건 제한이 있습니다. 잠시 기다리면 자동으로 재시도됩니다. 제한이 부담되면 Google 무료 번역으로 전환하세요.

**Q. Gmail에서 채팅 번역이 안 돼요**
A. 확장 프로그램을 새로고침한 후 Gmail 탭도 새로고침해 주세요. `all_frames: true` 설정으로 Gmail 내장 Chat iframe에서도 동작합니다.

**Q. API 키가 필요한가요?**
A. Google 무료 번역은 API 키 없이 사용 가능합니다. AI 엔진(Gemini, Claude, ChatGPT)을 사용하려면 각 서비스의 API 키가 필요합니다.

---

## 개인정보 및 보안

- 입력한 텍스트는 선택한 번역 엔진(Google/Gemini/Claude/OpenAI)으로만 전송됩니다
- 별도 서버나 외부 서비스로 데이터를 수집하거나 저장하지 않습니다
- API 키를 포함한 모든 설정은 Chrome 로컬 저장소(`chrome.storage.local`)에만 저장됩니다
- [개인정보처리방침](https://pks424.github.io/google-chat-translator/privacy-policy.html)

---

## 변경 이력

### v1.2.0
- 번역 캐시 추가 (최대 500건, 메모리 내 LRU)
- 용어 사전 기능 — 고유명사/전문용어 번역 방지 또는 커스텀 번역
- 채팅방별 번역 ON/OFF 토글 (플로팅 버튼 + 설정에서 표시/숨김)
- 번역 뱃지 클릭 시 원문 ↔ 번역 전환
- 단축키 지원 (`Alt+T` — 채팅방 번역 토글)
- AI 번역 톤 설정 (격식체/비격식체/비즈니스/친근한)
- 뷰포트 기반 번역 (IntersectionObserver) — 보이는 메시지만 번역
- 언어 자동 감지 — 이미 목표 언어인 메시지 API 호출 스킵
- API 오류 토스트 안내 개선 (401/429 등)
- Extension context 무효화 방어 강화

### v1.1.0
- AI 번역 엔진 추가 (Gemini, Claude, ChatGPT/OpenAI)
- API rate limit 자동 재시도 (지수 백오프)
- API 사용량 초과 시 토스트 알림 표시
- Gmail 내장 Chat 지원 (`all_frames: true`)
- 사이드바/대화 목록 번역 오적용 수정
- Extension context 무효화 방어 코드 추가

### v1.0.0
- 최초 릴리스
- Google 무료 번역 / Google Cloud Translation 지원
- 발신/수신 자동 번역
- Alt+T 수동 번역
- 팝업 설정 UI

---

## 라이선스

MIT License
