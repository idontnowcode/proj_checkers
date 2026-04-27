const SAVED_CARDS_KEY = 'saved_cards';

let savedItems = [];
let currentIndex = null;
let currentSlide = 0;

function loadSavedCards() {
  try {
    const raw = localStorage.getItem(SAVED_CARDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedCards(cards) {
  localStorage.setItem(SAVED_CARDS_KEY, JSON.stringify(cards));
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 3500);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatSavedAt(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '저장 일시 없음';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function renderSavedGrid() {
  const grid = document.getElementById('savedGrid');
  const count = document.getElementById('savedCount');

  if (!savedItems.length) {
    count.textContent = '(0개)';
    grid.innerHTML = '<div class="empty-state">저장된 카드뉴스가 없습니다.</div>';
    return;
  }

  count.textContent = `(${savedItems.length}개)`;

  grid.innerHTML = savedItems.map((item, i) => `
    <div class="news-item" id="saved-item-${i}" onclick="openSlide(${i})">
      <button class="save-icon saved" onclick="removeSaved(${i}, event)" aria-label="저장 해제">★</button>
      <span class="news-item-num">#${i + 1}</span>
      ${item.source ? `<div class="news-item-source">${escHtml(item.source)}</div>` : ''}
      <div class="news-item-title">${escHtml(item.title)}</div>
      <div class="saved-date">저장: ${escHtml(formatSavedAt(item.savedAt))}</div>
      <span class="news-item-badge badge-ready">카드뉴스 보기</span>
    </div>
  `).join('');
}

function removeSaved(i, e) {
  e?.stopPropagation();
  if (!savedItems[i]) return;
  savedItems.splice(i, 1);
  persistSavedCards(savedItems);
  renderSavedGrid();

  if (currentIndex === i) closeSlide();
  else if (currentIndex !== null && i < currentIndex) currentIndex--;

  showToast('저장을 해제했습니다.');
}

function openSlide(i) {
  const item = savedItems[i];
  if (!item || !Array.isArray(item.cards)) return;

  currentIndex = i;
  currentSlide = 0;

  document.getElementById('slideTitle').textContent = item.title;
  renderSlides(item.cards);
  updateNav(item.cards.length);

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
  track.innerHTML = cards.map(card => {
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
  const total = savedItems[currentIndex]?.cards?.length ?? 0;
  if (currentSlide >= total - 1) return;
  currentSlide++;
  moveSlide();
}

function moveSlide() {
  const track = document.getElementById('slideTrack');
  track.style.transform = `translateX(-${currentSlide * 100}%)`;
  updateNav(savedItems[currentIndex].cards.length);
}

function removeCurrentFromSlide(e) {
  e?.stopPropagation();
  if (currentIndex === null) return;
  removeSaved(currentIndex);
}

document.addEventListener('keydown', e => {
  if (document.getElementById('slideOverlay').hidden) return;
  if (e.key === 'ArrowRight') nextSlide();
  if (e.key === 'ArrowLeft') prevSlide();
  if (e.key === 'Escape') closeSlide();
});

document.getElementById('slideOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('slideOverlay')) closeSlide();
});

let touchStartX = 0;
document.getElementById('slideTrack').addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
}, { passive: true });
document.getElementById('slideTrack').addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (dx < -50) nextSlide();
  if (dx > 50) prevSlide();
}, { passive: true });

window.addEventListener('DOMContentLoaded', () => {
  savedItems = loadSavedCards();
  renderSavedGrid();
});
