'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { previewSettlement, createSettlement, type SettlementPreview } from '@/hooks/use-settlements';

export default function NewSettlementPage() {
  const router = useRouter();
  const [agentId, setAgentId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [memo, setMemo] = useState('');
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handlePreview = async () => {
    if (!agentId || !periodStart || !periodEnd) return;
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const data = await previewSettlement(Number(agentId), periodStart, periodEnd);
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!preview || preview.pending_entries === 0) return;
    setCreating(true);
    setError('');
    try {
      await createSettlement({
        agent_id: Number(agentId),
        period_start: periodStart,
        period_end: periodEnd,
        memo: memo || null,
      });
      router.push('/dashboard/settlements');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">New Settlement</h1>

      {error && <div className="rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

      {/* Step 1: Select agent and period */}
      <div className="rounded-lg border bg-white p-6 space-y-4">
        <h2 className="font-medium text-gray-700">1. Select Agent & Period</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600">Agent ID</label>
            <input
              type="number"
              value={agentId}
              onChange={(e) => { setAgentId(e.target.value); setPreview(null); }}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Period Start</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => { setPeriodStart(e.target.value); setPreview(null); }}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Period End</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => { setPeriodEnd(e.target.value); setPreview(null); }}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          onClick={handlePreview}
          disabled={!agentId || !periodStart || !periodEnd || loading}
          className="rounded-md bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-900 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Preview'}
        </button>
      </div>

      {/* Step 2: Preview result */}
      {preview && (
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h2 className="font-medium text-gray-700">2. Preview</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Agent</p>
              <p className="font-medium">{preview.agent_username}</p>
            </div>
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Pending Entries</p>
              <p className="font-medium">{preview.pending_entries}</p>
            </div>
            <div className="rounded-md bg-blue-50 p-3">
              <p className="text-xs text-blue-600">Rolling Total</p>
              <p className="text-lg font-bold text-blue-800">
                {Number(preview.rolling_total).toLocaleString()}
              </p>
            </div>
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-xs text-red-600">Losing Total</p>
              <p className="text-lg font-bold text-red-800">
                {Number(preview.losing_total).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="rounded-md bg-green-50 p-4 text-center">
            <p className="text-sm text-green-600">Gross Total</p>
            <p className="text-2xl font-bold text-green-800">
              {Number(preview.gross_total).toLocaleString()}
            </p>
          </div>

          {preview.pending_entries === 0 ? (
            <p className="text-center text-amber-600">No pending commissions in this period.</p>
          ) : (
            <>
              <div>
                <label className="block text-sm text-gray-600">Memo (optional)</label>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="rounded-md bg-blue-600 px-6 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Settlement'}
                </button>
                <button
                  onClick={() => router.back()}
                  className="rounded-md border border-gray-300 px-6 py-2 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
