# Phase 8 인수인계 - 게임 관리 (전체 카테고리)

## 완료 날짜: 2026-02-18

## 완료 사항
- [x] 게임 스키마 (GameProvider/Game/GameRound Create/Update/Response/ListResponse)
- [x] 게임 프로바이더 CRUD API 5개 엔드포인트
- [x] 게임 CRUD API 5개 엔드포인트 (7개 카테고리 지원)
- [x] 게임 라운드 조회 API 2개 엔드포인트 (합계 집계 포함)
- [x] main.py에 games_router 등록
- [x] 통합 테스트 29/29 통과
- [x] 게임 훅 (use-games.ts) - 5개 조회 훅 + 6개 mutation
- [x] 게임 목록 UI (7개 카테고리 탭 + 검색/프로바이더/활성 필터)
- [x] 게임 생성 UI
- [x] 게임 상세 UI (2탭: 정보수정/라운드)
- [x] 프로바이더 목록 UI (검색/카테고리/활성 필터)
- [x] 프로바이더 생성 UI
- [x] 프로바이더 상세 UI (수정 + 소속 게임 목록)
- [x] 라운드 조회 UI (필터 + 합계 카드)
- [x] 프론트엔드 빌드 성공 (25 routes)

## 미완료 / 알려진 이슈
- [ ] 게임 설정 (카테고리별 커미션 기본값) - Phase 5 커미션 정책에서 game_category로 이미 관리 가능
- [ ] 게임 썸네일 이미지 업로드 - URL 입력 방식으로 대체, 파일 업로드는 후순위

## 핵심 파일

### Backend
- `backend/app/schemas/game.py` - GameProvider/Game/GameRound Pydantic 스키마
- `backend/app/api/v1/games.py` - 게임 관리 API 라우터 (12 엔드포인트)
- `backend/app/main.py` - games_router 등록 추가
- `backend/scripts/test_games.py` - 통합 테스트 29개

### Frontend
- `frontend/src/hooks/use-games.ts` - 게임 API hooks (5 조회 + 6 mutation)
- `frontend/src/app/dashboard/games/page.tsx` - 게임 목록 (카테고리 탭)
- `frontend/src/app/dashboard/games/new/page.tsx` - 게임 생성
- `frontend/src/app/dashboard/games/[id]/page.tsx` - 게임 상세 (2탭)
- `frontend/src/app/dashboard/games/providers/page.tsx` - 프로바이더 목록
- `frontend/src/app/dashboard/games/providers/new/page.tsx` - 프로바이더 생성
- `frontend/src/app/dashboard/games/providers/[id]/page.tsx` - 프로바이더 상세
- `frontend/src/app/dashboard/games/rounds/page.tsx` - 라운드 조회

## API 엔드포인트

### GameProvider (5개)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | /api/v1/games/providers | 프로바이더 목록 (category, search, is_active 필터) | game_provider.view |
| POST | /api/v1/games/providers | 프로바이더 생성 (name/code 중복 체크) | game_provider.create |
| GET | /api/v1/games/providers/{id} | 프로바이더 상세 | game_provider.view |
| PUT | /api/v1/games/providers/{id} | 프로바이더 수정 | game_provider.update |
| DELETE | /api/v1/games/providers/{id} | 프로바이더 삭제 (soft: is_active=False) | game_provider.delete |

### Game (5개)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | /api/v1/games | 게임 목록 (category, provider_id, search, is_active 필터) | game.view |
| POST | /api/v1/games | 게임 생성 (프로바이더 검증 + code 중복 체크) | game.create |
| GET | /api/v1/games/{id} | 게임 상세 (provider_name joined) | game.view |
| PUT | /api/v1/games/{id} | 게임 수정 | game.update |
| DELETE | /api/v1/games/{id} | 게임 삭제 (soft: is_active=False) | game.delete |

### GameRound (2개)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | /api/v1/games/rounds | 라운드 목록 (game_id, user_id, result 필터 + total_bet/total_win 집계) | game.view |
| GET | /api/v1/games/rounds/{id} | 라운드 상세 (game_name, user_username joined) | game.view |

## 게임 카테고리 (7개)
| 코드 | 한글 라벨 |
|------|----------|
| casino | 카지노 |
| slot | 슬롯 |
| mini_game | 미니게임 |
| virtual_soccer | 가상축구 |
| sports | 스포츠 |
| esports | e스포츠 |
| holdem | 홀덤 |

## 라우트 순서 (경로 충돌 방지)
games.py에서 라우트 정의 순서가 중요:
1. `/providers` (고정 경로) → GameProvider 엔드포인트
2. `/rounds` (고정 경로) → GameRound 엔드포인트
3. `/{game_id}` (동적 경로) → Game 엔드포인트

## DB 변경사항
- 기존 테이블 활용 (game_providers, games, game_rounds - Phase 1에서 생성)
- 마이그레이션 불필요

## 테스트 결과
- 통합 테스트: 29/29 passed
- 프론트엔드 빌드: 25 routes 성공

## 다음 단계
- Phase 9: 실시간 대시보드 + 리포트 (WebSocket, 실시간 카운터, 에이전트/커미션 리포트, Excel 내보내기)
