---
name: dispatching-parallel-agents
description: Use when facing 2+ independent tasks that can run without shared state or sequential dependencies. Trigger when: multiple verifications needed simultaneously (eval-rubric + app-tester), multiple skill outputs are independent of each other, or task-orchestrator identifies parallel-executable steps. Also trigger when user says "병렬로", "동시에", "parallel", or "at the same time". Do NOT use when tasks share state, edit the same files, or when one task depends on another's output.
---

# Dispatching Parallel Agents

독립적인 작업을 동시에 여러 에이전트에게 위임하여 처리 속도를 높이는 패턴.

> **Codex 환경 도구 매핑**
> | Claude Code | Codex |
> |------------|-------|
> | `Agent(...)` / `Task(...)` | `spawn_agent(agent_type="worker", message=...)` |
> | 여러 `Agent` 동시 호출 | 여러 `spawn_agent` 동시 호출 |
> | 결과 대기 | `wait` |
> | 에이전트 종료 | `close_agent` |
>
> Codex에서 병렬 실행을 위해 `~/.codex/config.toml`에 `[features] multi_agent = true` 필요.

---

## 언제 사용하는가

```
독립 작업 2개+?
  YES → 각 작업이 서로 다른 결과에 의존하지 않는가?
    YES → 병렬 실행 ✅
    NO  → 순차 실행
  NO  → 단일 에이전트로 처리
```

**병렬 실행 적합 예시:**
- eval-rubric + app-tester (둘 다 같은 결과물을 읽지만 서로 독립)
- 여러 스킬 파일 동시 생성 (skill-creator × N)
- 서로 다른 파일의 버그 조사

**병렬 실행 부적합:**
- 이전 단계 출력을 다음 단계 입력으로 쓰는 경우
- 같은 파일을 편집하는 에이전트
- 공유 상태가 있는 작업

---

## 패턴

### 1. 독립 도메인 식별

작업을 그룹화한다:
- 검증 A: eval-rubric — 품질 점수
- 검증 B: app-tester — 스펙 대비 검증
- 검증 C: browser-automation — UI 런타임 확인

각 검증은 독립적 — 하나의 결과가 다른 것에 영향 없음.

### 2. 에이전트 프롬프트 작성 원칙

각 에이전트는 다음을 포함해야 한다:
- **명확한 범위**: 하나의 작업만
- **완전한 컨텍스트**: 결과물 경로, 기준, 필요한 모든 정보
- **구체적 출력 형식**: 무엇을 반환해야 하는지 명시
- **제약 조건**: "다른 파일은 수정하지 말 것" 등

### 3. Claude Code에서 병렬 실행

```javascript
// 같은 메시지에서 여러 Agent 동시 호출
Agent({ description: "eval-rubric 평가", prompt: "결과물 경로: ..., 평가 기준: ..." })
Agent({ description: "app-tester 검증", prompt: "스킬 스펙: ..., 코드 경로: ..." })
Agent({ description: "browser-automation QA", prompt: "URL: ..., 시나리오: ..." })
```

### 4. Codex에서 병렬 실행

```
spawn_agent(agent_type="worker", message="""
Your task is to run eval-rubric evaluation.

<agent-instructions>
평가 대상: [결과물 경로]
평가 기준: [기준 내용]
[.claude/skills/eval-rubric.md 내용 전체]
</agent-instructions>

Execute now. Return only the structured evaluation report.
""")

spawn_agent(agent_type="worker", message="""
Your task is to run app-tester verification.
<agent-instructions>...</agent-instructions>
Execute now. Return only PASS/FAIL table.
""")
```

---

## 에이전트 프롬프트 품질 기준

| ❌ 나쁜 예 | ✅ 좋은 예 |
|-----------|-----------|
| "코드 고쳐줘" | "`.claude/skills/eval-rubric.md` 기준으로 `result.html` 평가, 5개 항목 점수표 반환" |
| "버그 찾아봐" | "`app.js` 42번째 줄 `getFiltered()` 함수, 필터 조합 시 빈 배열 반환 문제 조사" |
| "테스트해줘" | "URL `https://..../index.html` 열고 콘솔 오류 없는지, 버튼 3개 클릭 작동 확인" |

---

## 결과 통합

모든 에이전트 완료 후:
1. 각 결과 요약 읽기
2. 충돌 여부 확인 (같은 파일 수정 여부)
3. 종합 판정 (과락 항목 있으면 재작업)
4. 최종 보고

---

## proj_checkers 적용 예시

```
task-orchestrator 검증 단계 — 병렬 실행:

[병렬] eval-rubric → 결과물 품질 점수
[병렬] app-tester  → 스펙 대비 구현 검증
       ↓ (둘 다 완료 후)
과락 있으면 재작업 / 모두 합격이면 보고
```
