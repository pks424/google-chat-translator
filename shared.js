// content.js 와 background.js 가 함께 쓰는 값
// - content: manifest 의 content_scripts 에서 content.js 보다 먼저 로드
// - background: importScripts('shared.js')

// 공통 언어 이름 매핑 (AI 프롬프트의 목표 언어 이름, 방 언어 알림 표시)
const LANG_NAMES = { ko: '한국어', en: 'English', ja: '日本語', 'zh-CN': '简体中文', 'zh-TW': '繁體中文', de: 'Deutsch', fr: 'Français', es: 'Español' };
