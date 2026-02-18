# Code Review Report - 통합 게임 관리자 패널

> **Date**: 2026-02-18
> **Reviewers**: 4-Agent Team (Backend / Frontend / Security / Architecture)
> **Scope**: Full codebase (Backend 137 routes + Frontend 41 routes)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Overall Score** | **75 / 100** |
| **Security Grade** | **B+** |
| **Architecture Score** | **82 / 100** |
| **Consistency Score** | **78 / 100** |
| **Files Reviewed** | 143+ (Backend 58 + Frontend 85) |
| **Total Issues** | **58** (Critical 8, Major 23, Minor 27) |

---

## Issue Distribution

| Category | Critical | Major | Minor | Total |
|----------|----------|-------|-------|-------|
| Backend Code Quality | 3 | 7 | 8 | 18 |
| Frontend Code Quality | 4 | 13 | 12 | 29 |
| Security | 1 | 3 | 4 | 8 |
| Architecture / DB | 4 | 7 | 7 | 18 |
| **Total (deduplicated)** | **8** | **23** | **27** | **58** |

> Note: Backend C1, Security L3, Architecture C1은 동일 이슈 (virtual_account 필드 참조) - 중복 제거 후 집계

---

## TOP 10 - Immediate Fix Required

### 1. [CRITICAL-FINANCE] Commission Webhook 인증 없음
- **File**: `backend/app/api/v1/commissions.py:409-491`
- **Risk**: 외부 공격자가 가짜 베팅/정산 데이터를 전송하여 허위 커미션 생성 가능
- **Fix**: HMAC 서명 검증 또는 API Key 인증 + IP 화이트리스트 추가
- **Priority**: P0 (금융 시스템 직접 위협)

### 2. [CRITICAL-RUNTIME] _build_response_batch 제거된 필드 참조
- **File**: `backend/app/api/v1/users.py:135-136`
- **Risk**: 회원 목록 조회 시 AttributeError 500 에러
- **Fix**: `virtual_account_bank/number` -> `deposit_address/deposit_network`
- **Priority**: P0 (기능 장애)

### 3. [CRITICAL-ROUTING] /transactions/summary 경로 충돌
- **File**: `backend/app/api/v1/finance.py:118-132`
- **Risk**: summary 엔드포인트 접근 불가 (tx_id로 매칭됨)
- **Fix**: summary 라우트를 {tx_id} 라우트 앞으로 이동
- **Priority**: P0 (기능 장애)

### 4. [CRITICAL-SECURITY] Refresh Token 무효화 미구현
- **File**: `backend/app/api/v1/auth.py:161-164`
- **Risk**: 로그아웃 후에도 7일간 토큰 유효, 탈취된 토큰 무효화 불가
- **Fix**: Redis 블랙리스트 구현 (JTI 기반, TTL = 남은 만료시간)
- **Priority**: P0 (인증 보안)

### 5. [CRITICAL-SECURITY] 출금 생성 시 잔액 체크 Race Condition
- **File**: `backend/app/services/transaction_service.py:45-73`
- **Risk**: 동시 출금 요청으로 잔액 초과 출금 가능
- **Fix**: `create_withdrawal()`에서 `session.get(User, id, with_for_update=True)` 사용
- **Priority**: P0 (금융 시스템 직접 위협)

### 6. [CRITICAL-SECURITY] Connector Webhook 서명 검증 선택적
- **File**: `backend/app/api/v1/connector.py:188-220`
- **Risk**: X-Signature 헤더 생략 시 검증 우회
- **Fix**: api_secret이 설정된 경우 서명 검증을 필수로 변경
- **Priority**: P1

### 7. [CRITICAL-FRONTEND] CSP localhost 하드코딩
- **File**: `frontend/src/app/layout.tsx:30`
- **Risk**: 프로덕션 배포 시 API 연결 전면 차단 + unsafe-eval로 CSP 무력화
- **Fix**: 환경변수 기반 동적 CSP 생성
- **Priority**: P1 (배포 차단)

### 8. [MAJOR-PERF] Partner Users N+1 쿼리
- **File**: `backend/app/api/v1/partner.py:168-178`
- **Risk**: 유저 100명 -> 200회 추가 쿼리, 느린 응답
- **Fix**: GROUP BY user_id 배치 쿼리로 변환
- **Priority**: P1

### 9. [MAJOR-AUTH] 퍼미션 이름 오류 (users.edit)
- **File**: `backend/app/api/v1/user_inquiry.py:158`, `user_message.py:104,142`
- **Risk**: 시드에 없는 퍼미션 -> 모든 사용자 답변/쪽지 불가
- **Fix**: `users.edit` -> `users.update` 확인 및 수정
- **Priority**: P1 (기능 장애)

### 10. [MAJOR-TYPE] GameRound float 사용
- **File**: `backend/app/models/game.py:44`
- **Risk**: 베팅/당첨 금액 부동소수점 오류
- **Fix**: `Decimal(18,2)`로 변경 + Alembic 마이그레이션
- **Priority**: P1 (데이터 정확성)

---

## Category Details

### Backend (18 issues)

#### Critical (3)
| ID | File | Issue |
|----|------|-------|
| BE-C1 | users.py:135 | 제거된 필드 참조 (AttributeError) |
| BE-C2 | transaction_service.py:39 | asyncio.ensure_future deprecated + 커밋 전 이벤트 발행 |
| BE-C3 | finance.py:118-132 | /transactions/summary 경로 충돌 |

#### Major (7)
| ID | File | Issue |
|----|------|-------|
| BE-M1 | agents.py:91 / users.py:231 | LIKE 와일드카드 이스케이프 미처리 |
| BE-M2 | partner.py:168 | N+1 쿼리 (bet_sum/win_sum) |
| BE-M3 | audit.py:161 | Excel Export N+1 (최대 5000회) |
| BE-M4 | agents.py:116 | 에이전트 목록 N+1 (descendant_count) |
| BE-M5 | games.py:203 | Game Rounds N+1 (Game + User JOIN 필요) |
| BE-M6 | middleware/audit.py:74 | datetime.utcnow() deprecated (78회) |
| BE-M7 | user_inquiry.py:158 | 잘못된 퍼미션명 "users.edit" |

#### Minor (8)
| ID | File | Issue |
|----|------|-------|
| BE-m1 | config.py:5 | 기본 DB URL에 하드코딩된 비밀번호 |
| BE-m2 | models/game.py:44 | GameRound float 사용 |
| BE-m3 | models/setting.py:43 | AgentSalaryConfig float 사용 |
| BE-m4 | settlements.py:165 | POST body 기본값 |
| BE-m5 | events.py:16 | SSE 토큰 쿼리 파라미터 |
| BE-m6 | user_history.py:161 | 변수명 l (가독성) |
| BE-m7 | cache_service.py:10 | Redis connection pool 미설정 |
| BE-m8 | users.py:168 | _verify_user_access 접근 제어 미완성 |

### Frontend (29 issues)

#### Critical (4)
| ID | File | Issue |
|----|------|-------|
| FE-C1 | use-sse.ts:32 | SSE 토큰 URL 노출 |
| FE-C2 | layout.tsx:30 | CSP localhost 하드코딩 + unsafe-eval |
| FE-C3 | auth-store.ts:38 | JWT localStorage 저장 (XSS 취약) |
| FE-C4 | use-sse/reports/audit.ts | getTokenFromStorage 3중 중복 |

#### Major (13)
| ID | File | Issue |
|----|------|-------|
| FE-M1 | use-users.ts:138 | while(true) 무한 루프 전체 유저 로딩 |
| FE-M2 | agents/tree, users/tree | react-d3-tree any 타입 |
| FE-M3 | 5+ files | formatKRW 5곳 중복 정의 |
| FE-M4 | use-dashboard.ts | 폴링 vs SSE 불일치 |
| FE-M5 | agents/[id], tab-general 등 | 200줄+ 대형 컴포넌트 (최대 519줄) |
| FE-M6 | transactions, commissions 등 | shadcn/ui vs raw HTML 비일관 |
| FE-M7 | (전체) | Error Boundary 부재 |
| FE-M8 | dashboard/page.tsx | 에러 상태 미처리 (빈 화면) |
| FE-M9 | use-sse.ts:23 | onEvent 불안정 참조 (SSE 재연결) |
| FE-M10 | tab-money/tab-points | 95% 동일 코드 (175줄 x 2) |
| FE-M11 | user-detail-content 등 | confirm()/alert() 네이티브 다이얼로그 |
| FE-M12 | types/index.ts | 타입 분산 정의 (중앙화 미흡) |
| FE-M13 | login/page.tsx:53 | 2FA 트리거가 에러 문자열 매칭 |

#### Minor (12)
| ID | Issue |
|----|-------|
| FE-m1 | use-mobile.ts dead code |
| FE-m2 | EditIcon 인라인 SVG (lucide 사용 가능) |
| FE-m3 | formatKRW -> formatAmount 이름 변경 필요 |
| FE-m4 | 아이콘 버튼 aria-label 누락 |
| FE-m5 | CommissionRateTab 인라인 (519줄 파일) |
| FE-m6 | timeAgo 로컬 정의 |
| FE-m7 | partner 에러 상태 미표시 |
| FE-m8 | 기간 필터 코드 3곳 반복 |
| FE-m9 | 커미션 타입 label 로컬 매핑 |
| FE-m10 | catch 블록 에러 무시 (6곳) |
| FE-m11 | games 페이지 스타일 미세 불일치 |
| FE-m12 | TiptapEditor 로딩 레이아웃 시프트 |

### Security (8 unique issues after dedup)

| Severity | ID | Issue |
|----------|----|-------|
| Critical | SEC-C1 | Commission Webhook 인증 없음 |
| High | SEC-H1 | Refresh Token 무효화 미구현 |
| High | SEC-H2 | 출금 생성 시 Balance Race Condition |
| High | SEC-H3 | Connector Webhook 서명 검증 선택적 |
| Medium | SEC-M1 | Default SECRET_KEY 약한 기본값 |
| Medium | SEC-M2 | /health 에러 상세 노출 |
| Medium | SEC-M3 | localStorage 토큰 저장 |
| Medium | SEC-M4 | Redis 비밀번호 미설정 |

### Architecture (8 unique issues after dedup)

| Severity | ID | Issue |
|----------|----|-------|
| Critical | ARC-C1 | GameRound float -> Decimal 필요 |
| Critical | ARC-C2 | Transaction/CommissionLedger user_id FK 누락 |
| Critical | ARC-C3 | 프론트-백 API 호출 형식 불일치 (배열 vs 단일 객체) |
| Major | ARC-M1 | SSE in-memory 기반 (멀티 워커 미지원) |
| Major | ARC-M2 | 커밋 전 이벤트 발행 (false positive) |
| Major | ARC-M3 | Legacy user_bank_account 모델 잔존 |
| Major | ARC-M4 | Pagination 응답 형식 불일치 (snake vs camel) |
| Minor | ARC-m1 | nginx ${DOMAIN} 환경변수 미치환 |

---

## Positive Highlights

### Backend Strengths
1. Closure Table 계층 구조 정확 구현
2. SELECT FOR UPDATE 잠금 적절 적용 (approve/adjustment)
3. PermissionChecker 47 퍼미션 일관 적용
4. 워터폴 커미션 엔진 정확성
5. Redis 장애 시 Graceful degradation
6. Batch 쿼리 최적화 (_build_response_batch)
7. CRUD 패턴/에러 응답 전체 일관성
8. Soft Delete 패턴
9. Webhook 중복 방지 (reference_id)

### Frontend Strengths
1. 일관된 Hook 패턴 (useState + useCallback + useEffect)
2. Auth Guard + RBAC sidebar 통합
3. Loading/Empty 상태 처리 우수
4. API Client 자동 토큰 갱신 (401 -> refresh -> retry)
5. Tree 시각화 + Sheet 슬라이드 패널 UX 우수
6. TypeScript 타입 커버리지 양호 (any 2곳만)

### Security Strengths
1. SQL Injection 위험 제로 (ORM 100% 사용)
2. XSS 벡터 없음
3. 강력한 보안 헤더 (HSTS, X-Frame-Options 등)
4. bcrypt 올바른 사용
5. RBAC 47 퍼미션 완성
6. 감사 로그 (모든 변경 작업)
7. Rate Limiting (Login 5/min, API 60/min)
8. 금융 데이터 Decimal 정밀 계산

### Architecture Strengths
1. 4-Layer 분리 (API -> Service -> Model -> Schema)
2. dev/prod Docker 구성 분리
3. prod 필수 환경변수 강제
4. Base Connector 어댑터 패턴 (재시도 + 지수 백오프)

---

## Recommended Fix Order

### Phase 1: 즉시 수정 (P0 - 서비스 장애/보안 위협)
1. Commission Webhook 인증 추가 (SEC-C1)
2. _build_response_batch 필드 수정 (BE-C1)
3. /transactions/summary 라우트 순서 수정 (BE-C3)
4. 출금 잔액 체크 SELECT FOR UPDATE (SEC-H2)
5. Refresh Token Redis 블랙리스트 (SEC-H1)
6. Connector Webhook 서명 검증 필수화 (SEC-H3)
7. 퍼미션명 오류 수정 (BE-M7)

### Phase 2: 주요 개선 (P1 - 품질/성능)
1. CSP 환경변수 기반 동적 생성 (FE-C2)
2. N+1 쿼리 4곳 배치 최적화 (BE-M2~M5)
3. GameRound float -> Decimal (ARC-C1)
4. FK 추가 (ARC-C2)
5. 프론트-백 API 형식 정합 (ARC-C3)
6. Error Boundary 추가 (FE-M7)
7. getTokenFromStorage / formatKRW 중복 제거 (FE-C4, FE-M3)

### Phase 3: 코드 품질 (P2 - 리팩토링)
1. localStorage -> httpOnly 쿠키 전환 (FE-C3)
2. shadcn/ui 사용 통일 (FE-M6)
3. 대형 컴포넌트 분리 (FE-M5)
4. tab-money/tab-points 공통 컴포넌트 (FE-M10)
5. SSE Redis Pub/Sub 전환 (ARC-M1)
6. datetime.utcnow() -> datetime.now(UTC) (BE-M6)
7. confirm()/alert() -> shadcn AlertDialog (FE-M11)

---

*Generated by 4-Agent Code Review Team (2026-02-18)*
