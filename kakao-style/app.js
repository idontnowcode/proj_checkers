const API_DATA = [
  {
    id: 1, method: 'GET', path: '/v2/user/me',
    category: 'user', status: 'online', latency: '42ms',
    desc: '현재 로그인한 사용자의 프로필 정보를 반환합니다.',
    params: [
      { name: 'access_token', type: 'string', required: true, desc: 'OAuth 2.0 액세스 토큰' },
      { name: 'property_keys', type: 'array', required: false, desc: '조회할 필드 목록' }
    ],
    sampleResponse: '{\n  "id": 1234567890,\n  "kakao_account": {\n    "profile": {\n      "nickname": "홍길동",\n      "profile_image_url": "https://..."\n    },\n    "email": "user@devportal.com"\n  }\n}'
  },
  {
    id: 2, method: 'POST', path: '/v2/user/logout',
    category: 'auth', status: 'online', latency: '38ms',
    desc: '현재 세션을 종료하고 액세스 토큰을 만료시킵니다.',
    params: [
      { name: 'access_token', type: 'string', required: true, desc: 'OAuth 2.0 액세스 토큰' }
    ],
    sampleResponse: '{\n  "id": 1234567890\n}'
  },
  {
    id: 3, method: 'POST', path: '/v2/api/talk/memo/default/send',
    category: 'message', status: 'online', latency: '87ms',
    desc: '나에게 카카오톡 메시지를 전송합니다. 텍스트·이미지·링크 타입을 지원합니다.',
    params: [
      { name: 'access_token', type: 'string', required: true, desc: 'OAuth 2.0 액세스 토큰' },
      { name: 'template_object', type: 'object', required: true, desc: '메시지 템플릿 JSON' }
    ],
    sampleResponse: '{\n  "result_code": 0\n}'
  },
  {
    id: 4, method: 'GET', path: '/v1/storage/files',
    category: 'storage', status: 'degraded', latency: '312ms',
    desc: '클라우드 스토리지에 저장된 파일 목록을 페이징으로 반환합니다.',
    params: [
      { name: 'access_token', type: 'string', required: true, desc: 'OAuth 2.0 액세스 토큰' },
      { name: 'page', type: 'integer', required: false, desc: '페이지 번호 (기본값: 1)' },
      { name: 'size', type: 'integer', required: false, desc: '페이지 당 항목 수 (최대 50)' }
    ],
    sampleResponse: '{\n  "total_count": 124,\n  "page_count": 3,\n  "files": [\n    { "id": "abc123", "name": "document.pdf", "size": 20480 }\n  ]\n}'
  },
  {
    id: 5, method: 'POST', path: '/v1/storage/upload',
    category: 'storage', status: 'online', latency: '156ms',
    desc: 'multipart/form-data 형식으로 파일을 업로드합니다. 최대 100MB 지원.',
    params: [
      { name: 'access_token', type: 'string', required: true, desc: 'OAuth 2.0 액세스 토큰' },
      { name: 'file', type: 'file', required: true, desc: '업로드할 파일 (multipart)' },
      { name: 'overwrite', type: 'boolean', required: false, desc: '동일 파일명 덮어쓰기 여부' }
    ],
    sampleResponse: '{\n  "id": "xyz789",\n  "name": "photo.jpg",\n  "url": "https://storage.devportal.com/xyz789"\n}'
  },
  {
    id: 6, method: 'DELETE', path: '/v1/storage/files/:id',
    category: 'storage', status: 'online', latency: '29ms',
    desc: '지정한 파일 ID의 파일을 삭제합니다. 삭제된 파일은 복구할 수 없습니다.',
    params: [
      { name: 'access_token', type: 'string', required: true, desc: 'OAuth 2.0 액세스 토큰' },
      { name: 'id', type: 'string', required: true, desc: '삭제할 파일 ID (Path Parameter)' }
    ],
    sampleResponse: '{\n  "deleted_id": "abc123"\n}'
  },
  {
    id: 7, method: 'GET', path: '/v1/analytics/events',
    category: 'analytics', status: 'online', latency: '61ms',
    desc: '지정한 기간의 앱 이벤트 집계 데이터를 반환합니다.',
    params: [
      { name: 'access_token', type: 'string', required: true, desc: '서비스 앱 키' },
      { name: 'start_date', type: 'string', required: true, desc: '조회 시작일 (YYYY-MM-DD)' },
      { name: 'end_date', type: 'string', required: true, desc: '조회 종료일 (YYYY-MM-DD)' },
      { name: 'event_name', type: 'string', required: false, desc: '필터할 이벤트 이름' }
    ],
    sampleResponse: '{\n  "total_events": 98432,\n  "daily": [\n    { "date": "2026-04-28", "count": 12040 },\n    { "date": "2026-04-29", "count": 11823 }\n  ]\n}'
  },
  {
    id: 8, method: 'POST', path: '/v1/oauth/token',
    category: 'auth', status: 'online', latency: '55ms',
    desc: '인가 코드로 액세스 토큰 및 리프레시 토큰을 발급합니다.',
    params: [
      { name: 'grant_type', type: 'string', required: true, desc: '"authorization_code" 고정값' },
      { name: 'client_id', type: 'string', required: true, desc: '앱의 REST API 키' },
      { name: 'redirect_uri', type: 'string', required: true, desc: '인가 코드를 받을 URI' },
      { name: 'code', type: 'string', required: true, desc: '인가 코드' }
    ],
    sampleResponse: '{\n  "token_type": "bearer",\n  "access_token": "eyJhbG...",\n  "expires_in": 21599,\n  "refresh_token": "eyJhbG...",\n  "refresh_token_expires_in": 5183999\n}'
  },
  {
    id: 9, method: 'POST', path: '/v1/oauth/token/refresh',
    category: 'auth', status: 'offline', latency: '—',
    desc: '리프레시 토큰으로 액세스 토큰을 갱신합니다. (현재 점검 중)',
    params: [
      { name: 'grant_type', type: 'string', required: true, desc: '"refresh_token" 고정값' },
      { name: 'client_id', type: 'string', required: true, desc: '앱의 REST API 키' },
      { name: 'refresh_token', type: 'string', required: true, desc: '갱신에 사용할 리프레시 토큰' }
    ],
    sampleResponse: '{\n  "access_token": "eyJhbG...",\n  "token_type": "bearer",\n  "expires_in": 21599\n}'
  },
  {
    id: 10, method: 'GET', path: '/v2/user/scopes',
    category: 'user', status: 'online', latency: '33ms',
    desc: '사용자가 동의한 권한(scope) 목록을 반환합니다.',
    params: [
      { name: 'access_token', type: 'string', required: true, desc: 'OAuth 2.0 액세스 토큰' },
      { name: 'scopes', type: 'array', required: false, desc: '조회할 scope ID 목록' }
    ],
    sampleResponse: '{\n  "id": 1234567890,\n  "scopes": [\n    { "id": "profile", "agreed": true },\n    { "id": "account_email", "agreed": false }\n  ]\n}'
  },
  {
    id: 11, method: 'POST', path: '/v1/api/talk/friends/message/send',
    category: 'message', status: 'degraded', latency: '428ms',
    desc: '친구 목록의 특정 유저에게 메시지를 전송합니다. (응답 지연 중)',
    params: [
      { name: 'access_token', type: 'string', required: true, desc: 'OAuth 2.0 액세스 토큰' },
      { name: 'receiver_uuids', type: 'array', required: true, desc: '수신자 UUID 배열 (최대 5명)' },
      { name: 'template_object', type: 'object', required: true, desc: '메시지 템플릿 JSON' }
    ],
    sampleResponse: '{\n  "successful_receiver_uuids": ["abc", "def"],\n  "failure_info": []\n}'
  },
  {
    id: 12, method: 'GET', path: '/v1/analytics/users',
    category: 'analytics', status: 'online', latency: '74ms',
    desc: '신규·활성·이탈 사용자 수를 일별로 집계하여 반환합니다.',
    params: [
      { name: 'access_token', type: 'string', required: true, desc: '서비스 앱 키' },
      { name: 'start_date', type: 'string', required: true, desc: '조회 시작일 (YYYY-MM-DD)' },
      { name: 'end_date', type: 'string', required: true, desc: '조회 종료일 (YYYY-MM-DD)' }
    ],
    sampleResponse: '{\n  "daily": [\n    { "date": "2026-04-29", "new": 1024, "active": 8932, "churned": 45 }\n  ]\n}'
  }
];

/* ── State ── */
let activeFilters = { cat: 'all', method: null, status: null };
let searchQuery = '';
let selectedId = null;

/* ── Init ── */
function init() {
  renderStats();
  renderGrid();
  bindFilters();
  bindSearch();
  document.getElementById('closePanel').addEventListener('click', closeDetail);
  document.getElementById('resetFilter').addEventListener('click', resetFilters);
}

/* ── Stats ── */
function renderStats() {
  document.getElementById('totalCount').textContent = API_DATA.length;
  document.getElementById('onlineCount').textContent   = API_DATA.filter(a => a.status === 'online').length;
  document.getElementById('degradedCount').textContent = API_DATA.filter(a => a.status === 'degraded').length;
  document.getElementById('offlineCount').textContent  = API_DATA.filter(a => a.status === 'offline').length;
}

/* ── Filtering ── */
function getFiltered() {
  return API_DATA.filter(api => {
    if (activeFilters.cat !== 'all' && api.category !== activeFilters.cat) return false;
    if (activeFilters.method && api.method !== activeFilters.method) return false;
    if (activeFilters.status && api.status !== activeFilters.status) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!api.path.toLowerCase().includes(q) && !api.desc.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

/* ── Grid ── */
function renderGrid() {
  const grid = document.getElementById('apiGrid');
  const items = getFiltered();
  document.getElementById('resultCount').textContent = `${items.length}개 결과`;

  if (items.length === 0) {
    grid.innerHTML = `<div class="no-result">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <p>검색 결과가 없습니다.</p>
    </div>`;
    return;
  }

  grid.innerHTML = items.map(api => `
    <div class="api-card ${selectedId === api.id ? 'selected' : ''}" data-id="${api.id}">
      <div class="card-top">
        <span class="card-path">${api.path}</span>
        <div class="card-status">
          <span class="card-status-dot ${api.status}"></span>
          <span class="card-status-text">${statusLabel(api.status)}</span>
        </div>
      </div>
      <p class="card-desc">${api.desc}</p>
      <div class="card-footer">
        <span class="card-method ${api.method}">${api.method}</span>
        <span class="card-cat">${catLabel(api.category)}</span>
        <span class="card-latency">${api.latency}</span>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.api-card').forEach(card => {
    card.addEventListener('click', () => openDetail(Number(card.dataset.id)));
  });
}

/* ── Detail ── */
function openDetail(id) {
  selectedId = id;
  const api = API_DATA.find(a => a.id === id);
  if (!api) return;

  const panel = document.getElementById('detailPanel');
  panel.style.display = 'block';

  document.getElementById('detailBody').innerHTML = `
    <div class="detail-card">
      <div class="detail-section">
        <p class="detail-key">엔드포인트</p>
        <p class="detail-val"><span class="card-method ${api.method}" style="font-size:11px;padding:.15rem .4rem;border-radius:4px;">${api.method}</span> <code style="font-size:13px;color:#a3e635;">${api.path}</code></p>
      </div>
      <div class="detail-section">
        <p class="detail-key">상태</p>
        <p class="detail-val" style="display:flex;align-items:center;gap:6px;">
          <span class="status-dot ${api.status}" style="width:8px;height:8px;border-radius:50%;display:inline-block;"></span>
          ${statusLabel(api.status)} <span style="color:var(--text3);font-size:12px;">(${api.latency})</span>
        </p>
      </div>
      <div class="detail-section">
        <p class="detail-key">설명</p>
        <p class="detail-val" style="font-size:13px;color:var(--text2);line-height:1.6;">${api.desc}</p>
      </div>
      <div class="detail-section">
        <p class="detail-key">파라미터</p>
        <div class="detail-params">
          ${api.params.map(p => `
            <div class="param-row">
              <span class="param-name">${p.name}</span>
              <span class="param-type">${p.type}</span>
              ${p.required ? '<span class="param-req">필수</span>' : ''}
              <span class="param-desc">${p.desc}</span>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="detail-section">
        <p class="detail-key">샘플 응답</p>
        <div class="detail-code">${api.sampleResponse}</div>
      </div>
      <div class="detail-section">
        <button class="try-btn" onclick="tryApi(${api.id})">▶ 테스트 실행</button>
        <div class="try-result" id="tryResult-${api.id}"></div>
      </div>
    </div>
  `;

  renderGrid();
}

function closeDetail() {
  selectedId = null;
  document.getElementById('detailPanel').style.display = 'none';
  document.getElementById('detailBody').innerHTML = '<p class="detail-placeholder">카드를 클릭하면 상세 정보를 확인할 수 있습니다.</p>';
  renderGrid();
}

function tryApi(id) {
  const api = API_DATA.find(a => a.id === id);
  const el = document.getElementById(`tryResult-${id}`);
  el.style.display = 'block';

  if (api.status === 'offline') {
    el.style.color = '#f87171';
    el.textContent = '503 Service Unavailable\n{\n  "error": "service_temporarily_unavailable"\n}';
    return;
  }
  if (api.status === 'degraded') {
    el.style.color = '#fbbf24';
    el.textContent = `200 OK  (${api.latency})\n` + api.sampleResponse;
    return;
  }
  el.style.color = '#86efac';
  el.textContent = `200 OK  (${api.latency})\n` + api.sampleResponse;
}

/* ── Filters ── */
function bindFilters() {
  document.querySelectorAll('[data-cat]').forEach(el => {
    el.addEventListener('click', () => {
      activeFilters.cat = el.dataset.cat;
      document.querySelectorAll('[data-cat]').forEach(e => e.classList.remove('active'));
      el.classList.add('active');
      renderGrid();
    });
  });
  document.querySelectorAll('[data-method]').forEach(el => {
    el.addEventListener('click', () => {
      const val = el.dataset.method;
      if (activeFilters.method === val) {
        activeFilters.method = null;
        el.classList.remove('active');
      } else {
        activeFilters.method = val;
        document.querySelectorAll('[data-method]').forEach(e => e.classList.remove('active'));
        el.classList.add('active');
      }
      renderGrid();
    });
  });
  document.querySelectorAll('[data-status]').forEach(el => {
    el.addEventListener('click', () => {
      const val = el.dataset.status;
      if (activeFilters.status === val) {
        activeFilters.status = null;
        el.classList.remove('active');
      } else {
        activeFilters.status = val;
        document.querySelectorAll('[data-status]').forEach(e => e.classList.remove('active'));
        el.classList.add('active');
      }
      renderGrid();
    });
  });
}

function resetFilters() {
  activeFilters = { cat: 'all', method: null, status: null };
  searchQuery = '';
  document.getElementById('apiSearch').value = '';
  document.getElementById('globalSearch').value = '';
  document.querySelectorAll('.filter-item').forEach(e => e.classList.remove('active'));
  document.querySelector('[data-cat="all"]').classList.add('active');
  renderGrid();
}

function bindSearch() {
  const doSearch = q => { searchQuery = q; renderGrid(); };
  document.getElementById('apiSearch').addEventListener('input', e => doSearch(e.target.value.trim()));
  document.getElementById('globalSearch').addEventListener('input', e => {
    const q = e.target.value.trim();
    document.getElementById('apiSearch').value = q;
    doSearch(q);
    if (q) window.scrollTo({ top: document.querySelector('.hero').offsetHeight + 60, behavior: 'smooth' });
  });
}

/* ── Helpers ── */
function statusLabel(s) {
  return { online: '정상', degraded: '지연', offline: '오류' }[s] ?? s;
}
function catLabel(c) {
  return { auth: 'Auth', user: 'User', message: 'Message', storage: 'Storage', analytics: 'Analytics' }[c] ?? c;
}

document.addEventListener('DOMContentLoaded', init);
