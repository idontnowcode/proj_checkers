---
name: gemini-client
description: Integrates Google Gemini API into static web apps (browser-side JS) with secure API key handling via localStorage. Trigger this skill whenever: (1) a static site needs AI text generation, summarization, classification, or structured JSON output; (2) the user says "Gemini 연동", "AI로 요약", "카드뉴스 생성", "AI 분석", or "AI 처리"; (3) another skill's output (e.g. rss-fetcher headlines) needs to be transformed by AI. Always stores the API key in localStorage only — never in source code or git. Use responseSchema for guaranteed JSON output (카드뉴스, 분류, 구조화 데이터 등).
---

# gemini-client

백엔드 없이 브라우저 JS에서 Gemini API를 호출하는 구현 패턴 스킬. API 키를 localStorage에 안전하게 보관하고 GitHub에 절대 노출되지 않도록 설계한다.

## 사용법

```
/gemini-client
```

AI로 처리할 작업(요약, 분류, 구조화된 출력 등)을 설명하면 구현 코드를 생성한다.

## 보안 원칙 (최우선)

API 키는 **절대 소스 코드에 하드코딩하지 않는다.** 키가 GitHub에 커밋되면 자동화된 봇이 수 초 내에 탐지해 악용할 수 있다.

| 항목 | 올바른 방식 | 금지 방식 |
|------|-------------|-----------|
| API 키 저장 | `localStorage` (브라우저 전용) | 소스 코드 직접 삽입 |
| 키 입력 UI | `type="password"` 마스킹 처리 | 평문 노출 |
| 전송 경로 | 브라우저 → Gemini 서버 (직접) | 중간 프록시 경유 |

## 동작 방식

### 1단계: API 키 입력 UI

```html
<!-- index.html -->
<div class="api-key-section">
  <input type="password" id="geminiKey" placeholder="Gemini API 키 입력"
         autocomplete="off" spellcheck="false">
  <button onclick="saveKey()">저장</button>
  <span id="keyStatus"></span>
</div>
```

```js
function saveKey() {
  const key = document.getElementById('geminiKey').value.trim();
  if (!key.startsWith('AIza')) {
    showStatus('keyStatus', '유효하지 않은 API 키 형식입니다.', 'error');
    return;
  }
  localStorage.setItem('gemini_api_key', key);
  document.getElementById('geminiKey').value = '';   // 입력 필드 즉시 초기화
  showStatus('keyStatus', 'API 키가 저장되었습니다.', 'success');
}

function getKey() {
  return localStorage.getItem('gemini_api_key') ?? '';
}
```

### 2단계: Gemini API 호출

```js
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

async function callGemini(prompt, responseSchema = null) {
  const apiKey = getKey();
  if (!apiKey) throw new Error('API 키가 설정되지 않았습니다.');

  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048,
      ...(responseSchema && {
        responseMimeType: 'application/json',
        responseSchema
      })
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message ?? res.statusText;
    throw new Error(`Gemini API 오류 (${res.status}): ${msg}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}
```

### 3단계: 구조화된 JSON 출력 요청

카드뉴스처럼 정해진 형식의 데이터가 필요할 때 `responseSchema`를 사용한다. Gemini가 JSON을 직접 반환하므로 파싱 오류가 없다.

```js
// 카드뉴스 생성 예시
async function generateCardNews(headline, description) {
  const prompt = `
다음 뉴스 헤드라인과 본문을 바탕으로 카드뉴스를 작성하라.
헤드라인: ${headline}
본문: ${description}

요구사항:
- 첫 번째 카드: 제목 카드 (핵심 주제 한 문장)
- 중간 카드: 핵심 내용 2~5장 (각 카드당 1개 사실 또는 포인트)
- 마지막 카드: 결론 카드 (시사점 또는 행동 제안)
- 전체 최대 7장, 각 카드 본문 80자 이내
- 언어: 한국어
`;

  const schema = {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: {
        type:    { type: 'STRING', enum: ['title', 'content', 'conclusion'] },
        heading: { type: 'STRING' },
        body:    { type: 'STRING' }
      },
      required: ['type', 'heading', 'body']
    }
  };

  const raw = await callGemini(prompt, schema);
  return JSON.parse(raw); // responseSchema 사용 시 항상 유효한 JSON 반환
}
```

### 4단계: 로딩 상태 표시

응답 지연(평균 2~5초)에 대비해 로딩 스피너를 표시하고 완료 시 제거한다.

```js
function setLoading(buttonEl, isLoading) {
  buttonEl.disabled = isLoading;
  buttonEl.textContent = isLoading ? '생성 중…' : '카드뉴스 생성';
}

// 사용 예
async function onGenerateClick() {
  const btn = document.getElementById('generateBtn');
  setLoading(btn, true);
  try {
    const cards = await safeCallGemini(prompt, schema);
    if (cards) renderCards(cards);
  } finally {
    setLoading(btn, false);
  }
}
```

### 5단계: 오류 처리 및 사용자 안내

```js
async function safeCallGemini(prompt, schema = null) {
  try {
    return await callGemini(prompt, schema);
  } catch (e) {
    if (e.message.includes('API 키가 설정되지 않았습니다')) {
      alert('Gemini API 키를 먼저 입력해 주세요.\n발급: https://aistudio.google.com/app/apikey');
    } else if (e.message.includes('429')) {
      alert('요청 한도 초과. 잠시 후 다시 시도해 주세요. (무료 티어: 분당 15회)');
    } else if (e.message.includes('400')) {
      alert('API 키가 올바르지 않습니다. 키를 다시 확인해 주세요.');
    } else {
      alert(`오류 발생: ${e.message}`);
    }
    return null;
  }
}
```

## API 키 발급 안내

사용자에게 안내할 문구:

```
Gemini API 키 발급 방법:
1. https://aistudio.google.com/app/apikey 접속
2. 'Create API key' 클릭
3. 생성된 키(AIza로 시작)를 앱 내 입력 필드에 붙여넣기

무료 사용 한도:
- 분당 15회 요청
- 일 1,500회 요청
- 뉴스 10개 요약 = 약 10회 사용 → 무료 범위 내 처리 가능
```

## 엣지 케이스 처리

| 상황 | 처리 방식 |
|------|-----------|
| API 키 미입력 상태에서 호출 | 경고 알림 + 발급 URL 안내 |
| 키 형식 오류 (`AIza`로 시작 안 함) | 저장 전 형식 검증 후 오류 표시 |
| 429 (요청 한도 초과) | 사용자에게 대기 안내 |
| JSON 파싱 오류 (schema 미사용 시) | try-catch로 감지, 빈 배열 반환 |
| 응답 지연 (10초+) | 로딩 스피너 표시, 완료 시 제거 |
| 페이지 새로고침 후 키 유지 | localStorage에서 자동 복원 |
