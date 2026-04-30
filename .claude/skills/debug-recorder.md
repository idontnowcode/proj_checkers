---
name: debug-recorder
description: Records debugging incidents, recurring error patterns, and root causes during or after project work. Auto-triggers when a bug is fixed, an error repeats, or a workaround is applied. Creates a structured knowledge base at .claude/debug-log.md that future sessions can query to avoid re-diagnosing known issues. Also triggers on phrases like "기록해", "다음에도 쓸 수 있게", "반복될 것 같아", "같은 에러", "왜 이게 안됐지", "record this", "log this issue", "note for later".
---

# debug-recorder

프로젝트 수행 중 발생한 버그, 반복 가능성이 높은 에러 패턴, 디버깅 과정에서 얻은 원인 분석을 **구조화된 로그**로 기록하고, 향후 동일·유사 문제를 빠르게 해결할 수 있는 지식 베이스를 누적하는 스킬.

## 사용법

```
/debug-recorder
```

실행 후 기록할 이슈를 설명하거나, 방금 해결한 버그를 요약해 주면 된다.
비판자·지휘자 사이클, task-orchestrator 실행 직후, 또는 같은 에러가 두 번 이상 발생한 시점에 자동 발동된다.

## 자동 발동 조건

다음 중 하나 이상 해당 시 자동 실행:

- 같은 에러 메시지가 한 세션 내에서 2회 이상 등장
- "fix:", "workaround:", "hotfix:" 커밋이 생성된 직후
- eval-rubric 평가에서 동일 유형의 과락이 반복 탐지
- 사용자가 "기록해", "다음에 쓰자", "note this", "record" 발화

## 동작 방식

### 1단계: 이슈 수집

다음 정보를 대화 맥락 또는 사용자 입력에서 추출한다:

| 필드 | 설명 | 예시 |
|------|------|------|
| `error_pattern` | 에러 메시지 또는 증상 요약 | `"Gemini 404: model not found"` |
| `root_cause` | 실제 원인 (표면 증상과 구분) | `모델명 오타 — gemini-2.0-flash → gemini-2.5-flash` |
| `fix` | 적용한 해결책 | `GEMINI_MODEL 상수 값 교체` |
| `prevention` | 재발 방지 방법 | `Gemini 신규 모델 사용 전 /v1beta/models 엔드포인트로 목록 조회` |
| `context` | 발생 환경·조건 | `GitHub Actions Node.js 20, node-fetch v3` |
| `tags` | 검색용 태그 | `gemini, api, 404, model-name` |

정보가 불완전하면 1~2개의 명확화 질문을 한다. 3개 이상은 묻지 않는다.

### 2단계: 중복 검사

`.claude/debug-log.md`에 기존 기록이 있으면:
- `error_pattern` 유사도(키워드 일치) 70% 이상이면 기존 항목을 **업데이트**한다
- 신규 이슈이면 새 항목으로 **추가**한다

### 3단계: 로그 파일 갱신

`.claude/debug-log.md`에 아래 형식으로 기록한다.

```markdown
## [YYYY-MM-DD] {error_pattern 요약}

**태그**: `tag1` `tag2`
**환경**: {context}

### 증상
{에러 메시지 또는 관찰된 증상}

### 원인
{root_cause — 표면 증상이 아닌 실제 원인}

### 해결책
{fix — 코드 스니펫 포함 가능}

### 재발 방지
{prevention — 체크리스트 또는 가이드라인 형태}

---
```

### 4단계: 요약 출력

기록 완료 후 다음을 출력한다:

```
✅ 기록 완료: {error_pattern 요약}
📁 위치: .claude/debug-log.md
🔁 유사 기존 기록: {있으면 항목 제목 / 없으면 "없음"}
💡 예방 포인트: {prevention 한 줄 요약}
```

## 조회 모드

`/debug-recorder search {키워드}` 형태로 호출하면 기록 조회 모드로 동작한다:

1. `.claude/debug-log.md`에서 키워드가 포함된 항목을 찾는다
2. 일치 항목을 최신순으로 최대 5개 출력한다
3. 항목이 없으면 "관련 기록 없음"을 안내하고 새 기록 작성을 제안한다

## 타 스킬 연동

| 시점 | 연동 스킬 | 동작 |
|------|-----------|------|
| eval-rubric 과락 후 | debug-recorder 자동 발동 | 과락 항목을 `error_pattern`으로 기록 |
| task-orchestrator 완료 후 | debug-recorder 선택 발동 | fix/workaround 커밋 내용을 자동 요약해 기록 |
| 새 세션 시작 시 | debug-recorder search | 현재 작업 키워드로 기존 기록 조회 후 context에 주입 |

**로그 정리 정책**: `.claude/debug-log.md`가 200줄을 초과하면 90일 이상 된 항목을 `.claude/debug-log-archive-YYYY.md`로 이동할 것을 사용자에게 제안한다.

## 엣지 케이스

| 상황 | 처리 |
|------|------|
| `.claude/debug-log.md` 미존재 | 파일 자동 생성 후 첫 항목 추가 |
| 에러 원인 불명확 | `원인: 미확인 — 추가 조사 필요` 로 기록 후 증상만 보존 |
| 해결책 없이 우회(workaround)만 있는 경우 | `해결책: [workaround] {내용}` 접두사로 구분 |
| 같은 날 동일 에러 재기록 요청 | 기존 항목에 `재발 (YYYY-MM-DD HH:MM)` 섹션 추가 |

## 출력 형식 예시

```
✅ 기록 완료: Gemini API 404 — 모델명 오류
📁 위치: .claude/debug-log.md
🔁 유사 기존 기록: 없음
💡 예방 포인트: 신규 Gemini 모델 사용 전 /v1beta/models 목록 조회로 유효성 확인
```
