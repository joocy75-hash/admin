'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLedger, useLedgerSummary } from '@/hooks/use-commissions';

const TYPE_COLORS: Record<string, string> = {
  rolling: 'bg-blue-100 text-blue-800',
  losing: 'bg-red-100 text-red-800',
  deposit: 'bg-green-100 text-green-800',
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
        <h1 className="text-2xl font-bold">Commission Ledger</h1>
        <Link href="/dashboard/commissions">
          <button className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">
            Back to Policies
          </button>
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {summary.map((s) => (
          <div key={s.type} className="rounded-lg border bg-white p-4">
            <p className="text-sm text-gray-500 capitalize">{s.type}</p>
            <p className="text-xl font-bold">{Number(s.total_amount).toLocaleString()}</p>
            <p className="text-xs text-gray-400">{s.count} entries</p>
          </div>
        ))}
        {data && (
          <div className="rounded-lg border bg-blue-50 p-4">
            <p className="text-sm text-blue-600">Total (filtered)</p>
            <p className="text-xl font-bold text-blue-800">
              {Number(data.total_commission).toLocaleString()}
            </p>
            <p className="text-xs text-blue-400">{data.total} entries</p>
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
          <option value="">All Types</option>
          <option value="rolling">Rolling</option>
          <option value="losing">Losing</option>
          <option value="deposit">Deposit</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="settled">Settled</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          type="number"
          value={agentIdFilter}
          onChange={(e) => { setAgentIdFilter(e.target.value); setPage(1); }}
          placeholder="Agent ID"
          className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <span className="self-center text-gray-400">~</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
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
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Agent</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Type</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Level</th>
                <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Source</th>
                <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Rate</th>
                <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Commission</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Ref</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {data?.items.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
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
                      {entry.type}
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
                      {entry.status}
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
                    No commission entries found
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
          <p className="text-sm text-gray-600">Total: {data.total} entries</p>
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
