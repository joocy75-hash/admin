'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePartnerDashboard, usePartnerCommissions } from '@/hooks/use-partner';
import { useAuthStore } from '@/stores/auth-store';
import { Users, Network, TrendingUp, Percent, Calculator, Gamepad2 } from 'lucide-react';

function formatKRW(amount: number): string {
  return '\u20A9' + amount.toLocaleString('ko-KR');
}

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
  rolling: '롤링',
  losing: '죽장',
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

export default function PartnerDashboardPage() {
  const { user } = useAuthStore();
  const { data: stats, loading: statsLoading } = usePartnerDashboard();
  const { data: commissions, loading: commLoading } = usePartnerCommissions({ page_size: 5 });

  const statCards = stats ? [
    { title: '하위 유저수', value: String(stats.total_sub_users), icon: Users, color: 'text-blue-500' },
    { title: '하위 에이전트', value: String(stats.total_sub_agents), icon: Network, color: 'text-green-500' },
    { title: '총 베팅', value: formatKRW(stats.total_bet_amount), icon: Gamepad2, color: 'text-purple-500' },
    { title: '총 커미션', value: formatKRW(stats.total_commission), icon: Percent, color: 'text-orange-500' },
    { title: '이번달 정산', value: formatKRW(stats.month_settlement), icon: Calculator, color: 'text-emerald-500' },
    { title: '이번달 베팅', value: formatKRW(stats.month_bet_amount), icon: TrendingUp, color: 'text-indigo-500' },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">파트너 대시보드</h2>
        <p className="text-muted-foreground">
          {user?.username}님의 파트너 현황입니다.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
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

      {/* Quick Links + Recent Commissions */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">빠른 링크</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/dashboard/partner/users"
              className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Users className="h-4 w-4 text-blue-500" />
              <span>하위 유저 관리</span>
            </Link>
            <Link
              href="/dashboard/partner/commissions"
              className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Percent className="h-4 w-4 text-orange-500" />
              <span>커미션 내역</span>
            </Link>
            <Link
              href="/dashboard/partner/settlements"
              className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Calculator className="h-4 w-4 text-emerald-500" />
              <span>정산 내역</span>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Commissions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">최근 커미션</CardTitle>
            <Link href="/dashboard/partner/commissions" className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">
              전체보기
            </Link>
          </CardHeader>
          <CardContent>
            {commLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                ))}
              </div>
            ) : !commissions?.items.length ? (
              <p className="text-sm text-muted-foreground">커미션 내역이 없습니다</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">타입</th>
                      <th className="pb-2 font-medium text-right">원금</th>
                      <th className="pb-2 font-medium text-right">커미션</th>
                      <th className="pb-2 font-medium text-right">시간</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {commissions.items.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            c.type === 'rolling'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                          }`}>
                            {TYPE_LABELS[c.type] || c.type}
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono text-xs">{formatKRW(c.source_amount)}</td>
                        <td className="py-2 text-right font-mono">{formatKRW(c.commission_amount)}</td>
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
