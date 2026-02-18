'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLedger, useLedgerSummary } from '@/hooks/use-commissions';

const TYPE_LABELS: Record<string, string> = {
  rolling: '롤링',
  losing: '루징',
  deposit: '입금',
};

const TYPE_COLORS: Record<string, string> = {
  rolling: 'bg-blue-100 text-blue-800',
  losing: 'bg-red-100 text-red-800',
  deposit: 'bg-green-100 text-green-800',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  settled: '정산됨',
  withdrawn: '출금됨',
  cancelled: '취소됨',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  settled: 'bg-green-100 text-green-800',
  withdrawn: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function CommissionLedgerPage() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [agentIdFilter, setAgentIdFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, loading } = useLedger({
    page,
    page_size: 20,
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    agent_id: agentIdFilter ? Number(agentIdFilter) : undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const { data: summary } = useLedgerSummary(
    agentIdFilter ? Number(agentIdFilter) : undefined,
    dateFrom || undefined,
    dateTo || undefined,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">커미션 원장</h1>
        <Link href="/dashboard/commissions">
          <button className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800">
            정책 목록
          </button>
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {summary.map((s) => (
          <div key={s.type} className="rounded-lg border bg-white p-4 dark:bg-gray-900 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{TYPE_LABELS[s.type] || s.type}</p>
            <p className="text-xl font-bold">{Number(s.total_amount).toLocaleString()}</p>
            <p className="text-xs text-gray-400">{s.count}건</p>
          </div>
        ))}
        {data && (
          <div className="rounded-lg border bg-blue-50 p-4">
            <p className="text-sm text-blue-600">합계 (필터 적용)</p>
            <p className="text-xl font-bold text-blue-800">
              {Number(data.total_commission).toLocaleString()}
            </p>
            <p className="text-xs text-blue-400">{data.total}건</p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">전체 유형</option>
          <option value="rolling">롤링</option>
          <option value="losing">루징</option>
          <option value="deposit">입금</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
        >
          <option value="">전체 상태</option>
          <option value="pending">대기</option>
          <option value="settled">정산됨</option>
          <option value="withdrawn">출금됨</option>
          <option value="cancelled">취소됨</option>
        </select>
        <input
          type="number"
          value={agentIdFilter}
          onChange={(e) => { setAgentIdFilter(e.target.value); setPage(1); }}
          placeholder="에이전트 ID"
          className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
        />
        <span className="self-center text-gray-400">~</span>
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
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">에이전트</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">유형</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">단계</th>
                <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">원금</th>
                <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">비율</th>
                <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">커미션</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">상태</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">참조</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">일시</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {data?.items.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">{entry.id}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-sm">
                    <div>
                      <span className="font-medium">{entry.agent_username || entry.agent_id}</span>
                      {entry.agent_code && (
                        <span className="ml-1 text-xs text-gray-400">({entry.agent_code})</span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_COLORS[entry.type] || 'bg-gray-100'}`}>
                      {TYPE_LABELS[entry.type] || entry.type}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-sm text-center">L{entry.level}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-sm text-right">
                    {Number(entry.source_amount).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-sm text-right">
                    {Number(entry.rate)}%
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-sm text-right font-medium">
                    {Number(entry.commission_amount).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[entry.status] || 'bg-gray-100'}`}>
                      {STATUS_LABELS[entry.status] || entry.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-400">
                    {entry.reference_id ? `${entry.reference_type}/${entry.reference_id}` : '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500">
                    {new Date(entry.created_at).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
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
          <p className="text-sm text-gray-600 dark:text-gray-400">전체: {data.total}건</p>
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
