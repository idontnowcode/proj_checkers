---
name: gemini-client
description: Integrates Google Gemini API into static web apps (browser-side JS) with secure API key handling via localStorage, model fallback chain, and production-grade error handling. Trigger this skill whenever: (1) a static site needs AI text generation, summarization, classification, or structured JSON output; (2) the user says "Gemini 연동", "AI로 요약", "카드뉴스 생성", "AI 분석", or "AI 처리"; (3) another skill's output (e.g. rss-fetcher headlines) needs to be transformed by AI. Always stores the API key in localStorage only — never in source code or git. Uses model fallback (gemini-2.5-flash → gemini-2.0-flash-001 → gemini-1.5-flash), responseSchema for guaranteed JSON output, repairJson() for truncated response recovery, and 60-second countdown auto-retry on 429.
---

# gemini-client

백엔드 없이 브라우저 JS에서 Gemini API를 호출하는 구현 패턴 스킬. API 키를 localStorage에 안전하게 보관하고 GitHub에 절대 노출되지 않도록 설계한다. 모델 폴백, 잘린 JSON 복구, 429 자동 재시도를 포함한다.

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
  document.getElementById('geminiKey').value = '';
  showStatus('keyStatus', 'API 키가 저장되었습니다.', 'success');
}

function getKey() {
  return localStorage.getItem('gemini_api_key') ?? '';
}
```

### 2단계: 모델 폴백 체인

최신 모델을 우선 시도하고 404(모델 미지원) 오류 시 다음 모델로 자동 전환한다.

```js
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-001',
  'gemini-1.5-flash'
];
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

async function callGeminiWithModelFallback(prompt, responseSchema = null) {
  const apiKey = getKey();
  if (!apiKey) throw new Error('API 키가 설정되지 않았습니다.');

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 4096,
      ...(responseSchema && {
        responseMimeType: 'application/json',
        responseSchema
      })
    }
  };

  for (const model of GEMINI_MODELS) {
    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (res.status === 404) continue;  // 모델 미지원 → 다음 모델 시도

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message ?? res.statusText;
      const error = new Error(`Gemini API 오류 (${res.status}): ${msg}`);
      error.status = res.status;
      throw error;
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }
  throw new Error('사용 가능한 Gemini 모델이 없습니다.');
}
```

### 3단계: 구조화된 JSON 출력 요청

카드뉴스처럼 정해진 형식의 데이터가 필요할 때 `responseSchema`를 사용한다. Gemini가 JSON을 직접 반환하므로 파싱 오류가 줄어든다.

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
- 전체 최대 7장, heading 20자 이내, body 80자 이내
- 언어: 한국어, 객관적·중립적 톤
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

  const raw = await callGeminiWithModelFallback(prompt, schema);
  return JSON.parse(repairJson(raw));
}
```

### 4단계: 잘린 JSON 복구 (repairJson)

`maxOutputTokens` 한계로 응답이 중간에 잘릴 경우, 마지막으로 완성된 JSON 객체까지만 잘라내어 복구한다.

```js
function repairJson(raw) {
  if (!raw) return '[]';
  const text = raw.trim();

  // 완전한 JSON이면 그대로 반환
  try { JSON.parse(text); return text; } catch {}

  // 마지막 완전한 객체 위치 탐색
  let lastValidEnd = -1;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (depth === 0) lastValidEnd = i;
    }
  }

  if (lastValidEnd === -1) return '[]';
  const repaired = text.substring(0, lastValidEnd + 1);

  // 배열로 감싸진 형태 복구
  const startIdx = repaired.indexOf('[');
  if (startIdx !== -1) {
    return repaired.substring(startIdx) + ']';
  }
  return '[' + repaired + ']';
}
```

### 5단계: 429 자동 재시도 + 네트워크 오류 백오프

한도 초과(429) 시 60초 카운트다운 후 자동 재시도한다. 네트워크 오류는 2초 대기 후 즉시 재시도한다.

```js
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function generateWithRetryAndBackoff(generateFn, progressEl = null) {
  while (true) {
    try {
      return await generateFn();
    } catch (e) {
      if (e.status === 429) {
        // 60초 카운트다운 표시 후 자동 재시도
        for (let sec = 60; sec > 0; sec--) {
          if (progressEl) progressEl.textContent = `요청 한도 초과. ${sec}초 후 자동 재시도…`;
          await sleep(1000);
        }
        if (progressEl) progressEl.textContent = '재시도 중…';
        continue;  // 자동 재시도
      }
      throw e;  // 그 외 오류는 상위로 전파
    }
  }
}

// 사용 예
async function onGenerateClick(headline, desc, progressEl) {
  const cards = await generateWithRetryAndBackoff(
    () => generateCardNews(headline, desc),
    progressEl
  );
  renderCards(cards);
}
```

### 6단계: 오류 처리 및 사용자 안내

```js
async function safeGenerateCardNews(headline, desc, progressEl) {
  try {
    return await generateWithRetryAndBackoff(
      () => generateCardNews(headline, desc),
      progressEl
    );
  } catch (e) {
    if (e.message.includes('API 키가 설정되지 않았습니다')) {
      showToast('Gemini API 키를 먼저 입력해 주세요.', 'error');
    } else if (e.message.includes('400')) {
      showToast('API 키가 올바르지 않습니다. 키를 다시 확인해 주세요.', 'error');
    } else if (e.message.includes('안전 정책') || e.message.includes('SAFETY')) {
      showToast('안전 정책으로 인해 생성이 제한됩니다.', 'warning');
    } else {
      showToast(`생성 오류: ${e.message}`, 'error');
    }
    return null;
  }
}
```

## 로딩 상태 표시

응답 지연(평균 2~5초)에 대비해 로딩 스피너를 표시하고 완료 시 제거한다.

```js
function setLoading(buttonEl, isLoading) {
  buttonEl.disabled = isLoading;
  buttonEl.textContent = isLoading ? '생성 중…' : '카드뉴스 생성';
}
```

## API 키 발급 안내

사용자에게 안내할 문구:

```
Gemini API 키 발급 방법:
1. https://aistudio.google.com/app/apikey 접속
2. 'Create API key' 클릭
3. 생성된 키(AIza로 시작)를 앱 내 입력 필드에 붙여넣기

무료 사용 한도 (gemini-2.5-flash 기준):
- 분당 10회 요청
- 일 500회 요청
- 뉴스 10개 요약 = 약 10회 사용 → 무료 범위 내 처리 가능
```

## 엣지 케이스 처리

| 상황 | 처리 방식 |
|------|-----------|
| API 키 미입력 상태에서 호출 | 경고 토스트 + 발급 URL 안내 |
| 키 형식 오류 (`AIza`로 시작 안 함) | 저장 전 형식 검증 후 오류 표시 |
| 429 (요청 한도 초과) | 60초 카운트다운 후 자동 재시도 1회 |
| 404 (모델 미지원) | 다음 모델로 자동 폴백 (최대 3개) |
| 응답 JSON 잘림 (`maxOutputTokens` 초과) | `repairJson()`으로 마지막 완전한 객체까지 복구 |
| 안전 정책 차단 | `SAFETY` 키워드 감지 후 사용자에게 알림 |
| 응답 지연 (10초+) | 로딩 스피너 표시, 완료 시 제거 |
| 페이지 새로고침 후 키 유지 | `localStorage`에서 자동 복원 |
| JSON 파싱 오류 (schema 미사용 시) | `repairJson()` 적용 후 재파싱 시도 |
