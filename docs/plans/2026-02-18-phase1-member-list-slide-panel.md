# Phase 1: 회원 목록 리뉴얼 + 슬라이드 패널 구현 계획서

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 회원 목록 페이지를 PRISM과 동일 수준으로 리뉴얼하고, 회원 클릭 시 슬라이드 패널(Sheet)로 상세 정보를 표시한다.

**Architecture:** 기존 트리 테이블을 유지하면서 요약 카드 3개, 상태/등급 필터 버튼, 페이지네이션을 추가한다. 회원 상세는 기존 `[id]/page.tsx`의 8탭 구조를 `UserDetailContent` 공유 컴포넌트로 추출하여 Sheet와 독립 페이지 양쪽에서 재활용한다.

**Tech Stack:** Next.js 16 + React 19 + shadcn/ui Sheet + TailwindCSS 4 + FastAPI

---

## Task 1: 백엔드 - 회원 통계 요약 API 추가

**Files:**
- Modify: `backend/app/api/v1/users.py` (router에 엔드포인트 추가)
- Modify: `backend/app/schemas/user.py` (응답 스키마 추가)

**Step 1: 스키마 추가**

`backend/app/schemas/user.py` 하단에 추가:

```python
class UserSummaryStats(BaseModel):
    total_count: int
    active_count: int
    suspended_count: int
    banned_count: int
    pending_count: int
    total_balance: float
    total_points: float
```

**Step 2: API 엔드포인트 추가**

`backend/app/api/v1/users.py`에 추가:

```python
@router.get("/summary-stats", response_model=UserSummaryStats)
async def get_user_summary_stats(
    session: AsyncSession = Depends(get_session),
    _: AdminUser = Depends(PermissionChecker("users.view")),
):
    total = (await session.execute(select(func.count(User.id)))).scalar() or 0
    active = (await session.execute(select(func.count(User.id)).where(User.status == "active"))).scalar() or 0
    suspended = (await session.execute(select(func.count(User.id)).where(User.status == "suspended"))).scalar() or 0
    banned = (await session.execute(select(func.count(User.id)).where(User.status == "banned"))).scalar() or 0
    pending = (await session.execute(select(func.count(User.id)).where(User.status == "pending"))).scalar() or 0
    bal = (await session.execute(select(func.coalesce(func.sum(User.balance), 0)))).scalar() or 0
    pts = (await session.execute(select(func.coalesce(func.sum(User.points), 0)))).scalar() or 0
    return UserSummaryStats(
        total_count=total, active_count=active, suspended_count=suspended,
        banned_count=banned, pending_count=pending,
        total_balance=float(bal), total_points=float(pts),
    )
```

> **주의**: `/summary-stats` 경로는 `/{user_id}` 보다 먼저 등록해야 FastAPI가 올바르게 매칭한다.

**Step 3: 검증**

```bash
cd /Users/mr.joo/Desktop/관리자페이지/backend && source .venv/bin/activate && PYTHONPATH=. uvicorn app.main:app --port 8002 --reload
# 별도 터미널에서:
curl -s http://localhost:8002/api/v1/users/summary-stats -H "Authorization: Bearer <token>" | python3 -m json.tool
```

Expected: `{ "total_count": N, "active_count": N, ... }`

---

## Task 2: 프론트엔드 - 회원 요약 통계 훅 추가

**Files:**
- Modify: `frontend/src/hooks/use-users.ts`

**Step 1: 타입 + 훅 추가**

`use-users.ts` 하단 `deleteUser` 함수 위에 추가:

```typescript
export type UserSummaryStats = {
  total_count: number;
  active_count: number;
  suspended_count: number;
  banned_count: number;
  pending_count: number;
  total_balance: number;
  total_points: number;
};

export function useUserSummaryStats() {
  const [data, setData] = useState<UserSummaryStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<UserSummaryStats>('/api/v1/users/summary-stats');
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}
```

**Step 2: 검증**

Frontend 개발 서버에서 훅이 정상 import 되는지 확인 (빌드 체크):

```bash
cd /Users/mr.joo/Desktop/관리자페이지/frontend && npx next build --webpack 2>&1 | tail -5
```

---

## Task 3: 프론트엔드 - UserDetailContent 공유 컴포넌트 추출

**Files:**
- Create: `frontend/src/components/user-detail-content.tsx`
- Modify: `frontend/src/app/dashboard/users/[id]/page.tsx`

**Step 1: 공유 컴포넌트 생성**

기존 `[id]/page.tsx`에서 공통 헤더 + 8탭 로직을 `UserDetailContent`로 추출한다. 이 컴포넌트는 `userId: number` prop만 받아서 헤더 + 탭을 렌더링한다. `onClose?: () => void` prop이 있으면 닫기 동작을 수행하고, 없으면 `router.back()` 동작.

```typescript
// frontend/src/components/user-detail-content.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUserDetail, resetUserPassword, setUserPassword, suspendUser } from '@/hooks/use-user-detail';
import { updateUser } from '@/hooks/use-users';
import { ArrowLeft, X, Edit, KeyRound, Lock, Ban } from 'lucide-react';
import TabGeneral from '@/app/dashboard/users/[id]/tab-general';
import TabBetting from '@/app/dashboard/users/[id]/tab-betting';
import TabMoney from '@/app/dashboard/users/[id]/tab-money';
import TabPoints from '@/app/dashboard/users/[id]/tab-points';
import TabTransactions from '@/app/dashboard/users/[id]/tab-transactions';
import TabInquiries from '@/app/dashboard/users/[id]/tab-inquiries';
import TabReferral from '@/app/dashboard/users/[id]/tab-referral';
import TabMessages from '@/app/dashboard/users/[id]/tab-messages';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: '활성', color: 'bg-blue-100 text-blue-800' },
  suspended: { label: '정지', color: 'bg-red-100 text-red-800' },
  banned: { label: '차단', color: 'bg-red-100 text-red-800' },
};

const TAB_LIST = [
  { key: 'general', label: '기본 정보' },
  { key: 'betting', label: '베팅' },
  { key: 'money', label: '머니' },
  { key: 'points', label: '포인트' },
  { key: 'transactions', label: '입출금' },
  { key: 'inquiries', label: '문의내역' },
  { key: 'referral', label: '추천코드' },
  { key: 'messages', label: '쪽지' },
] as const;

type TabKey = (typeof TAB_LIST)[number]['key'];

type Props = {
  userId: number;
  onClose?: () => void;  // Sheet 모드에서 닫기
  isSheet?: boolean;      // Sheet 모드 여부
};

export function UserDetailContent({ userId, onClose, isSheet }: Props) {
  const router = useRouter();
  const { data: detail, loading, refetch } = useUserDetail(userId);
  const [tab, setTab] = useState<TabKey>('general');

  const user = detail?.user;

  const handleResetPassword = async () => {
    if (!confirm('비밀번호를 초기화하시겠습니까?')) return;
    try {
      await resetUserPassword(userId);
      alert('비밀번호가 초기화되었습니다.');
    } catch { alert('비밀번호 초기화 실패'); }
  };

  const handleSetPassword = async () => {
    const pw = prompt('새 비밀번호를 입력하세요 (6자 이상):');
    if (!pw || pw.length < 6) { alert('비밀번호는 6자 이상이어야 합니다.'); return; }
    try {
      await setUserPassword(userId, pw);
      alert('비밀번호가 지정되었습니다.');
    } catch { alert('비밀번호 지정 실패'); }
  };

  const handleSuspend = async () => {
    if (!user) return;
    if (user.status === 'suspended') {
      if (!confirm('정지를 해제하시겠습니까?')) return;
      try {
        await updateUser(userId, { status: 'active' });
        refetch();
      } catch { alert('정지 해제 실패'); }
    } else {
      const reason = prompt('정지 사유를 입력하세요:');
      if (reason === null) return;
      try {
        await suspendUser(userId, reason || undefined);
        refetch();
      } catch { alert('정지 실패'); }
    }
  };

  if (loading || !detail || !user) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-12 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-64 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  const statusInfo = STATUS_MAP[user.status] || { label: user.status, color: 'bg-gray-100 text-gray-800' };

  return (
    <div className="flex flex-col h-full">
      {/* Common Header */}
      <div className="flex items-start justify-between p-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          {isSheet ? (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight">{user.username}</h2>
              <Badge className={statusInfo.color} variant="secondary">{statusInfo.label}</Badge>
              {user.nickname && <span className="text-muted-foreground text-sm">({user.nickname})</span>}
              <span className="text-xs text-muted-foreground">Lv.{user.level}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user.referrer_username ? `추천인: ${user.referrer_username}` : '추천인 없음'} · 가입: {new Date(user.created_at).toLocaleDateString('ko-KR')}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap shrink-0">
          <Button variant="outline" size="sm" onClick={() => setTab('general')}>
            <Edit className="h-3 w-3 mr-1" />수정
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetPassword}>
            <KeyRound className="h-3 w-3 mr-1" />초기화
          </Button>
          <Button variant="outline" size="sm" onClick={handleSetPassword}>
            <Lock className="h-3 w-3 mr-1" />비밀번호
          </Button>
          <Button
            variant={user.status === 'suspended' ? 'default' : 'destructive'}
            size="sm"
            onClick={handleSuspend}
          >
            <Ban className="h-3 w-3 mr-1" />
            {user.status === 'suspended' ? '해제' : '정지'}
          </Button>
        </div>
      </div>

      {/* 8 Tabs */}
      <div className="flex gap-0.5 border-b overflow-x-auto px-4 shrink-0">
        {TAB_LIST.map((t) => (
          <button
            key={t.key}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content - scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'general' && <TabGeneral detail={detail} userId={userId} onRefetch={refetch} />}
        {tab === 'betting' && <TabBetting userId={userId} />}
        {tab === 'money' && <TabMoney userId={userId} />}
        {tab === 'points' && <TabPoints userId={userId} />}
        {tab === 'transactions' && <TabTransactions userId={userId} />}
        {tab === 'inquiries' && <TabInquiries userId={userId} />}
        {tab === 'referral' && <TabReferral userId={userId} detail={detail} />}
        {tab === 'messages' && <TabMessages userId={userId} />}
      </div>
    </div>
  );
}
```

**Step 2: 기존 [id]/page.tsx 수정**

기존 코드를 `UserDetailContent`를 사용하도록 교체:

```typescript
// frontend/src/app/dashboard/users/[id]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { UserDetailContent } from '@/components/user-detail-content';

export default function UserDetailPage() {
  const params = useParams();
  const userId = Number(params.id);

  return (
    <div className="space-y-6">
      <UserDetailContent userId={userId} />
    </div>
  );
}
```

**Step 3: 검증**

```bash
cd /Users/mr.joo/Desktop/관리자페이지/frontend && npx next build --webpack 2>&1 | tail -5
```

Expected: Build 성공. 기존 `/dashboard/users/1` 페이지에서 8탭이 동일하게 동작.

---

## Task 4: 프론트엔드 - 회원 목록 페이지 리뉴얼

**Files:**
- Modify: `frontend/src/app/dashboard/users/page.tsx`

전체 파일을 리뉴얼한다. 핵심 변경:

1. **요약 카드 3개**: 전체회원 수, 정상회원 수, 총 보유금
2. **상태 필터 버튼**: 전체/정상/정지/차단 (버튼 그룹으로 변경)
3. **등급 필터 버튼**: 전체등급/부본사/총판/대리점
4. **페이지네이션**: 하단에 페이지 번호 + 페이지 크기 선택 (10/20/50/100)
5. **슬라이드 패널**: 회원 클릭 → Sheet 오픈
6. 기존 트리 테이블 구조 유지 (SVG 커넥터)

**Step 1: users/page.tsx 전체 교체**

```typescript
'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { UserDetailContent } from '@/components/user-detail-content';
import { useUserTreeList, useUserSummaryStats, type TreeFlatUser } from '@/hooks/use-users';
import { Plus, ChevronRight, ChevronDown, RefreshCw, Users, DollarSign, UserCheck } from 'lucide-react';
import Link from 'next/link';

// ── Lookup tables ──────────────────────────────────────────────
const RANK_STYLES: Record<string, { label: string; cls: string }> = {
  sub_hq:      { label: '부본사', cls: 'bg-red-50 text-red-700 border border-red-200' },
  distributor: { label: '총판',   cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  agency:      { label: '대리점', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
};

const STATUS_STYLES: Record<string, { label: string; cls: string; dot: string }> = {
  active:    { label: '정상', cls: 'text-emerald-700', dot: 'bg-emerald-400' },
  suspended: { label: '정지', cls: 'text-amber-600',  dot: 'bg-amber-400' },
  banned:    { label: '차단', cls: 'text-red-600',    dot: 'bg-red-400' },
  pending:   { label: '대기', cls: 'text-blue-600',   dot: 'bg-blue-400' },
};

const DEPTH_ACCENT = ['#818cf8', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa'];
const DEPTH_ROW_BG = ['', 'bg-sky-50/40', 'bg-violet-50/30', 'bg-emerald-50/25', 'bg-orange-50/20', ''];

const ROW_H = 44;
const SLOT_W = 24;
const ARM = 14;
const B = 0.75;

function TreeConnectorSVG({ connectorLines, isLastChild }: { connectorLines: boolean[]; isLastChild: boolean }) {
  const n = connectorLines.length;
  const cx = n * SLOT_W + SLOT_W / 2;
  const w = cx + ARM + 4;
  const midY = ROW_H / 2;
  const sw = 1.5;

  return (
    <svg width={w} height={ROW_H} className="text-slate-300 dark:text-slate-500" style={{ display: 'block', flexShrink: 0, overflow: 'visible' }} aria-hidden>
      {connectorLines.map((show, i) =>
        show ? <line key={i} x1={i * SLOT_W + SLOT_W / 2} y1={-B} x2={i * SLOT_W + SLOT_W / 2} y2={ROW_H + B} stroke="currentColor" strokeWidth={sw} /> : null
      )}
      <line x1={cx} y1={-B} x2={cx} y2={isLastChild ? midY : ROW_H + B} stroke="currentColor" strokeWidth={sw} />
      <line x1={cx} y1={midY} x2={w - 4} y2={midY} stroke="currentColor" strokeWidth={sw} />
      <circle cx={w - 4} cy={midY} r={2.5} fill="currentColor" />
    </svg>
  );
}

// ── Page sizes ─────────────────────────────────────────────────
const PAGE_SIZES = [10, 20, 50, 100];

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [rankFilter, setRankFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const { items: treeItems, loading, refetch } = useUserTreeList();
  const { data: stats } = useUserSummaryStats();

  const toggle = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () =>
    setCollapsed(new Set(treeItems.filter((u) => u.hasChildren).map((u) => u.id)));

  // Filter
  const filteredItems = (() => {
    const hidden = new Set<number>();
    const result: TreeFlatUser[] = [];
    for (const item of treeItems) {
      const pid = item.referrer_id;
      if (pid && (hidden.has(pid) || collapsed.has(pid))) {
        hidden.add(item.id);
        continue;
      }
      result.push(item);
    }
    if (!search && !statusFilter && !rankFilter) return result;
    const q = search.toLowerCase();
    return result.filter((u) => {
      const matchQ = !search || u.username.toLowerCase().includes(q) || (u.real_name?.toLowerCase().includes(q) ?? false) || (u.phone?.includes(search) ?? false);
      return matchQ && (!statusFilter || u.status === statusFilter) && (!rankFilter || u.rank === rankFilter);
    });
  })();

  // Pagination
  const totalFiltered = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedItems = filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleUserClick = (userId: number) => {
    setSelectedUserId(userId);
  };

  return (
    <div className="space-y-5">
      {/* ── Summary Cards ────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">전체회원</p>
              <p className="text-2xl font-bold">{stats?.total_count?.toLocaleString() ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950">
              <UserCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">정상회원</p>
              <p className="text-2xl font-bold">{stats?.active_count?.toLocaleString() ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950">
              <DollarSign className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">총 보유금</p>
              <p className="text-2xl font-bold">{stats?.total_balance?.toLocaleString() ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Header + Actions ─────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">회원 관리</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            전체 <span className="font-semibold text-foreground">{treeItems.length}</span>명
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>전체 펼침</Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>전체 접기</Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />새로고침
          </Button>
          <Link href="/dashboard/users/new">
            <Button size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" />회원 등록</Button>
          </Link>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────── */}
      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          {/* Search */}
          <Input
            placeholder="아이디 / 이름 / 전화번호 검색"
            className="max-w-80 h-9 text-sm"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
          {/* Status filter buttons */}
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground self-center mr-1">상태:</span>
            {[{ key: '', label: '전체' }, ...Object.entries(STATUS_STYLES).map(([k, v]) => ({ key: k, label: v.label }))].map((s) => (
              <Button
                key={s.key}
                variant={statusFilter === s.key ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setStatusFilter(s.key); setCurrentPage(1); }}
              >
                {s.label}
              </Button>
            ))}
            <span className="text-xs text-muted-foreground self-center ml-4 mr-1">등급:</span>
            {[{ key: '', label: '전체등급' }, ...Object.entries(RANK_STYLES).map(([k, v]) => ({ key: k, label: v.label }))].map((r) => (
              <Button
                key={r.key}
                variant={rankFilter === r.key ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setRankFilter(r.key); setCurrentPage(1); }}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Tree Table ───────────────────────────────────── */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr className="bg-muted/60" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs tracking-wide w-14">ID</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground text-xs tracking-wide min-w-64">아이디</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs tracking-wide">전화번호</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs tracking-wide">잔액</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs tracking-wide">포인트</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground text-xs tracking-wide">등급</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground text-xs tracking-wide w-14">추천</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground text-xs tracking-wide">상태</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs tracking-wide">가입일</th>
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <RefreshCw className="h-5 w-5 animate-spin opacity-40" />
                        <span className="text-sm">데이터 로딩 중...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Users className="h-8 w-8 opacity-30" />
                        <span className="text-sm">회원이 없습니다</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((user) => {
                    const depth = user.treeDepth;
                    const isCollapsed = collapsed.has(user.id);
                    const accentColor = DEPTH_ACCENT[Math.min(depth, DEPTH_ACCENT.length - 1)] as string;
                    const rowBg = DEPTH_ROW_BG[Math.min(depth, DEPTH_ROW_BG.length - 1)] as string;
                    const rankStyle = RANK_STYLES[user.rank];
                    const statusStyle = STATUS_STYLES[user.status];

                    return (
                      <tr
                        key={user.id}
                        className={`transition-colors hover:bg-muted/40 cursor-pointer ${rowBg}`}
                        style={{ height: ROW_H, borderBottom: '1px solid hsl(var(--border) / 0.35)' }}
                        onClick={() => handleUserClick(user.id)}
                      >
                        <td style={{ height: ROW_H, padding: '0 12px', verticalAlign: 'middle', borderLeft: `3px solid ${accentColor}` }}>
                          <span className="tabular-nums text-xs text-muted-foreground/50">{user.id}</span>
                        </td>
                        <td style={{ height: ROW_H, padding: 0, verticalAlign: 'middle' }}>
                          <div style={{ height: ROW_H, display: 'flex', alignItems: 'center', paddingRight: 8, overflow: 'hidden' }}>
                            {depth > 0 ? <TreeConnectorSVG connectorLines={user.connectorLines} isLastChild={user.isLastChild} /> : <div style={{ width: 8 }} />}
                            <span
                              className={`hover:underline underline-offset-2 truncate text-sm ${depth === 0 ? 'text-foreground font-semibold' : 'text-blue-600 dark:text-blue-400 hover:text-blue-800'}`}
                              style={{ maxWidth: 140 }}
                            >
                              {user.username}
                            </span>
                            {user.real_name && <span className="text-muted-foreground/50 text-[11px] ml-1.5 shrink-0 truncate" style={{ maxWidth: 60 }}>{user.real_name}</span>}
                            {isCollapsed && user.hasChildren && (
                              <span className="ml-1.5 shrink-0 text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-px rounded-full font-medium leading-snug">+{user.childCount}</span>
                            )}
                          </div>
                        </td>
                        <td style={{ height: ROW_H, padding: '0 16px', verticalAlign: 'middle' }}>
                          <span className="text-sm text-muted-foreground tabular-nums">{user.phone ?? <span className="opacity-30">—</span>}</span>
                        </td>
                        <td style={{ height: ROW_H, padding: '0 16px', verticalAlign: 'middle', textAlign: 'right' }}>
                          <span className="font-mono text-sm tabular-nums">{Number(user.balance).toLocaleString()}</span>
                        </td>
                        <td style={{ height: ROW_H, padding: '0 16px', verticalAlign: 'middle', textAlign: 'right' }}>
                          <span className="font-mono text-sm tabular-nums text-muted-foreground">{Number(user.points).toLocaleString()}</span>
                        </td>
                        <td style={{ height: ROW_H, padding: '0 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                          {rankStyle ? <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${rankStyle.cls}`}>{rankStyle.label}</span> : <span className="text-xs text-muted-foreground">{user.rank}</span>}
                        </td>
                        <td style={{ height: ROW_H, padding: '0 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                          {user.direct_referral_count > 0 ? <span className="font-medium text-sm">{user.direct_referral_count}</span> : <span className="text-muted-foreground/30 text-sm">0</span>}
                        </td>
                        <td style={{ height: ROW_H, padding: '0 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                          {statusStyle ? (
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusStyle.cls}`}>
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusStyle.dot}`} />
                              {statusStyle.label}
                            </span>
                          ) : <span className="text-xs text-muted-foreground">{user.status}</span>}
                        </td>
                        <td style={{ height: ROW_H, padding: '0 16px', verticalAlign: 'middle' }}>
                          <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
                            {new Date(user.created_at).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                          </span>
                        </td>
                        <td style={{ height: ROW_H, padding: '0 8px', verticalAlign: 'middle', textAlign: 'center' }}>
                          {user.hasChildren ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggle(user.id); }}
                              title={isCollapsed ? '펼치기' : '접기'}
                              className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-muted text-muted-foreground/60 hover:text-foreground transition-colors"
                            >
                              {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer: Pagination */}
          {!loading && (
            <div className="border-t bg-muted/20 px-5 py-2.5 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>표시 <span className="font-semibold text-foreground">{paginatedItems.length}</span>명 / 전체 <span className="font-semibold text-foreground">{totalFiltered}</span>명</span>
                <select
                  className="border rounded px-2 py-1 text-xs bg-background ml-2"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                >
                  {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}건</option>)}
                </select>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={safePage <= 1} onClick={() => setCurrentPage(safePage - 1)}>‹</Button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (safePage <= 4) {
                      pageNum = i + 1;
                    } else if (safePage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = safePage - 3 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={safePage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 w-7 p-0 text-xs"
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={safePage >= totalPages} onClick={() => setCurrentPage(safePage + 1)}>›</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Slide Panel (Sheet) ──────────────────────────── */}
      <Sheet open={selectedUserId !== null} onOpenChange={(open) => { if (!open) setSelectedUserId(null); }}>
        <SheetContent side="right" className="w-[900px] sm:max-w-[900px] p-0" showCloseButton={false}>
          {selectedUserId && (
            <UserDetailContent
              userId={selectedUserId}
              isSheet
              onClose={() => setSelectedUserId(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

**Step 2: 검증**

```bash
cd /Users/mr.joo/Desktop/관리자페이지/frontend && npx next build --webpack 2>&1 | tail -5
```

Expected: Build 성공.

**Step 3: UI 검증 체크리스트**

1. 요약 카드 3개 표시 (전체회원, 정상, 총 보유금)
2. 상태 필터 버튼 클릭 → 테이블 필터링
3. 등급 필터 버튼 클릭 → 테이블 필터링
4. 검색 입력 → 실시간 필터링
5. 페이지네이션 동작 (페이지 이동, 페이지 크기 변경)
6. 회원 행 클릭 → 우측 슬라이드 패널 열림
7. 패널 내 8탭 전환 정상
8. X 버튼 / ESC 키 → 패널 닫기
9. 트리 펼침/접기 버튼 정상 (이벤트 버블링 방지)

---

## Task 5: 빌드 검증 + CLAUDE.md 업데이트

**Step 1: 빌드 검증**

```bash
cd /Users/mr.joo/Desktop/관리자페이지/frontend && npx next build --webpack
```

Expected: Build 성공, 에러 없음.

**Step 2: CLAUDE.md 업데이트**

CLAUDE.md의 `## 회원 상세정보 강화` 섹션 하단에 추가:

```markdown
## Phase 1: 회원 목록 리뉴얼 + 슬라이드 패널 (2026-02-18)

- 요약 카드 3개 (전체회원/정상/총 보유금) - `/api/v1/users/summary-stats` API 신규
- 상태 필터 버튼 (전체/정상/정지/차단/대기)
- 등급 필터 버튼 (전체/부본사/총판/대리점)
- 클라이언트 페이지네이션 (10/20/50/100건)
- 슬라이드 패널: shadcn/ui Sheet (900px) - 8탭 재활용
- 공유 컴포넌트: `frontend/src/components/user-detail-content.tsx`
- 기존 `/dashboard/users/[id]` 페이지 유지 (직접 URL 접속용)
```

**Step 3: 설계서 체크리스트 업데이트**

`docs/plans/2026-02-18-member-management-upgrade-design.md`에서 Phase 1 항목들 `[ ]` → `[x]` 변경.

---

## 작업 순서 요약

| Task | 내용 | 소요 | 의존성 |
|------|------|------|--------|
| 1 | 백엔드 요약 통계 API | 소 | 없음 |
| 2 | 프론트엔드 통계 훅 | 소 | Task 1 |
| 3 | UserDetailContent 공유 컴포넌트 추출 | 중 | 없음 |
| 4 | 회원 목록 페이지 전체 리뉴얼 | 대 | Task 2, 3 |
| 5 | 빌드 검증 + 문서 업데이트 | 소 | Task 4 |

**병렬 가능**: Task 1과 Task 3은 독립적이므로 동시 진행 가능.
