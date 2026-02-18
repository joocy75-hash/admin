'use client';

import { useState } from 'react';
import { useTransactionList, approveTransaction, rejectTransaction } from '@/hooks/use-transactions';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { AlertCircle, Receipt } from 'lucide-react';

const TYPE_COLORS: Record<string, string> = {
  deposit: 'bg-blue-100 text-blue-800',
  withdrawal: 'bg-red-100 text-red-800',
  adjustment: 'bg-purple-100 text-purple-800',
  commission: 'bg-green-100 text-green-800',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmDesc, setConfirmDesc] = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  const openConfirm = (title: string, desc: string, action: () => void) => {
    setConfirmTitle(title);
    setConfirmDesc(desc);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  const { data, loading, error, refetch } = useTransactionList({
    page,
    page_size: 20,
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    user_id: userIdFilter ? Number(userIdFilter) : undefined,
  });

  const handleApprove = (id: number) => {
    openConfirm('거래 승인', '이 거래를 승인하시겠습니까?', async () => {
      try {
        await approveTransaction(id);
        refetch();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Approve failed');
      }
    });
  };

  const handleReject = (id: number) => {
    openConfirm('거래 거부', '이 거래를 거부하시겠습니까?', async () => {
      try {
        await rejectTransaction(id);
        refetch();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Reject failed');
      }
    });
  };

  return (
    <div className="space-y-6">
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => { confirmAction?.(); setConfirmOpen(false); }}>
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <h1 className="text-2xl font-bold">입출금 관리</h1>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-blue-600 dark:text-blue-400">전체 건수</p>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{data.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-green-600 dark:text-green-400">총 금액 (필터)</p>
              <p className="text-xl font-bold text-green-700 dark:text-green-300">{Number(data.total_amount).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-yellow-600 dark:text-yellow-400">현재 페이지</p>
              <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300">{data.items.length}건</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="border rounded-md px-3 py-1.5 text-sm bg-background"
        >
          <option value="">전체 유형</option>
          <option value="deposit">입금</option>
          <option value="withdrawal">출금</option>
          <option value="adjustment">조정</option>
          <option value="commission">커미션</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded-md px-3 py-1.5 text-sm bg-background"
        >
          <option value="">전체 상태</option>
          <option value="pending">대기중</option>
          <option value="approved">승인</option>
          <option value="rejected">거부</option>
        </select>
        <Input
          type="number"
          value={userIdFilter}
          onChange={(e) => { setUserIdFilter(e.target.value); setPage(1); }}
          placeholder="회원 ID"
          className="w-32 h-9"
        />
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
          <Receipt className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">거래 내역이 없습니다</p>
          <p className="text-sm">조건을 변경해주세요.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>회원</TableHead>
                <TableHead>유형</TableHead>
                <TableHead className="text-center">코인</TableHead>
                <TableHead className="text-right">금액</TableHead>
                <TableHead className="text-right">전 잔액</TableHead>
                <TableHead className="text-right">후 잔액</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>TX Hash</TableHead>
                <TableHead>일시</TableHead>
                <TableHead>액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-muted-foreground">{tx.id}</TableCell>
                  <TableCell className="font-medium">
                    {tx.user_username || tx.user_id}
                  </TableCell>
                  <TableCell>
                    <Badge className={TYPE_COLORS[tx.type] || 'bg-gray-100 text-gray-800'} variant="secondary">
                      {tx.type}
                    </Badge>
                    <span className="ml-1 text-xs text-muted-foreground">({tx.action})</span>
                  </TableCell>
                  <TableCell className="text-center">
                    {tx.coin_type ? (
                      <span className="text-xs">{tx.coin_type}{tx.network ? ` (${tx.network})` : ''}</span>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium font-mono">
                    {Number(tx.amount).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground font-mono">
                    {Number(tx.balance_before).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground font-mono">
                    {Number(tx.balance_after).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[tx.status] || 'bg-gray-100 text-gray-800'} variant="secondary">
                      {tx.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate font-mono">
                    {tx.tx_hash ? tx.tx_hash.slice(0, 10) + '...' : (tx.memo || '-')}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                  </TableCell>
                  <TableCell>
                    {tx.status === 'pending' ? (
                      <div className="flex gap-1">
                        <Button size="xs" onClick={() => handleApprove(tx.id)}>
                          승인
                        </Button>
                        <Button variant="destructive" size="xs" onClick={() => handleReject(tx.id)}>
                          거부
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {tx.processed_by_username || '-'}
                      </span>
                    )}
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
          <p className="text-sm text-muted-foreground">총 {data.total}건</p>
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
