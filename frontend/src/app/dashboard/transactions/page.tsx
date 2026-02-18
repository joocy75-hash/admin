'use client';

import { useState } from 'react';
import { useTransactionList, approveTransaction, rejectTransaction } from '@/hooks/use-transactions';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
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

  const { data, loading, error, refetch } = useTransactionList({
    page,
    page_size: 20,
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    user_id: userIdFilter ? Number(userIdFilter) : undefined,
  });

  const handleApprove = async (id: number) => {
    if (!confirm('이 거래를 승인하시겠습니까?')) return;
    try {
      await approveTransaction(id);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Approve failed');
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm('이 거래를 거부하시겠습니까?')) return;
    try {
      await rejectTransaction(id);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reject failed');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">입출금 관리</h1>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border bg-blue-50 p-4">
            <p className="text-xs text-blue-600">전체 건수</p>
            <p className="text-xl font-bold text-blue-800">{data.total}</p>
          </div>
          <div className="rounded-lg border bg-green-50 p-4">
            <p className="text-xs text-green-600">총 금액 (필터)</p>
            <p className="text-xl font-bold text-green-800">{Number(data.total_amount).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border bg-yellow-50 p-4">
            <p className="text-xs text-yellow-600">현재 페이지</p>
            <p className="text-xl font-bold text-yellow-800">{data.items.length}건</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
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
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">전체 상태</option>
          <option value="pending">대기중</option>
          <option value="approved">승인</option>
          <option value="rejected">거부</option>
        </select>
        <input
          type="number"
          value={userIdFilter}
          onChange={(e) => { setUserIdFilter(e.target.value); setPage(1); }}
          placeholder="회원 ID"
          className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
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
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">회원</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">유형</th>
                <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">금액</th>
                <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">전 잔액</th>
                <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">후 잔액</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">상태</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">메모</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">일시</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {data?.items.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500 dark:text-gray-400">{tx.id}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-sm font-medium">
                    {tx.user_username || tx.user_id}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_COLORS[tx.type] || 'bg-gray-100'}`}>
                      {tx.type}
                    </span>
                    <span className="ml-1 text-xs text-gray-400">({tx.action})</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-sm text-right font-medium">
                    {Number(tx.amount).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-sm text-right text-gray-500 dark:text-gray-400">
                    {Number(tx.balance_before).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-sm text-right text-gray-500 dark:text-gray-400">
                    {Number(tx.balance_after).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[tx.status] || 'bg-gray-100'}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[150px] truncate">
                    {tx.memo || '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(tx.created_at).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-sm">
                    {tx.status === 'pending' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleApprove(tx.id)}
                          className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => handleReject(tx.id)}
                          className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                        >
                          거부
                        </button>
                      </div>
                    )}
                    {tx.status !== 'pending' && (
                      <span className="text-xs text-gray-400">
                        {tx.processed_by_username || '-'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">총 {data.total}건</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
            >
              이전
            </button>
            <span className="px-3 py-1 text-sm">
              {data.page} / {Math.ceil(data.total / data.page_size)}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= Math.ceil(data.total / data.page_size)}
              className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
