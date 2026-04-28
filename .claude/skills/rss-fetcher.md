---
name: rss-fetcher
description: Fetches and parses RSS feeds in the browser using a 5-stage CORS proxy fallback, with built-in duplicate filtering and sample news fallback. Trigger this skill whenever: (1) a static web app needs live news or blog posts from an RSS/Atom URL; (2) the user says "RSS 가져오기", "뉴스 수집", "피드 파싱", "RSS 연동", or "실시간 뉴스 표시"; (3) another skill (e.g. web-dev, gemini-client) needs external RSS feed data as input. Use this instead of raw fetch() for any RSS URL — it handles CORS bypass via 5 proxies (rss2json → allorigins/raw → allorigins/get → corsproxy.io → codetabs.com), XML/JSON parsing for RSS 2.0 and Atom, keyword-based duplicate filtering (70% threshold), and sample news fallback when all proxies fail.
---

# rss-fetcher

브라우저에서 5단계 CORS 프록시 폴백을 경유해 RSS 피드를 실시간으로 수집·파싱하고, 중복 항목을 필터링하는 순수 JS 구현 패턴 스킬. 모든 프록시 실패 시 샘플 뉴스로 자동 대체한다. 백엔드 없이 정적 웹앱에서 사용한다.

## 사용법

```
/rss-fetcher
```

RSS URL, 수집 개수, 중복 필터 기준을 알려주면 구현 코드를 생성한다.

## 동작 방식

### 1단계: 5단계 CORS 프록시 폴백 fetch

브라우저에서 외부 RSS URL을 직접 요청하면 CORS 오류가 발생한다. 아래 5개 프록시를 순서대로 시도하여 이를 우회한다. 각 프록시는 **8초 타임아웃**을 적용한다.

| 순서 | 프록시 | 응답 형식 | 특이사항 |
|------|--------|-----------|----------|
| 1 | rss2json.com | JSON (`items[]`) | 파싱된 JSON 직접 반환 |
| 2 | allorigins.win/raw | 원시 텍스트 | XML 그대로 반환 |
| 3 | allorigins.win/get | JSON (`contents`) | XML을 JSON에 래핑 |
| 4 | corsproxy.io | 원시 텍스트 | XML 그대로 반환 |
| 5 | codetabs.com | 원시 텍스트 | XML 그대로 반환 |

```js
async function fetchWithFallback(rssUrl) {
  const encoded = encodeURIComponent(rssUrl);

  const proxies = [
    {
      url: `https://api.rss2json.com/v1/api.json?rss_url=${encoded}`,
      extract: async (res) => {
        const data = await res.json();
        if (data.status !== 'ok') throw new Error('rss2json status not ok');
        return { type: 'json', data };          // parseRss2Json() 에서 처리
      }
    },
    {
      url: `https://api.allorigins.win/raw?url=${encoded}`,
      extract: async (res) => ({ type: 'xml', data: await res.text() })
    },
    {
      url: `https://api.allorigins.win/get?url=${encoded}`,
      extract: async (res) => {
        const d = await res.json();
        return { type: 'xml', data: d.contents };
      }
    },
    {
      url: `https://corsproxy.io/?${encoded}`,
      extract: async (res) => ({ type: 'xml', data: await res.text() })
    },
    {
      url: `https://api.codetabs.com/v1/proxy?quest=${encoded}`,
      extract: async (res) => ({ type: 'xml', data: await res.text() })
    }
  ];

  for (const proxy of proxies) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(proxy.url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      return await proxy.extract(res);
    } catch { clearTimeout(timer); continue; }
  }
  throw new Error('모든 CORS 프록시 실패');
}
```

### 2단계: RSS XML / JSON 파싱

프록시 유형에 따라 XML 파서 또는 JSON 파서를 사용한다.

#### 2-A. XML 파싱 (allorigins, corsproxy, codetabs)

`DOMParser`로 XML을 파싱하고 `<item>` 또는 `<entry>` 요소에서 필드를 추출한다.

```js
function parseRSS(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  if (doc.querySelector('parsererror')) throw new Error('XML 파싱 오류');

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

#### 2-B. JSON 파싱 (rss2json.com)

rss2json은 이미 파싱된 JSON을 반환하므로 별도 파서를 사용한다.

```js
function parseRss2Json(data) {
  const feedTitle = data.feed?.title ?? '';
  return (data.items ?? []).map(item => ({
    title:       item.title?.trim() ?? '',
    description: item.description?.replace(/<[^>]+>/g, '').trim() ?? '',
    link:        item.link ?? '',
    pubDate:     item.pubDate ?? '',
    source:      feedTitle
  }));
}
```

### 3단계: 중복 필터링

**키워드 겹침 기반 필터 (기본값: 70%)**

같은 사건을 여러 언론사가 보도한 기사를 제거한다. 키워드 비교이므로 번역·표현이 달라도 감지할 수 있다.

```js
function extractKeywords(title) {
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

### 4단계: 샘플 뉴스 폴백

모든 프록시가 실패했을 때에도 앱 기능을 시연할 수 있도록 샘플 뉴스 10건을 자동으로 반환한다.

```js
const SAMPLE_NEWS = [
  { title: '[샘플] AI 기술 발전으로 업무 자동화 가속', description: '생성형 AI 도입 기업이 전년 대비 3배 증가했다.', link: '#', pubDate: new Date().toISOString(), source: '샘플 뉴스' },
  { title: '[샘플] 글로벌 경제 불확실성 지속', description: '주요국 중앙은행이 금리 동결을 결정했다.', link: '#', pubDate: new Date().toISOString(), source: '샘플 뉴스' },
  { title: '[샘플] 기후 변화 대응 국제 협약 체결', description: '120개국이 탄소 감축 목표를 상향 조정했다.', link: '#', pubDate: new Date().toISOString(), source: '샘플 뉴스' },
  { title: '[샘플] 반도체 공급망 재편 가속화', description: '주요 제조사들이 국내 생산 거점을 확대하고 있다.', link: '#', pubDate: new Date().toISOString(), source: '샘플 뉴스' },
  { title: '[샘플] 스타트업 투자 시장 회복세', description: '벤처캐피털 투자액이 전분기 대비 15% 증가했다.', link: '#', pubDate: new Date().toISOString(), source: '샘플 뉴스' },
  { title: '[샘플] 원격근무 정책 변화 추세', description: '대기업 중 60%가 주 3일 출근 정책으로 전환했다.', link: '#', pubDate: new Date().toISOString(), source: '샘플 뉴스' },
  { title: '[샘플] 전기차 배터리 기술 혁신', description: '충전 시간을 20분으로 단축한 신기술이 공개됐다.', link: '#', pubDate: new Date().toISOString(), source: '샘플 뉴스' },
  { title: '[샘플] 의료 AI 진단 정확도 향상', description: '암 조기 진단 정확도가 전문의 수준을 넘어섰다.', link: '#', pubDate: new Date().toISOString(), source: '샘플 뉴스' },
  { title: '[샘플] 우주 탐사 민간 경쟁 심화', description: '민간 우주 발사체 성공률이 90%를 돌파했다.', link: '#', pubDate: new Date().toISOString(), source: '샘플 뉴스' },
  { title: '[샘플] 디지털 헬스케어 시장 급성장', description: '모바일 건강 관리 앱 사용자가 10억 명을 넘어섰다.', link: '#', pubDate: new Date().toISOString(), source: '샘플 뉴스' }
];
```

### 5단계: 통합 실행 함수

```js
async function getNewsHeadlines(rssUrl, count = 10, threshold = 0.7) {
  try {
    const result = await fetchWithFallback(rssUrl);
    const items = result.type === 'json'
      ? parseRss2Json(result.data)
      : parseRSS(result.data);
    const unique = deduplicateByKeyword(items, threshold);
    return unique.slice(0, count);
  } catch (e) {
    console.warn('RSS 수집 실패, 샘플 뉴스로 대체:', e.message);
    return SAMPLE_NEWS.slice(0, count);
  }
}

// 사용 예
// const news = await getNewsHeadlines('https://news.naver.com/rss/main.xml', 10);
```

## 주요 RSS URL

| 소스 | URL | 비고 |
|------|-----|------|
| 네이버 뉴스 (전체) | `https://news.naver.com/rss/main.xml` | 국내 종합 |
| 네이버 뉴스 (정치) | `https://news.naver.com/rss/politics.xml` | |
| 네이버 뉴스 (경제) | `https://news.naver.com/rss/economy.xml` | |
| 네이버 뉴스 (사회) | `https://news.naver.com/rss/society.xml` | |
| 구글 뉴스 (한국어) | `https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko` | 국내외 포괄 |
| BBC 코리아 | `https://feeds.bbci.co.uk/korean/rss.xml` | 국제 뉴스 |

## 엣지 케이스 처리

| 상황 | 처리 방식 |
|------|-----------|
| 프록시 응답 지연 (8초+) | `AbortController` 8초 타임아웃, 다음 프록시로 자동 폴백 |
| 모든 프록시 실패 | `SAMPLE_NEWS` 10건으로 자동 대체, 콘솔에 경고 기록 |
| XML 파싱 오류 | `doc.querySelector('parsererror')`로 감지 후 오류 반환 |
| rss2json status 오류 | `data.status !== 'ok'` 검사, 다음 프록시로 폴백 |
| `<description>`에 HTML 포함 | XML: `textContent`로 순수 텍스트 추출, JSON: 정규식으로 태그 제거 |
| 수집 항목이 `count`보다 적은 경우 | 가능한 만큼만 반환, 오류 없이 처리 |
| 한글 키워드 비교 오류 | 조사 제거 시 정규식에 유니코드 범위 `가-힣` 포함 확인 |
| 커스텀 RSS URL 직접 입력 | `getNewsHeadlines(customUrl)` 호출, 드롭다운보다 우선 적용 |
