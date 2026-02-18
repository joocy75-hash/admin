'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserBets } from '@/hooks/use-user-detail';
import { Dices } from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  casino: '카지노', slot: '슬롯', holdem: '홀덤', sports: '스포츠',
  shooting: '슈팅', coin: '코인', minigame: '미니게임',
};
const STATUS_LABELS: Record<string, string> = {
  pending: '대기', settled: '정산', cancelled: '취소', win: '당첨', lose: '낙첨',
};

const PERIOD_PRESETS = [
  { label: '오늘', days: 0 },
  { label: '어제', days: 1 },
  { label: '7일', days: 7 },
  { label: '30일', days: 30 },
];

function formatKRW(n: number) { return '\u20A9' + Number(n).toLocaleString('ko-KR'); }
function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }

type Props = { userId: number };

export default function TabBetting({ userId }: Props) {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, loading } = useUserBets(userId, {
    page,
    page_size: 20,
    game_category: category || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const applyPreset = (days: number) => {
    const now = new Date();
    if (days === 0) {
      setDateFrom(toDateStr(now));
      setDateTo(toDateStr(now));
    } else if (days === 1) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      setDateFrom(toDateStr(yesterday));
      setDateTo(toDateStr(yesterday));
    } else {
      const from = new Date(now);
      from.setDate(from.getDate() - days);
      setDateFrom(toDateStr(from));
      setDateTo(toDateStr(now));
    }
    setPage(1);
  };

  const summary = data?.summary;
  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900"><CardContent className="pt-6">
            <p className="text-xs text-blue-600 dark:text-blue-400">총 베팅</p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{formatKRW(summary.total_bet)}</p>
          </CardContent></Card>
          <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900"><CardContent className="pt-6">
            <p className="text-xs text-green-600 dark:text-green-400">총 당첨액</p>
            <p className="text-xl font-bold text-green-700 dark:text-green-300">{formatKRW(summary.total_win)}</p>
          </CardContent></Card>
          <Card className={`${summary.net_profit >= 0 ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900'}`}><CardContent className="pt-6">
            <p className={`text-xs ${summary.net_profit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>손익</p>
            <p className={`text-xl font-bold ${summary.net_profit >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`}>
              {formatKRW(summary.net_profit)}
            </p>
          </CardContent></Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="border rounded-md px-3 py-1.5 text-sm bg-background"
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            >
              <option value="">전체 게임</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {PERIOD_PRESETS.map((p) => (
              <Button key={p.label} variant="outline" size="sm" onClick={() => applyPreset(p.days)}>{p.label}</Button>
            ))}
            <Input type="date" className="w-36 h-8 text-sm" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
            <span className="text-muted-foreground">~</span>
            <Input type="date" className="w-36 h-8 text-sm" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
            {(category || dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setCategory(''); setDateFrom(''); setDateTo(''); setPage(1); }}>초기화</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data?.items.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Dices className="h-10 w-10 mb-3" />
              <p className="text-base font-medium">베팅 내역이 없습니다</p>
              <p className="text-sm">조건을 변경해주세요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left">게임</th>
                    <th className="px-4 py-2 text-left">제공사</th>
                    <th className="px-4 py-2 text-left">게임명</th>
                    <th className="px-4 py-2 text-right">베팅금</th>
                    <th className="px-4 py-2 text-right">당첨금</th>
                    <th className="px-4 py-2 text-right">손익</th>
                    <th className="px-4 py-2 text-center">상태</th>
                    <th className="px-4 py-2 text-left">시간</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.items.map((bet) => (
                    <tr key={bet.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2">{CATEGORY_LABELS[bet.game_category] || bet.game_category}</td>
                      <td className="px-4 py-2 text-muted-foreground">{bet.provider || '-'}</td>
                      <td className="px-4 py-2">{bet.game_name || '-'}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatKRW(bet.bet_amount)}</td>
                      <td className="px-4 py-2 text-right font-mono text-blue-600">{formatKRW(bet.win_amount)}</td>
                      <td className={`px-4 py-2 text-right font-mono ${bet.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatKRW(bet.profit)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Badge variant="secondary" className="text-xs">
                          {STATUS_LABELS[bet.status] || bet.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(bet.bet_at).toLocaleString('ko-KR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>이전</Button>
          <span className="flex items-center text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>다음</Button>
        </div>
      )}
    </div>
  );
}
