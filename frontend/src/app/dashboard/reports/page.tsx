'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useAgentReport,
  useCommissionReport,
  useFinancialReport,
  exportAgentReport,
  exportCommissionReport,
  exportFinancialReport,
} from '@/hooks/use-reports';
import { useToast } from '@/components/toast-provider';
import { Download } from 'lucide-react';
import { formatAmount } from '@/lib/utils';

function getDateRange(preset: string): { start: string; end: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const end = fmt(today);

  switch (preset) {
    case 'today':
      return { start: end, end };
    case 'week': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { start: fmt(start), end };
    }
    case 'month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: fmt(start), end };
    }
    default:
      return { start: end, end };
  }
}

const TABS = [
  { key: 'agents', label: '에이전트 성과' },
  { key: 'commissions', label: '커미션 분석' },
  { key: 'financial', label: '재무 현황' },
];

const PRESETS = [
  { key: 'today', label: '오늘' },
  { key: 'week', label: '이번 주' },
  { key: 'month', label: '이번 달' },
  { key: 'custom', label: '직접 선택' },
];

export default function ReportsPage() {
  const toast = useToast();
  const [tab, setTab] = useState('agents');
  const [preset, setPreset] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [exporting, setExporting] = useState(false);

  const range = preset === 'custom'
    ? { start: customStart, end: customEnd }
    : getDateRange(preset);

  const { data: agentData, loading: agentLoading } = useAgentReport(range.start, range.end);
  const { data: commissionData, loading: commissionLoading } = useCommissionReport(range.start, range.end);
  const { data: financialData, loading: financialLoading } = useFinancialReport(range.start, range.end);

  const handleExport = async () => {
    if (!range.start || !range.end) return;
    setExporting(true);
    try {
      if (tab === 'agents') await exportAgentReport(range.start, range.end);
      else if (tab === 'commissions') await exportCommissionReport(range.start, range.end);
      else await exportFinancialReport(range.start, range.end);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '내보내기 실패');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">리포트</h1>
        <button
          onClick={handleExport}
          disabled={exporting || !range.start || !range.end}
          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exporting ? '내보내는 중...' : 'Excel 내보내기'}
        </button>
      </div>

      {/* Date Range */}
      <div className="flex flex-wrap items-center gap-3">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              preset === p.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:bg-gray-900 dark:border-gray-700"
            />
            <span className="text-sm text-muted-foreground">~</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'agents' && (
        <AgentTab data={agentData} loading={agentLoading} />
      )}
      {tab === 'commissions' && (
        <CommissionTab data={commissionData} loading={commissionLoading} />
      )}
      {tab === 'financial' && (
        <FinancialTab data={financialData} loading={financialLoading} />
      )}
    </div>
  );
}

// ─── Agent Tab ──────────────────────────────────────────────────

function AgentTab({ data, loading }: { data: import('@/hooks/use-reports').AgentReportItem[]; loading: boolean }) {
  if (loading) return <LoadingTable />;
  if (data.length === 0) return <EmptyState text="에이전트 성과 데이터가 없습니다" />;

  const totals = data.reduce(
    (acc, r) => ({
      users: acc.users + r.total_users,
      bets: acc.bets + r.total_bets,
      commissions: acc.commissions + r.total_commissions,
    }),
    { users: 0, bets: 0, commissions: 0 }
  );

  const ROLE_LABELS: Record<string, string> = {
    super_admin: '최고관리자',
    admin: '관리자',
    distributor: '총판',
    sub_hq: '부본사',
    agent: '에이전트',
    sub_agent: '서브에이전트',
  };

  return (
    <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">에이전트</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">코드</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">역할</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">총 회원</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">총 베팅</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">총 커미션</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
          {data.map((r) => (
            <tr key={r.agent_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">{r.username}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">{r.agent_code}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm">
                <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  {ROLE_LABELS[r.role] || r.role}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-right">{r.total_users}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono">{formatAmount(r.total_bets)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono">{formatAmount(r.total_commissions)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50 dark:bg-gray-800">
          <tr className="font-semibold">
            <td className="px-4 py-3 text-sm" colSpan={3}>합계</td>
            <td className="px-4 py-3 text-sm text-right">{totals.users}</td>
            <td className="px-4 py-3 text-sm text-right font-mono">{formatAmount(totals.bets)}</td>
            <td className="px-4 py-3 text-sm text-right font-mono">{formatAmount(totals.commissions)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Commission Tab ─────────────────────────────────────────────

function CommissionTab({ data, loading }: { data: import('@/hooks/use-reports').CommissionReportItem[]; loading: boolean }) {
  if (loading) return <LoadingTable />;
  if (data.length === 0) return <EmptyState text="커미션 데이터가 없습니다" />;

  const rollingTotal = data.filter((d) => d.type === 'rolling').reduce((s, d) => s + d.total_amount, 0);
  const losingTotal = data.filter((d) => d.type === 'losing').reduce((s, d) => s + d.total_amount, 0);

  const TYPE_LABELS: Record<string, string> = {
    rolling: '롤링',
    losing: '죽장',
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">롤링 커미션 합계</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatAmount(rollingTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">죽장 커미션 합계</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatAmount(losingTotal)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">커미션 유형</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">건수</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">합계 금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
            {data.map((d, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                    d.type === 'rolling'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                      : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                  }`}>
                    {TYPE_LABELS[d.type] || d.type}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-right">{d.count}건</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono">{formatAmount(d.total_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Financial Tab ──────────────────────────────────────────────

function FinancialTab({ data, loading }: { data: import('@/hooks/use-reports').FinancialReport | null; loading: boolean }) {
  if (loading) return <LoadingTable />;
  if (!data) return <EmptyState text="재무 데이터가 없습니다" />;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 입금</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatAmount(data.total_deposits)}</div>
            <p className="text-xs text-muted-foreground mt-1">{data.deposit_count}건</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 출금</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatAmount(data.total_withdrawals)}</div>
            <p className="text-xs text-muted-foreground mt-1">{data.withdrawal_count}건</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">순수익</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.net_revenue >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatAmount(data.net_revenue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">입금 - 출금</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">커미션 지출</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatAmount(data.total_commissions)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Period */}
      <p className="text-sm text-muted-foreground">
        기간: {data.start_date} ~ {data.end_date}
      </p>
    </div>
  );
}

// ─── Shared Components ──────────────────────────────────────────

function LoadingTable() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-12 text-center text-sm text-muted-foreground">{text}</div>
  );
}
