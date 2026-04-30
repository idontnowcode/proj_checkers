---
name: agent-team
description: 특정 작업을 병렬 검토·실행하는 에이전트 팀을 구성하고 조율한다. task-orchestrator가 단일 흐름을 지휘한다면, agent-team은 복수의 전문 에이전트를 동시에 출동시켜 검토 속도와 커버리지를 높인다. Trigger: 빌드 결과물의 다각도 검토가 필요할 때 / task-orchestrator 4단계(품질 검증)에서 eval-rubric 대신 또는 병행하여 사용 / "병렬 검토", "에이전트 팀", "agent team", "multi-agent review" 언급 시.
---

# agent-team

복수의 전문 에이전트를 병렬로 출동시켜 결과물을 다각도로 검토하고, 후검토(post-review)로 통합하는 조율 스킬.

## 사용법

```
/agent-team
```

검토할 결과물(파일 경로 또는 설명)을 제공하면 팀 구성 → 병렬 실행 → 후검토 통합 순으로 진행한다.

## 에이전트 역할 정의 (표준 팀)

| 역할 | 담당 스킬 | 검토 영역 |
|------|-----------|-----------|
| **Code Reviewer** | `bkit:code-analyzer` | 코드 품질, 에러 처리, 엣지 케이스 |
| **Security Reviewer** | `bkit:security-architect` | 보안 취약점, 인증, 데이터 노출 |
| **Architecture Reviewer** | 일반 에이전트 | 시스템 설계, 의존성, 확장성 |
| **QA Reviewer** | `bkit:qa-strategist` | 테스트 커버리지, 예외 상황 |

필요에 따라 역할을 줄이거나 커스텀 에이전트로 대체한다.

## 동작 방식

### 1단계: 팀 구성 결정

task-orchestrator로부터 결과물 정보를 받아 다음 기준으로 필요한 에이전트를 선정한다.

| 기준 | 포함 에이전트 |
|------|---------------|
| 서버 실행 코드(API, 스크립트) 포함 | Code Reviewer + Security Reviewer |
| 정적 웹 UI 포함 | Code Reviewer (XSS/UX 항목) |
| 외부 API 연동 포함 | Security Reviewer |
| GitHub Actions / 인프라 포함 | Architecture Reviewer |
| 테스트 계획 필요 | QA Reviewer |

### 2단계: 병렬 출동 (Parallel Dispatch)

`Agent` 툴로 에이전트를 동시에 실행한다. 각 에이전트의 프롬프트에는 반드시 포함한다:
- 검토 대상 파일 경로 (절대 경로)
- 검토 항목 목록
- 출력 형식: `항목 | PASS/WARN/FAIL | 개선 제안`
- 응답 길이 제한 (200단어 이내)

```
run_in_background: true  # 모든 에이전트 동시 실행
```

### 3단계: 후검토 통합 (Post-Review Aggregation)

모든 에이전트 완료 후 결과를 수집하여 다음 형식으로 통합 보고서를 작성한다.

```markdown
## 에이전트 팀 검토 결과

| 에이전트 | PASS | WARN | FAIL |
|---------|------|------|------|
| Code Reviewer | N | N | N |
| Security Reviewer | N | N | N |
| Architecture Reviewer | N | N | N |

### FAIL 항목 (즉시 수정 필요)
- [에이전트명] [항목]: [설명] → 수정 방안

### WARN 항목 (권고)
- [에이전트명] [항목]: [설명]

### 종합 판정
- 총점: N/100
- 판정: 통과 / 조건부 통과 / 재작업 필요
```

### 4단계: 자동 수정 (FAIL 항목)

FAIL 항목이 있으면 task-orchestrator에 피드백을 전달하여 재작업 루프를 트리거한다.
WARN 항목은 사용자에게 보고 후 수정 여부를 결정한다.

## 팀 구성 패턴

### 최소 팀 (빠른 검토)
```
Code Reviewer + Architecture Reviewer (2명)
→ 간단한 스크립트·설정 파일 검토
```

### 표준 팀 (일반 웹앱)
```
Code Reviewer + Security Reviewer + Architecture Reviewer (3명)
→ 외부 배포 앱의 기본 검토
```

### 풀 팀 (프로덕션 수준)
```
Code Reviewer + Security Reviewer + Architecture Reviewer + QA Reviewer (4명)
→ 중요한 기능 릴리스 전 종합 검토
```

## task-orchestrator 통합 포인트

task-orchestrator의 **4단계(품질 검증)**에서 eval-rubric 대신 또는 병행하여 호출한다.

```
task-orchestrator 4단계 변형:
  eval-rubric (정량 점수) + agent-team (전문 다각도 검토) 동시 실행
  → 두 결과를 통합하여 최종 판정
```

## 엣지 케이스

| 상황 | 처리 |
|------|------|
| 에이전트 한 명 실패 | 나머지 결과로 진행, 실패 항목은 직접 처리 |
| 모든 에이전트 WARN 이상 없음 | "전원 통과" 보고 후 task-orchestrator 5단계로 이동 |
| FAIL이 3개 이상 | task-orchestrator 재작업 루프 즉시 트리거 |
| 에이전트 결과 충돌 | 더 보수적인 판정을 채택 |
