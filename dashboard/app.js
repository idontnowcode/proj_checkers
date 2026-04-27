// ── Data (inlined for local + GitHub Pages compatibility) ──────────────────
const DATA = {
  "project": "proj_checkers",
  "description": "AI 활용 점검을 위한 스킬 모음 프로젝트",
  "lastUpdated": "2026-04-27",
  "skills": [
    {
      "id": "prompt-clarify",
      "name": "prompt-clarify",
      "description": "사용자가 작성한 AI 지시 프롬프트를 역질문을 통해 명확하고 구체적으로 개선",
      "currentScore": 97,
      "status": "active",
      "history": [
        { "label": "초안", "score": 56 },
        { "label": "멀티에이전트 추가", "score": 88 },
        { "label": "스킬추천 추가", "score": 88 },
        { "label": "프론트매터 추가", "score": 88 },
        { "label": "엣지케이스 보강", "score": 97 }
      ]
    },
    {
      "id": "eval-rubric",
      "name": "eval-rubric",
      "description": "AI 결과물을 체크리스트·점수표(과락 기준 포함)로 정량 평가하고 피드백 제공",
      "currentScore": 97,
      "status": "active",
      "history": [
        { "label": "초안", "score": 52 },
        { "label": "프론트매터 추가", "score": 89 },
        { "label": "배점기준 명확화", "score": 97 }
      ]
    },
    {
      "id": "task-orchestrator",
      "name": "task-orchestrator",
      "description": "최종 프롬프트를 받아 필요한 스킬을 자율 조율하고 품질 검증까지 완료하는 팀장 역할",
      "currentScore": 95,
      "status": "active",
      "history": [
        { "label": "초안", "score": 82 },
        { "label": "갭스킬 자동생성 추가", "score": 95 }
      ]
    },
    {
      "id": "skill-creator",
      "name": "skill-creator",
      "description": "새로운 스킬을 처음부터 만들거나 기존 스킬을 개선하고 성능을 정량 측정 (Anthropic 공식)",
      "currentScore": null,
      "status": "unscored",
      "history": []
    },
    {
      "id": "web-dev",
      "name": "web-dev",
      "description": "사용자 개입 없이 AI 단독으로 완성 가능한 정적 웹 앱을 기획·구현·GitHub Pages 배포",
      "currentScore": 96,
      "status": "active",
      "history": [
        { "label": "초안", "score": 90 },
        { "label": "CORS·CSS 패턴 추가", "score": 96 }
      ]
    }
  ]
};

// ── Chart color palette ────────────────────────────────────────────────────
const COLORS = ['#4f46e5','#10b981','#f59e0b','#ef4444','#8b5cf6'];

// ── Helpers ────────────────────────────────────────────────────────────────
function scoreBarClass(score) {
  if (score === null) return '';
  if (score >= 90) return 'high';
  if (score >= 75) return 'mid';
  return '';
}

// ── Render skill cards ─────────────────────────────────────────────────────
function renderSkillGrid(skills) {
  const grid = document.getElementById('skillGrid');
  grid.innerHTML = skills.map(skill => {
    const score = skill.currentScore;
    const isUnscored = score === null;
    const barWidth = isUnscored ? 0 : score;
    const barClass = scoreBarClass(score);

    return `
      <div class="skill-card">
        <div class="skill-card-header">
          <span class="skill-name">${skill.name}</span>
          <span class="skill-badge ${isUnscored ? 'badge-unscored' : 'badge-active'}">
            ${isUnscored ? '미채점' : '운영중'}
          </span>
        </div>
        <p class="skill-desc">${skill.description}</p>
        <div class="skill-score-row">
          <div class="score-bar-wrap">
            <div class="score-bar ${barClass}" style="width: ${barWidth}%"></div>
          </div>
          ${isUnscored
            ? `<span class="score-label unscored">미채점</span>`
            : `<span class="score-label">${score}<small style="font-size:.7em;font-weight:400">/100</small></span>`
          }
        </div>
      </div>
    `;
  }).join('');
}

// ── Render history charts ──────────────────────────────────────────────────
function renderCharts(skills) {
  const grid = document.getElementById('chartGrid');
  const scored = skills.filter(s => s.history.length > 0);

  if (scored.length === 0) {
    grid.innerHTML = '<p style="color:var(--muted);font-size:.875rem">개선 이력이 없습니다.</p>';
    return;
  }

  grid.innerHTML = scored.map((skill, idx) => `
    <div class="chart-card">
      <div class="chart-card-title">
        ${skill.name}
        <span>최고 ${Math.max(...skill.history.map(h => h.score))}점</span>
      </div>
      <div class="chart-wrap">
        <canvas id="chart-${skill.id}"></canvas>
      </div>
    </div>
  `).join('');

  scored.forEach((skill, idx) => {
    const ctx = document.getElementById(`chart-${skill.id}`).getContext('2d');
    const color = COLORS[idx % COLORS.length];
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: skill.history.map(h => h.label),
        datasets: [{
          label: '점수',
          data: skill.history.map(h => h.score),
          borderColor: color,
          backgroundColor: color + '18',
          borderWidth: 2.5,
          pointBackgroundColor: color,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.parsed.y}점`
            }
          }
        },
        scales: {
          y: {
            min: 0, max: 100,
            ticks: { stepSize: 25, font: { size: 11 } },
            grid: { color: '#f0f0f0' }
          },
          x: {
            ticks: { font: { size: 10 }, maxRotation: 30 },
            grid: { display: false }
          }
        }
      }
    });
  });
}

// ── Init ───────────────────────────────────────────────────────────────────
function init() {
  // 마지막 업데이트 날짜
  const el = document.getElementById('lastUpdated');
  if (el) el.textContent = `마지막 업데이트: ${DATA.lastUpdated}`;

  renderSkillGrid(DATA.skills);
  renderCharts(DATA.skills);
}

document.addEventListener('DOMContentLoaded', init);
