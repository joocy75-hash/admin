# 통합 게임 관리자 패널 (Admin Panel)

> **상태**: Phase 0~13 전체 완료 + 회원 상세 8탭 + 회원 목록 리뉴얼 완료 | Backend 133 routes | Frontend 41 routes + 8탭 + 슬라이드 패널
> **Phase 상세**: @docs/reference/phases-completed.md
> **회원 상세 계획서**: @docs/plans/user-detail-plan.md

## 기술 스택

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript 5.7 + TailwindCSS 4 + shadcn/ui + Zustand
- **Backend**: Python 3.14 + FastAPI 0.115 + SQLModel + Alembic + PostgreSQL 16 + Redis 7
- **인프라**: Docker Compose (dev/prod 분리) + Nginx

## 개발 명령어

```bash
# Backend
cd backend && source .venv/bin/activate && PYTHONPATH=. uvicorn app.main:app --port 8002 --reload

# Frontend (한글 경로 → --webpack 필수)
cd frontend && npx next dev --port 3001 --webpack

# Frontend 빌드
cd frontend && npx next build --webpack

# Docker DB+Redis
docker compose up db redis -d

# Alembic (PYTHONPATH=. 필수)
cd backend && source .venv/bin/activate && PYTHONPATH=. alembic upgrade head

# 시드 데이터
cd backend && source .venv/bin/activate && python scripts/seed.py

# 로그인: superadmin / admin1234!
```

## 코드 스타일

**Python**: PEP 8, Black, type hints 필수, async/await 우선, snake_case
**TypeScript**: 함수형 선호, camelCase, kebab-case 파일명, 세미콜론, 싱글 쿼트, type 선호

## 핵심 규칙

- 코드 수정 전 반드시 파일 읽기
- 기존 코드 패턴 따르기
- 불필요한 주석/docstring 추가 금지
- console.log / print 디버깅 코드 남기지 않기
- .env 파일 커밋 금지
- 파일 삭제/DB 데이터 삭제 전 반드시 확인
- 패키지 버전 임의 변경 금지
- 명시적 요청 없이 커밋/푸시 금지
- 프로덕션 서버 직접 조작 금지

## 알려진 이슈

- 한글 경로(관리자페이지) → Turbopack 실패 → `--webpack` 필수
- PostgreSQL 포트: **5433** (기존 5432 충돌)
- passlib + bcrypt 4.x 비호환 → bcrypt 직접 사용
- 포트: Backend **8002**, Frontend **3001**
- Alembic: `PYTHONPATH=.` 필수

## 핵심 아키텍처

- **에이전트 트리**: Closure Table (admin_user_tree) - 최대 6단계
- **커미션**: 롤링(베팅금 %) + 죽장(손실금 %) - 게임 카테고리별 차등
- **인증**: JWT RS256 + Refresh Token + 2FA TOTP
- **권한**: RBAC 47개 퍼미션, PermissionChecker 의존성
- **외부 연동**: BaseConnector 어댑터 패턴 (4 커넥터: casino/sports/slot/holdem)

## 회원 상세정보 강화 (2026-02-18)

8탭 구조 전면 리뉴얼 완료:
- **신규 테이블 11개**: user_login_history, user_bank_accounts, user_betting_permissions, user_null_betting_configs, user_game_rolling_rates, bet_records, money_logs, point_logs, inquiries, inquiry_replies, messages
- **신규 API 22개**: /users/{id}/detail, /statistics, /bank-accounts(CRUD), /betting-permissions, /null-betting, /rolling-rates, /reset-password, /set-password, /suspend, /bets, /money-logs, /point-logs, /login-history, /inquiries(CRUD+reply), /messages(CRUD+read)
- **프론트엔드 파일**: `frontend/src/app/dashboard/users/[id]/` (page.tsx + tab-*.tsx 8개) + `frontend/src/hooks/use-user-detail.ts`
- **8탭**: 기본정보, 베팅, 머니, 포인트, 입출금, 문의내역, 추천코드, 쪽지
- **컬러 시스템**: Blue=긍정(활성/승인/지급), Red=부정(정지/회수/거부)

## Phase 1: 회원 목록 리뉴얼 + 슬라이드 패널 (2026-02-18)

- 요약 카드 3개 (전체회원/정상/총 보유금) - `/api/v1/users/summary-stats` API 신규
- 상태 필터 버튼 (전체/정상/정지/차단/대기)
- 등급 필터 버튼 (전체/부본사/총판/대리점)
- 클라이언트 페이지네이션 (10/20/50/100건)
- 슬라이드 패널: shadcn/ui Sheet (900px) - 8탭 재활용
- 공유 컴포넌트: `frontend/src/components/user-detail-content.tsx`
- 기존 `/dashboard/users/[id]` 페이지 유지 (직접 URL 접속용)

## 인수인계 문서

Phase 0~13 완료 문서: `docs/handoff/phase-{0..13}-handoff.md`
