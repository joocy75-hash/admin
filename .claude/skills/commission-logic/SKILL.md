---
name: commission-logic
description: Commission calculation business logic for the game admin panel. MUST reference this before ANY commission-related code changes.
---

# Commission Business Logic (커미션 비즈니스 로직)

> **이 문서는 커미션 시스템의 단일 진실 소스(Single Source of Truth)입니다.**
> 커미션 관련 코드 수정 전 반드시 이 문서를 참조하세요.

## 1. 커미션 유형 (2가지만 존재)

| 유형 | 한국어 | 계산 기준 | 발생 조건 | 공식 |
|------|--------|---------|----------|------|
| rolling | 롤링 | 베팅액 (bet_amount) | 모든 베팅 | `bet_amount × effective_rate%` |
| losing | 죽장(루징) | 손실액 (bet - win) | 손실 > 0일 때만 | `loss_amount × effective_rate%` |

**절대 규칙:**
- 롤링: 베팅이 발생할 때마다 즉시 계산. 승패 관계없이 발생
- 죽장: 사용자가 **손실했을 때만** 발생. `손실액 = 베팅액 - 당첨액 > 0`
- 두 유형 모두 게임 카테고리별로 독립적 요율 설정

## 2. 게임 카테고리 (7개)

```
casino, slot, holdem, sports, shooting, coin, mini_game
```

각 에이전트는 카테고리별 + 유형별(rolling/losing) 요율을 **개별 설정** 가능.
→ 에이전트당 최대 14개 요율 (7카테고리 × 2유형)

## 3. 계층적 워터폴 분배 (Hierarchical Waterfall) - 핵심

### 3.1 구조

```
Root (최상위)
└── L2 (부본사/총판)
    └── L3 (대리점)
        └── L4 (회원관리사)
            └── User (최종 사용자 = 베팅 주체)
```

에이전트 트리: Closure Table (admin_user_tree), 최대 6단계

### 3.2 요율 규칙 (절대 불변)

```
자식 요율 ≤ 부모 요율 (같은 카테고리, 같은 유형)
```

- 부모가 자식에게 자기보다 높은 요율을 줄 수 없음
- 부모가 자기 요율을 낮출 때, 자식 중 더 높은 요율이 있으면 거부
- 루트 에이전트(부모 없음)는 자유롭게 설정 가능

### 3.3 실제 수령액 계산 (effective_rate)

```
각 에이전트의 실제 수령률 = 자신의 요율 - 바로 아래 자식의 요율
```

- 최하위 에이전트(유저 직속): 자신의 요율 전체 수령
- 중간/상위 에이전트: 자신 요율에서 자식 요율을 뺀 차액만 수령

### 3.4 완전 예시

**에이전트 체인** (카지노 롤링):
```
Root: 15%  →  L2: 12%  →  L3: 8%  →  L4: 5%  →  User
```

**User가 100만원 베팅 시:**

| 에이전트 | 자신 요율 | 자식 요율 | 실제 수령률 | 수령액 |
|---------|----------|----------|-----------|--------|
| L4 (직속) | 5.00% | 0% (없음) | 5.00% | 50,000 |
| L3 | 8.00% | 5.00% | 3.00% | 30,000 |
| L2 | 12.00% | 8.00% | 4.00% | 40,000 |
| Root | 15.00% | 12.00% | 3.00% | 30,000 |
| **합계** | | | **15.00%** | **150,000** |

**검증:** 총 지급액 = Root 요율 × 베팅액 (항상 일치해야 함)

### 3.5 죽장(losing) 예시

같은 체인에서 User가 100만원 베팅 → 30만원 당첨 → 손실 70만원

**죽장 요율이 Root: 10%, L2: 7%, L3: 4%, L4: 2%일 때:**

| 에이전트 | 실제 수령률 | 손실액 기준 | 수령액 |
|---------|-----------|-----------|--------|
| L4 | 2.00% | 700,000 | 14,000 |
| L3 | 2.00% (4-2) | 700,000 | 14,000 |
| L2 | 3.00% (7-4) | 700,000 | 21,000 |
| Root | 3.00% (10-7) | 700,000 | 21,000 |
| **합계** | **10.00%** | | **70,000** |

## 4. 핵심 테이블

| 테이블 | 용도 |
|--------|------|
| `agent_commission_rates` | 에이전트별, 게임별, 유형별 요율 (UNIQUE: agent_id + game_category + commission_type) |
| `commission_policies` | 기본 정책 (min_bet_amount, 게임별 필터) |
| `commission_overrides` | VIP 에이전트용 커스텀 요율 |
| `commission_ledger` | 커미션 발생 기록 (원장) |
| `settlements` | 주간 정산 집계 |

## 5. 상태 머신

### CommissionLedger 상태
```
pending → settled (주간 정산) → withdrawn (인출)
pending → cancelled (취소)
```

### 커미션 계산 플로우
```
Bet Event
  → commission_engine.calculate_rolling(bet_amount)
  → 체인 구성: agent → parent → ... → root
  → agent_commission_rates에서 배치 조회
  → 각 에이전트: effective_rate = own_rate - child_rate
  → CommissionLedger 생성 (status=pending)

Game Result (손실)
  → commission_engine.calculate_losing(loss_amount)
  → 동일한 워터폴 플로우
```

## 6. API 엔드포인트

| 엔드포인트 | 용도 |
|----------|------|
| `GET /agents/{id}/commission-rates` | 에이전트 요율 조회 |
| `PUT /agents/{id}/commission-rates` | 단건 요율 설정 (부모 상한 + 자식 하한 검증) |
| `PUT /agents/{id}/commission-rates/bulk` | 다건 요율 일괄 설정 |
| `GET /agents/{id}/sub-agent-rates` | 하위 에이전트 요율 조회 |

## 7. 검증 규칙 (코드 변경 시 반드시 유지)

1. **부모 천장 (Parent Ceiling):** `new_rate <= parent_rate`
2. **자식 바닥 (Child Floor):** `new_rate >= max(children_rates)`
3. **최소 베팅액:** `bet_amount >= policy.min_bet_amount` (미충족 시 커미션 미생성)
4. **에이전트 활성 상태:** `agent.status == "active"` (비활성 에이전트 스킵)
5. **중복 방지:** `round_id` 유니크 체크 (웹훅 중복 호출 대비)
6. **소수점:** 요율 소수점 2자리, 금액 소수점 2자리 (ROUND_HALF_UP)
7. **동시성:** `SELECT FOR UPDATE`로 잔액 변경 시 행 잠금

## 8. 절대 하지 말 것

- 워터폴 순서 변경 금지 (항상 하위→상위 순)
- effective_rate 음수 허용 금지 (자식 > 부모면 에러)
- CommissionLedger 직접 삭제 금지 (cancelled로 상태 변경만)
- 정산 완료(settled) 후 요율 소급 적용 금지
- 커미션 유형 추가 시 반드시 이 문서 먼저 업데이트
