# 뉴스 카드뉴스 자동화 — 프로젝트 보고서

**작성일**: 2026-04-29  
**상태**: 아카이브 (코드 삭제, 보고서만 보존)  
**GitHub Pages**: https://idontnowcode.github.io/proj_checkers/ (gh-pages 브랜치 유지)

---

## 1. 프로젝트 개요

proj_checkers의 스킬 생태계(task-orchestrator, rss-fetcher, gemini-client, web-dev 등)를 실제로 검증하기 위해 구축한 데모 웹 애플리케이션.

**핵심 기능**: RSS 뉴스 피드를 수집하고 Google Gemini AI로 인스타그램 스타일의 카드뉴스(최대 7장)를 자동 생성한다.

---

## 2. 기술 스택

| 분류 | 기술 |
|------|------|
| 언어/프레임워크 | 바닐라 JavaScript (ES2020+), HTML5, CSS3 |
| AI API | Google Gemini API (gemini-2.5-flash → 2.0-flash-001 → 1.5-flash 폴백) |
| RSS 수집 | CORS 프록시 5단계 폴백 (rss2json → allorigins /raw → allorigins /get → corsproxy.io → codetabs.com) |
| 스토리지 | 브라우저 localStorage (API 키 · 세션 · 저장 카드) |
| 배포 | GitHub Pages (gh-pages 브랜치) |
| 빌드 도구 | 없음 (제로 빌드 아키텍처) |

---

## 3. 아키텍처

```
브라우저
  ├── index.html          메인 페이지 (뉴스 수집 + 카드뉴스 생성)
  ├── saved.html          저장된 카드뉴스 목록 페이지
  ├── app.js              핵심 로직 (Gemini API, RSS 파싱, UI 상태)
  ├── saved.js            저장 목록 관리 (localStorage)
  └── style.css           CSS 변수 기반 반응형 디자인

데이터 흐름
  RSS 피드 → CORS 프록시 → parseRSS() → 중복 제거 → 뉴스 그리드
       ↓
  Gemini API → generateCardNews() → JSON 파싱/복구 → 슬라이드 렌더링
       ↓
  localStorage → 세션 저장/복원, 카드 북마크
```

---

## 4. 구현 기능

### 4.1 RSS 수집

- 구글 뉴스, BBC 코리아, 네이버 뉴스(전체·정치·경제·사회) 6개 소스 선택 가능
- 커스텀 RSS URL 직접 입력 지원 (드롭다운보다 우선 적용)
- 5단계 CORS 프록시 폴백으로 수집 실패 최소화
- 키워드 기반 유사도 중복 제거 (임계값 0.7, Jaccard 유사도)
- 모든 프록시 실패 시 샘플 뉴스 10건으로 자동 대체 (카드뉴스 생성은 정상 작동)

### 4.2 Gemini AI 카드뉴스 생성

- 모델 자동 폴백: gemini-2.5-flash → 2.0-flash-001 → 1.5-flash
- responseSchema로 구조화된 JSON 출력 강제 (type·heading·body 필드)
- 잘린 JSON 자동 복구 (`repairJson()`: 마지막 완전한 객체 위치 탐색)
- 카드 구성: title 1장 + content 2~5장 + conclusion 1장, 최대 7장
- 출력 기준: heading 20자 이내, body 80자 이내, 한국어, 객관적·중립적

### 4.3 UI/UX

- 2열 × 5행 반응형 그리드 (모바일 1열)
- 카드뉴스 슬라이드 오버레이 (인스타그램 스타일 그라디언트 배경)
- 키보드 화살표 + 터치 스와이프 내비게이션
- 배지 상태: 생성 대기 → 생성 중 → 카드뉴스 보기 / 생성 실패 / 안전 정책 제한
- 토스트 알림, 저장/해제 북마크

### 4.4 세션 관리

- 페이지 새로고침 후 이전 세션 자동 복원
- 저장된 카드뉴스 별도 페이지(`saved.html`)에서 영구 보관

---

## 5. 주요 개선 이력 (2026-04-28~29)

task-orchestrator가 rss-fetcher · gemini-client · web-dev · test-planner · app-tester · eval-rubric 스킬을 순차 조율하여 수행한 개선.

| 개선 항목 | 내용 | 효과 |
|-----------|------|------|
| 중복 retry 통합 | 네트워크 재시도 로직을 `generateWithRetryAndBackoff()` 단일 함수로 통합 | 코드 중복 제거, main loop 단순화 |
| 429 자동 재시도 | 한도 초과 시 전체 중단 → 60초 카운트다운 후 자동 재시도 | 사용자 수동 재시작 불필요 |
| 개별 카드 재시도 | 생성 실패 카드에 `↺ 재시도` 버튼 추가 | 실패한 항목만 선택적 복구 가능 |
| 커스텀 RSS URL | 드롭다운 외 직접 URL 입력 지원 | 임의 RSS 피드 사용 가능 |

**eval-rubric 최종 품질 점수: 97 / 100점 (합격)**

---

## 6. 파일 통계 (삭제 시점 기준)

| 파일 | 역할 | 코드 라인 수 |
|------|------|:------------:|
| `app.js` | 핵심 로직 (Gemini, RSS, UI) | 760 |
| `style.css` | 반응형 CSS | 510 |
| `saved.js` | 저장 목록 관리 | 184 |
| `index.html` | 메인 페이지 마크업 | 93 |
| `saved.html` | 저장 페이지 마크업 | 50 |
| **합계** | | **1,597** |

---

## 7. 주요 설계 결정

| 결정 | 이유 |
|------|------|
| 바닐라 JS (프레임워크 없음) | 의존성 제로, GitHub Pages 직접 배포, 스킬 검증 목적에 충분 |
| API 키를 localStorage에만 저장 | 소스코드·서버 전송 없이 브라우저 내 격리 보안 |
| CORS 프록시 5단계 폴백 | 단일 프록시 의존도 제거, 가용성 확보 |
| responseSchema 구조화 출력 | 자유 텍스트 파싱 오류 제거, JSON 형식 강제 |
| `repairJson()` 복구 로직 | maxOutputTokens 초과로 잘린 응답 구제 |
| 샘플 뉴스 폴백 | RSS 수집 실패 시에도 기능 시연 가능 |
| `sleep()` 헬퍼 + backoff 통합 | setTimeout 분산 사용 제거, 타이밍 로직 집중 관리 |

---

## 8. 검증된 스킬 연동

이 프로젝트 개발 과정에서 아래 proj_checkers 스킬들이 실제로 작동함을 확인.

| 스킬 | 역할 | 결과 |
|------|------|------|
| `task-orchestrator` | 전체 작업 자율 조율 | 중간 개입 없이 완료 |
| `rss-fetcher` | RSS 파싱 설계 참조 | 5단계 폴백 로직 반영 |
| `gemini-client` | Gemini API 설계 참조 | 모델 폴백·JSON 스키마 반영 |
| `web-dev` | 웹앱 구현 가이드 | 바닐라 JS 패턴 준수 |
| `test-planner` | 테스트 케이스 10개 생성 | 커버리지 확보 |
| `app-tester` | 구현 대비 스펙 검증 | 10/10 PASS |
| `eval-rubric` | 최종 품질 평가 | 97/100점 합격 |

---

## 9. 아카이브 사유

데모로서의 목적(스킬 생태계 검증)을 완수하였으며, 이후 프로젝트는 스킬 자체의 품질 고도화에 집중한다. 코드는 삭제하되 GitHub Pages(gh-pages 브랜치)의 배포본은 참조용으로 유지한다.
