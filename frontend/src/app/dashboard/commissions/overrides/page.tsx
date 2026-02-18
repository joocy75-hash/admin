'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useOverrides,
  usePolicyList,
  createOverride,
  deleteOverride,
} from '@/hooks/use-commissions';

export default function OverridesPage() {
  const [agentIdFilter, setAgentIdFilter] = useState('');
  const [policyIdFilter, setPolicyIdFilter] = useState('');

  const { data: overrides, loading, refetch } = useOverrides(
    agentIdFilter ? Number(agentIdFilter) : undefined,
    policyIdFilter ? Number(policyIdFilter) : undefined,
  );

  const { data: policies } = usePolicyList({ page_size: 100 });

  // New override form
  const [showForm, setShowForm] = useState(false);
  const [newAgentId, setNewAgentId] = useState('');
  const [newPolicyId, setNewPolicyId] = useState('');
  const [newRates, setNewRates] = useState('');

  const handleAdd = async () => {
    if (!newAgentId || !newPolicyId || !newRates) return;
    try {
      const rates: Record<string, number> = {};
      for (const part of newRates.split(',')) {
        const [lvl, rate] = part.trim().split(':');
        if (lvl && rate) rates[lvl.trim()] = parseFloat(rate.trim());
      }
      await createOverride({
        admin_user_id: parseInt(newAgentId),
        policy_id: parseInt(newPolicyId),
        custom_rates: rates,
      });
      setNewAgentId('');
      setNewPolicyId('');
      setNewRates('');
      setShowForm(false);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Create failed');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this override?')) return;
    await deleteOverride(id);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agent Commission Overrides</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/commissions">
            <button className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">
              Back to Policies
            </button>
          </Link>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            {showForm ? 'Cancel' : '+ New Override'}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <h3 className="font-medium">New Override</h3>
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="block text-xs text-gray-500">Agent ID</label>
              <input
                type="number"
                value={newAgentId}
                onChange={(e) => setNewAgentId(e.target.value)}
                className="mt-1 w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500">Policy</label>
              <select
                value={newPolicyId}
                onChange={(e) => setNewPolicyId(e.target.value)}
                className="mt-1 w-64 rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select policy...</option>
                {policies?.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.type}] {p.name} {p.game_category ? `(${p.game_category})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500">Custom Rates (e.g. 1:0.8, 2:0.5, 3:0.2)</label>
              <input
                type="text"
                value={newRates}
                onChange={(e) => setNewRates(e.target.value)}
                placeholder="1:0.8, 2:0.5, 3:0.2"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!newAgentId || !newPolicyId || !newRates}
              className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <input
          type="number"
          value={agentIdFilter}
          onChange={(e) => setAgentIdFilter(e.target.value)}
          placeholder="Agent ID"
          className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={policyIdFilter}
          onChange={(e) => setPolicyIdFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Policies</option>
          {policies?.items.map((p) => (
            <option key={p.id} value={p.id}>
              [{p.type}] {p.name}
            </option>
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
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Agent</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Policy</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Custom Rates</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {overrides.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{o.id}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
                    {o.agent_username || o.admin_user_id}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{o.agent_code}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">{o.policy_name || o.policy_id}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {o.custom_rates
                      ? Object.entries(o.custom_rates)
                          .sort(([a], [b]) => Number(a) - Number(b))
                          .map(([k, v]) => `L${k}: ${v}%`)
                          .join(', ')
                      : '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      o.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {o.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <button
                      onClick={() => handleDelete(o.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {overrides.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No overrides found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
