# Phase 0 인수인계 - 프로젝트 초기 설정

## 완료 날짜: 2026-02-18

## 완료 사항
- [x] 프로젝트 디렉토리 구조 생성 (backend/, frontend/, scripts/, docs/)
- [x] docker-compose.yml (PostgreSQL 16 + Redis 7)
- [x] FastAPI 백엔드 초기화 (main.py, config.py, database.py)
- [x] Alembic 마이그레이션 설정
- [x] Next.js 16 프론트엔드 초기화 (App Router, TailwindCSS 4)
- [x] shadcn/ui 설정 + 핵심 컴포넌트 14개 설치
- [x] Zustand, TanStack Table/Query, Recharts, react-d3-tree 등 패키지 설치
- [x] API 클라이언트 (frontend/src/lib/api-client.ts)
- [x] Auth 스토어 (frontend/src/stores/auth-store.ts)
- [x] 공통 타입 (frontend/src/types/index.ts)
- [x] 환경변수 (.env, .env.example)
- [x] .gitignore
- [x] Dockerfile (backend + frontend)
- [x] OpenAPI → TypeScript 타입 생성 스크립트

## 검증 결과
- Backend /health: ✅ `{"status":"ok","version":"0.1.0","service":"admin-panel-backend"}`
- Backend DB 연결: ✅ PostgreSQL 16 연결 성공
- Backend OpenAPI 문서: ✅ /docs 접근 가능
- Frontend dev 서버: ✅ localhost:3000 렌더링 성공
- Docker (DB + Redis): ✅ 컨테이너 정상 실행

## 알려진 이슈
- 한글 경로(관리자페이지) 때문에 Turbopack 빌드 실패 → Docker 내(/app)에서는 정상
- 로컬 PostgreSQL 포트 5432 충돌 → 5433으로 매핑
- Backend venv 필요: `source backend/.venv/bin/activate`

## 핵심 파일
- `backend/app/main.py` - FastAPI 앱 진입점
- `backend/app/config.py` - Pydantic Settings
- `backend/app/database.py` - SQLAlchemy async engine
- `frontend/src/app/layout.tsx` - Next.js 루트 레이아웃
- `frontend/src/lib/api-client.ts` - API 클라이언트
- `docker-compose.yml` - 전체 인프라 정의

## DB 포트 매핑
- PostgreSQL: 호스트 5433 → 컨테이너 5432
- Redis: 호스트 6379 → 컨테이너 6379

## 다음 단계: Phase 1 (DB 스키마 + 모델 정의)
- admin_users, admin_user_tree (Closure Table) 모델 생성
- roles, permissions (RBAC) 모델 생성
- commission_policies, commission_ledger 모델 생성
- settlements, transactions 모델 생성
- Alembic 초기 마이그레이션 실행
- 시드 데이터 (super_admin, 기본 역할/권한)
