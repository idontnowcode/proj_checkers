# PROJECT_LOG.md

Claude/Codex 공용 진행 기록. **세션 시작 시 이 파일을 가장 먼저 읽는다.**

---

## 📌 현재 상태 스냅샷
<!-- 항상 최신 상태로 덮어쓴다. 1개만 유지. -->

- **날짜**: 2026-04-29
- **스킬 수**: 17개 (Project-Local)
- **마지막 작업**: critical-challenger 스킬 신규 생성 (95점, 1차 합격)
- **주의사항**: browser-automation은 Codex 미지원 (eval-rubric 대체)

---

## 🕐 최근 작업 로그
<!-- 최신 항목이 위에 온다. 최대 10개 유지. 10개 초과 시 → 아래 로테이션 규칙 적용. -->

| 날짜 | 에이전트 | 작업 내용 | 결과 |
|------|---------|-----------|------|
| 2026-04-29 | Claude | critical-challenger 스킬 신규 생성 (95점 1차 합격, Steel-Man + 7범주 논리결함 + 리스크맵) | ✅ |
| 2026-04-29 | Claude | verification-before-completion / writing-plans / test-driven-development 로컬 스킬 생성 (Codex 공유) | ✅ |
| 2026-04-29 | Claude | dispatching-parallel-agents / systematic-debugging / code-review 스킬 생성 | ✅ |
| 2026-04-29 | Claude | AGENTS.md 전면 개편 (Codex 워크플로우 + 도구 매핑) | ✅ |
| 2026-04-29 | Claude | task-orchestrator 모호성 감지 → prompt-clarify 자동 발동 추가 | ✅ |
| 2026-04-29 | Claude | skill-creator 61pt → 95pt 개선 (2차 반복) | ✅ |
| 2026-04-29 | Claude | skill-auditor Agent Teams 테스트: 10개 스킬 전수 감사 | 10/10 합격 |
| 2026-04-29 | Claude | CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 환경변수 설정 | ✅ |
| 2026-04-29 | Claude | kakao-style 개발자 포털 모방 페이지 GitHub Pages 배포 | ✅ |
| 2026-04-29 | Claude | browser-automation 스킬 신규 생성 (92pt) | ✅ |

---

## 💡 누적 학습
<!-- 영구 보존. 플랫폼별 주의사항, 반복 실수, 핵심 인사이트만. 최대 8개. -->

- `browser-automation`: Claude in Chrome MCP 필요. Codex·로컬 파일 URL에서 미작동. GitHub Pages URL 사용 필수.
- `skill-creator`: Anthropic 공식 스킬 오버라이드 파일. 한국어 트리거·95점 등록 기준·입력 명확화 절차 포함 필수.
- `rss-fetcher`: 8000ms AbortController 타임아웃. 5개 프록시 폴백 순서: rss2json → allorigins/raw → allorigins/get → corsproxy → codetabs.
- `gemini-client`: API 키 절대 소스코드에 포함 금지. localStorage만 사용. 모델 폴백: 2.5-flash → 2.0-flash-001 → 1.5-flash.
- `Codex 로컬 스킬 전환 기준`: 순수 방법론(도구 미사용)이면 그대로 변환. bkit 파일 의존(`btw`)·외부 템플릿 의존(`requesting-code-review`)은 제외.
- `eval-rubric` 과락 기준: 70점. proj_checkers 등록 기준: 95점.
- Agent Teams 병렬 실행: 검증 단계(eval-rubric + app-tester + browser-automation)를 동시 실행하면 처리 속도 최대 3배 향상.

---

## 🔄 로테이션 규칙
<!-- 에이전트가 이 규칙을 읽고 자동으로 실행한다. -->

**트리거**: "최근 작업 로그"의 행이 10개를 초과할 때

**실행 순서**:
1. 가장 오래된 5개 항목을 `PROJECT_LOG_ARCHIVE.md`에 추가
2. 5개를 핵심 인사이트 1~2줄로 요약 → "누적 학습"에 추가 (8개 초과 시 가장 오래된 것 삭제)
3. "최근 작업 로그"에서 해당 5개 삭제
4. "현재 상태 스냅샷" 갱신

**작업 완료 후 이 파일 업데이트 방법**:
- "현재 상태 스냅샷": 최신 상태로 덮어쓰기
- "최근 작업 로그": 새 행을 맨 위에 추가 (형식: `날짜 | 에이전트 | 작업 내용 | 결과`)
- 10개 초과 시 즉시 로테이션 실행
