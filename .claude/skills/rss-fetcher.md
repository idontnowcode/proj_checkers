---
name: rss-fetcher
description: Fetches and parses RSS feeds in the browser using a CORS proxy, with built-in duplicate filtering. Trigger this skill whenever: (1) a static web app needs live news or blog posts from an RSS/Atom URL; (2) the user says "RSS 가져오기", "뉴스 수집", "피드 파싱", "RSS 연동", or "실시간 뉴스 표시"; (3) another skill (e.g. web-dev, gemini-client) needs external RSS feed data as input. Use this instead of raw fetch() for any RSS URL — it handles CORS bypass, XML parsing for RSS 2.0 and Atom, and keyword-based duplicate filtering (70% threshold) automatically.
---

# rss-fetcher

브라우저에서 CORS 프록시를 경유해 RSS 피드를 실시간으로 수집·파싱하고, 중복 항목을 필터링하는 순수 JS 구현 패턴 스킬. 백엔드 없이 정적 웹앱에서 사용한다.

## 사용법

```
/rss-fetcher
```

RSS URL, 수집 개수, 중복 필터 기준을 알려주면 구현 코드를 생성한다.

## 동작 방식

### 1단계: CORS 프록시 경유 fetch

브라우저에서 외부 RSS URL을 직접 요청하면 CORS 오류가 발생한다. `allorigins.win` 프록시를 경유해 이를 우회한다.

```js
async function fetchRSS(rssUrl) {
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;
  const res = await fetch(proxy);
  if (!res.ok) throw new Error(`프록시 오류: ${res.status}`);
  const data = await res.json();
  return data.contents; // RSS XML 문자열
}
```

**프록시 장애 대비**: `allorigins.win` 실패 시 `corsproxy.io`로 폴백한다. 각 프록시는 5초 타임아웃을 적용한다.

```js
async function fetchWithFallback(rssUrl) {
  const proxies = [
    url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`
  ];
  for (const makeUrl of proxies) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(makeUrl(rssUrl), { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      return data.contents ?? data; // allorigins vs corsproxy 응답 형식 차이
    } catch { clearTimeout(timer); continue; }
  }
  throw new Error('모든 CORS 프록시 실패');
}
```

### 2단계: RSS XML 파싱

`DOMParser`로 XML을 파싱하고 `<item>` 또는 `<entry>` 요소에서 필드를 추출한다.

```js
function parseRSS(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  // RSS 2.0과 Atom 모두 지원
  const items = [...doc.querySelectorAll('item, entry')];

  return items.map(item => ({
    title:       item.querySelector('title')?.textContent?.trim() ?? '',
    description: item.querySelector('description, summary')?.textContent?.trim() ?? '',
    link:        item.querySelector('link')?.textContent?.trim()
                   ?? item.querySelector('link')?.getAttribute('href') ?? '',
    pubDate:     item.querySelector('pubDate, published, updated')?.textContent?.trim() ?? '',
    source:      item.querySelector('source')?.textContent?.trim()
                   ?? doc.querySelector('channel > title, feed > title')?.textContent?.trim() ?? ''
  }));
}
```

### 3단계: 중복 필터링

**키워드 겹침 기반 필터 (기본값: 70%)**

같은 사건을 여러 언론사가 보도한 기사를 제거한다. 키워드 비교이므로 번역·표현이 달라도 감지할 수 있다.

```js
function extractKeywords(title) {
  // 조사·접속사·특수문자 제거 후 2글자 이상 단어 추출
  return title
    .replace(/[^\w가-힣\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 2);
}

function similarity(titleA, titleB) {
  const a = new Set(extractKeywords(titleA));
  const b = new Set(extractKeywords(titleB));
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter(w => b.has(w)).length;
  return intersection / Math.min(a.size, b.size);
}

function deduplicateByKeyword(items, threshold = 0.7) {
  const kept = [];
  for (const item of items) {
    const isDuplicate = kept.some(k => similarity(k.title, item.title) >= threshold);
    if (!isDuplicate) kept.push(item);
  }
  return kept;
}
```

### 4단계: 통합 실행 함수

```js
async function getNewsHeadlines(rssUrl, count = 10, threshold = 0.7) {
  const xml = await fetchWithFallback(rssUrl);
  const items = parseRSS(xml);
  const unique = deduplicateByKeyword(items, threshold);
  return unique.slice(0, count);
}

// 사용 예
// const news = await getNewsHeadlines('https://news.naver.com/rss/main.xml', 10);
```

## 주요 RSS URL

| 소스 | URL | 비고 |
|------|-----|------|
| 네이버 뉴스 (전체) | `https://news.naver.com/rss/main.xml` | 국내 종합 |
| 네이버 뉴스 (정치) | `https://news.naver.com/rss/politics.xml` | |
| 구글 뉴스 (한국어) | `https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko` | 국내외 포괄 |
| 다음 뉴스 | `https://news.daum.net/rss/main` | |

## 엣지 케이스 처리

| 상황 | 처리 방식 |
|------|-----------|
| 프록시 응답 지연 (5초+) | `AbortController` 5초 타임아웃, 다음 프록시로 자동 폴백 |
| XML 파싱 오류 | `doc.querySelector('parsererror')`로 감지 후 오류 반환 |
| `<description>`에 HTML 포함 | `DOMParser`로 파싱 후 `textContent`로 순수 텍스트 추출 |
| 수집 항목이 `count`보다 적은 경우 | 가능한 만큼만 반환, 오류 없이 처리 |
| 한글 키워드 비교 오류 | 조사 제거 시 정규식에 유니코드 범위 `가-힣` 포함 확인 |
