'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePolicyList, deletePolicy, type CommissionPolicy } from '@/hooks/use-commissions';

const TYPE_LABELS: Record<string, string> = {
  rolling: 'Rolling',
  losing: 'Losing (Dead)',
  deposit: 'Deposit',
};

const CATEGORY_LABELS: Record<string, string> = {
  casino: 'Casino',
  slot: 'Slot',
  mini_game: 'Mini Game',
  virtual_soccer: 'Virtual Soccer',
  sports: 'Sports',
  esports: 'E-Sports',
  holdem: 'Holdem',
};

export default function CommissionPoliciesPage() {
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, loading, refetch } = usePolicyList({
    page,
    page_size: 20,
    type: typeFilter || undefined,
    game_category: categoryFilter || undefined,
  });

  const handleDelete = async (policy: CommissionPolicy) => {
    if (!confirm(`"${policy.name}" policy will be deactivated. Continue?`)) return;
    try {
      await deletePolicy(policy.id);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const formatRates = (rates: Record<string, number>) => {
    return Object.entries(rates)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([lvl, rate]) => `L${lvl}: ${rate}%`)
      .join(', ');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Commission Policies</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/commissions/overrides">
            <button className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">
              Agent Overrides
            </button>
          </Link>
          <Link href="/dashboard/commissions/ledger">
            <button className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">
              Commission Ledger
            </button>
          </Link>
          <Link href="/dashboard/commissions/new">
            <button className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              + New Policy
            </button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
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
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Level Rates</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Min Bet</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {data?.items.map((policy) => (
                <tr key={policy.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">{policy.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      policy.type === 'rolling' ? 'bg-blue-100 text-blue-800' :
                      policy.type === 'losing' ? 'bg-red-100 text-red-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {TYPE_LABELS[policy.type] || policy.type}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {policy.game_category ? CATEGORY_LABELS[policy.game_category] || policy.game_category : (
                      <span className="text-gray-400">All</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatRates(policy.level_rates)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {Number(policy.min_bet_amount).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      policy.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {policy.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-center">{policy.priority}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <Link href={`/dashboard/commissions/${policy.id}`}>
                        <button className="text-blue-600 hover:text-blue-800">Edit</button>
                      </Link>
                      <button
                        onClick={() => handleDelete(policy)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No commission policies found
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
          <p className="text-sm text-gray-600">
            Total: {data.total} policies
          </p>
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
