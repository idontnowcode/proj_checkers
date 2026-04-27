# 작업 중단 기록 — news-dashboard 추가 기능 구현

**기록 일시**: 2026-04-27  
**상태**: 구현 미완료 (스트림 타임아웃으로 중단)  
**담당 스킬**: task-orchestrator → web-dev

---

## 실행 계획

| 순서 | 스킬 | 역할 | 상태 |
|------|------|------|------|
| 1 | web-dev | 3가지 기능 구현 | ❌ 미완료 |
| 2 | test-planner | 명세 대조 체크리스트 | 대기 |
| 3 | app-tester | 체크리스트 실행 | 대기 |
| 최종 | eval-rubric | 품질 검증 | 대기 |

---

## task-orchestrator 입력 프롬프트

```
news-dashboard 앱(index.html, app.js, style.css)에 아래 3가지 기능을 추가하라.
기존 동작(RSS 수집, 카드뉴스 생성, 슬라이드 오버레이)은 그대로 유지한다.

---

## 기능 1: 새로고침 후 복원

새로고침 시 뉴스 목록과 생성된 카드뉴스가 모두 사라지는 문제를 해결한다.

### 저장 대상 (localStorage)
- 수집된 뉴스 항목 배열 (제목·본문·출처·링크)
- 각 뉴스의 생성된 카드뉴스 JSON 데이터

### 동작 규칙
- 카드뉴스 생성이 완료될 때마다 localStorage에 즉시 저장
- 페이지 로드 시 localStorage에 데이터가 있으면 뉴스 그리드와 카드뉴스를
  자동 복원 (생성 버튼 누를 필요 없음)
- 복원 시 "저장된 세션 복원됨" 안내 표시

---

## 기능 2: 즐겨찾기(저장) 기능

생성된 카드뉴스를 개별로 저장할 수 있다.

### 저장 버튼 위치 (2곳 모두)
- **메인 그리드 카드**: 카드뉴스 생성 완료(badge-ready) 상태인 항목에만
  ★ 아이콘 표시. 저장 시 ★ 채움, 저장 취소 시 ☆으로 토글
- **슬라이드 오버레이**: 카드뉴스를 보는 중에도 저장 버튼 표시.
  두 위치의 상태는 항상 동기화

### 저장 데이터 (localStorage `saved_cards` 키)
- 뉴스 제목, 출처, 링크, 저장 일시, 카드뉴스 JSON 배열

### 동작 규칙
- 저장 취소 시 `saved_cards`에서 해제 (saved.html 목록에서도 즉시 제거)
- 저장 개수 제한 없음

---

## 기능 3: 재생성 시 경고 + 저장됨 별도 페이지

### 재생성 경고 (index.html)
- "뉴스 수집 & 카드뉴스 생성" 버튼 클릭 시:
  - 저장하지 않은 카드뉴스가 1개 이상 있으면 확인 팝업 표시
    → "저장되지 않은 카드뉴스 N개가 사라집니다. 계속하시겠습니까?"
  - 확인 시 localStorage 세션 데이터 초기화 후 새로 생성
  - 취소 시 기존 상태 유지
  - 저장된 카드뉴스는 `saved_cards`에서 유지 (삭제되지 않음)

### 저장됨 페이지 (saved.html — 신규 파일)
- index.html 헤더 우측에 "저장됨 (N)" 링크 추가 (N = 저장된 카드 수)
- saved.html 레이아웃:
  - 저장된 카드뉴스 목록 (index.html 뉴스 그리드와 동일한 카드 UI)
  - 각 카드에: 저장 일시, ☆ 아이콘(클릭 시 저장 해제·목록에서 제거)
  - 카드 클릭 시 기존 슬라이드 오버레이와 동일한 UI로 카드뉴스 열람
  - 저장된 항목이 없으면 "저장된 카드뉴스가 없습니다" 빈 상태 표시
- style.css는 index.html과 공유
- saved.html은 Gemini API 키 없이도 열람 가능 (저장 데이터만 읽음)

---

## 기술 제약
- 백엔드 없음, 순수 HTML/CSS/Vanilla JS
- 모든 데이터는 localStorage에만 저장
- 기존 app.js 구조 최대한 유지, 공통 함수는 재사용
- 캐시 버스팅: app.js?v=N 버전 번호 증가 (현재 v=12)
- 배포: gh-pages 브랜치 (git subtree)
```

---

## 구현 시 참고사항

### 수정 대상 파일
- `news-dashboard/app.js` — localStorage 저장·복원, 즐겨찾기 토글, 재생성 경고
- `news-dashboard/index.html` — 헤더에 저장됨 링크, 슬라이드에 저장 버튼, v=13으로 버전 업
- `news-dashboard/style.css` — 새 UI 요소 스타일 추가

### 신규 생성 파일
- `news-dashboard/saved.html`
- `news-dashboard/saved.js`

### localStorage 키 구조
```
news_session  → { items: [...뉴스배열], cards: { 0: [...카드], 1: [...카드], ... } }
saved_cards   → [ { title, source, link, savedAt, cards: [...] }, ... ]
gemini_api_key → 'AIza...'
```

### 핵심 신규 함수 목록 (app.js)
- `loadSession()` / `saveSession()` — 세션 저장·복원
- `loadSavedCards()` / `persistSavedCards()` — 즐겨찾기 저장
- `isSaved(i)` — 현재 인덱스 i가 저장됐는지 확인
- `toggleSave(i, e)` — 즐겨찾기 토글 (그리드 카드 클릭)
- `toggleSaveFromSlide()` — 슬라이드 오버레이 저장 버튼
- `updateSavedLink()` — 헤더의 "저장됨 (N)" 카운트 갱신
- `updateItemSaveIcon(i)` — 그리드 카드 ★/☆ 아이콘 갱신
- `updateSlideSaveBtn(i)` — 슬라이드 저장 버튼 상태 갱신

### 배포 명령
```bash
git subtree split --prefix news-dashboard -b tmp-deploy
git push origin $(git subtree split --prefix news-dashboard):gh-pages --force
git branch -D tmp-deploy
git push -u origin claude/ai-prompt-validation-skills-6rQQc
```
