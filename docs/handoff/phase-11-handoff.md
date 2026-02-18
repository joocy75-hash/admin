# Phase 11 인수인계 - 외부 게임 API 커넥터

## 완료 날짜: 2026-02-18

## 완료 사항
- [x] BaseConnector 추상 클래스 (httpx AsyncClient, HMAC 검증, 3회 지수 백오프 재시도)
- [x] CasinoConnector (Evolution/SA Gaming 패턴 - operator token 인증)
- [x] SportsConnector (Kambi/Betradar 패턴 - Bearer 인증, 이벤트/마켓)
- [x] SlotConnector (Pragmatic/PG Soft 패턴 - real/demo 모드)
- [x] HoldemConnector (PPPoker 패턴 - 테이블 목록, rake 추적)
- [x] ConnectorFactory (7개 카테고리 매핑)
- [x] API 라우터 5개 엔드포인트 (목록/테스트/동기화/웹훅/상태)
- [x] Pydantic 스키마 4개 (ConnectorStatus/Test/Webhook/GameSync)
- [x] main.py에 connector_router 등록
- [x] 통합 테스트 21개 케이스

## 핵심 파일
- `backend/app/connectors/base.py` - BaseConnector 추상 클래스
- `backend/app/connectors/casino_connector.py` - 카지노 커넥터
- `backend/app/connectors/sports_connector.py` - 스포츠 커넥터
- `backend/app/connectors/slot_connector.py` - 슬롯 커넥터
- `backend/app/connectors/holdem_connector.py` - 홀덤 커넥터
- `backend/app/connectors/__init__.py` - ConnectorFactory
- `backend/app/schemas/connector.py` - Pydantic 스키마
- `backend/app/api/v1/connector.py` - API 라우터
- `backend/scripts/test_connectors.py` - 통합 테스트

## API 엔드포인트
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/v1/connectors | 전체 커넥터 목록 + 연결 상태 |
| POST | /api/v1/connectors/{provider_id}/test | 연결 테스트 (latency 측정) |
| POST | /api/v1/connectors/{provider_id}/sync-games | 외부 API에서 게임 동기화 |
| POST | /api/v1/connectors/webhook/{provider_code} | 웹훅 수신 (HMAC 검증) |
| GET | /api/v1/connectors/{provider_id}/status | 상세 상태 |

## 설계 결정
- 권한: `game_provider.view`/`game_provider.update` 재사용 (별도 connector 권한 미생성)
- 게임 동기화 시 코드 prefix: `{provider_code}_{game_code}` (유니크 보장)
- 커넥터는 GameProvider의 api_url, api_key 필드 활용 (별도 테이블 불필요)

## 테스트 결과
- 통합 테스트: 21 케이스 작성
- 빌드: 성공 (110 routes)
