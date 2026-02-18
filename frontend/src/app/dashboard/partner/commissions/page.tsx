'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePartnerCommissions } from '@/hooks/use-partner';
import { Percent } from 'lucide-react';
import { formatAmount } from '@/lib/utils';

const TYPE_LABELS: Record<string, string> = {
  rolling: '롤링',
  losing: '죽장',
  deposit: '입금',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  settled: '정산완료',
  cancelled: '취소',
};

export default function PartnerCommissionsPage() {
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const { data, loading } = usePartnerCommissions({
    page,
    page_size: 20,
    type: typeFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">커미션 내역</h1>

      {/* Summary Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">총 커미션</CardTitle>
          <Percent className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {loading ? '...' : formatAmount(data?.total_commission ?? 0)}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
        >
          <option value="">전체 타입</option>
          <option value="rolling">롤링</option>
          <option value="losing">죽장</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
        />
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">타입</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">원금</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">비율</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">커미션</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">일시</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {data?.items.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      c.type === 'rolling'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                    }`}>
                      {TYPE_LABELS[c.type] || c.type}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono">{formatAmount(c.source_amount)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono">{(c.rate * 100).toFixed(2)}%</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono font-medium">{formatAmount(c.commission_amount)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`text-xs ${
                      c.status === 'settled' ? 'text-green-600 dark:text-green-400'
                        : c.status === 'pending' ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(c.created_at).toLocaleString('ko-KR')}
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    커미션 내역이 없습니다
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
