---
name: web-dev
description: Builds complete static web applications (HTML/CSS/JS) that can be deployed to GitHub Pages without any user intervention. Use this skill whenever the user wants to create a web app, dashboard, landing page, or any browser-based UI — even if they don't explicitly say "web app". Trigger when the user wants to visualize data, build a portfolio, create a tool that runs in the browser, or deploy something to GitHub Pages. Also trigger when another skill's output needs to be presented as a web interface, or when the user says "make this accessible via URL", "put this on the web", or "I want to share this as a link".
---

# web-dev

사용자 개입 없이 AI 단독으로 완성 가능한 정적 웹 앱(HTML/CSS/JS)을 기획·구현·배포하는 스킬. 서버·DB·로그인·결제가 필요한 기능은 구현하지 않는다.

## 사용법

```
/web-dev
```

실행 후 만들고 싶은 웹 앱의 목적과 표시할 내용을 설명하면 된다.

## 동작 방식

### 1단계: 요구사항 분석

입력된 내용을 아래 항목으로 분석한다:

| 항목 | 확인 내용 |
|------|-----------|
| 앱 목적 | 무엇을 보여주거나 수행하는가 |
| 데이터 소스 | 로컬 파일(JSON/CSV), 하드코딩, 공개 API 중 무엇인가 |
| 핵심 UI 컴포넌트 | 차트, 테이블, 카드, 폼 등 |
| 반응형 요구 | 모바일·데스크톱 대응 필요 여부 |
| 배포 대상 | GitHub Pages, 로컬 파일 실행 등 |

분석 중 필수 정보가 누락된 경우에만 사용자에게 질문한다.

### 2단계: 기술 스택 선정

AI 단독 실행 가능성을 최우선 기준으로 선정한다.

**기본 스택**
- HTML5 + CSS3 + Vanilla JS (기본)
- Chart.js (CDN) — 차트가 필요한 경우
- 외부 라이브러리는 CDN으로만 사용 (npm 빌드 불필요)

**선택 불가 스택** (사용자 개입 필요)
- 로그인·인증이 필요한 외부 API
- 결제 모듈
- 서버 사이드 렌더링 (Node.js, Python 서버 등)
- 환경변수나 API 키가 런타임에 필요한 서비스

### 3단계: 파일 구조 설계 및 구현

**표준 파일 구조**
```
(프로젝트 루트)/
└── dashboard/          # 또는 앱 목적에 맞는 폴더명
    ├── index.html      # 메인 페이지
    ├── style.css       # 스타일
    ├── app.js          # 로직 및 데이터 바인딩
    └── data/
        └── (데이터파일).json
```

**구현 원칙**
- `index.html`: 시맨틱 마크업, CDN 스크립트는 `</body>` 직전에 배치
- `style.css`: CSS 변수(`--primary`, `--bg` 등)로 테마 관리, 모바일 퍼스트 반응형
- `app.js`: 데이터 로딩 → DOM 렌더링 → 이벤트 바인딩 순서로 작성
- 데이터는 JS 하드코딩보다 JSON 파일 분리를 우선

**CORS 주의사항 (중요)**
`fetch()`로 로컬 JSON 파일을 불러오면 브라우저의 CORS 정책으로 로컬 실행 시 오류가 발생한다. 이를 방지하려면:
- **GitHub Pages 배포 기준**: `fetch('./data/skills.json')` 그대로 사용 가능
- **로컬 미리보기 필요 시**: JSON 데이터를 `app.js` 내부의 `const DATA = {...}` 변수로 인라인

```js
// app.js — 데이터 인라인 패턴 (로컬·배포 모두 호환)
const DATA = {
  skills: [
    { name: "prompt-clarify", score: 97, history: [...] },
    ...
  ]
};
renderDashboard(DATA);
```

**CSS 구조 패턴**
```css
/* 1. 변수 */
:root { --primary: #4f46e5; --bg: #f8f9fa; --card-bg: #fff; }
/* 2. 리셋 */
*, *::before, *::after { box-sizing: border-box; margin: 0; }
/* 3. 레이아웃 */
.container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
/* 4. 컴포넌트 */
.card { background: var(--card-bg); border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
/* 5. 반응형 */
@media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
```

**디자인 기본 원칙**
- 배경: 흰색 또는 밝은 회색 계열 (`#f8f9fa` 등)
- 카드/패널: 흰색 배경 + 미세한 그림자 (`box-shadow: 0 2px 8px rgba(0,0,0,0.08)`)
- 타이포그래피: 시스템 폰트 스택 (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`)
- 컬러 포인트: 1~2가지로 제한
- 최소 터치 영역: 44px × 44px (모바일 접근성)

### 4단계: 자기 검토

파일 작성 후 아래 항목을 순서대로 확인한다. 문제 발견 시 즉시 수정한다.

**기능 검토**
- [ ] HTML에서 CSS·JS 파일 경로가 올바른가 (상대 경로 사용)
- [ ] JSON 데이터 파일 경로가 `fetch()` 호출과 일치하는가
- [ ] `fetch()`를 사용하는 경우 로컬 파일 실행 시 CORS 오류가 발생하지 않도록 데이터를 JS 내부로 인라인하거나, GitHub Pages 배포 기준으로 작성했는가
- [ ] 차트 컨테이너에 명시적 높이가 지정되어 있는가 (Chart.js 렌더링 필수)
- [ ] 빈 데이터·null 값에 대한 방어 코드가 있는가

**디자인 검토**
- [ ] 모바일(375px)과 데스크톱(1280px) 레이아웃이 모두 의도대로 동작하는가
- [ ] 텍스트와 배경의 명도 대비가 충분한가 (WCAG AA: 4.5:1 이상)
- [ ] 가로 스크롤이 발생하지 않는가

**배포 검토**
- [ ] 모든 리소스가 HTTPS CDN 또는 로컬 파일로만 구성되어 있는가
- [ ] GitHub Pages에서 `index.html`이 루트에 위치하는가 (또는 경로 안내 포함)

### 5단계: GitHub Pages 배포

**방식: `gh-pages` 브랜치 배포**

```bash
# 1. gh-pages 브랜치로 대시보드 파일 배포
git subtree push --prefix dashboard origin gh-pages
# 또는 빌드 파일을 gh-pages 브랜치에 직접 커밋
```

배포 후 사용자에게 안내할 내용:
```
배포 완료. 아래 단계로 GitHub Pages를 활성화해 주세요:
1. GitHub 저장소 → Settings → Pages
2. Source: Deploy from a branch
3. Branch: gh-pages / (root)
4. Save

활성화 후 약 1~2분 후 접속 가능:
https://(사용자명).github.io/(저장소명)/
```

## 엣지 케이스 처리

| 상황 | 처리 방식 |
|------|-----------|
| `fetch()`로 로컬 JSON 로드 시 CORS 오류 | 데이터를 JS 변수로 인라인하거나 GitHub Pages 배포 후 테스트 안내 |
| Chart.js CDN 로드 실패 대비 | `<noscript>` 또는 fallback 텍스트 테이블 제공 |
| 데이터 파일이 비어 있는 경우 | "데이터 없음" 안내 메시지 렌더링 |
| 모바일에서 차트가 너무 작은 경우 | `responsive: true`, `maintainAspectRatio: false` 설정 |

## 예시 출력 구조

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>대시보드</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="site-header">...</header>
  <main class="container">
    <section class="skill-grid">...</section>
    <section class="chart-section">...</section>
  </main>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="app.js"></script>
</body>
</html>
```
