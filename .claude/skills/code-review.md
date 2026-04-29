---
name: code-review
description: Analyze code quality, detect bugs, and verify best practices. Use proactively when user requests code review, quality check, or bug detection — or after implementation is complete and before eval-rubric runs. Also trigger when user says "코드 리뷰", "코드 검토", "버그 검사", "code review", "review this", "check this code", "quality check". Do NOT use for: design document creation, deployment tasks, or gap analysis (use app-tester for spec-vs-implementation comparison instead).
---

# Code Review

코드 품질, 버그, 보안, 성능 문제를 체계적으로 검토하고 실행 가능한 피드백을 제공한다.

> **Codex 환경 주의사항**
> Claude Code에서는 `code-analyzer` 에이전트를 자동 호출하여 심층 분석을 수행한다.
> Codex에서는 해당 에이전트가 없으므로 **이 스킬의 지침에 따라 인라인으로 분석을 직접 수행**한다.

---

## 리뷰 범위 입력

| 인수 | 예시 | 설명 |
|------|------|------|
| 파일 경로 | `src/app.js` | 특정 파일 리뷰 |
| 디렉토리 | `src/features/` | 디렉토리 전체 리뷰 |
| (없음) | — | 최근 변경 파일 자동 감지 |

---

## 4가지 리뷰 항목

### 1. 코드 품질
- 중복 코드 감지 (DRY 원칙 위반)
- 함수/파일 복잡도 분석 (함수당 50줄 초과 시 분할 권장)
- 네이밍 컨벤션 준수 여부
- 타입 안전성 (TypeScript/JSDoc 등)

### 2. 버그 감지
- Null/undefined 처리 누락
- 오류 처리 부재 (try-catch 없는 async)
- 경계 조건 미처리 (빈 배열, 0, 음수 등)
- 잠재적 레이스 컨디션

### 3. 보안
- XSS/CSRF 취약점 패턴
- SQL Injection 패턴 (문자열 직접 연결)
- 민감 정보 노출 (API 키 하드코딩, console.log에 토큰 등)
- 인증/인가 로직 검토

### 4. 성능
- N+1 쿼리 패턴
- 불필요한 리렌더 (React deps 배열 오류 등)
- 메모리 누수 패턴 (이벤트 리스너 미해제 등)
- 최적화 가능 지점

---

## 출력 형식

```
## 코드 리뷰 보고서

### 요약
- 리뷰 파일 수: N
- 발견 이슈: N건 (Critical: N, Major: N, Minor: N)
- 점수: N/100

### Critical 이슈
1. [FILE:LINE] 이슈 설명
   원인: ...
   수정 제안: ...

### Major 이슈
1. [FILE:LINE] 이슈 설명
   수정 제안: ...

### Minor 이슈
1. [FILE:LINE] 이슈 설명

### 권장 사항
- ...
```

---

## 신뢰도 기반 필터링

| 신뢰도 | 표시 여부 | 기준 |
|--------|-----------|------|
| 높음 (90%+) | 항상 표시 | 명확한 이슈 |
| 중간 (70~89%) | 선택적 표시 | 가능한 이슈 |
| 낮음 (~69%) | 표시 안 함 | 불확실한 제안 |

---

## 엣지 케이스

| 상황 | 처리 방식 |
|------|-----------|
| 파일이 너무 큰 경우 (500줄+) | 섹션별로 나눠 순차 리뷰 |
| 생성 코드 / 빌드 산출물 | 리뷰 대상에서 제외 |
| 테스트 파일 | 프로덕션 코드와 기준 분리 적용 |
| 언어 미지원 | "지원되지 않는 언어" 명시 후 일반 패턴만 검토 |
