---
name: commission-logic
description: Commission calculation business logic for the game admin panel. MUST reference this before ANY commission-related code changes.
---

# Commission Business Logic (커미션 비즈니스 로직)

> **이 문서는 커미션 시스템의 단일 진실 소스(Single Source of Truth)입니다.**
> 커미션 관련 코드 수정 전 반드시 이 문서를 참조하세요.

## 1. MLM 모델 (핵심 원칙)

**Users = Agents.** 별도의 영업진이 없음. 모든 회원이 플레이 + 커미션 수령.
- 본사코드(추천코드)로 가입 → 추천 트리(UserTree)에 자동 편입
- 자기 플레이 → 셀프 롤링 (레벨 0) → 포인트 적립
- 하부 플레이 → 워터폴 분배 → 각 상위자 포인트 적립
- **커미션 = User.points** (AdminUser.pending_balance 아님)

## 2. 커미션 유형 (2가지만 존재)

| 유형 | 한국어 | 계산 기준 | 발생 조건 | 공식 |
|------|--------|---------|----------|------|
| rolling | 롤링 | 베팅액 (bet_amount) | 모든 베팅 | `bet_amount × effective_rate%` |
| losing | 죽장(루징) | 손실액 (bet - win) | 손실 > 0일 때만 | `loss_amount × effective_rate%` |

**절대 규칙:**
- 롤링: 베팅이 발생할 때마다 즉시 계산. 승패 관계없이 발생
- 죽장: 사용자가 **손실했을 때만** 발생. `손실액 = 베팅액 - 당첨액 > 0`
- User.commission_type으로 롤링/죽장 택 1 (동시 불가)
- 두 유형 모두 게임 카테고리별로 독립적 요율 설정

## 3. 게임 카테고리 (7개)

```
casino, slot, holdem, sports, shooting, coin, mini_game
```

각 유저는 카테고리별 + 유형별(rolling/losing) 요율을 **개별 설정** 가능.
→ 유저당 최대 14개 요율 (7카테고리 × 2유형)
→ 요율 저장: `user_game_rolling_rates` (rolling_rate, losing_rate per user+category)

## 4. 계층적 워터폴 분배 (Hierarchical Waterfall) - 핵심

### 4.1 구조 (User 기반 MLM 트리)

```
Root User (최상위)
└── L1 User (부본사/총판)
    └── L2 User (대리점)
        └── L3 User (하위 회원)
            └── Bettor (베팅 주체 = 셀프 롤링 레벨 0)
```

유저 트리: Closure Table (`user_tree`), `user_tree_service.py`로 조회
계층: User.referrer_id 기반 (부모-자식 관계)

### 4.2 요율 규칙 (절대 불변)

```
자식 요율 ≤ 부모 요율 (같은 카테고리, 같은 유형)
```

- 부모가 자식에게 자기보다 높은 요율을 줄 수 없음
- 부모가 자기 요율을 낮출 때, 자식 중 더 높은 요율이 있으면 거부
- 루트 유저(referrer_id 없음)는 자유롭게 설정 가능

### 4.3 실제 수령액 계산 (effective_rate)

```
레벨 0 (셀프 롤링): bettor 자신의 요율 전체
레벨 1+ (워터폴): 자신의 요율 - 바로 아래 자식(체인 내)의 요율
```

- 베터 본인: 자기 요율 전체 → User.points
- 추천인 체인의 각 상위자: (자신 요율 - 하위 요율) 차액 → User.points

### 4.4 완전 예시

**유저 체인** (카지노 롤링):
```
Root: 15%  →  L1: 12%  →  L2: 8%  →  L3: 5%  →  Bettor(셀프: 1%)
```

**Bettor가 100만원 베팅 시:**

| 유저 | 레벨 | 자신 요율 | 하위 요율 | 실제 수령률 | 수령액 | 적립 위치 |
|------|------|----------|----------|-----------|--------|----------|
| Bettor (셀프) | 0 | 1.00% | - | 1.00% | 10,000 | User.points |
| L3 (직속) | 1 | 5.00% | 1.00% | 4.00% | 40,000 | User.points |
| L2 | 2 | 8.00% | 5.00% | 3.00% | 30,000 | User.points |
| L1 | 3 | 12.00% | 8.00% | 4.00% | 40,000 | User.points |
| Root | 4 | 15.00% | 12.00% | 3.00% | 30,000 | User.points |
| **합계** | | | | **15.00%** | **150,000** | |

### 4.5 죽장(losing) 예시

같은 체인에서 Bettor가 100만원 베팅 → 30만원 당첨 → 손실 70만원

**죽장 요율이 Root: 10%, L1: 7%, L2: 4%, L3: 2%, Bettor: 0.5%일 때:**

| 유저 | 레벨 | 실제 수령률 | 손실액 기준 | 수령액 |
|------|------|-----------|-----------|--------|
| Bettor | 0 | 0.50% | 700,000 | 3,500 |
| L3 | 1 | 1.50% (2-0.5) | 700,000 | 10,500 |
| L2 | 2 | 2.00% (4-2) | 700,000 | 14,000 |
| L1 | 3 | 3.00% (7-4) | 700,000 | 21,000 |
| Root | 4 | 3.00% (10-7) | 700,000 | 21,000 |
| **합계** | | **10.00%** | | **70,000** |

## 5. 핵심 테이블

| 테이블 | 용도 |
|--------|------|
| `user_game_rolling_rates` | 유저별, 게임별 롤링/죽장 요율 (UNIQUE: user_id + game_category + provider) |
| `user_tree` | 유저 추천 트리 Closure Table (ancestor_id, descendant_id, depth) |
| `commission_policies` | 기본 정책 (min_bet_amount, 게임별 필터) |
| `commission_ledger` | 커미션 발생 기록 (원장) — recipient_user_id = 수령자, user_id = 베터 |
| `settlements` | 정산 감사 기록 (실시간 포인트 적립 후 회계 정리용) |

### CommissionLedger 핵심 필드

| 필드 | 설명 |
|------|------|
| `recipient_user_id` | 커미션 수령자 (User.id, FK → users.id) |
| `user_id` | 베터 (배팅한 유저, FK → users.id) |
| `agent_id` | 레거시/관리자 오버라이드용 (nullable) |
| `level` | 0=셀프, 1=직속 추천인, 2=상위, ... |
| `game_category` | 게임 카테고리 |

## 6. 상태 머신

### CommissionLedger 상태
```
pending → settled (정산 배치) → withdrawn (인출)
pending → cancelled (취소)
```

### 커미션 계산 플로우 (실시간 포인트 적립)
```
Bet Event
  → commission_engine.calculate_rolling_commission(user_id, game_category, bet_amount, round_id)
  → 베터 검증: commission_enabled=True, commission_type="rolling"
  → 체인 구성: bettor(셀프) + get_ancestors(user_id)
  → user_game_rolling_rates에서 배치 조회 (get_user_rates_bulk)
  → 레벨 0(셀프): effective_rate = own_rate
  → 레벨 1+: effective_rate = own_rate - child_rate
  → CommissionLedger 생성 (status=pending)
  → User.points += amount (atomic UPDATE, 즉시 적립)

Game Result (손실)
  → commission_engine.calculate_losing_commission(...)
  → commission_type="losing" 검증
  → 동일한 워터폴 플로우, loss_amount 기준
```

## 7. API 엔드포인트

| 엔드포인트 | 용도 |
|----------|------|
| `POST /commissions/webhook/bet` | 롤링 커미션 웹훅 (user_id, game_category, bet_amount) |
| `POST /commissions/webhook/round-result` | 죽장 커미션 웹훅 (user_id, loss 계산) |
| `GET /commissions/ledger` | 원장 조회 (recipient_user_id, user_id 필터) |
| `GET /commissions/summary` | 유형별 요약 |

## 8. 검증 규칙 (코드 변경 시 반드시 유지)

1. **부모 천장 (Parent Ceiling):** `new_rate <= referrer_rate` (validate_rate_against_parent)
2. **자식 바닥 (Child Floor):** `new_rate >= max(children_rates)` (validate_rate_against_children)
3. **최소 베팅액:** `bet_amount >= policy.min_bet_amount` (미충족 시 커미션 미생성)
4. **유저 활성 상태:** `user.status == "active"` (비활성 유저 체인에서 스킵)
5. **커미션 활성:** `user.commission_enabled == True` (비활성 시 미생성)
6. **중복 방지:** `reference_id + user_id + type + recipient_user_id` UniqueConstraint + FOR UPDATE
7. **소수점:** 요율 소수점 4자리, 금액 소수점 2자리 (ROUND_HALF_UP)
8. **포인트 적립:** `User.points += amount` atomic UPDATE (SELECT FOR UPDATE 불필요)

## 9. 핵심 파일

| 파일 | 용도 |
|------|------|
| `backend/app/services/commission_engine.py` | 워터폴 계산 엔진 (핵심) |
| `backend/app/services/user_tree_service.py` | UserTree Closure Table 조회 |
| `backend/app/models/commission.py` | CommissionLedger, CommissionPolicy 모델 |
| `backend/app/models/user_game_rolling_rate.py` | 유저별 게임별 요율 |
| `backend/app/api/v1/commissions.py` | 웹훅 + 원장 조회 API |
| `backend/app/services/settlement_service.py` | 정산 (감사 기록용, 포인트는 실시간) |

## 10. 절대 하지 말 것

- 워터폴 순서 변경 금지 (항상 셀프→직속→상위 순)
- effective_rate 음수 허용 금지 (자식 > 부모면 에러)
- CommissionLedger 직접 삭제 금지 (cancelled로 상태 변경만)
- 정산 완료(settled) 후 요율 소급 적용 금지
- User.points 직접 UPDATE 금지 (commission_engine 경유만)
- AdminUser 기반 커미션 계산 금지 (반드시 User 기반)
- 커미션 유형 추가 시 반드시 이 문서 먼저 업데이트
