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

function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 3500);
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

  // 안전 정책 차단 또는 빈 응답 감지
  const candidate = data.candidates?.[0];
  if (!candidate?.content) {
    const reason = candidate?.finishReason ?? data.promptFeedback?.blockReason ?? 'BLOCKED';
    throw new Error(`SAFETY_BLOCK:${reason}`);
  }
  return candidate.content.parts?.[0]?.text ?? '';
}

async function generateCardNews(headline, description) {
  const prompt = `당신은 뉴스 전문 편집자입니다. 아래 뉴스 기사를 독자가 이해하기 쉽도록 인스타그램 카드뉴스 형식으로 객관적이고 중립적으로 요약하세요. 자극적 표현은 사실 중심으로 순화하세요.

헤드라인: ${headline}
본문: ${description || '(본문 없음)'}

출력 형식:
- 첫 번째 카드: type="title" — 핵심 주제 한 문장 (heading: 제목, body: 한 줄 부제)
- 중간 카드: type="content" — 핵심 사실 하나씩 (2~5장)
- 마지막 카드: type="conclusion" — 시사점 또는 독자 행동 제안
- 전체 최대 7장, 각 body 80자 이내, heading 20자 이내
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
  if (!raw || !raw.trim()) throw new Error('EMPTY_RESPONSE');
  return JSON.parse(raw);
}

/* ===== RSS Fetcher ===== */

// 프록시마다 응답 형식이 다르므로 각각 별도 처리 (5단계 폴백)
async function fetchWithFallback(rssUrl) {
  const strategies = [
    // 1. rss2json.com — RSS 전용 JSON API, XML 파싱 불필요
    {
      label: 'rss2json.com',
      run: async signal => {
        const res = await fetch(
          `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`,
          { signal }
        );
        if (!res.ok) return null;
        const json = await res.json();
        return json.status === 'ok' && json.items?.length ? parseRss2Json(json) : null;
      }
    },
    // 2. allorigins.win /raw — 원시 텍스트 직접 반환
    {
      label: 'allorigins /raw',
      run: async signal => {
        const res = await fetch(
          `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`,
          { signal }
        );
        if (!res.ok) return null;
        return parseRSS(await res.text());
      }
    },
    // 3. allorigins.win /get — JSON 래퍼 { contents: '<xml>...' }
    {
      label: 'allorigins /get',
      run: async signal => {
        const res = await fetch(
          `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`,
          { signal }
        );
        if (!res.ok) return null;
        const json = await res.json();
        return json.contents ? parseRSS(json.contents) : null;
      }
    },
    // 4. corsproxy.io — 원시 XML 텍스트 반환
    {
      label: 'corsproxy.io',
      run: async signal => {
        const res = await fetch(
          `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`,
          { signal }
        );
        if (!res.ok) return null;
        return parseRSS(await res.text());
      }
    },
    // 5. codetabs.com — 원시 텍스트 반환
    {
      label: 'codetabs.com',
      run: async signal => {
        const res = await fetch(
          `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(rssUrl)}`,
          { signal }
        );
        if (!res.ok) return null;
        return parseRSS(await res.text());
      }
    }
  ];

  const progressEl = document.getElementById('progressMsg');
  for (const s of strategies) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    if (progressEl) progressEl.textContent = `RSS 수집 중… (${s.label} 시도)`;
    try {
      const result = await s.run(ctrl.signal);
      clearTimeout(t);
      if (result && result.length > 0) return result;
    } catch { clearTimeout(t); }
  }

  // 모든 프록시 실패 시 샘플 데이터로 폴백
  return null;
}

const SAMPLE_NEWS = [
  { title: '인공지능 기술 발전으로 산업 지형 급변', description: '생성형 AI가 다양한 산업 분야에 빠르게 도입되면서 기업들의 업무 방식이 크게 바뀌고 있다. 특히 제조·금융·의료 분야에서 AI 도입 속도가 빨라지고 있다.', source: '샘플 뉴스', link: '#', pubDate: '' },
  { title: '글로벌 경제 불확실성 속 국내 증시 동향', description: '미국 연방준비제도의 금리 정책 결정을 앞두고 국내외 증시가 관망세를 보이고 있다. 코스피는 소폭 등락을 반복하며 박스권을 유지하고 있다.', source: '샘플 뉴스', link: '#', pubDate: '' },
  { title: '기후 변화 대응 위한 국제 협약 추진', description: '주요 20개국 정상들이 탄소 중립 목표 달성을 위한 새로운 국제 협약을 논의하고 있다. 2030년까지 탄소 배출량을 절반으로 줄이는 방안이 핵심 의제다.', source: '샘플 뉴스', link: '#', pubDate: '' },
  { title: '전기차 시장 경쟁 심화, 가격 인하 전쟁 돌입', description: '글로벌 전기차 업체들이 시장 점유율 확보를 위해 잇따라 가격을 인하하고 있다. 국내 완성차 업체들도 경쟁력 강화 방안을 모색 중이다.', source: '샘플 뉴스', link: '#', pubDate: '' },
  { title: '반도체 업황 회복세, 수출 증가 전망', description: '글로벌 반도체 수요가 회복되면서 국내 반도체 수출이 증가세로 돌아설 것으로 전망된다. AI 서버용 고대역폭 메모리 수요가 핵심 성장 동력이다.', source: '샘플 뉴스', link: '#', pubDate: '' },
  { title: '청년 주거 문제 해결 위한 정부 대책 발표', description: '정부가 청년층의 주거 부담을 줄이기 위해 공공임대 주택 공급을 대폭 늘리는 방안을 발표했다. 역세권을 중심으로 소형 주택 1만 호를 추가 공급할 예정이다.', source: '샘플 뉴스', link: '#', pubDate: '' },
  { title: '의료 AI 진단 기술, 임상 적용 확대', description: 'AI 기반 의료 영상 판독 기술이 주요 대형병원에 도입되면서 진단 정확도와 속도가 크게 향상되고 있다. 의사들의 업무 부담 경감 효과도 보고되고 있다.', source: '샘플 뉴스', link: '#', pubDate: '' },
  { title: '식품 물가 상승세 지속, 장바구니 부담 가중', description: '채소·과일 등 신선식품 가격이 지속적으로 오르면서 소비자들의 장바구니 부담이 커지고 있다. 이상기후로 인한 작황 부진이 주된 원인으로 지목된다.', source: '샘플 뉴스', link: '#', pubDate: '' },
  { title: '우주 탐사 경쟁 가속화, 달 기지 건설 청사진 공개', description: '미국·중국·유럽 등 주요국이 달 기지 건설 계획을 잇따라 발표하며 새로운 우주 경쟁이 본격화되고 있다. 민간 기업들의 참여도 활발해지고 있다.', source: '샘플 뉴스', link: '#', pubDate: '' },
  { title: '온라인 플랫폼 규제 강화, 빅테크 대응 분주', description: '국내외 규제 당국이 온라인 플랫폼의 시장 지배력 남용을 제한하는 법안을 추진하면서 빅테크 기업들이 대응책 마련에 분주하다.', source: '샘플 뉴스', link: '#', pubDate: '' }
];

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
  const items = await fetchWithFallback(rssUrl);
  if (!items) return null; // 폴백 신호
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
    let fetched = await getNewsHeadlines(rssUrl, 10);
    let usingSample = false;
    if (!fetched || fetched.length === 0) {
      fetched = SAMPLE_NEWS;
      usingSample = true;
    }
    newsItems = fetched;

    cardData = {};
    renderGrid(newsItems);
    document.getElementById('newsGrid').hidden = false;
    const countEl = document.getElementById('newsCount');
    if (usingSample) {
      countEl.textContent = `(샘플 데이터 — RSS 수집 불가, 카드뉴스 생성은 정상 작동합니다)`;
      countEl.style.color = '#d97706';
    } else {
      countEl.textContent = `(${newsItems.length}건)`;
      countEl.style.color = '';
    }

    // 뉴스별 카드뉴스 순차 생성 — 개별 실패해도 전체 루프 완주
    for (let i = 0; i < newsItems.length; i++) {
      progressEl.textContent = `카드뉴스 생성 중… (${i + 1}/${newsItems.length})`;
      updateItemBadge(i, 'loading');

      try {
        const cards = await generateCardNews(newsItems[i].title, newsItems[i].description);
        cardData[i] = cards;
        updateItemBadge(i, 'ready');
      } catch (e) {
        const msg = e.message ?? '';
        const isSafety = msg.startsWith('SAFETY_BLOCK') || msg === 'EMPTY_RESPONSE';
        const isLimit  = msg.includes('429');

        cardData[i] = isSafety ? 'blocked' : null;
        updateItemBadge(i, isSafety ? 'blocked' : 'error');

        // 실제 에러 메시지를 1.5초 표시 후 계속
        progressEl.textContent = `#${i + 1} 실패: ${msg.slice(0, 70)}`;
        await new Promise(r => setTimeout(r, 1500));

        if (isLimit) {
          progressEl.textContent = '한도 초과 — 4초 대기 후 재시도…';
          await new Promise(r => setTimeout(r, 4000));
          try {
            const cards = await generateCardNews(newsItems[i].title, newsItems[i].description);
            cardData[i] = cards;
            updateItemBadge(i, 'ready');
          } catch { /* 재시도 실패 시 그냥 넘어감 */ }
        }
      }

      // API 호출 간격 (과호출 방지)
      if (i < newsItems.length - 1) await new Promise(r => setTimeout(r, 800));
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
  if (!badge || !item) return;
  const map = {
    ready:   ['badge-ready',   '카드뉴스 보기'],
    pending: ['badge-pending', '생성 대기'],
    loading: ['badge-loading', '생성 중…'],
    error:   ['badge-error',   '생성 실패'],
    blocked: ['badge-error',   '안전 정책 제한']
  };
  const [cls, label] = map[state] ?? map.pending;
  badge.className = `news-item-badge ${cls}`;
  badge.textContent = label;
  if (state === 'loading') item.classList.add('generating');
  else item.classList.remove('generating');
}

/* ===== 슬라이드 ===== */
function openSlide(i) {
  const d = cardData[i];
  if (!d || typeof d !== 'object' || !Array.isArray(d)) {
    if (d === 'blocked') {
      showToast('안전 정책으로 인해 이 뉴스의 카드뉴스를 생성할 수 없습니다.');
    } else if (d === null) {
      showToast('카드뉴스 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } else {
      showToast('카드뉴스 생성 중입니다. 잠시 후 다시 눌러 주세요.');
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
