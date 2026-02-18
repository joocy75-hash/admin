# 통합 게임 관리자 패널 - 설계 문서

> **작성일**: 2026-02-17
> **상태**: 승인 대기

---

## 1. 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Compose                           │
├──────────────────┬──────────────────────────────────────────┤
│   Frontend       │   Backend                                │
│   Next.js 16     │   FastAPI (Python 3.14)                  │
│   React 19       │   Pydantic v2                            │
│   TailwindCSS 4  │   SQLModel + Alembic                     │
│   shadcn/ui      │   PostgreSQL 16                           │
│   Zustand 5      │   Redis 7                                 │
│   Port: 3000     │   Port: 8000                              │
├──────────────────┴──────────────────────────────────────────┤
│                  외부 게임 API (커넥터 패턴)                    │
│   카지노 | 슬롯 | 미니게임 | 가상축구 | 스포츠 | e스포츠 | 홀덤   │
└─────────────────────────────────────────────────────────────┘
```

## 2. 데이터 플로우

```
외부 게임 백엔드
    │
    ▼ Webhook (베팅/게임결과/입금/가입)
    │
FastAPI Connector (HMAC 검증)
    │
    ├─▶ commission_engine.py (롤링/죽장 계산)
    │       │
    │       ▼ Closure Table 조회 → 상위 에이전트 체인
    │       │
    │       ▼ commission_ledger (원장 기록)
    │
    ├─▶ settlement_service.py (정산)
    │       │
    │       ▼ pending 커미션 집계 → 정산서 생성
    │       │
    │       ▼ 관리자 확인 → 지급
    │
    └─▶ WebSocket → 실시간 대시보드 업데이트
```

## 3. 핵심 설계 결정

### 3.1 Closure Table (에이전트 트리)
- 선택 이유: 임의 깊이 하위 트리 조회가 O(1) JOIN
- admin_user_tree 테이블에 모든 조상-자손 관계 저장
- PostgreSQL WITH RECURSIVE와 결합하여 최적 성능

### 3.2 커미션 상태 머신
```
pending → settled → withdrawn
pending → cancelled
```

### 3.3 정산 상태 머신
```
draft → confirmed → paid
draft → rejected
```

### 3.4 커넥터 패턴 (어댑터)
- BaseConnector 추상 클래스 정의
- 게임 카테고리별 커넥터 구현
- 새 게임 백엔드 추가 시 어댑터만 구현

### 3.5 타입 공유
- FastAPI → OpenAPI JSON 자동 생성
- openapi-typescript-codegen → TS 타입 자동 생성
- 프론트엔드에서 타입 안전한 API 호출

## 4. 7개 게임 카테고리 상세

| 카테고리 | 커미션 소스 | 롤링 기준 | 죽장 기준 |
|----------|-----------|----------|----------|
| 카지노 | 베팅금/손실금 | bet_amount × rate | loss_amount × rate |
| 슬롯 | 베팅금/손실금 | bet_amount × rate | loss_amount × rate |
| 미니게임 | 베팅금/손실금 | bet_amount × rate | loss_amount × rate |
| 가상축구 | 베팅금 | bet_amount × rate | N/A (선택) |
| 스포츠 | 베팅금 | bet_amount × rate | N/A (선택) |
| e스포츠 | 베팅금 | bet_amount × rate | N/A (선택) |
| 홀덤 | 레이크 | rake_amount × rate | N/A |

## 5. 우선순위 근거

- **Phase 0~2 (P0)**: 프로젝트 기반, 인증 → 모든 후속 작업의 전제 조건
- **Phase 3 (P0)**: 레이아웃 → 모든 페이지의 기반
- **Phase 4~6 (P0)**: 에이전트 트리 + 커미션 + 정산 → 핵심 비즈니스 로직
- **Phase 7~11 (P1)**: 부가 기능 → 핵심 완성 후 순차 구현
- **Phase 12~13 (P2)**: 파트너/보안 → 마무리 단계
