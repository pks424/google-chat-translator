// 크롬 웹스토어 업로드용 빌드: dist/google-chat-translator-v{버전}.zip
// 사용: npm run build   (node v10 이상)
//
// 1) 확장 실행에 필요한 파일만 dist/google-chat-translator-v{버전}/ 에 복사
// 2) manifest·popup.html·background.js 가 참조하는 파일이 모두 들어갔는지 검사 (빠지면 실패)
// 3) zip 생성 — Windows 기본 tar(bsdtar) 사용 (zip 안 경로를 '/' 로 기록, 스토어 호환)
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// 확장에 들어가는 파일 (테스트·스토어 자료·문서 제외)
const FILES = [
  'manifest.json',
  'shared.js',
  'content.js',
  'background.js',
  'popup.html',
  'popup.js',
  'styles.css',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
];

function fail(msg) {
  console.error('[build] 실패: ' + msg);
  process.exit(1);
}

// ─── 참조 파일 검사 ───
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const referenced = new Set();
(manifest.content_scripts || []).forEach(cs => {
  (cs.js || []).forEach(f => referenced.add(f));
  (cs.css || []).forEach(f => referenced.add(f));
});
if (manifest.background && manifest.background.service_worker) referenced.add(manifest.background.service_worker);
if (manifest.action && manifest.action.default_popup) referenced.add(manifest.action.default_popup);
Object.values((manifest.action && manifest.action.default_icon) || {}).forEach(f => referenced.add(f));
Object.values(manifest.icons || {}).forEach(f => referenced.add(f));

// popup.html 의 <script src>, background 의 importScripts(...)
const popupHtml = fs.readFileSync(path.join(ROOT, manifest.action.default_popup), 'utf8');
(popupHtml.match(/<script[^>]+src="([^"]+)"/g) || []).forEach(tag => referenced.add(tag.match(/src="([^"]+)"/)[1]));
const bgSrc = fs.readFileSync(path.join(ROOT, manifest.background.service_worker), 'utf8');
(bgSrc.match(/importScripts\(([^)]*)\)/g) || []).forEach(call => {
  (call.match(/'([^']+)'|"([^"]+)"/g) || []).forEach(q => referenced.add(q.slice(1, -1)));
});

const missing = Array.from(referenced).filter(f => FILES.indexOf(f) < 0);
if (missing.length) fail('빌드 목록에 없는 참조 파일: ' + missing.join(', '));
FILES.forEach(f => { if (!fs.existsSync(path.join(ROOT, f))) fail('파일 없음: ' + f); });

// ─── 복사 ───
const name = 'google-chat-translator-v' + manifest.version;
const stage = path.join(DIST, name);
const zipPath = path.join(DIST, name + '.zip');

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) {
    fs.readdirSync(p).forEach(c => rmrf(path.join(p, c)));
    fs.rmdirSync(p);
  } else {
    fs.unlinkSync(p);
  }
}
function mkdirp(p) {
  if (fs.existsSync(p)) return;
  mkdirp(path.dirname(p));
  fs.mkdirSync(p);
}

rmrf(stage);
rmrf(zipPath);
FILES.forEach(f => {
  const dest = path.join(stage, f);
  mkdirp(path.dirname(dest));
  fs.copyFileSync(path.join(ROOT, f), dest);
});

// ─── zip ───
const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
execFileSync(tar, ['-a', '-c', '-f', zipPath, '-C', stage].concat(FILES), { stdio: 'inherit' });

const listed = execFileSync(tar, ['-t', '-f', zipPath]).toString().trim().split(/\r?\n/);
const notInZip = FILES.filter(f => listed.indexOf(f) < 0);
if (notInZip.length) fail('zip 에 빠진 파일: ' + notInZip.join(', '));

console.log('[build] 완료: ' + path.relative(ROOT, zipPath) + ' (v' + manifest.version + ', ' + listed.length + '개 파일, ' + fs.statSync(zipPath).size + ' bytes)');
listed.forEach(f => console.log('  ' + f));
