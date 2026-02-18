'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { useDashboardStats, useRecentTransactions, useRecentCommissions } from '@/hooks/use-dashboard';
import { Users, Network, Wallet, Gamepad2, Percent, TrendingUp, TrendingDown, Activity, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { formatAmount } from '@/lib/utils';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

const TYPE_LABELS: Record<string, string> = {
  deposit: '입금',
  withdrawal: '출금',
  adjustment: '조정',
  rolling: '롤링',
  losing: '죽장',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  approved: '승인',
  rejected: '거부',
  completed: '완료',
};

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </CardHeader>
      <CardContent>
        <div className="h-7 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </CardContent>
    </Card>
  );
}

function SkeletonTable() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data: stats, loading: statsLoading, error: statsError } = useDashboardStats();
  const { data: transactions, loading: txLoading } = useRecentTransactions();
  const { data: commissions, loading: commLoading } = useRecentCommissions();

  const statCards = stats ? [
    { title: '총 에이전트', value: String(stats.total_agents), icon: Network, color: 'text-blue-500' },
    { title: '총 회원수', value: String(stats.total_users), icon: Users, color: 'text-green-500' },
    { title: '오늘 입금', value: formatAmount(stats.today_deposits), icon: TrendingUp, color: 'text-emerald-500' },
    { title: '오늘 출금', value: formatAmount(stats.today_withdrawals), icon: TrendingDown, color: 'text-red-500' },
    { title: '오늘 베팅', value: formatAmount(stats.today_bets), icon: Gamepad2, color: 'text-purple-500' },
    { title: '오늘 커미션', value: formatAmount(stats.today_commissions), icon: Percent, color: 'text-orange-500' },
    { title: '보유 잔액', value: formatAmount(stats.total_balance), icon: Wallet, color: 'text-indigo-500' },
    { title: '활성 게임', value: String(stats.active_games), icon: Activity, color: 'text-pink-500' },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">대시보드</h2>
        <p className="text-muted-foreground">
          안녕하세요, {user?.username}님. 오늘의 현황입니다.
        </p>
      </div>

      {statsError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            데이터를 불러오는 중 오류가 발생했습니다: {statsError}
          </p>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          statCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pending Badges */}
      {stats && (stats.pending_deposits > 0 || stats.pending_withdrawals > 0) && (
        <div className="flex gap-4">
          {stats.pending_deposits > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              <ArrowDownCircle className="h-4 w-4" />
              대기중 입금: {stats.pending_deposits}건
            </span>
          )}
          {stats.pending_withdrawals > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-200">
              <ArrowUpCircle className="h-4 w-4" />
              대기중 출금: {stats.pending_withdrawals}건
            </span>
          )}
        </div>
      )}

      {/* Recent Tables */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 입출금</CardTitle>
          </CardHeader>
          <CardContent>
            {txLoading ? (
              <SkeletonTable />
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">최근 입출금 내역이 없습니다</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">유저</th>
                      <th className="pb-2 font-medium">유형</th>
                      <th className="pb-2 font-medium text-right">금액</th>
                      <th className="pb-2 font-medium">상태</th>
                      <th className="pb-2 font-medium text-right">시간</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-2 font-medium">{tx.user_username || '-'}</td>
                        <td className="py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            tx.type === 'deposit'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                              : tx.type === 'withdrawal'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {TYPE_LABELS[tx.type] || tx.type}
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono">{formatAmount(tx.amount)}</td>
                        <td className="py-2">
                          <span className={`text-xs ${
                            tx.status === 'approved' || tx.status === 'completed'
                              ? 'text-green-600 dark:text-green-400'
                              : tx.status === 'pending'
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {STATUS_LABELS[tx.status] || tx.status}
                          </span>
                        </td>
                        <td className="py-2 text-right text-xs text-muted-foreground">{timeAgo(tx.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Commissions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 커미션</CardTitle>
          </CardHeader>
          <CardContent>
            {commLoading ? (
              <SkeletonTable />
            ) : commissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">최근 커미션 내역이 없습니다</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">에이전트</th>
                      <th className="pb-2 font-medium">타입</th>
                      <th className="pb-2 font-medium text-right">금액</th>
                      <th className="pb-2 font-medium text-right">시간</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {commissions.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-2 font-medium">{c.agent_username || '-'}</td>
                        <td className="py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            c.type === 'rolling'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                          }`}>
                            {TYPE_LABELS[c.type] || c.type}
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono">{formatAmount(c.commission_amount)}</td>
                        <td className="py-2 text-right text-xs text-muted-foreground">{timeAgo(c.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
