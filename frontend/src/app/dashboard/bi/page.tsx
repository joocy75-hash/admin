'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  DollarSign,
  Gamepad2,
  UserPlus,
  Clock,
  TrendingUp,
  TrendingDown,
  Inbox,
} from 'lucide-react';
import {
  useBiOverview,
  useRevenueSummary,
  useRevenueTrend,
  useUserRetention,
  useUserCohort,
  useGamePerformance,
  useAgentPerformance,
} from '@/hooks/use-bi';

// ─── Helpers ────────────────────────────────────────────────────

const fmt = Intl.NumberFormat('ko-KR');

const fmtMoney = (v: number | undefined | null): string => {
  if (v == null) return '0';
  return fmt.format(v);
};

const fmtPercent = (v: number | undefined | null): string => {
  if (v == null) return '0.0%';
  return `${v.toFixed(1)}%`;
};

const PERIOD_OPTIONS = [
  { key: 'today', label: '오늘' },
  { key: 'week', label: '이번주' },
  { key: 'month', label: '이번달' },
  { key: 'year', label: '올해' },
];

function ChangeIndicator({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  const isUp = change >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${isUp ? 'text-emerald-600' : 'text-red-600'}`}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
  });
}

// ─── KPI Cards Section ──────────────────────────────────────────

function KpiSection() {
  const { data, loading } = useBiOverview();

  const cards = [
    { label: '전체 회원', value: data?.total_users, icon: Users, color: 'text-blue-600' },
    { label: '오늘 활성', value: data?.active_today, icon: Activity, color: 'text-emerald-600' },
    { label: '오늘 입금', value: data?.deposits_today, icon: ArrowDownToLine, color: 'text-blue-600', isMoney: true },
    { label: '오늘 출금', value: data?.withdrawals_today, icon: ArrowUpFromLine, color: 'text-red-600', isMoney: true },
    { label: '오늘 순수익', value: data?.net_revenue_today, icon: DollarSign, color: 'text-emerald-600', isMoney: true },
    { label: '오늘 베팅', value: data?.bets_today, icon: Gamepad2, color: 'text-purple-600', isMoney: true },
    { label: '신규 가입', value: data?.new_registrations, icon: UserPlus, color: 'text-indigo-600' },
    { label: '출금 대기', value: data?.pending_withdrawals, icon: Clock, color: 'text-amber-600' },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {loading
        ? Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="py-4 px-5"><Skeleton className="h-14 w-full" /></CardContent></Card>
          ))
        : cards.map((c, i) => (
            <Card key={i}>
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <div className="relative">
                    <c.icon className={`h-4 w-4 ${c.color}`} />
                    <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  </div>
                </div>
                <p className={`text-2xl font-bold mt-1 ${c.color}`}>
                  {c.isMoney ? fmtMoney(c.value) : (c.value?.toLocaleString() ?? '0')}
                </p>
              </CardContent>
            </Card>
          ))}
    </div>
  );
}

// ─── Revenue Section ────────────────────────────────────────────

function RevenueSection() {
  const [period, setPeriod] = useState('today');
  const { data: summary, loading: summaryLoading } = useRevenueSummary(period);
  const { data: trend, loading: trendLoading } = useRevenueTrend(30);

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Revenue Summary */}
      <Card>
        <CardContent className="py-4 px-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">매출 요약</h3>
            <div className="flex gap-1">
              {PERIOD_OPTIONS.map((p) => (
                <Button
                  key={p.key}
                  variant={period === p.key ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => setPeriod(p.key)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          {summaryLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : summary ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">총 입금</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-blue-600">{fmtMoney(summary.total_deposits)}</span>
                  <ChangeIndicator current={summary.total_deposits} previous={summary.prev_deposits} />
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">총 출금</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-red-600">{fmtMoney(summary.total_withdrawals)}</span>
                  <ChangeIndicator current={summary.total_withdrawals} previous={summary.prev_withdrawals} />
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">순수익</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-emerald-600">{fmtMoney(summary.net_revenue)}</span>
                  <ChangeIndicator current={summary.net_revenue} previous={summary.prev_net_revenue} />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">데이터 없음</p>
          )}
        </CardContent>
      </Card>

      {/* Revenue Trend Table */}
      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          <h3 className="text-sm font-semibold">일별 매출 추이 (30일)</h3>
          {trendLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : trend.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Inbox className="h-6 w-6 opacity-30" />
              <p className="text-sm">데이터가 없습니다</p>
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">날짜</TableHead>
                    <TableHead className="text-xs text-right">입금</TableHead>
                    <TableHead className="text-xs text-right">출금</TableHead>
                    <TableHead className="text-xs text-right">순수익</TableHead>
                    <TableHead className="text-xs text-right">누적</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trend.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell className="text-xs tabular-nums">{formatDate(row.date)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-blue-600">{fmtMoney(row.deposits)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-red-600">{fmtMoney(row.withdrawals)}</TableCell>
                      <TableCell className={`text-xs text-right tabular-nums ${row.net_revenue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {fmtMoney(row.net_revenue)}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmtMoney(row.cumulative)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── User Analytics Section ─────────────────────────────────────

function UserAnalyticsSection() {
  const { data: retention, loading: retentionLoading } = useUserRetention();
  const { data: cohort, loading: cohortLoading } = useUserCohort();

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Retention */}
      <Card>
        <CardContent className="py-4 px-5 space-y-4">
          <h3 className="text-sm font-semibold">유저 리텐션</h3>
          {retentionLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : retention ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">신규 유저</span>
                <span className="text-sm font-semibold text-indigo-600">{fmtMoney(retention.new_users)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">활성 유저</span>
                <span className="text-sm font-semibold text-emerald-600">{fmtMoney(retention.active_users)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">전체 유저</span>
                <span className="text-sm font-semibold">{fmtMoney(retention.total_users)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">활성 비율</span>
                <span className="text-sm font-semibold text-blue-600">{fmtPercent(retention.active_rate)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">이탈률</span>
                <span className="text-sm font-semibold text-red-600">{fmtPercent(retention.churn_rate)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">데이터 없음</p>
          )}
        </CardContent>
      </Card>

      {/* Cohort Table */}
      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          <h3 className="text-sm font-semibold">코호트 분석</h3>
          {cohortLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : cohort.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Inbox className="h-6 w-6 opacity-30" />
              <p className="text-sm">데이터가 없습니다</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">가입월</TableHead>
                  <TableHead className="text-xs text-center">0개월</TableHead>
                  <TableHead className="text-xs text-center">1개월</TableHead>
                  <TableHead className="text-xs text-center">2개월</TableHead>
                  <TableHead className="text-xs text-center">3개월</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohort.map((row) => (
                  <TableRow key={row.cohort_month}>
                    <TableCell className="text-xs font-medium">{row.cohort_month}</TableCell>
                    <TableCell className="text-center">
                      <CohortCell value={row.month_0} />
                    </TableCell>
                    <TableCell className="text-center">
                      <CohortCell value={row.month_1} />
                    </TableCell>
                    <TableCell className="text-center">
                      <CohortCell value={row.month_2} />
                    </TableCell>
                    <TableCell className="text-center">
                      <CohortCell value={row.month_3} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CohortCell({ value }: { value: number }) {
  const bg =
    value >= 80 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
    : value >= 50 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    : value >= 20 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
    : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300';

  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${bg}`}>
      {fmtPercent(value)}
    </span>
  );
}

// ─── Performance Section ────────────────────────────────────────

function PerformanceSection() {
  const { data: games, loading: gamesLoading } = useGamePerformance();
  const { data: agents, loading: agentsLoading } = useAgentPerformance();

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Game Performance */}
      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          <h3 className="text-sm font-semibold">게임 성과 (Top 20)</h3>
          {gamesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : games.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Inbox className="h-6 w-6 opacity-30" />
              <p className="text-sm">데이터가 없습니다</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">게임</TableHead>
                    <TableHead className="text-xs text-right">총베팅</TableHead>
                    <TableHead className="text-xs text-right">총당첨</TableHead>
                    <TableHead className="text-xs text-right">RTP%</TableHead>
                    <TableHead className="text-xs text-right">플레이어수</TableHead>
                    <TableHead className="text-xs text-right">평균베팅</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {games.slice(0, 20).map((g, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium">{g.game_name}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmtMoney(g.total_bet)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmtMoney(g.total_win)}</TableCell>
                      <TableCell className={`text-xs text-right tabular-nums ${g.rtp > 100 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {fmtPercent(g.rtp)}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{g.player_count.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmtMoney(g.avg_bet)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Performance */}
      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          <h3 className="text-sm font-semibold">에이전트 성과 (Top 20)</h3>
          {agentsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Inbox className="h-6 w-6 opacity-30" />
              <p className="text-sm">데이터가 없습니다</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">에이전트</TableHead>
                    <TableHead className="text-xs text-right">하부수</TableHead>
                    <TableHead className="text-xs text-right">총입금</TableHead>
                    <TableHead className="text-xs text-right">총베팅</TableHead>
                    <TableHead className="text-xs text-right">커미션</TableHead>
                    <TableHead className="text-xs text-right">순수익</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.slice(0, 20).map((a, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium">{a.agent_name}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{a.sub_count.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-blue-600">{fmtMoney(a.total_deposit)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmtMoney(a.total_bet)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-purple-600">{fmtMoney(a.commission)}</TableCell>
                      <TableCell className={`text-xs text-right tabular-nums ${a.net_revenue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {fmtMoney(a.net_revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function BiPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">BI 대시보드</h2>
        <p className="text-sm text-muted-foreground mt-0.5">핵심 지표 및 비즈니스 인텔리전스 분석</p>
      </div>

      <KpiSection />
      <RevenueSection />
      <UserAnalyticsSection />
      <PerformanceSection />
    </div>
  );
}
