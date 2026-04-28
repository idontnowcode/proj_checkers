---
name: browser-automation
description: Runs live browser-based QA and UI validation using the Claude in Chrome plugin (MCP). Use this skill whenever: (1) a web app needs real-browser verification after implementation — not just code analysis; (2) the user says "브라우저에서 확인해줘", "실제로 열어봐", "화면 캡처해줘", "콘솔 오류 확인", "UI 동작 검증"; (3) task-orchestrator needs to verify a deployed or locally-served web app (GitHub Pages, localhost, file://). This skill complements app-tester (static code analysis) by performing dynamic runtime checks: page rendering, console errors, network requests, form interactions, and responsive layout. Requires Claude in Chrome plugin to be connected.
---

# browser-automation

Claude in Chrome MCP 플러그인을 사용해 실제 브라우저에서 웹앱을 자동으로 열고, 인터랙션하고, 결과를 검증하는 스킬. `app-tester`가 코드 정적 분석을 담당한다면, 이 스킬은 **런타임 동작 확인**을 담당한다.

## 역할 분리

| 스킬 | 검증 방식 | 대상 |
|------|-----------|------|
| `app-tester` | 정적 코드 분석 | 함수·변수·로직 구조 |
| `browser-automation` | 실제 브라우저 실행 | 렌더링·콘솔·네트워크·UI 인터랙션 |

## 사용법

```
/browser-automation
```

검증할 URL(또는 파일 경로)과 확인할 시나리오를 알려주면 브라우저를 열어 자동 검증한다.

### 입력 명확화 (URL 또는 시나리오 미제공 시)

URL 또는 시나리오가 제공되지 않은 경우, 실행 전에 아래 질문으로 명확화한다.

```
## browser-automation 시작 전 확인

다음 정보를 알려주세요:

1. **검증 대상 URL** (필수)
   - 로컬 파일: file:///경로/index.html
   - 로컬 서버: http://localhost:포트번호
   - 배포 URL: https://...

2. **검증 시나리오** (선택 — 미입력 시 기본 5종 자동 실행)
   기본 시나리오: 렌더링 / 콘솔 오류 / 네트워크 / 반응형 레이아웃 / 스크린샷
   추가 가능: UI 인터랙션, 폼 입력, 특정 요소 확인

3. **합격 기준** (선택 — 미입력 시 80% 이상 PASS 적용)
```

URL만 제공되고 시나리오가 없으면 기본 5종 시나리오를 자동 실행한다.

## 전제 조건

- Claude in Chrome 플러그인이 설치되어 있고 브라우저가 연결되어 있어야 한다
- 연결 확인: `list_connected_browsers` 도구로 사전 확인
- 연결이 없으면 사용자에게 플러그인 설치 안내 후 중단

## 동작 방식

### 1단계: 브라우저 연결 확인

```
사용 도구: mcp__Claude_in_Chrome__list_connected_browsers
목적: 연결된 브라우저 인스턴스 확인
실패 시: "Claude in Chrome 플러그인이 연결되지 않았습니다. 
         크롬 확장 프로그램을 설치하고 활성화해 주세요." 안내 후 중단
```

### 2단계: 대상 URL 열기

```
사용 도구: mcp__Claude_in_Chrome__navigate
입력: 검증 대상 URL
     - 로컬 파일: file:///path/to/index.html
     - 로컬 서버: http://localhost:포트번호
     - 배포 URL: https://username.github.io/repo/
```

### 3단계: 시나리오별 검증 실행

아래 4가지 검증 유형을 필요에 따라 조합하여 실행한다.

#### 3-A. 페이지 렌더링 검증

```
사용 도구: mcp__Claude_in_Chrome__get_page_text
           mcp__Claude_in_Chrome__find

확인 항목:
- 핵심 UI 요소가 렌더링되었는가 (헤더, 카드, 버튼 등)
- 빈 화면 또는 "undefined", "null" 텍스트가 노출되지 않는가
- 레이아웃 구조가 설계대로인가
```

#### 3-B. 콘솔 오류 감지

```
사용 도구: mcp__Claude_in_Chrome__read_console_messages

확인 항목:
- console.error / console.warn 메시지
- JavaScript 런타임 오류 (TypeError, ReferenceError 등)
- CORS 오류 메시지
판정: 오류 없음 → PASS, 오류 있음 → 내용 기록 후 FAIL
```

#### 3-C. 네트워크 요청 확인

```
사용 도구: mcp__Claude_in_Chrome__read_network_requests

확인 항목:
- API 호출이 실제로 발생했는가
- HTTP 상태 코드 (200 외 오류 코드)
- CORS 프록시 폴백 순서가 동작했는가 (rss-fetcher 연계 시)
```

#### 3-D. UI 인터랙션 테스트

```
사용 도구: mcp__Claude_in_Chrome__find
           mcp__Claude_in_Chrome__form_input
           mcp__Claude_in_Chrome__javascript_tool

실행 예시:
1. 버튼 클릭: find("생성 버튼") → javascript_tool("document.querySelector('button').click()")
2. 폼 입력: form_input("#geminiKey", "테스트용_키_값")
3. 상태 변화 확인: get_page_text() → 기대 텍스트 포함 여부 검사
```

#### 3-E. 반응형 레이아웃 검증

```
사용 도구: mcp__Claude_in_Chrome__resize_window

실행 순서:
1. 모바일 (375 × 812): resize_window(375, 812) → get_page_text()
2. 태블릿 (768 × 1024): resize_window(768, 1024)
3. 데스크톱 (1280 × 800): resize_window(1280, 800)

확인 항목: 가로 스크롤 없음, 텍스트 겹침 없음, 핵심 요소 표시
```

### 4단계: QA 보고서 출력

모든 시나리오 실행 후 아래 형식으로 결과를 출력한다.

```
## browser-automation QA 보고서

대상 URL: https://...
실행 시각: YYYY-MM-DD HH:MM

### 검증 결과

| # | 시나리오 | 결과 | 비고 |
|---|----------|------|------|
| 1 | 페이지 렌더링 | ✅ PASS | 핵심 요소 12개 확인 |
| 2 | 콘솔 오류 | ✅ PASS | 오류 없음 |
| 3 | 네트워크 요청 | ✅ PASS | RSS 프록시 1번째 성공 |
| 4 | 버튼 인터랙션 | ❌ FAIL | 클릭 후 상태 변화 없음 |
| 5 | 모바일 레이아웃 | ✅ PASS | 1열 그리드 정상 |
| 6 | 데스크톱 레이아웃 | ✅ PASS | 2열 그리드 정상 |

**종합: 5/6 PASS (83%) — 조건부 통과**

### FAIL 항목 상세

**시나리오 4: 버튼 인터랙션**
- 현상: "카드뉴스 생성" 버튼 클릭 후 배지 상태가 변경되지 않음
- 예상: "생성 중…" 배지로 전환
- 콘솔 오류: "Cannot read property 'textContent' of null" (app.js:142)
- 권장 조치: app.js 142번 줄 null 체크 추가
```

### 5단계: task-orchestrator 연계 시 자동 보고

`task-orchestrator`에서 호출된 경우, FAIL 항목 목록을 반환하여 eval-rubric 과락 판정 또는 재작업 트리거로 활용한다.

## 유틸리티 패턴

### 스크린샷 캡처 (시각적 증거 수집)

```
사용 도구: mcp__Claude_in_Chrome__computer

용도:
- QA 보고서에 시각적 증거 첨부
- 반응형 레이아웃 비교 (모바일 vs 데스크톱)
- FAIL 항목 현장 캡처

실행 시점:
1. 페이지 최초 로드 후 → 기본 렌더링 스크린샷
2. resize_window 후 → 각 해상도별 레이아웃 캡처
3. FAIL 발생 직후 → 오류 상태 캡처
```

```js
// 스크린샷 캡처 패턴
mcp__Claude_in_Chrome__computer({
  action: "screenshot"
})
```

### JavaScript 실행으로 상태 검사

```js
// 특정 요소가 표시 중인지 확인
mcp__Claude_in_Chrome__javascript_tool({
  script: "document.getElementById('loadingSpinner').hidden"
})
// → true면 로딩 종료 확인

// localStorage 값 확인
mcp__Claude_in_Chrome__javascript_tool({
  script: "localStorage.getItem('gemini_api_key')?.slice(0,4)"
})
// → "AIza"면 키 저장 확인 (값 노출 없이 형식만 검증)
```

### 페이지 요소 탐색

```
mcp__Claude_in_Chrome__find
쿼리 예시:
- "생성 버튼" → aria-label 또는 텍스트 기반 탐색
- ".news-card" → CSS 셀렉터
- "#geminiKey" → ID 셀렉터
```

## 엣지 케이스 처리

| 상황 | 처리 방식 |
|------|-----------|
| Chrome 플러그인 미연결 | 연결 방법 안내 후 중단, 수동 검증 시나리오 제공 |
| 페이지 로드 지연 (3초+) | javascript_tool로 `document.readyState` 폴링 |
| 로그인 필요 페이지 | 사전 조건에 로그인 단계 추가 또는 스킵 처리 |
| 동적 콘텐츠 (setTimeout 후 렌더링) | javascript_tool로 대기 후 확인 |
| 외부 API 호출 실패 (CORS 등) | read_network_requests로 오류 코드 기록 |
| file:// 프로토콜 CORS 제한 | 사용자에게 로컬 서버(python -m http.server) 실행 안내 |

## 스킬 연계

- **호출하는 스킬**: `task-orchestrator` (웹앱 구현 완료 후 자동 호출), `web-dev` (4단계 자기 검토 후 연계)
- **보완 스킬**: `app-tester` (정적 분석), `test-planner` (시나리오 설계)
- **단독 사용**: 사용자가 `/browser-automation`으로 직접 호출 시 독립 실행
