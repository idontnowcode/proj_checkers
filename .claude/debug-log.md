# Debug Log — proj_checkers

---

## [2026-04-30] Gemini API 404 — 모델명 오류

**태그**: `gemini` `api` `404` `model-name` `github-actions`
**환경**: GitHub Actions ubuntu-latest, Node.js 20, node-fetch v3

### 증상
`요약 실패 (...): Gemini 404` — 모든 기사 요약 실패. 수집은 정상.

### 원인
`GEMINI_MODEL` 상수에 존재하지 않는 모델명 사용.
- `gemini-2.0-flash` → 404 (deprecated or renamed)
- `gemini-2.0-flash-001` → 404 (존재하지 않는 suffix)
- `gemini-1.5-flash` → 404 (구버전 API에서 제거됨)
- **정답: `gemini-2.5-flash`** (2026 기준 현행 모델)

### 해결책
```js
const GEMINI_MODEL = 'gemini-2.5-flash';
```

### 재발 방지
신규 Gemini 모델 사용 전 실제 사용 가능 모델 목록 조회:
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY" | jq '.[].name'
```
또는 [ai.google.dev/api/models](https://ai.google.dev/api/models) 에서 현행 모델 ID 확인.

---

## [2026-04-30] Gemini 응답 JSON 잘림 — maxOutputTokens 부족

**태그**: `gemini` `json` `truncation` `maxOutputTokens`
**환경**: GitHub Actions, gemini-2.5-flash, responseSchema 사용

### 증상
`요약 실패 (...): Unterminated string in JSON at position N`

### 원인
`maxOutputTokens: 512`가 너무 작아 JSON 응답이 중간에 잘림.
`responseMimeType: 'application/json'` + `responseSchema` 조합에서 발생 빈도 높음.

### 해결책
```js
maxOutputTokens: 1024,  // 512 → 1024
```

### 재발 방지
JSON 구조화 응답(`responseSchema`)을 사용할 때는 `maxOutputTokens`를 최소 1024로 설정. summary(150자) + keyPoint(1문장) 기준 약 300~400 토큰 필요.

---

## [2026-04-30] npm cache 에러 — package-lock.json 없음

**태그**: `github-actions` `npm` `cache` `setup-node`
**환경**: GitHub Actions, actions/setup-node@v4

### 증상
```
Error: Some specified paths were not resolved, unable to cache dependencies.
```

### 원인
`actions/setup-node`의 `cache-dependency-path: daily-digest/package-lock.json` 설정인데 `package-lock.json`이 repo에 없음.

### 해결책
```yaml
# cache 옵션 제거, npm ci → npm install 로 변경
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    # cache 옵션 없음

- run: npm install  # npm ci 대신
```

### 재발 방지
`npm ci`는 `package-lock.json`이 반드시 있어야 함. lock 파일 없이 배포하는 경우 `npm install` 사용. 또는 `package-lock.json`을 repo에 커밋.

---

## [2026-04-30] GitHub Actions 워크플로우 미인식 — 잘못된 파일 경로

**태그**: `github-actions` `workflow` `path`
**환경**: GitHub, 서브디렉토리 프로젝트

### 증상
Actions 탭에 워크플로우가 나타나지 않음.

### 원인
`daily-digest/.github/workflows/collect.yml` — GitHub은 저장소 **루트**의 `.github/workflows/`만 인식.

### 해결책
워크플로우 파일을 루트로 이동:
```
.github/workflows/collect.yml  ✅
daily-digest/.github/workflows/collect.yml  ❌
```

### 재발 방지
서브디렉토리 프로젝트라도 GitHub Actions 워크플로우는 항상 저장소 루트 `.github/workflows/`에 위치해야 함.

---

## [2026-04-30] 이벤트 리스너 누적 — renderXxx() 반복 호출 시

**태그**: `javascript` `event-listener` `memory-leak` `ux`
**환경**: 브라우저, 바닐라 JS, innerHTML 재렌더 패턴

### 증상
탭을 클릭하면 N번 선택한 날짜 수만큼 이벤트 핸들러 중복 실행.

### 원인
`renderArticles()` 내부에서 `element.addEventListener(...)` 호출 → 함수 실행마다 리스너 추가. `tabsInner.onclick = null`은 property 핸들러만 제거하고 `addEventListener` 리스너는 제거하지 않음.

### 해결책
```js
// ❌ 잘못된 패턴 — renderXxx() 안에 addEventListener
function render() {
  el.innerHTML = '...';
  el.addEventListener('click', handler);  // 매 렌더마다 추가
}

// ✅ 올바른 패턴 — 초기화 시점에 단 한 번
document.getElementById('tabBar').addEventListener('click', e => {
  const btn = e.target.closest('.tab');
  if (btn) switchTab(btn.dataset.key);
});
```

### 재발 방지
동적 렌더 컴포넌트에 이벤트를 붙일 때는 **항상 부모 요소에 이벤트 위임(event delegation)**으로 초기화 시 1회만 등록. `data-*` attribute로 식별자 전달.

---

## [2026-04-30] RSS 피드 HTML 엔티티 미디코딩 — Gemini 요약 품질 저하

**태그**: `rss` `html-entities` `gemini` `preprocessing`
**환경**: Node.js, BBC/Al Jazeera/TechCrunch RSS

### 증상
Gemini 요약 결과에 `&#8217;`, `&amp;`, `&lt;` 등이 그대로 포함됨.

### 원인
RSS item의 `<title>`, `<description>` 필드에서 HTML 엔티티가 그대로 Gemini API로 전달됨.

### 해결책
```js
function decodeHtmlEntities(s) {
  return (s ?? '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ');
}
```
파싱 직후 title과 description에 적용.

### 재발 방지
RSS/HTML 소스에서 텍스트를 추출하면 항상 엔티티 디코딩 + HTML 태그 제거(`stripHtml`) 후 LLM에 전달.
