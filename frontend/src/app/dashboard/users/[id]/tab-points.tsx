'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUserPointLogs } from '@/hooks/use-user-detail';

const TYPE_LABELS: Record<string, string> = {
  grant: '지급', revoke: '회수', rolling: '롤링', losing: '루징',
  convert: '전환', attendance: '출석', event: '이벤트', usage: '사용',
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

export default function TabPoints({ userId }: Props) {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, loading } = useUserPointLogs(userId, {
    page,
    page_size: 20,
    type: type || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const applyPreset = (days: number) => {
    const now = new Date();
    if (days === 0) {
      setDateFrom(toDateStr(now));
      setDateTo(toDateStr(now));
    } else if (days === 1) {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      setDateFrom(toDateStr(d));
      setDateTo(toDateStr(d));
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
          <Card><CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">현재 포인트</p>
            <p className="text-xl font-bold text-blue-600">{formatKRW(summary.current_points)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">총 지급 (+)</p>
            <p className="text-xl font-bold text-blue-600">{formatKRW(summary.total_credit)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">총 회수/사용 (-)</p>
            <p className="text-xl font-bold text-red-600">{formatKRW(summary.total_debit)}</p>
          </CardContent></Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="border rounded-md px-3 py-1.5 text-sm bg-background"
              value={type}
              onChange={(e) => { setType(e.target.value); setPage(1); }}
            >
              <option value="">전체 유형</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {PERIOD_PRESETS.map((p) => (
              <Button key={p.label} variant="outline" size="sm" onClick={() => applyPreset(p.days)}>{p.label}</Button>
            ))}
            <Input type="date" className="w-36 h-8 text-sm" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
            <span className="text-muted-foreground">~</span>
            <Input type="date" className="w-36 h-8 text-sm" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
            {(type || dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setType(''); setDateFrom(''); setDateTo(''); setPage(1); }}>초기화</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">로딩 중...</div>
          ) : !data?.items.length ? (
            <div className="p-8 text-center text-muted-foreground">포인트 변동 내역이 없습니다</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left">유형</th>
                    <th className="px-4 py-2 text-right">포인트</th>
                    <th className="px-4 py-2 text-right">전 포인트</th>
                    <th className="px-4 py-2 text-right">후 포인트</th>
                    <th className="px-4 py-2 text-left">설명</th>
                    <th className="px-4 py-2 text-left">일시</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.items.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <Badge variant="secondary" className="text-xs">
                          {TYPE_LABELS[log.type] || log.type}
                        </Badge>
                      </td>
                      <td className={`px-4 py-2 text-right font-mono ${log.amount >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {log.amount >= 0 ? '+' : ''}{formatKRW(log.amount)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-muted-foreground">{formatKRW(log.balance_before)}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatKRW(log.balance_after)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{log.description || '-'}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString('ko-KR')}</td>
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
