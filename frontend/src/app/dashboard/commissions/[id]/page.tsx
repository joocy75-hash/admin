'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import {
  updatePolicy,
  useOverrides,
  createOverride,
  deleteOverride,
  type CommissionPolicy,
} from '@/hooks/use-commissions';

const TYPE_LABELS: Record<string, string> = {
  rolling: 'Rolling',
  losing: 'Losing (Dead)',
  deposit: 'Deposit',
};

export default function PolicyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const policyId = Number(params.id);

  const [policy, setPolicy] = useState<CommissionPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'edit' | 'overrides'>('edit');

  // Form state
  const [name, setName] = useState('');
  const [levelRates, setLevelRates] = useState<Record<string, string>>({});
  const [minBetAmount, setMinBetAmount] = useState('0');
  const [priority, setPriority] = useState('0');
  const [active, setActive] = useState(true);

  // Override state
  const { data: overrides, refetch: refetchOverrides } = useOverrides(undefined, policyId);
  const [newAgentId, setNewAgentId] = useState('');
  const [newOverrideRates, setNewOverrideRates] = useState('');

  useEffect(() => {
    apiClient.get<CommissionPolicy>(`/api/v1/commissions/policies/${policyId}`)
      .then((p) => {
        setPolicy(p);
        setName(p.name);
        const ratesStr: Record<string, string> = {};
        for (const [k, v] of Object.entries(p.level_rates)) {
          ratesStr[k] = String(v);
        }
        setLevelRates(ratesStr);
        setMinBetAmount(String(p.min_bet_amount));
        setPriority(String(p.priority));
        setActive(p.active);
      })
      .catch(() => setError('Failed to load policy'))
      .finally(() => setLoading(false));
  }, [policyId]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const rates: Record<string, number> = {};
      for (const [k, v] of Object.entries(levelRates)) {
        const num = parseFloat(v);
        if (!isNaN(num) && num > 0) rates[k] = num;
      }
      const updated = await updatePolicy(policyId, {
        name,
        level_rates: rates,
        min_bet_amount: parseFloat(minBetAmount) || 0,
        priority: parseInt(priority) || 0,
        active,
      });
      setPolicy(updated);
      alert('Saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAddOverride = async () => {
    if (!newAgentId || !newOverrideRates) return;
    try {
      const rates: Record<string, number> = {};
      for (const part of newOverrideRates.split(',')) {
        const [lvl, rate] = part.trim().split(':');
        if (lvl && rate) rates[lvl.trim()] = parseFloat(rate.trim());
      }
      await createOverride({
        admin_user_id: parseInt(newAgentId),
        policy_id: policyId,
        custom_rates: rates,
      });
      setNewAgentId('');
      setNewOverrideRates('');
      refetchOverrides();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create override');
    }
  };

  const handleDeleteOverride = async (id: number) => {
    if (!confirm('Remove this override?')) return;
    await deleteOverride(id);
    refetchOverrides();
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!policy) return <p className="text-red-500">Policy not found</p>;

  const levelKeys = Object.keys(levelRates).sort((a, b) => Number(a) - Number(b));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{policy.name}</h1>
          <p className="text-sm text-gray-500">
            {TYPE_LABELS[policy.type] || policy.type}
            {policy.game_category ? ` / ${policy.game_category}` : ' / All Categories'}
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/commissions')}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          Back to List
        </button>
      </div>

      {error && <div className="rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

      {/* Tabs */}
      <div className="flex border-b">
        {(['edit', 'overrides'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'edit' ? 'Policy Settings' : `Overrides (${overrides.length})`}
          </button>
        ))}
      </div>

      {/* Edit Tab */}
      {tab === 'edit' && (
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                value={active ? 'active' : 'inactive'}
                onChange={(e) => setActive(e.target.value === 'active')}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Min Bet Amount</label>
              <input
                type="number"
                value={minBetAmount}
                onChange={(e) => setMinBetAmount(e.target.value)}
                min="0"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Priority</label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Level Rates (%)</label>
            <div className="space-y-2">
              {levelKeys.map((lvl) => (
                <div key={lvl} className="flex items-center gap-3">
                  <span className="w-20 text-sm text-gray-600">Level {lvl}:</span>
                  <input
                    type="number"
                    value={levelRates[lvl] || '0'}
                    onChange={(e) => setLevelRates({ ...levelRates, [lvl]: e.target.value })}
                    step="0.01"
                    min="0"
                    className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <span className="text-sm text-gray-400">%</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                const next = String(levelKeys.length + 1);
                setLevelRates({ ...levelRates, [next]: '0' });
              }}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              + Add Level
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-blue-600 px-6 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Overrides Tab */}
      {tab === 'overrides' && (
        <div className="space-y-4">
          {/* Add override */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Add Agent Override</h3>
            <div className="flex gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-500">Agent ID</label>
                <input
                  type="number"
                  value={newAgentId}
                  onChange={(e) => setNewAgentId(e.target.value)}
                  placeholder="Agent ID"
                  className="mt-1 w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500">Custom Rates (e.g. 1:0.8, 2:0.5, 3:0.2)</label>
                <input
                  type="text"
                  value={newOverrideRates}
                  onChange={(e) => setNewOverrideRates(e.target.value)}
                  placeholder="1:0.8, 2:0.5, 3:0.2"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={handleAddOverride}
                disabled={!newAgentId || !newOverrideRates}
                className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/* Override list */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Agent</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Custom Rates</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {overrides.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3 text-sm">{o.agent_username || o.admin_user_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{o.agent_code}</td>
                    <td className="px-4 py-3 text-sm">
                      {o.custom_rates
                        ? Object.entries(o.custom_rates)
                            .sort(([a], [b]) => Number(a) - Number(b))
                            .map(([k, v]) => `L${k}: ${v}%`)
                            .join(', ')
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        o.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {o.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => handleDeleteOverride(o.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {overrides.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      No overrides for this policy
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
