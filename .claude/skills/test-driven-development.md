---
name: test-driven-development
description: Use when implementing any feature or bugfix, before writing any implementation code. Enforce Red-Green-Refactor cycle strictly. Trigger when user says "기능 구현", "버그 수정", "implement", "add feature", "fix bug", "새 기능", "수정해줘". Do NOT use for: throwaway prototypes, configuration files, or pure documentation tasks. Exceptions require explicit user approval.
---

# Test-Driven Development (TDD)

테스트를 먼저 작성하고, 실패를 확인하고, 최소 코드로 통과시킨다.

> **플랫폼 중립**: 이 스킬은 도구 호출이 없는 순수 방법론이다. Claude Code, Codex 모두 동일하게 적용된다.

---

## 철칙

```
실패하는 테스트 없이는 프로덕션 코드를 작성하지 않는다.
```

테스트 전에 코드를 작성했는가? 삭제하라. 처음부터 다시 시작.

**예외 없음:**
- "참고용"으로 남겨두지 않는다
- 테스트를 작성하면서 "적용"하지 않는다
- 보지도 않는다
- 삭제는 삭제다

테스트로부터 새로 구현한다. 그뿐이다.

---

## Red-Green-Refactor 사이클

```
RED (실패하는 테스트 작성)
     ↓
실패 확인 (MANDATORY — 절대 건너뛰지 않는다)
     ↓ 올바른 실패
GREEN (통과할 최소 코드)
     ↓
통과 확인 (MANDATORY)
     ↓ 통과
REFACTOR (정리)
     ↓
모든 테스트 여전히 통과
     ↓
다음 기능 → RED로
```

---

## Phase 1: RED — 실패하는 테스트 작성

무엇이 일어나야 하는지를 보여주는 최소 테스트 하나를 작성한다.

**좋은 예:**
```typescript
test('실패한 작업을 3번 재시도한다', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };

  const result = await retryOperation(operation);

  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
```
명확한 이름, 실제 동작 테스트, 한 가지 사항

**나쁜 예:**
```typescript
test('retry works', async () => {
  const mock = jest.fn()
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce('success');
  await retryOperation(mock);
  expect(mock).toHaveBeenCalledTimes(3);
});
```
모호한 이름, 실제 코드가 아닌 mock 테스트

**요구사항:**
- 하나의 동작
- 명확한 이름
- 실제 코드 (불가피한 경우에만 mock)

---

## Phase 2: 실패 확인 (MANDATORY — 절대 건너뛰지 않는다)

```bash
npm test path/to/test.test.ts
# 또는
pytest tests/path/test.py::test_name -v
```

확인 사항:
- 테스트가 실패한다 (오류 아님)
- 실패 메시지가 예상과 같다
- 기능이 없어서 실패한다 (오타 때문이 아님)

**테스트가 통과한다?** 기존 동작을 테스트하고 있는 것. 테스트를 수정하라.

**테스트가 오류난다?** 오류를 수정하고, 올바르게 실패할 때까지 재실행.

---

## Phase 3: GREEN — 최소 코드

테스트를 통과할 가장 단순한 코드를 작성한다.

**좋은 예:**
```typescript
async function retryOperation<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === 2) throw e;
    }
  }
  throw new Error('unreachable');
}
```
통과하기에 충분한 것만

**나쁜 예:**
```typescript
async function retryOperation<T>(
  fn: () => Promise<T>,
  options?: { maxRetries?: number; backoff?: 'linear' | 'exponential'; }
): Promise<T> { /* YAGNI */ }
```
과잉 엔지니어링

기능을 추가하거나, 다른 코드를 리팩터링하거나, 테스트를 초과하는 "개선"을 하지 않는다.

---

## Phase 4: 통과 확인 (MANDATORY)

```bash
npm test path/to/test.test.ts
```

확인 사항:
- 테스트가 통과한다
- 다른 테스트도 여전히 통과한다
- 출력이 깨끗하다 (오류, 경고 없음)

**테스트가 실패한다?** 테스트가 아닌 코드를 수정하라.

**다른 테스트가 실패한다?** 지금 수정하라.

---

## Phase 5: REFACTOR — 정리

통과 후에만:
- 중복 제거
- 이름 개선
- 헬퍼 추출

테스트를 계속 통과시킨다. 동작을 추가하지 않는다.

---

## 좋은 테스트 기준

| 품질 | 좋은 예 | 나쁜 예 |
|------|---------|---------|
| **최소** | 한 가지. 이름에 "and"? 분리하라. | `test('이메일과 도메인과 공백 검증')` |
| **명확** | 이름이 동작을 설명함 | `test('test1')` |
| **의도 표현** | 원하는 API를 보여줌 | 코드가 무엇을 해야 하는지 모호함 |

---

## 완료 전 체크리스트

- [ ] 새 함수/메서드마다 테스트가 있다
- [ ] 구현 전에 각 테스트가 실패하는 것을 확인했다
- [ ] 예상된 이유로 실패했다 (기능 없음, 오타 아님)
- [ ] 각 테스트를 통과할 최소 코드를 작성했다
- [ ] 모든 테스트가 통과한다
- [ ] 출력이 깨끗하다 (오류, 경고 없음)
- [ ] 테스트가 실제 코드를 사용한다 (불가피한 경우에만 mock)
- [ ] 엣지 케이스와 오류가 커버된다

모든 항목을 체크할 수 없다? TDD를 건너뛴 것이다. 처음부터 다시 시작.

---

## 🚩 멈추고 처음부터 다시 시작해야 할 신호

- 테스트 전에 코드 작성
- 구현 후 테스트
- 테스트가 즉시 통과
- 테스트가 왜 실패했는지 설명할 수 없음
- "나중에 테스트 추가"
- "이번 한 번만"이라는 합리화
- "이미 수동으로 테스트했어"
- "참고용으로 남겨두고 테스트 먼저 작성할게"
- "X시간 작업을 삭제하는 건 낭비야"

**이 모든 경우: 코드를 삭제하라. TDD로 처음부터 다시 시작.**

---

## 합리화 방지

| 변명 | 현실 |
|------|------|
| "테스트하기 너무 단순해" | 단순한 코드도 깨진다. 테스트는 30초다. |
| "나중에 테스트할게" | 즉시 통과하는 테스트는 아무것도 증명하지 않는다. |
| "이미 수동 테스트했어" | 임시방편 ≠ 체계적. 기록 없음, 재실행 불가. |
| "X시간 삭제는 낭비야" | 매몰 비용 오류. 검증되지 않은 코드를 유지하는 것이 낭비다. |
| "참고용으로 남겨둘게" | 적용하게 된다. 그건 나중에 테스트하는 것이다. 삭제하라. |
| "TDD는 독단적이야, 나는 실용적이야" | TDD가 실용적이다: 커밋 전에 버그를 잡는다. |

---

## 버그 수정 시 TDD

버그 발견 → 실패하는 테스트 작성 → TDD 사이클 따르기 → 테스트가 수정 증명 + 회귀 방지.

테스트 없이 버그를 수정하지 않는다.

---

## 최종 규칙

```
프로덕션 코드 → 테스트가 존재하고 먼저 실패했다
그렇지 않으면 → TDD가 아니다
```

사용자의 명시적 허가 없이는 예외 없음.
