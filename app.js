/* ===== Gemini API ===== */
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function saveKey() {
  const key = document.getElementById('geminiKey').value.trim();
  if (!key.startsWith('AIza')) {
    showStatus('keyStatus', '유효하지 않은 API 키 형식입니다. (AIza로 시작해야 합니다)', 'error');
    return;
  }
  localStorage.setItem('gemini_api_key', key);
  document.getElementById('geminiKey').value = '';
  showStatus('keyStatus', 'API 키가 저장되었습니다.', 'success');
}

function clearKey() {
  localStorage.removeItem('gemini_api_key');
  showStatus('keyStatus', 'API 키가 초기화되었습니다.', 'error');
}

function getKey() {
  return localStorage.getItem('gemini_api_key') ?? '';
}

function showStatus(id, msg, type) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = 'status-msg ' + type;
}

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

async function generateCardNews(headline, description) {
  const prompt = `다음 뉴스를 바탕으로 인스타그램 스타일 카드뉴스를 작성하라.
헤드라인: ${headline}
본문: ${description || '(본문 없음)'}

요구사항:
- 첫 번째 카드: type="title" — 핵심 주제를 한 문장으로 (heading은 제목, body는 한 줄 부제)
- 중간 카드: type="content" — 핵심 사실 또는 포인트 하나씩 (2~5장)
- 마지막 카드: type="conclusion" — 시사점 또는 행동 제안
- 전체 최대 7장, 각 카드 body는 80자 이내
- heading은 20자 이내, 임팩트 있게
- 언어: 한국어`;

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
  return JSON.parse(raw);
}

/* ===== RSS Fetcher ===== */

// 프록시마다 응답 형식이 다르므로 각각 별도 처리
async function fetchWithFallback(rssUrl) {
  // 1. rss2json.com — RSS 전용 JSON API (CORS 지원, XML 파싱 불필요)
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(
      `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`,
      { signal: ctrl.signal }
    );
    clearTimeout(t);
    if (res.ok) {
      const json = await res.json();
      if (json.status === 'ok' && json.items?.length) return parseRss2Json(json);
    }
  } catch {}

  // 2. allorigins.win — JSON 래퍼({ contents: '<xml>...' }) 형식
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`,
      { signal: ctrl.signal }
    );
    clearTimeout(t);
    if (res.ok) {
      const json = await res.json();
      if (json.contents) return parseRSS(json.contents);
    }
  } catch {}

  // 3. corsproxy.io — 원시 XML 텍스트 반환 (JSON 아님, res.text() 필수)
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(
      `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`,
      { signal: ctrl.signal }
    );
    clearTimeout(t);
    if (res.ok) {
      const xml = await res.text();
      return parseRSS(xml);
    }
  } catch {}

  throw new Error('모든 CORS 프록시 실패. 잠시 후 다시 시도해 주세요.');
}

function parseRss2Json(json) {
  return json.items.map(item => ({
    title:       item.title ?? '',
    description: (item.description ?? '').replace(/<[^>]+>/g, '').trim(),
    link:        item.link ?? '',
    pubDate:     item.pubDate ?? '',
    source:      json.feed?.title ?? ''
  }));
}

function parseRSS(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('RSS XML 파싱 오류');

  const items = [...doc.querySelectorAll('item, entry')];
  return items.map(item => {
    const rawDesc = item.querySelector('description, summary')?.textContent?.trim() ?? '';
    const descDoc = new DOMParser().parseFromString(rawDesc, 'text/html');
    return {
      title:       item.querySelector('title')?.textContent?.trim() ?? '',
      description: descDoc.body.textContent?.trim() ?? '',
      link:        item.querySelector('link')?.textContent?.trim()
                     || item.querySelector('link')?.getAttribute('href') || '',
      pubDate:     item.querySelector('pubDate, published, updated')?.textContent?.trim() ?? '',
      source:      item.querySelector('source')?.textContent?.trim()
                     || doc.querySelector('channel > title, feed > title')?.textContent?.trim() || ''
    };
  });
}

function extractKeywords(title) {
  return title
    .replace(/[^\w가-힣\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 2);
}

function similarity(a, b) {
  const sa = new Set(extractKeywords(a));
  const sb = new Set(extractKeywords(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  const inter = [...sa].filter(w => sb.has(w)).length;
  return inter / Math.min(sa.size, sb.size);
}

function deduplicateByKeyword(items, threshold = 0.7) {
  const kept = [];
  for (const item of items) {
    if (!kept.some(k => similarity(k.title, item.title) >= threshold)) kept.push(item);
  }
  return kept;
}

async function getNewsHeadlines(rssUrl, count = 10) {
  const items = await fetchWithFallback(rssUrl); // fetchWithFallback이 배열 직접 반환
  return deduplicateByKeyword(items, 0.7).slice(0, count);
}

/* ===== 앱 상태 ===== */
let newsItems = [];
let cardData = {};  // index -> card array
let currentNewsIndex = null;
let currentSlide = 0;

/* ===== 메인 실행 ===== */
async function fetchAndGenerate() {
  if (!getKey()) {
    alert('Gemini API 키를 먼저 입력해 주세요.\n키 발급: https://aistudio.google.com/app/apikey');
    return;
  }

  const rssUrl = document.getElementById('rssSource').value;
  const fetchBtn = document.getElementById('fetchBtn');
  const progressEl = document.getElementById('progressMsg');

  fetchBtn.disabled = true;
  progressEl.textContent = 'RSS 피드 수집 중…';
  progressEl.hidden = false;

  try {
    newsItems = await getNewsHeadlines(rssUrl, 10);
    if (newsItems.length === 0) {
      progressEl.textContent = '수집된 뉴스가 없습니다.';
      return;
    }

    cardData = {};
    renderGrid(newsItems);
    document.getElementById('newsGrid').hidden = false;
    document.getElementById('newsCount').textContent = `(${newsItems.length}건)`;

    // 뉴스별 카드뉴스 순차 생성
    for (let i = 0; i < newsItems.length; i++) {
      progressEl.textContent = `카드뉴스 생성 중… (${i + 1}/${newsItems.length})`;
      updateItemBadge(i, 'loading');
      try {
        const cards = await generateCardNews(newsItems[i].title, newsItems[i].description);
        cardData[i] = cards;
        updateItemBadge(i, 'ready');
      } catch (e) {
        cardData[i] = null;
        updateItemBadge(i, 'error');
        if (e.message.includes('API 키가 설정되지 않았습니다')) {
          progressEl.textContent = 'API 키 오류로 중단되었습니다.';
          break;
        }
        if (e.message.includes('429')) {
          progressEl.textContent = '요청 한도 초과. 잠시 후 다시 시도해 주세요.';
          break;
        }
      }
    }

    progressEl.textContent = '생성 완료! 뉴스 카드를 클릭하면 카드뉴스를 볼 수 있습니다.';
  } catch (e) {
    progressEl.textContent = `오류: ${e.message}`;
  } finally {
    fetchBtn.disabled = false;
  }
}

/* ===== 그리드 렌더링 ===== */
function renderGrid(items) {
  const grid = document.getElementById('gridItems');
  grid.innerHTML = items.map((item, i) => `
    <div class="news-item" id="item-${i}" onclick="openSlide(${i})">
      <span class="news-item-num">#${i + 1}</span>
      ${item.source ? `<div class="news-item-source">${escHtml(item.source)}</div>` : ''}
      <div class="news-item-title">${escHtml(item.title)}</div>
      ${item.description ? `<div class="news-item-desc">${escHtml(item.description)}</div>` : ''}
      <span class="news-item-badge badge-pending" id="badge-${i}">생성 대기</span>
    </div>
  `).join('');
}

function updateItemBadge(i, state) {
  const badge = document.getElementById(`badge-${i}`);
  const item = document.getElementById(`item-${i}`);
  if (!badge) return;
  const map = {
    ready:   ['badge-ready',   '카드뉴스 보기'],
    pending: ['badge-pending', '생성 대기'],
    loading: ['badge-loading', '생성 중…'],
    error:   ['badge-error',   '생성 실패']
  };
  const [cls, label] = map[state] ?? map.pending;
  badge.className = `news-item-badge ${cls}`;
  badge.textContent = label;
  if (state === 'loading') item.classList.add('generating');
  else item.classList.remove('generating');
}

/* ===== 슬라이드 ===== */
function openSlide(i) {
  if (!cardData[i]) {
    if (cardData[i] === null) {
      alert('이 뉴스의 카드뉴스 생성에 실패했습니다.');
    } else {
      alert('카드뉴스 생성 중입니다. 잠시 후 다시 시도해 주세요.');
    }
    return;
  }
  currentNewsIndex = i;
  currentSlide = 0;
  const cards = cardData[i];

  document.getElementById('slideTitle').textContent = newsItems[i].title;
  renderSlides(cards);
  updateNav(cards.length);

  document.getElementById('slideOverlay').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeSlide() {
  document.getElementById('slideOverlay').hidden = true;
  document.body.style.overflow = '';
}

function renderSlides(cards) {
  const contentCount = {};
  const track = document.getElementById('slideTrack');
  track.innerHTML = cards.map((card, i) => {
    let colorClass;
    if (card.type === 'title') {
      colorClass = 'type-title';
    } else if (card.type === 'conclusion') {
      colorClass = 'type-conclusion';
    } else {
      const n = contentCount.n ?? 0;
      colorClass = `type-content-${n % 5}`;
      contentCount.n = n + 1;
    }
    const typeLabel = { title: 'HEADLINE', content: 'POINT', conclusion: 'CONCLUSION' }[card.type] || card.type;
    return `
      <div class="card-slide ${colorClass}">
        <div class="card-type-badge">${typeLabel}</div>
        <div class="card-heading">${escHtml(card.heading)}</div>
        <div class="card-body">${escHtml(card.body)}</div>
      </div>
    `;
  }).join('');
  track.style.transform = 'translateX(0)';
}

function updateNav(total) {
  document.getElementById('slideIndicator').textContent = `${currentSlide + 1} / ${total}`;
  document.getElementById('prevBtn').disabled = currentSlide === 0;
  document.getElementById('nextBtn').disabled = currentSlide === total - 1;
}

function prevSlide() {
  if (currentSlide <= 0) return;
  currentSlide--;
  moveSlide();
}

function nextSlide() {
  const total = cardData[currentNewsIndex]?.length ?? 0;
  if (currentSlide >= total - 1) return;
  currentSlide++;
  moveSlide();
}

function moveSlide() {
  const track = document.getElementById('slideTrack');
  track.style.transform = `translateX(-${currentSlide * 100}%)`;
  updateNav(cardData[currentNewsIndex].length);
}

/* 키보드 지원 */
document.addEventListener('keydown', e => {
  if (document.getElementById('slideOverlay').hidden) return;
  if (e.key === 'ArrowRight') nextSlide();
  if (e.key === 'ArrowLeft') prevSlide();
  if (e.key === 'Escape') closeSlide();
});

/* 오버레이 배경 클릭 시 닫기 */
document.getElementById('slideOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('slideOverlay')) closeSlide();
});

/* 터치 스와이프 */
let touchStartX = 0;
document.getElementById('slideTrack').addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
}, { passive: true });
document.getElementById('slideTrack').addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (dx < -50) nextSlide();
  if (dx > 50) prevSlide();
}, { passive: true });

/* ===== 유틸 ===== */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* 페이지 로드 시 키 상태 표시 */
window.addEventListener('DOMContentLoaded', () => {
  if (getKey()) showStatus('keyStatus', 'API 키가 저장되어 있습니다.', 'success');
});
