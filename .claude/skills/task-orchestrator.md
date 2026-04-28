---
name: task-orchestrator
description: Orchestrates multiple skills to complete a task end-to-end with Agent Teams support. Use this skill when the user has a finalized prompt and wants Claude to automatically plan, execute, and quality-validate the work without micromanaging each step. Trigger whenever a user says "just do it", "handle this end-to-end", "take care of everything", "run this", or pastes a detailed prompt expecting a complete result. Also trigger immediately when the user has just finished using /prompt-clarify and wants to act on the improved prompt right away. When CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 is set, automatically spawns parallel sub-agents for independent skills to maximize throughput.
---

# task-orchestrator

사용자가 구체화된 최종 프롬프트를 제공하면, 필요한 스킬들을 자율적으로 선택·조율하고 품질 검증까지 완료하는 팀장 역할 스킬. **Agent Teams가 활성화된 경우 독립 단계를 병렬 서브에이전트로 실행**하여 처리 속도를 높인다.

## 사용법

```
/task-orchestrator
```

실행 후 완성된 프롬프트를 붙여넣으면 된다. `/prompt-clarify` 출력 결과를 그대로 붙여넣어도 된다.

---

## Agent Teams 통합 (Claude Code 공식 기능)

### 감지 및 모드 분기

실행 시작 전 Agent Teams 활성화 여부를 판단하여 실행 모드를 자동 선택한다.

```
감지 조건: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 환경변수 설정 여부

활성화 시 → Team Mode (병렬 서브에이전트 실행)
비활성화 시 → Solo Mode (단일 세션 순차 실행, 기존 동작)
```

### 병렬화 판단 기준

스킬 실행 계획을 수립할 때, 각 단계를 아래 기준으로 분류한다.

| 분류 | 조건 | 실행 방식 |
|------|------|-----------|
| 병렬 가능 | 이전 단계 출력에 의존하지 않음 | Agent 도구로 동시 실행 |
| 직렬 필수 | 이전 단계 출력을 입력으로 사용 | 순서대로 실행 |

**병렬화 우선 후보 스킬** (출력이 서로 독립적):
- `eval-rubric` + `app-tester` + `browser-automation` → 검증 단계 동시 실행
- `test-planner` + `prompt-clarify` → 입력 분석 단계 동시 실행
- `skill-creator` 다수 갭 스킬 생성 → 각 스킬 파일 동시 생성

### Team Mode 실행 패턴

```
Agent Teams 활성화 시:

[직렬] 0단계: 갭 스킬 생성 (필요 시)
       ↓
[직렬] 1단계: 핵심 구현 (이후 단계들이 이 출력에 의존)
       ↓
[병렬] 검증 단계: eval-rubric + app-tester + browser-automation 동시 실행
         ├─ Agent("eval-rubric 실행", prompt=결과물+기준)
         ├─ Agent("app-tester 실행", prompt=코드경로+스킬명세)
         └─ Agent("browser-automation 실행", prompt=URL+시나리오)
       ↓
[직렬] 최종: 검증 결과 취합 → 과락 판정 → 보고
```

Agent 도구 호출 예시:

```
// 검증 3종을 병렬로 실행
Agent({ description: "eval-rubric 품질 평가", prompt: "결과물 평가 기준: ..." })
Agent({ description: "app-tester 스펙 검증", prompt: "코드 경로: ..., 스킬: ..." })
Agent({ description: "browser-automation UI 검증", prompt: "URL: ..., 시나리오: 기본 5종" })
```

---

## 동작 방식

### 1단계: 프롬프트 분석 및 스킬 후보 선정

입력된 프롬프트를 분석하여 필요한 스킬을 두 단계로 선정한다.

**1-1. prompt-clarify 추천 참조**
입력에 `/prompt-clarify` 출력이 포함된 경우, "스킬 추천 및 갭 검토" 섹션의 권장 스킬 목록을 우선 참조한다.

**1-2. 전체 스킬 재검토**
아래 7개 레이어, 총 86개 스킬을 대상으로 재스캔한다. 각 스킬에 대해 아래 3가지 기준으로 포함 여부를 판단한다:

| 레이어 | 위치 | 스킬 수 |
|--------|------|---------|
| Project-Local | `.claude/skills/` | 10 |
| bkit Core v1.6.1 | `~/.claude/plugins/cache/bkit-marketplace/bkit/1.6.1/skills/` | 31 |
| superpowers v5.0.6 | `~/.claude/plugins/cache/superpowers-dev/superpowers/5.0.6/skills/` | 14 |
| Anthropic 공식 | `~/.claude/skills/` | 10 |
| Design | Design 플러그인 | 7 |
| team-attention-plugins | 팀 주의 플러그인 | 4 |
| CC Built-in | Claude Code 내장 | 10 |

| 기준 | 판단 질문 |
|------|-----------|
| 작업 유형 일치 | 이 스킬의 목적이 프롬프트가 요구하는 작업과 직접 연관되는가? |
| 파이프라인 적합성 | 이 스킬의 출력이 다음 스킬의 입력으로 자연스럽게 이어지는가? |
| 품질 기여도 | 스킬 없이 직접 처리하는 것보다 결과 품질이 의미 있게 향상되는가? |

세 기준 중 2개 이상 충족하는 스킬만 실행 계획에 포함한다.

**1-3. 갭 스킬 처리**
필요하지만 존재하지 않는 스킬(갭 스킬)이 발견되면, 본 작업 실행 전에 `skill-creator`로 해당 스킬을 먼저 구현한다. Agent Teams 활성화 시 갭 스킬이 여러 개면 동시 생성한다.

### 2단계: 실행 계획 출력 후 즉시 실행

선정된 스킬과 실행 모드를 아래 형식으로 출력하고 **중간 승인 없이 바로 실행을 시작한다.**

```
## 실행 계획  [Team Mode / Solo Mode]

### [사전 단계] 갭 스킬 생성 (있는 경우만)
| 순서 | 스킬 | 역할 | 산출물 | 실행 방식 |
|------|------|------|--------|-----------|
| 0-1  | skill-creator | (갭 스킬명) 생성 | .claude/skills/.... | 병렬/직렬 |

### [본 작업]
| 순서 | 스킬 | 역할 | 입력 | 예상 출력 | 실행 방식 |
|------|------|------|------|-----------|-----------|
| 1    | (스킬명) | (역할) | 프롬프트 | (산출물) | 직렬 |
| 2-A  | eval-rubric | 품질 평가 | 결과물 | 점수 | 병렬 ← |
| 2-B  | app-tester | 스펙 검증 | 코드 | PASS/FAIL | 병렬 ← |
| 2-C  | browser-automation | UI 검증 | URL | QA 보고서 | 병렬 ← |

→ 계획대로 즉시 실행을 시작합니다.
```

> **eval-rubric은 항상 마지막 단계 그룹에 포함한다.** 검증 스킬(app-tester, browser-automation)과 함께 병렬 실행 가능하다.

### 3단계: 스킬 실행

**Solo Mode (Agent Teams 비활성화 시)**
- 계획 순서대로 스킬을 하나씩 실행
- 각 스킬 완료 시 진행 상황 보고

**Team Mode (Agent Teams 활성화 시)**
- 직렬 의존 단계: 순서대로 실행
- 병렬 가능 단계: `Agent` 도구로 동시에 여러 서브에이전트 실행
- 서브에이전트 프롬프트에는 필요한 컨텍스트(결과물, 파일 경로, 스킬 지침)를 모두 포함

**중간 보고 형식 (각 단계 완료 시)**
```
[단계 N/전체] ✓ (스킬명) 완료  [병렬/직렬]
- 산출물: (결과물 한 줄 요약)
- 다음 단계: (다음 스킬명)
```

스킬 실행 중 오류 발생 시 즉시 중단하고 사용자에게 보고한다.

### 4단계: 품질 검증 (eval-rubric)

최종 결과물을 `eval-rubric`으로 평가한다. Team Mode에서는 app-tester, browser-automation과 병렬 실행한다.

**통과 시**: 5단계로 진행한다.

**과락 발생 시 — 자동 재작업 루프 (최대 2회)**

```
재시도 1: 과락 피드백을 반영하여 결과물 재생성 → eval-rubric 재평가
재시도 2: 재시도 1 결과가 여전히 과락이면 다른 접근으로 재생성 → eval-rubric 재평가
```

2회 후에도 과락이면:

```
## 품질 검증 반복 실패 보고

| 시도 | 총점 | 과락 항목 |
|------|------|-----------|
| 초안  | N점  | (항목명) |
| 재시도 1 | N점 | (항목명) |
| 재시도 2 | N점 | (항목명) |

지속적으로 부족한 부분: (원인 분석)

다음 중 선택해 주세요:
1. 현재 결과물로 진행
2. 방향을 조정하여 재시도
3. 작업 중단
```

### 5단계: 최종 결과 보고

```
## 작업 완료 보고  [Team Mode: N개 병렬 에이전트 / Solo Mode]

### 최종 결과물
(결과물 전문 또는 파일 경로)

### 품질 검증 결과
| 항목 | 점수 | 판정 |
|------|------|------|
| eval-rubric | N점 | 합격 |
| app-tester  | N/N PASS | 합격 |
| browser-automation | N% | 합격 |
**종합: 합격**

### 작업 요약
- 실행 모드: Team Mode / Solo Mode
- 사용 스킬: (목록)
- 병렬 실행: (병렬화된 단계 목록 또는 없음)
- 재작업: 없음 / N회 (사유)

최종 승인하시겠습니까?
```

---

## 엣지 케이스 처리

| 상황 | 처리 방식 |
|------|-----------|
| Agent Teams 미설정 | Solo Mode로 자동 폴백, 계획에 "[Solo Mode]" 표시 |
| 병렬 에이전트 중 하나 실패 | 나머지 에이전트 완료 후 실패 항목만 재시도 |
| prompt-clarify 없이 원시 프롬프트 입력 | 스킬 재검토(1-2)만으로 진행 |
| 갭 스킬 다수 발생 | Team Mode: 동시 생성 / Solo Mode: 순차 생성 |
| 적용 가능 스킬이 없는 경우 | "직접 처리" 계획 + eval-rubric만 유지 |
| eval-rubric 사용 불가 | 정성 평가(자기 검토)로 대체할지 사용자에게 확인 |
| 실행 중 스킬 오류 | 즉시 중단 후 보고, 재시도·건너뛰기·중단 선택 요청 |

## 예시 — Team Mode 실행 계획

```
## 실행 계획  [Team Mode]

### [본 작업]
| 순서 | 스킬 | 역할 | 입력 | 예상 출력 | 실행 방식 |
|------|------|------|------|-----------|-----------|
| 1    | rss-fetcher + gemini-client + web-dev | 뉴스 웹앱 구현 | 프롬프트 | index.html + app.js | 직렬 |
| 2-A  | eval-rubric | 코드 품질 점수 | 결과물 | 점수표 | 병렬 ← |
| 2-B  | app-tester  | 스펙 대비 검증 | 코드 경로 | PASS/FAIL | 병렬 ← |
| 2-C  | browser-automation | UI 렌더링 확인 | GitHub Pages URL | QA 보고서 | 병렬 ← |

갭 스킬: 없음
→ 즉시 실행을 시작합니다.
```
