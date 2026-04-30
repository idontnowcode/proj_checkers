import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const config = JSON.parse(readFileSync(join(ROOT, 'config.json'), 'utf-8'));
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ── RSS 수집 (rss-fetcher 패턴) ──────────────────────────────────────────────

async function fetchWithFallback(url) {
  // GitHub Actions 환경에서는 CORS 없으므로 직접 fetch 우선
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) return res.text();
  } catch { /* 실패 시 프록시로 폴백 */ }

  const proxies = [
    u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
    u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  ];
  for (const makeUrl of proxies) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(makeUrl(url), { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      return data.contents ?? data;
    } catch {
      clearTimeout(timer);
    }
  }
  throw new Error(`RSS fetch 실패: ${url}`);
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
      return m ? m[1].trim() : '';
    };
    const linkMatch = block.match(/<link[^>]*href="([^"]+)"/) || block.match(/<link[^>]*>(?:<!\[CDATA\[)?([^<]+)/i);
    items.push({
      title: get('title').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
      description: get('description') || get('summary'),
      link: linkMatch ? linkMatch[1].trim() : '',
      pubDate: get('pubDate') || get('published') || get('updated'),
      source: '',
    });
  }
  return items;
}

function extractKeywords(title) {
  return title.replace(/[^\w가-힣\s]/g, '').split(/\s+/).filter(w => w.length >= 2);
}

function similarity(a, b) {
  const sa = new Set(extractKeywords(a));
  const sb = new Set(extractKeywords(b));
  if (!sa.size || !sb.size) return 0;
  return [...sa].filter(w => sb.has(w)).length / Math.min(sa.size, sb.size);
}

function deduplicate(items, threshold = 0.7) {
  const kept = [];
  for (const item of items) {
    if (!kept.some(k => similarity(k.title, item.title) >= threshold)) kept.push(item);
  }
  return kept;
}

async function fetchTopicArticles(topicKey) {
  const { feeds, count, label } = config.topics[topicKey];
  const all = [];
  await Promise.allSettled(
    feeds.map(async (feedUrl) => {
      try {
        const xml = await fetchWithFallback(feedUrl);
        const items = parseRSS(xml);
        const sourceName = feedUrl.match(/(?:https?:\/\/)?(?:feeds?\.)?([^./]+)/)?.[1] ?? feedUrl;
        items.forEach(item => { item.source = sourceName; });
        all.push(...items);
        console.log(`  ✓ ${sourceName}: ${items.length}건`);
      } catch (e) {
        console.warn(`  ✗ ${feedUrl}: ${e.message}`);
      }
    })
  );
  const unique = deduplicate(all);
  console.log(`${label}: ${all.length}건 수집 → 중복 제거 후 ${unique.length}건`);
  return unique.slice(0, count);
}

// ── Gemini 요약 (gemini-client 패턴) ────────────────────────────────────────

async function summarizeArticle(title, description) {
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY 없음 — 요약 건너뜀');
    return { summary: description.slice(0, 120), keyPoint: '' };
  }

  const prompt = `다음 뉴스를 한국어로 요약하라.
제목: ${title}
내용: ${description.slice(0, 500)}

요구사항:
- summary: 핵심 내용 2~3문장 (150자 이내)
- keyPoint: 독자에게 중요한 시사점 한 문장`;

  const schema = {
    type: 'OBJECT',
    properties: {
      summary: { type: 'STRING' },
      keyPoint: { type: 'STRING' },
    },
    required: ['summary', 'keyPoint'],
  };

  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 512,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 4000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`Gemini ${res.status}`);
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
      return JSON.parse(text);
    } catch (e) {
      if (attempt === 2) {
        console.warn(`요약 실패 (${title.slice(0, 30)}): ${e.message}`);
      }
    }
  }
  return { summary: description.slice(0, 120), keyPoint: '' };
}

// ── 메인 ────────────────────────────────────────────────────────────────────

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`\n=== Daily Digest 수집 시작: ${today} ===\n`);

  const result = { date: today, generatedAt: new Date().toISOString(), topics: {} };

  for (const topicKey of Object.keys(config.topics)) {
    console.log(`\n[${config.topics[topicKey].label}] 수집 중...`);
    const articles = await fetchTopicArticles(topicKey);

    console.log(`요약 생성 중 (${articles.length}건)...`);
    const summarized = [];
    for (const article of articles) {
      const { summary, keyPoint } = await summarizeArticle(article.title, article.description);
      summarized.push({ ...article, summary, keyPoint });
      process.stdout.write('.');
    }
    console.log();
    result.topics[topicKey] = summarized;
  }

  // 아카이브 저장
  mkdirSync(join(ROOT, 'archive'), { recursive: true });
  const archivePath = join(ROOT, 'archive', `${today}.json`);
  writeFileSync(archivePath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\n✓ 아카이브 저장: archive/${today}.json`);

  // docs/data/latest.json 갱신
  mkdirSync(join(ROOT, 'docs', 'data'), { recursive: true });
  writeFileSync(join(ROOT, 'docs', 'data', 'latest.json'), JSON.stringify(result, null, 2), 'utf-8');
  console.log('✓ docs/data/latest.json 갱신');

  console.log('\n=== 수집 완료 ===\n');
}

main().catch(e => { console.error(e); process.exit(1); });
