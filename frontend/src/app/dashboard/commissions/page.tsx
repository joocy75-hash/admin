'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePolicyList, deletePolicy, type CommissionPolicy } from '@/hooks/use-commissions';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { AlertCircle, Percent } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  rolling: '롤링',
  losing: '루징 (죽장)',
  deposit: '입금',
};

const CATEGORY_LABELS: Record<string, string> = {
  casino: '카지노',
  slot: '슬롯',
  mini_game: '미니게임',
  virtual_soccer: '가상축구',
  sports: '스포츠',
  esports: 'e스포츠',
  holdem: '홀덤',
};

const TYPE_BADGE_COLORS: Record<string, string> = {
  rolling: 'bg-blue-100 text-blue-800',
  losing: 'bg-red-100 text-red-800',
  deposit: 'bg-green-100 text-green-800',
};

export default function CommissionPoliciesPage() {
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPolicy, setPendingPolicy] = useState<CommissionPolicy | null>(null);

  const { data, loading, error, refetch } = usePolicyList({
    page,
    page_size: 20,
    type: typeFilter || undefined,
    game_category: categoryFilter || undefined,
  });

  const handleDelete = (policy: CommissionPolicy) => {
    setPendingPolicy(policy);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingPolicy) return;
    try {
      await deletePolicy(pendingPolicy.id);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
    setConfirmOpen(false);
    setPendingPolicy(null);
  };

  const formatRates = (rates: Record<string, number>) => {
    return Object.entries(rates)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([lvl, rate]) => `L${lvl}: ${rate}%`)
      .join(', ');
  };

  return (
    <div className="space-y-6">
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정책 비활성화</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{pendingPolicy?.name}&quot; 정책을 비활성화합니다. 계속하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>확인</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">커미션 정책</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/commissions/overrides">
            <Button variant="outline">에이전트 오버라이드</Button>
          </Link>
          <Link href="/dashboard/commissions/ledger">
            <Button variant="outline">커미션 원장</Button>
          </Link>
          <Link href="/dashboard/commissions/new">
            <Button>+ 정책 등록</Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="border rounded-md px-3 py-1.5 text-sm bg-background"
        >
          <option value="">전체 유형</option>
          <option value="rolling">롤링</option>
          <option value="losing">루징</option>
          <option value="deposit">입금</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="border rounded-md px-3 py-1.5 text-sm bg-background"
        >
          <option value="">전체 카테고리</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-destructive">
          <AlertCircle className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">데이터를 불러오지 못했습니다</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Button variant="outline" className="mt-4" onClick={refetch}>다시 시도</Button>
        </div>
      ) : data?.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Percent className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">등록된 커미션 정책이 없습니다</p>
          <p className="text-sm">조건을 변경하거나 새로 등록해주세요.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>정책명</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead>단계별 비율</TableHead>
                <TableHead>최소 베팅</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-center">우선순위</TableHead>
                <TableHead>관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell className="font-medium">{policy.name}</TableCell>
                  <TableCell>
                    <Badge className={TYPE_BADGE_COLORS[policy.type] || 'bg-gray-100 text-gray-800'} variant="secondary">
                      {TYPE_LABELS[policy.type] || policy.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {policy.game_category ? CATEGORY_LABELS[policy.game_category] || policy.game_category : (
                      <span className="text-muted-foreground">전체</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatRates(policy.level_rates)}</TableCell>
                  <TableCell>{Number(policy.min_bet_amount).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge className={policy.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'} variant="secondary">
                      {policy.active ? '활성' : '비활성'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{policy.priority}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Link href={`/dashboard/commissions/${policy.id}`}>
                        <Button variant="ghost" size="xs">수정</Button>
                      </Link>
                      <Button variant="ghost" size="xs" className="text-red-600 hover:text-red-800" onClick={() => handleDelete(policy)}>
                        삭제
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">전체: {data.total}건</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))}>
              이전
            </Button>
            <span className="flex items-center text-sm text-muted-foreground">
              {data.page} / {Math.ceil(data.total / data.page_size)}
            </span>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(data.total / data.page_size)} onClick={() => setPage(page + 1)}>
              다음
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
