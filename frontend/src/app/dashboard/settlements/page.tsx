'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSettlementList } from '@/hooks/use-settlements';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function SettlementsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [agentIdFilter, setAgentIdFilter] = useState('');

  const { data, loading } = useSettlementList({
    page,
    page_size: 20,
    status: statusFilter || undefined,
    agent_id: agentIdFilter ? Number(agentIdFilter) : undefined,
  });

  const formatDate = (dt: string) =>
    new Date(dt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settlements</h1>
        <Link href="/dashboard/settlements/new">
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
            + New Settlement
          </button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
        <input
          type="number"
          value={agentIdFilter}
          onChange={(e) => { setAgentIdFilter(e.target.value); setPage(1); }}
          placeholder="Agent ID"
          className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Agent</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Period</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Rolling</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Losing</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Net Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {data?.items.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{s.id}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className="font-medium">{s.agent_username}</span>
                    {s.agent_code && <span className="ml-1 text-xs text-gray-400">({s.agent_code})</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {formatDate(s.period_start)} ~ {formatDate(s.period_end)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-right">
                    {Number(s.rolling_total).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-right">
                    {Number(s.losing_total).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-bold">
                    {Number(s.net_total).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${STATUS_COLORS[s.status] || 'bg-gray-100'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                    {formatDate(s.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <Link href={`/dashboard/settlements/${s.id}`}>
                      <button className="text-blue-600 hover:text-blue-800">Detail</button>
                    </Link>
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    No settlements found
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
          <p className="text-sm text-gray-600">Total: {data.total}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
            >
              Prev
            </button>
            <span className="px-3 py-1 text-sm">
              Page {data.page} / {Math.ceil(data.total / data.page_size)}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= Math.ceil(data.total / data.page_size)}
              className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
