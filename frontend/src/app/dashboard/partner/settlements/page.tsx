'use client';

import { useState } from 'react';
import { usePartnerSettlements } from '@/hooks/use-partner';

function formatKRW(amount: number): string {
  return '\u20A9' + amount.toLocaleString('ko-KR');
}

const STATUS_LABELS: Record<string, string> = {
  draft: '초안',
  confirmed: '확인됨',
  paid: '지급완료',
  rejected: '거부',
};

export default function PartnerSettlementsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, loading } = usePartnerSettlements({
    page,
    page_size: 20,
    status: statusFilter || undefined,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">정산 내역</h1>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
        >
          <option value="">전체 상태</option>
          <option value="draft">초안</option>
          <option value="confirmed">확인됨</option>
          <option value="paid">지급완료</option>
          <option value="rejected">거부</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">기간</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">총 커미션</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">지급일</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">생성일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {data?.items.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {new Date(s.period_start).toLocaleDateString('ko-KR')} ~ {new Date(s.period_end).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono font-medium">
                    {formatKRW(s.total_commission)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      s.status === 'paid'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                        : s.status === 'confirmed'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                        : s.status === 'rejected'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {STATUS_LABELS[s.status] || s.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {s.paid_at ? new Date(s.paid_at).toLocaleDateString('ko-KR') : '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(s.created_at).toLocaleDateString('ko-KR')}
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    정산 내역이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            전체: {data.total}건
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded-md border px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-700"
            >
              이전
            </button>
            <span className="px-3 py-1 text-sm">
              {data.page} / {Math.ceil(data.total / data.page_size)}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= Math.ceil(data.total / data.page_size)}
              className="rounded-md border px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-700"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
