# AGENTS.md — proj_checkers 에이전트 실행 규칙

> **⚡ 세션 시작 시 가장 먼저 읽을 것**: [`PROJECT_LOG.md`](./PROJECT_LOG.md) — 현재 상태·최근 작업·누적 학습 기록
> **작업 완료 후**: PROJECT_LOG.md의 "현재 상태 스냅샷"과 "최근 작업 로그"를 업데이트할 것. 로그 10개 초과 시 로테이션 규칙 실행.

이 파일은 **Claude Code, Codex 등 모든 AI 에이전트**가 이 저장소에서 작업할 때 따르는 규칙이다.
Claude Code는 `CLAUDE.md`도 함께 읽는다. Codex는 이 파일이 유일한 진입점이다.

---

## 1. 스킬 시스템

이 프로젝트의 모든 작업 지침은 `.claude/skills/` 폴더의 마크다운 파일로 관리된다.

### 스킬 로딩 방법

| 환경 | 방법 |
|------|------|
| Claude Code | `Skill` 도구가 자동으로 스킬 파일을 로딩한다 |
| **Codex** | **스킬 파일을 직접 읽고 지시를 따른다** → `Read(".claude/skills/<name>.md")` |
| 기타 AI | 동일하게 파일을 직접 읽는다 |

### 사용 가능한 스킬 목록 (16개)

| 스킬명 | 파일 | 역할 |
|--------|------|------|
| `task-orchestrator` | `.claude/skills/task-orchestrator.md` | ★ 핵심: 작업 자율 조율 팀장 |
| `prompt-clarify` | `.claude/skills/prompt-clarify.md` | 프롬프트 명확화 |
| `eval-rubric` | `.claude/skills/eval-rubric.md` | AI 결과물 정량 평가 |
| `skill-creator` | `.claude/skills/skill-creator.md` | 스킬 생성·개선 |
| `app-tester` | `.claude/skills/app-tester.md` | 스펙 대비 구현 검증 |
| `test-planner` | `.claude/skills/test-planner.md` | 테스트 케이스 생성 |
| `rss-fetcher` | `.claude/skills/rss-fetcher.md` | RSS/Atom 피드 파싱 |
| `gemini-client` | `.claude/skills/gemini-client.md` | Gemini API 브라우저 통합 |
| `web-dev` | `.claude/skills/web-dev.md` | 정적 웹앱 개발 |
| `browser-automation` | `.claude/skills/browser-automation.md` | 브라우저 QA ⚠️ |
| `dispatching-parallel-agents` | `.claude/skills/dispatching-parallel-agents.md` | 병렬 에이전트 실행 |
| `systematic-debugging` | `.claude/skills/systematic-debugging.md` | 체계적 디버깅 |
| `code-review` | `.claude/skills/code-review.md` | 코드 품질 리뷰 |
| `verification-before-completion` | `.claude/skills/verification-before-completion.md` | 완료 전 검증 철칙 |
| `writing-plans` | `.claude/skills/writing-plans.md` | 구현 계획서 작성 |
| `test-driven-development` | `.claude/skills/test-driven-development.md` | TDD Red-Green-Refactor |

> ⚠️ `browser-automation`: Claude in Chrome MCP 플러그인 필요. **Codex에서는 이 스킬을 건너뛰고 `eval-rubric` 정적 검증으로 대체한다.**

---

## 2. 도구 매핑 (Codex ↔ Claude Code)

Codex에서 스킬 파일에 등장하는 Claude Code 도구명을 아래 표로 변환하여 사용한다.

| 스킬 파일에 나오는 도구 | Codex 동등 도구 |
|------------------------|----------------|
| `Read`, `Write`, `Edit` | 파일 읽기/쓰기 네이티브 도구 |
| `Bash` | 셸 실행 네이티브 도구 |
| `Agent(...)` / `Task(...)` | `spawn_agent(agent_type="worker", message=...)` |
| 여러 `Agent` 동시 호출 | 여러 `spawn_agent` 동시 호출 |
| `TodoWrite` | `update_plan` |
| `Glob` | 파일 패턴 검색 네이티브 도구 |
| `Grep` | 텍스트 검색 네이티브 도구 |
| `mcp__Claude_in_Chrome__*` | **미지원 — 해당 단계 생략** |

### Codex 병렬 실행 활성화

```toml
# ~/.codex/config.toml 또는 프로젝트 루트 .codex/config.toml
[features]
multi_agent = true
```

### Codex에서 스킬 내용으로 서브에이전트 실행하는 방법

```
1. 해당 스킬 파일 읽기: Read(".claude/skills/eval-rubric.md")
2. spawn_agent 호출:
   spawn_agent(
     agent_type="worker",
     message="""
     Your task is to perform the following. Follow instructions exactly.

     <agent-instructions>
     [읽은 스킬 파일 내용 전체]

     실행 컨텍스트:
     - 평가 대상: [결과물 경로]
     - 입력: [필요한 데이터]
     </agent-instructions>

     Execute now. Output ONLY the structured response as specified above.
     """
   )
3. wait() 후 결과 수신
4. close_agent()
```

---

## 3. 자율 실행 워크플로우

사용자가 실행 지시를 내리면 아래 흐름을 따른다. **사용자 개입은 최종 승인 1회만.**

```
사용자 지시 (자연어)
        ↓
[Step 0] 모호성 감지
  목적·출력형식·범위 중 2개 이상 불명확?
   YES → prompt-clarify 스킬 실행 → 답변 수렴 → 계속
   NO  → 다음 단계로
        ↓
[Step 1] task-orchestrator 스킬 실행
  .claude/skills/task-orchestrator.md 읽기 → 지시 따르기
  - 13개 스킬 전체 스캔 → 적합 스킬 선정
  - 갭 스킬 발견 시 → skill-creator로 먼저 생성
        ↓
[Step 2] 선정된 스킬 실행
  각 스킬 파일을 직접 읽고 지시 수행
  독립 단계는 병렬 실행 (dispatching-parallel-agents 스킬 참조)
        ↓
[Step 3] 품질 검증
  eval-rubric 스킬 실행 → 점수 판정
  과락(70점 미만) 시 → 최대 2회 자동 재작업
  browser-automation → Codex에서는 생략
        ↓
[Step 4] 최종 보고
  결과물 + 품질 점수 + 사용 스킬 목록 보고
  → 사용자 최종 승인 대기
```

### 모호성 판단 기준

| 항목 | 불명확 판단 기준 |
|------|----------------|
| 목적/목표 | 기대 결과물을 특정할 수 없음 |
| 출력 형식 | 파일·코드·보고서 등 형태가 미정 |
| 범위/대상 | 어디까지 작업할지 불분명 |

2개 이상 해당 → `prompt-clarify` 스킬 먼저 실행.

---

## 4. 스킬 선정 기준

아래 3가지 중 **2개 이상** 충족하는 스킬만 실행 계획에 포함한다.

| 기준 | 판단 질문 |
|------|-----------|
| 작업 유형 일치 | 스킬의 목적이 요청 작업과 직접 연관되는가? |
| 파이프라인 적합성 | 이 스킬의 출력이 다음 스킬의 입력으로 자연스럽게 이어지는가? |
| 품질 기여도 | 스킬 없이 직접 처리하는 것보다 결과 품질이 의미 있게 향상되는가? |

---

## 5. 기본 작업 원칙

- 큰 변경 전에 영향 범위를 먼저 파악한다
- 불확실한 부분은 가정하지 말고 코드/문서로 검증한다
- 요청 범위를 넘는 리팩터링은 하지 않는다
- 오류 발생 시 `systematic-debugging` 스킬을 먼저 실행한다

---

## 6. 커밋 규칙

- Conventional Commits 형식 사용: `feat:`, `fix:`, `docs:`, `refactor:`
- 하나의 커밋 = 하나의 논리 변경 단위

---

## 7. 응답 스타일

- 기본 한국어 응답
- 결과 보고 시: 무엇을 / 왜 / 어떻게 검증했는지 분리하여 작성
- 최종 보고 형식:

```
## 작업 완료 보고

### 최종 결과물
(결과물 또는 파일 경로)

### 품질 검증
| 스킬 | 결과 |
|------|------|
| eval-rubric | N점 |
| app-tester  | N/N PASS |

### 사용 스킬: (목록)
### 재작업: 없음 / N회

최종 승인하시겠습니까?
```
