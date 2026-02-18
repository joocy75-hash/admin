'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  BarChart3,
  RefreshCw,
  AlertCircle,
  Inbox,
  ArrowUpDown,
} from 'lucide-react';
import {
  useRtpByGame,
  useRtpByProvider,
  useRtpTrend,
} from '@/hooks/use-analytics';

// ─── Constants ───────────────────────────────────────────────────

const PERIOD_FILTERS = [
  { key: 'today', label: '오늘', days: 0 },
  { key: '7d', label: '7일', days: 7 },
  { key: '30d', label: '30일', days: 30 },
  { key: 'custom', label: '커스텀', days: -1 },
];

function getDateRange(period: string): { start?: string; end?: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];

  if (period === 'today') {
    return { start: end, end };
  }
  if (period === '7d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return { start: d.toISOString().split('T')[0], end };
  }
  if (period === '30d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return { start: d.toISOString().split('T')[0], end };
  }
  return {};
}

function rtpColor(rtp: number): string {
  if (rtp < 97) return 'text-emerald-600 dark:text-emerald-400';
  if (rtp <= 100) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function rtpBadgeCls(rtp: number): string {
  if (rtp < 97) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300';
  if (rtp <= 100) return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300';
  return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
}

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

// ─── Main Page ───────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [tab, setTab] = useState<'game' | 'provider' | 'trend'>('game');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">분석 / RTP</h2>
          <p className="text-sm text-muted-foreground mt-0.5">게임별, 공급사별 RTP 분석</p>
        </div>
      </div>

      {/* Tab Buttons */}
      <div className="flex gap-2">
        <Button
          variant={tab === 'game' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('game')}
        >
          <BarChart3 className="mr-1 h-3.5 w-3.5" />게임별 RTP
        </Button>
        <Button
          variant={tab === 'provider' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('provider')}
        >
          <BarChart3 className="mr-1 h-3.5 w-3.5" />공급사별 RTP
        </Button>
        <Button
          variant={tab === 'trend' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('trend')}
        >
          <ArrowUpDown className="mr-1 h-3.5 w-3.5" />RTP 추이
        </Button>
      </div>

      {tab === 'game' && <GameRtpTab />}
      {tab === 'provider' && <ProviderRtpTab />}
      {tab === 'trend' && <TrendTab />}
    </div>
  );
}

// ─── Game RTP Tab ───────────────────────────────────────────────

function GameRtpTab() {
  const [period, setPeriod] = useState('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  const range = period === 'custom'
    ? { start: customStart || undefined, end: customEnd || undefined }
    : getDateRange(period);

  const { data, loading, error, refetch } = useRtpByGame(range.start, range.end);

  const sorted = useMemo(() => {
    if (!data?.items) return [];
    return [...data.items].sort((a, b) => sortAsc ? a.rtp - b.rtp : b.rtp - a.rtp);
  }, [data, sortAsc]);

  return (
    <>
      {/* Filters */}
      <Card>
        <CardContent className="py-3 px-5">
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-muted-foreground mr-1">기간:</span>
            {PERIOD_FILTERS.map((f) => (
              <Button
                key={f.key}
                variant={period === f.key ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setPeriod(f.key)}
              >
                {f.label}
              </Button>
            ))}
            {period === 'custom' && (
              <div className="flex items-center gap-2 ml-2">
                <Input
                  type="date"
                  className="h-7 text-xs w-[140px]"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">~</span>
                <Input
                  type="date"
                  className="h-7 text-xs w-[140px]"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            )}
            <Button variant="outline" size="sm" className="ml-auto h-7 text-xs" onClick={() => refetch()}>
              <RefreshCw className="mr-1 h-3 w-3" />새로고침
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>다시 시도</Button>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-30" />
              <p className="text-sm">데이터가 없습니다</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>게임명</TableHead>
                  <TableHead>공급사</TableHead>
                  <TableHead className="text-right">총 베팅</TableHead>
                  <TableHead className="text-right">총 당첨</TableHead>
                  <TableHead
                    className="text-center cursor-pointer select-none"
                    onClick={() => setSortAsc(!sortAsc)}
                  >
                    RTP% <ArrowUpDown className="inline h-3 w-3 ml-0.5" />
                  </TableHead>
                  <TableHead className="text-right">베팅 건수</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => (
                  <TableRow key={row.game_id}>
                    <TableCell className="font-medium">{row.game_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.provider_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row.total_bet)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row.total_win)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className={rtpBadgeCls(row.rtp)}>
                        {row.rtp.toFixed(2)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row.bet_count)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ─── Provider RTP Tab ───────────────────────────────────────────

function ProviderRtpTab() {
  const [period, setPeriod] = useState('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  const range = period === 'custom'
    ? { start: customStart || undefined, end: customEnd || undefined }
    : getDateRange(period);

  const { data, loading, error, refetch } = useRtpByProvider(range.start, range.end);

  const sorted = useMemo(() => {
    if (!data?.items) return [];
    return [...data.items].sort((a, b) => sortAsc ? a.rtp - b.rtp : b.rtp - a.rtp);
  }, [data, sortAsc]);

  return (
    <>
      {/* Filters */}
      <Card>
        <CardContent className="py-3 px-5">
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-muted-foreground mr-1">기간:</span>
            {PERIOD_FILTERS.map((f) => (
              <Button
                key={f.key}
                variant={period === f.key ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setPeriod(f.key)}
              >
                {f.label}
              </Button>
            ))}
            {period === 'custom' && (
              <div className="flex items-center gap-2 ml-2">
                <Input
                  type="date"
                  className="h-7 text-xs w-[140px]"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">~</span>
                <Input
                  type="date"
                  className="h-7 text-xs w-[140px]"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            )}
            <Button variant="outline" size="sm" className="ml-auto h-7 text-xs" onClick={() => refetch()}>
              <RefreshCw className="mr-1 h-3 w-3" />새로고침
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>다시 시도</Button>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-30" />
              <p className="text-sm">데이터가 없습니다</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>공급사명</TableHead>
                  <TableHead className="text-right">총 베팅</TableHead>
                  <TableHead className="text-right">총 당첨</TableHead>
                  <TableHead
                    className="text-center cursor-pointer select-none"
                    onClick={() => setSortAsc(!sortAsc)}
                  >
                    RTP% <ArrowUpDown className="inline h-3 w-3 ml-0.5" />
                  </TableHead>
                  <TableHead className="text-right">베팅 건수</TableHead>
                  <TableHead className="text-right">게임 수</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => (
                  <TableRow key={row.provider_id}>
                    <TableCell className="font-medium">{row.provider_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row.total_bet)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row.total_win)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className={rtpBadgeCls(row.rtp)}>
                        {row.rtp.toFixed(2)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row.bet_count)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row.game_count)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ─── Trend Tab ──────────────────────────────────────────────────

function TrendTab() {
  const [days, setDays] = useState(30);
  const { data, loading, error, refetch } = useRtpTrend(undefined, days);

  return (
    <>
      {/* Filters */}
      <Card>
        <CardContent className="py-3 px-5">
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-muted-foreground mr-1">기간:</span>
            {[7, 14, 30, 60].map((d) => (
              <Button
                key={d}
                variant={days === d ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setDays(d)}
              >
                {d}일
              </Button>
            ))}
            <Button variant="outline" size="sm" className="ml-auto h-7 text-xs" onClick={() => refetch()}>
              <RefreshCw className="mr-1 h-3 w-3" />새로고침
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>다시 시도</Button>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-30" />
              <p className="text-sm">데이터가 없습니다</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>날짜</TableHead>
                  <TableHead className="text-right">총 베팅</TableHead>
                  <TableHead className="text-right">총 당첨</TableHead>
                  <TableHead className="text-center">RTP%</TableHead>
                  <TableHead className="text-right">베팅 건수</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell className="font-medium tabular-nums">{row.date}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row.total_bet)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row.total_win)}</TableCell>
                    <TableCell className="text-center">
                      <span className={`font-medium ${rtpColor(row.rtp)}`}>
                        {row.rtp.toFixed(2)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row.bet_count)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
