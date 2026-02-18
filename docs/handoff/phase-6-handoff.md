# Phase 6 인수인계 - 정산 시스템

## 완료 날짜: 2026-02-18

## 완료 사항
- [x] 정산 서비스 (preview, create, confirm, reject, pay)
- [x] 정산 API 7개 엔드포인트 (목록/미리보기/생성/상세/확인/거부/지급)
- [x] 정산 생성 시 pending 커미션 자동 집계 (rolling/losing/deposit별)
- [x] 정산 확인 → 지급 워크플로우 (draft → confirmed → paid)
- [x] 정산 거부 시 원장 엔트리 unlink (재정산 가능)
- [x] 지급 시 에이전트 잔액 반영 (pending_balance → balance 이전)
- [x] 이중 지급 방지 (상태 체크)
- [x] 정산 목록 UI (상태/에이전트 필터, 페이지네이션)
- [x] 정산 생성 UI (2단계: 에이전트+기간 → 미리보기 → 생성)
- [x] 정산 상세 UI (금액 카드 4개, 상세 정보, 액션 버튼)
- [x] 통합 테스트 15/15 통과
- [x] 프론트엔드 빌드 성공 (16 routes)

## 미완료 / 알려진 이슈
- [ ] 자동 정산 스케줄러 (일/주/월) - Phase 6.5로 후순위
- [ ] 정산 Excel 내보내기 - Phase 6.8로 후순위
- [ ] 에이전트 급여 시스템 - Phase 6.9로 후순위 (선택 기능)

## 핵심 파일

### Backend
- `backend/app/schemas/settlement.py` - Pydantic 스키마 6개
- `backend/app/services/settlement_service.py` - 5개 서비스 함수
- `backend/app/api/v1/settlements.py` - 7개 API 엔드포인트
- `backend/scripts/test_settlements.py` - 통합 테스트 15개

### Frontend
- `frontend/src/hooks/use-settlements.ts` - API hooks (list, detail, preview, create, confirm, reject, pay)
- `frontend/src/app/dashboard/settlements/page.tsx` - 정산 목록 (상태/에이전트 필터)
- `frontend/src/app/dashboard/settlements/new/page.tsx` - 정산 생성 (2단계 미리보기 플로우)
- `frontend/src/app/dashboard/settlements/[id]/page.tsx` - 정산 상세 (금액 카드 + 액션)

## API 엔드포인트
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | /api/v1/settlements | 정산 목록 (agent_id, status 필터) | settlements.view |
| GET | /api/v1/settlements/preview | 미리보기 (pending 커미션 집계) | settlements.create |
| POST | /api/v1/settlements | 정산 생성 (draft) | settlements.create |
| GET | /api/v1/settlements/{id} | 정산 상세 | settlements.view |
| POST | /api/v1/settlements/{id}/confirm | 정산 확인 | settlements.approve |
| POST | /api/v1/settlements/{id}/reject | 정산 거부 (엔트리 unlink) | settlements.approve |
| POST | /api/v1/settlements/{id}/pay | 정산 지급 (잔액 반영) | settlements.approve |

## 정산 워크플로우
```
커미션 발생 (pending)
  → 미리보기 (preview) - rolling/losing/deposit 집계
  → 정산 생성 (draft) - pending 엔트리에 settlement_id 연결
  → 확인 (confirmed) - 관리자 승인 + confirmed_by 기록
  → 지급 (paid) - 엔트리 status=settled, pending_balance→balance 이전

거부 시: rejected - 엔트리 settlement_id=null로 복원 → 재정산 가능
```

## DB 변경사항
- 기존 settlements 테이블 활용 (Phase 1에서 생성됨)
- commission_ledger.settlement_id로 엔트리 연결
- admin_users.balance + pending_balance 업데이트 (지급 시)

## 테스트 결과
- 통합 테스트: 15/15 passed
- 프론트엔드 빌드: 16 routes 성공
- E2E 플로우: webhook → 커미션 → 미리보기 → 생성 → 거부 → 재생성 → 확인 → 지급 → 잔액 확인 → 이중지급 방지

## 다음 단계
- Phase 7: 회원/재무 관리 (회원 목록, 입출금 관리, 잔액 조정, 거래 내역)
