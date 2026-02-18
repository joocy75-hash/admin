'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
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


const ROW_H = 44;
const SLOT_W = 28;
const ARM = 10;
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
          <Input
            placeholder="아이디 / 이름 / 전화번호 검색"
            className="max-w-80 h-9 text-sm"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
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
                    const rankStyle = RANK_STYLES[user.rank];
                    const statusStyle = STATUS_STYLES[user.status];

                    return (
                      <tr
                        key={user.id}
                        className="transition-colors hover:bg-muted/40 cursor-pointer"
                        style={{ height: ROW_H, borderBottom: '1px solid hsl(var(--border) / 0.35)' }}
                        onClick={() => handleUserClick(user.id)}
                      >
                        <td style={{ height: ROW_H, padding: '0 12px', verticalAlign: 'middle' }}>
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
          <SheetTitle className="sr-only">회원 상세정보</SheetTitle>
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
