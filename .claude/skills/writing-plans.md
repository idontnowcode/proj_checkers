---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching any code. Create a comprehensive implementation plan with exact file paths, code snippets, and TDD steps. Trigger when user says "구현 계획", "작업 계획", "플랜 작성", "계획 짜줘", "implementation plan", "plan this out", "break this down". Do NOT use for: single-file trivial changes, design document creation (use eval-rubric), or post-implementation review (use app-tester).
---

# Writing Plans

구현을 시작하기 전에 단계별 계획서를 작성한다. 코드베이스를 모르는 개발자도 즉시 실행할 수 있을 정도로 구체적으로 작성한다.

> **플랫폼 중립**: 이 스킬은 도구 호출이 없는 순수 방법론이다. Claude Code, Codex 모두 동일하게 적용된다.

---

## 핵심 원칙

- **DRY, YAGNI, TDD** — 중복 없이, 필요한 것만, 테스트 우선
- **잦은 커밋** — 각 태스크마다 커밋
- **플레이스홀더 금지** — 모든 단계에 실제 코드·명령 포함
- **정확한 파일 경로** — 상대/절대 경로 명시

시작 시 선언: "writing-plans 스킬을 사용하여 구현 계획을 작성합니다."

---

## 저장 경로

계획서를 저장할 기본 경로: `docs/plans/YYYY-MM-DD-<기능명>.md`

> 사용자가 다른 경로를 지정하면 그 경로를 우선한다.

---

## 범위 점검

스펙이 독립적인 여러 서브시스템을 포함하면 분리를 제안한다. 각 계획서는 독립적으로 테스트 가능한 결과물을 생성해야 한다.

---

## 계획서 구조

### 헤더 (필수)

```markdown
# [기능명] 구현 계획

**목표:** [한 문장으로 무엇을 만드는지]

**아키텍처:** [2-3 문장, 접근 방식]

**기술 스택:** [핵심 기술/라이브러리]

---
```

### 파일 구조 매핑

태스크 정의 전에 생성·수정할 파일과 각각의 역할을 매핑한다.

- 각 파일은 하나의 명확한 책임만 가진다
- 함께 변경되는 파일은 함께 배치한다
- 기존 코드베이스의 패턴을 따른다

### 태스크 구조

````markdown
### 태스크 N: [컴포넌트명]

**파일:**
- 생성: `exact/path/to/file.py`
- 수정: `exact/path/to/existing.py:123-145`
- 테스트: `tests/exact/path/to/test.py`

- [ ] **Step 1: 실패하는 테스트 작성**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: 테스트 실패 확인**

실행: `pytest tests/path/test.py::test_name -v`
예상: FAIL — "function not defined"

- [ ] **Step 3: 최소 구현 작성**

```python
def function(input):
    return expected
```

- [ ] **Step 4: 테스트 통과 확인**

실행: `pytest tests/path/test.py::test_name -v`
예상: PASS

- [ ] **Step 5: 커밋**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
````

---

## 단계 세분화 기준

**각 단계는 하나의 행동 (2~5분):**
- "실패하는 테스트 작성" — 1단계
- "실패 확인 실행" — 1단계
- "통과할 최소 코드 작성" — 1단계
- "통과 확인 실행" — 1단계
- "커밋" — 1단계

---

## 플레이스홀더 금지 목록

다음은 **계획서 실패**를 의미한다 — 절대 사용 금지:

- "TBD", "TODO", "나중에 구현", "세부 사항 추가 예정"
- "적절한 에러 처리 추가" / "유효성 검사 추가" / "엣지 케이스 처리"
- "위 코드에 대한 테스트 작성" (실제 테스트 코드 없이)
- "태스크 N과 유사하게" (코드를 반복하라 — 개발자가 순서 없이 읽을 수 있다)
- 코드 단계에서 어떻게 할지 설명만 있고 코드 블록 없음
- 어느 태스크에도 정의되지 않은 타입·함수·메서드 참조

---

## 체크리스트 (작성 완료 후)

계획서 작성 완료 후 스펙과 대조하여 검토한다:

**1. 스펙 커버리지**: 스펙의 각 요구사항이 어느 태스크에서 구현되는지 확인. 빠진 항목 명시.

**2. 플레이스홀더 스캔**: 위 금지 목록 패턴 검색 후 발견 즉시 수정.

**3. 타입 일관성**: 이후 태스크에서 사용한 타입·메서드 시그니처·프로퍼티명이 이전 태스크에서 정의한 것과 일치하는지 확인.

문제 발견 시 인라인으로 즉시 수정. 재검토 불필요.

---

## 기억사항

- 항상 정확한 파일 경로
- 코드를 변경하는 단계에는 반드시 코드 블록 포함
- 예상 출력이 포함된 정확한 명령
- DRY, YAGNI, TDD, 잦은 커밋
