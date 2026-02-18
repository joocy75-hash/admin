'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  Loader2,
  AlertCircle,
  Activity,
  Database,
  Server,
  Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useRealtimeStats,
  useLiveTransactions,
  useActiveAlerts,
  useSystemHealth,
} from '@/hooks/use-monitoring';
import type { LiveTransaction, ActiveAlert } from '@/hooks/use-monitoring';

// ─── Constants ───────────────────────────────────────────────────

const TX_TYPE_STYLES: Record<string, { label: string; cls: string }> = {
  deposit: { label: '입금', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
  withdrawal: { label: '출금', cls: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  bet: { label: '베팅', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  win: { label: '당첨', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  commission: { label: '커미션', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  transfer: { label: '이체', cls: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
};

const SEVERITY_STYLES: Record<string, { cls: string }> = {
  critical: { cls: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  high: { cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  medium: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  low: { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
};

const HEALTH_STYLES: Record<string, { label: string; dot: string; text: string }> = {
  ok: { label: '정상', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  degraded: { label: '저하', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  down: { label: '중단', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
};

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

// ─── Page ────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const { data: stats, loading: statsLoading, fetching: statsFetching } = useRealtimeStats();
  const { items: transactions, loading: txLoading, fetching: txFetching } = useLiveTransactions();
  const { data: alerts, loading: alertsLoading } = useActiveAlerts();
  const { data: health, loading: healthLoading } = useSystemHealth();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">실시간 모니터링</h2>
          <p className="text-sm text-muted-foreground mt-0.5">시스템 상태 및 실시간 데이터</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {(statsFetching || txFetching) && (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          )}
          <span>자동 갱신 중</span>
        </div>
      </div>

      {/* Realtime Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="py-4 px-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="py-4 px-5 flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">현재 접속자</p>
                  <p className="text-2xl font-bold">{stats?.online_users?.toLocaleString() ?? '0'}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 px-5 flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950">
                  <ArrowDownCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">대기중 입금</p>
                  <p className="text-2xl font-bold">{stats?.pending_deposits?.toLocaleString() ?? '0'}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 px-5 flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950">
                  <ArrowUpCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">대기중 출금</p>
                  <p className="text-2xl font-bold">{stats?.pending_withdrawals?.toLocaleString() ?? '0'}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 px-5 flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">오늘 수익</p>
                  <p className="text-2xl font-bold">{stats?.today_profit?.toLocaleString() ?? '0'} <span className="text-sm font-normal text-muted-foreground">USDT</span></p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Two-column layout: Live Transactions + Alerts & Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Live Transactions - 2 cols */}
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4" />
                실시간 거래 내역
                {txFetching && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
              </h3>
              <span className="text-xs text-muted-foreground">최근 20건</span>
            </div>
            <div className="max-h-[480px] overflow-y-auto">
              {txLoading ? (
                <div className="p-5 space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                  <Inbox className="h-8 w-8 opacity-30" />
                  <p className="text-sm">데이터가 없습니다</p>
                </div>
              ) : (
                <div className="divide-y">
                  {transactions.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right column: Alerts + Health */}
        <div className="space-y-4">
          {/* Active Alerts */}
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-5 py-3 border-b">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  활성 알림
                </h3>
                {alerts && (
                  <Badge variant="destructive">{alerts.total}</Badge>
                )}
              </div>
              <div className="max-h-[260px] overflow-y-auto">
                {alertsLoading ? (
                  <div className="p-5 space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : !alerts || alerts.items.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                    <Inbox className="h-6 w-6 opacity-30" />
                    <p className="text-xs">활성 알림 없음</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {alerts.items.slice(0, 5).map((alert) => (
                      <AlertRow key={alert.id} alert={alert} />
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* System Health */}
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-5 py-3 border-b">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  시스템 상태
                </h3>
              </div>
              {healthLoading ? (
                <div className="p-5 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : !health ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <AlertCircle className="h-6 w-6 opacity-30" />
                  <p className="text-xs">상태 확인 불가</p>
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => window.location.reload()}>다시 시도</Button>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  <HealthItem label="Database" status={health.database} icon={Database} />
                  <HealthItem label="Redis" status={health.redis} icon={Server} />
                  <HealthItem label="API Server" status={health.api} icon={Activity} />
                  <p className="text-[11px] text-muted-foreground text-right mt-2">
                    마지막 확인: {formatTime(health.last_checked)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Sub Components ──────────────────────────────────────────────

function TransactionRow({ tx }: { tx: LiveTransaction }) {
  const style = TX_TYPE_STYLES[tx.type];
  return (
    <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/30 transition-colors">
      <Badge variant="secondary" className={`text-[10px] px-1.5 ${style?.cls || 'bg-gray-100 text-gray-700'}`}>
        {style?.label || tx.type}
      </Badge>
      <span className="text-sm font-medium min-w-[80px]">{tx.username}</span>
      <span className={`text-sm font-mono tabular-nums ml-auto ${
        tx.type === 'deposit' || tx.type === 'win' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
      }`}>
        {tx.type === 'deposit' || tx.type === 'win' ? '+' : ''}{tx.amount.toLocaleString()}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums w-20 text-right shrink-0">
        {formatRelativeTime(tx.created_at)}
      </span>
    </div>
  );
}

function AlertRow({ alert }: { alert: ActiveAlert }) {
  const sev = SEVERITY_STYLES[alert.severity];
  return (
    <div className="px-4 py-2.5 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2 mb-0.5">
        <Badge variant="secondary" className={`text-[10px] px-1.5 ${sev?.cls || ''}`}>
          {alert.severity}
        </Badge>
        <span className="text-xs font-medium">{alert.username}</span>
        <span className="text-[11px] text-muted-foreground ml-auto">{formatRelativeTime(alert.created_at)}</span>
      </div>
      <p className="text-xs text-muted-foreground truncate">{alert.description}</p>
    </div>
  );
}

function HealthItem({ label, status, icon: Icon }: { label: string; status: string; icon: typeof Database }) {
  const style = HEALTH_STYLES[status] || HEALTH_STYLES.down;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${style.dot}`} />
        <span className={`text-xs font-medium ${style.text}`}>{style.label}</span>
      </div>
    </div>
  );
}
