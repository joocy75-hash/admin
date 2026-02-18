---
name: crypto-payment
description: Cryptocurrency deposit/withdrawal business logic. MUST reference this before ANY payment/transaction code changes.
---

# Crypto Payment System (암호화폐 입출금 시스템)

> **이 문서는 입출금 시스템의 단일 진실 소스(Single Source of Truth)입니다.**
> 입출금/거래 관련 코드 수정 전 반드시 이 문서를 참조하세요.

## 1. 기본 원칙 (절대 불변)

- **암호화폐 전용**: 현금 계좌이체는 일절 사용하지 않음
- **USDT 메인**: 주 결제 수단은 USDT
- **서브 코인**: 전송 속도가 빠른 코인을 보조로 사용
- **은행 계좌 없음**: user_bank_accounts는 레거시, user_wallet_addresses만 사용

## 2. 지원 코인 & 네트워크

| 코인 | 네트워크 | 용도 | 비고 |
|------|---------|------|------|
| USDT | TRC20 | **메인** 입출금 | 수수료 저렴, 속도 빠름 |
| USDT | ERC20 | 서브 | 수수료 높음 |
| USDT | BEP20 | 서브 | BSC 기반 |
| TRX | TRC20 | 서브 (빠른 전송) | 자체 네트워크 |
| ETH | ERC20 | 서브 | |
| BTC | BTC | 서브 | 확인 느림 |
| BNB | BEP20 | 서브 | BSC 기반 |

**코인 추가 시:** 이 문서 먼저 업데이트 → 프론트엔드 COIN_OPTIONS/NETWORK_OPTIONS 배열 수정

## 3. DB 구조

### 3.1 user_wallet_addresses (사용자 출금 지갑)

사용자가 **출금받을** 자신의 외부 지갑 주소를 등록하는 테이블.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| user_id | int | FK → users.id |
| coin_type | varchar(20) | USDT, TRX, ETH, BTC, BNB |
| network | varchar(20) | TRC20, ERC20, BEP20, BTC |
| address | varchar(255) | 지갑 주소 |
| label | varchar(100) | 사용자 지정 별칭 (선택) |
| is_primary | bool | 기본 출금 주소 여부 |
| status | varchar(20) | active, inactive |

**API:** `GET/POST/PUT/DELETE /api/v1/users/{id}/wallet-addresses`

### 3.2 users 테이블 입금 관련 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| deposit_address | varchar(255) | **시스템이 배정한** 입금 주소 (관리자 설정) |
| deposit_network | varchar(20) | 입금 주소의 네트워크 |

- `deposit_address`: 사용자에게 "이 주소로 보내세요"라고 안내하는 주소
- 관리자가 사용자별로 배정 (자동 또는 수동)
- user_wallet_addresses와 다름 (입금 vs 출금 주소 구분)

### 3.3 transactions 테이블 암호화폐 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| coin_type | varchar(20) | 거래에 사용된 코인 |
| network | varchar(20) | 거래에 사용된 네트워크 |
| tx_hash | varchar(255) | 블록체인 트랜잭션 해시 (입금 확인용) |
| wallet_address | varchar(255) | 출금 대상 지갑 주소 |
| confirmations | int | 블록 확인 수 (입금 검증용) |

## 4. 거래 유형 & 상태

### 4.1 거래 유형 (Transaction.type)

| type | action | 설명 |
|------|--------|------|
| deposit | credit | 입금 (사용자→시스템) |
| withdrawal | debit | 출금 (시스템→사용자) |
| adjustment | credit/debit | 관리자 수동 조정 |
| commission | credit | 커미션 지급 |

### 4.2 상태 머신 (Transaction.status)

```
입금/출금:
  pending (신청) → approved (승인) → 잔액 반영
  pending (신청) → rejected (거절) → 잔액 변동 없음

조정 (adjustment):
  approved (즉시) → 잔액 즉시 반영
```

**상태 전이 규칙:**
- `pending` → `approved` 또는 `rejected`만 가능
- `approved` → 다른 상태 전이 불가
- `rejected` → 다른 상태 전이 불가
- 한번 결정된 거래는 번복 불가 (새 조정 거래로 대응)

## 5. 입출금 플로우

### 5.1 입금 (Deposit)

```
1. 사용자가 deposit_address로 코인 전송
2. 관리자가 tx_hash + coin_type + network 확인
3. POST /api/v1/finance/deposit (status=pending)
4. 관리자 승인: POST /api/v1/finance/transactions/{id}/approve
5. user.balance += amount (SELECT FOR UPDATE 잠금)
6. 이벤트: deposit_approved
```

### 5.2 출금 (Withdrawal)

```
1. 사용자가 출금 신청 (금액 + 지갑주소)
2. POST /api/v1/finance/withdrawal (status=pending)
   - 검증: user.balance >= amount (부족하면 거절)
3. 관리자가 실제 코인 전송 후 승인
4. POST /api/v1/finance/transactions/{id}/approve
5. user.balance -= amount (SELECT FOR UPDATE 잠금)
6. 이벤트: withdrawal_approved
```

### 5.3 잔액 조정 (Adjustment)

```
1. 관리자가 직접 조정 (보너스 지급, 오류 보정 등)
2. POST /api/v1/finance/adjustment
3. 즉시 approved 상태로 생성
4. user.balance 즉시 반영 (SELECT FOR UPDATE 잠금)
```

## 6. API 엔드포인트

| 엔드포인트 | 권한 | 설명 |
|----------|------|------|
| `GET /finance/transactions` | transaction.view | 거래 목록 (필터: type, status, user_id, 기간) |
| `GET /finance/transactions/summary` | transaction.view | type×status별 건수/총액 요약 |
| `POST /finance/deposit` | transaction.create | 입금 신청 (coin_type, network, tx_hash) |
| `POST /finance/withdrawal` | transaction.create | 출금 신청 (coin_type, network, wallet_address) |
| `POST /finance/adjustment` | users.balance | 잔액 조정 (즉시 반영) |
| `POST /finance/transactions/{id}/approve` | transaction.approve | 승인 |
| `POST /finance/transactions/{id}/reject` | transaction.reject | 거절 |

## 7. 프론트엔드 위치

| 파일 | 용도 |
|------|------|
| `frontend/src/app/dashboard/transactions/page.tsx` | 전체 입출금 관리 페이지 |
| `frontend/src/app/dashboard/users/[id]/tab-transactions.tsx` | 사용자별 입출금 탭 |
| `frontend/src/app/dashboard/users/[id]/tab-general.tsx` | 지갑주소 관리 (CRUD) + 입금주소 표시 |
| `frontend/src/hooks/use-transactions.ts` | 거래 API 훅 + 타입 |
| `frontend/src/hooks/use-user-detail.ts` | 지갑주소 API 훅 + 타입 |

**프론트엔드 코인/네트워크 옵션:**
```typescript
COIN_OPTIONS = ['USDT', 'TRX', 'ETH', 'BTC', 'BNB']
NETWORK_OPTIONS = ['TRC20', 'ERC20', 'BEP20', 'BTC']
```

**금액 표시 형식:** `formatUSDT(amount)` → "1,234.56 USDT"

## 8. 동시성 보호 (절대 유지)

모든 잔액 변경은 반드시 `SELECT FOR UPDATE`로 행 잠금:

```python
user_stmt = select(User).where(User.id == user_id).with_for_update()
```

- approve, reject, adjustment 모두 동일 패턴
- 잠금 없이 잔액 변경하면 경합 조건(race condition) 발생

## 9. 절대 하지 말 것

- 현금/계좌이체 관련 기능 추가 금지 (은행명, 계좌번호 등)
- user_bank_accounts 테이블 사용 금지 (레거시, 참조만)
- approved/rejected 거래의 상태 변경 금지 (새 adjustment로 대응)
- balance 직접 UPDATE 금지 (반드시 transaction_service 경유)
- SELECT FOR UPDATE 없이 잔액 변경 금지
- tx_hash 없는 입금 승인은 관리자 판단 (시스템 강제 아님)
- 코인/네트워크 하드코딩 금지 (프론트 COIN_OPTIONS/NETWORK_OPTIONS 배열 사용)
