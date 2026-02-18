# Phase 7 인수인계 - 회원/재무 관리

## 완료 날짜: 2026-02-18

## 완료 사항
- [x] User (게임 회원) 모델 생성 (users 테이블)
- [x] 회원 CRUD API 5개 엔드포인트 (목록/생성/상세/수정/삭제)
- [x] 회원 검색 (이름/아이디/전화번호)
- [x] 회원-에이전트 매핑 (agent_id FK)
- [x] 거래 서비스 (입금/출금/수동조정)
- [x] 거래 API 7개 엔드포인트 (목록/상세/입금/출금/조정/승인/거부)
- [x] 입금: pending → approve (잔액 반영) / reject
- [x] 출금: pending → approve (잔액 차감) / reject + 잔액 부족 검증
- [x] 수동 조정: credit/debit 즉시 반영 (users.balance 권한)
- [x] 이중 승인 방지, 잔액 부족 방지
- [x] 회원 목록 UI (검색/상태/에이전트 필터)
- [x] 회원 생성 UI
- [x] 회원 상세 UI (3탭: 정보+수정/거래내역/입출금)
- [x] 입출금 관리 UI (승인/거부 버튼, 유형/상태 필터)
- [x] 통합 테스트 20/20 통과
- [x] 프론트엔드 빌드 성공 (20 routes)

## 미완료 / 알려진 이슈
- [ ] 재무 리포트 (일/주/월 집계) - Phase 9 리포트 시스템에서 통합 구현 예정

## 핵심 파일

### Backend
- `backend/app/models/user.py` - User 모델 (게임 회원)
- `backend/app/schemas/user.py` - UserCreate/Update/Response/ListResponse
- `backend/app/schemas/transaction.py` - DepositCreate/WithdrawalCreate/AdjustmentCreate/TransactionResponse
- `backend/app/services/transaction_service.py` - 5개 서비스 함수
- `backend/app/api/v1/users.py` - 회원 CRUD 5개 엔드포인트
- `backend/app/api/v1/finance.py` - 거래 관리 7개 엔드포인트
- `backend/scripts/test_users_finance.py` - 통합 테스트 20개

### Frontend
- `frontend/src/hooks/use-users.ts` - 회원 API hooks
- `frontend/src/hooks/use-transactions.ts` - 거래 API hooks
- `frontend/src/app/dashboard/users/page.tsx` - 회원 목록
- `frontend/src/app/dashboard/users/new/page.tsx` - 회원 생성
- `frontend/src/app/dashboard/users/[id]/page.tsx` - 회원 상세 (3탭)
- `frontend/src/app/dashboard/transactions/page.tsx` - 입출금 관리

## API 엔드포인트

### Users
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | /api/v1/users | 회원 목록 (search, status, agent_id 필터) | users.view |
| POST | /api/v1/users | 회원 생성 | users.create |
| GET | /api/v1/users/{id} | 회원 상세 | users.view |
| PUT | /api/v1/users/{id} | 회원 수정 | users.update |
| DELETE | /api/v1/users/{id} | 회원 삭제 (soft: banned) | users.delete |

### Finance
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | /api/v1/finance/transactions | 거래 목록 (type, status, user_id 필터) | transaction.view |
| GET | /api/v1/finance/transactions/{id} | 거래 상세 | transaction.view |
| POST | /api/v1/finance/deposit | 입금 요청 (pending) | transaction.create |
| POST | /api/v1/finance/withdrawal | 출금 요청 (pending) | transaction.create |
| POST | /api/v1/finance/adjustment | 수동 잔액 조정 (즉시 반영) | users.balance |
| POST | /api/v1/finance/transactions/{id}/approve | 거래 승인 | transaction.approve |
| POST | /api/v1/finance/transactions/{id}/reject | 거래 거부 | transaction.reject |

## 거래 워크플로우
```
입금/출금 요청 (pending)
  → 승인 (approved) - 잔액 반영 + processed_by/processed_at 기록
  → 거부 (rejected) - 잔액 변경 없음

수동 조정 (adjustment)
  → 즉시 반영 (approved) - credit: 충전 / debit: 차감
```

## DB 변경사항
- users 테이블 활용 (init_db 자동 생성)
- transactions 테이블 활용 (Phase 1 마이그레이션)

## 테스트 결과
- 통합 테스트: 20/20 passed
- 프론트엔드 빌드: 20 routes 성공

## 다음 단계
- Phase 8: 게임 관리 (프로바이더/게임/라운드 CRUD + UI)
