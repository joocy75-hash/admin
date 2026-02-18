'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { LucideIcon } from 'lucide-react';
import { formatAmount } from '@/lib/utils';
import DateRangeFilter from '@/components/date-range-filter';

type SummaryItem = {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'red' | 'purple';
};

type LogItem = {
  id: number;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  created_at: string;
};

type LogData = {
  items: LogItem[];
  total: number;
  page_size: number;
  summary: Record<string, number>;
};

type LogListProps = {
  typeLabels: Record<string, string>;
  summaryItems: (summary: Record<string, number>) => SummaryItem[];
  columnLabels: { amount: string; before: string; after: string };
  emptyIcon: LucideIcon;
  emptyMessage: string;
  useFetch: (userId: number, params: Record<string, unknown>) => { data: LogData | null; loading: boolean };
  userId: number;
};

const COLOR_MAP = {
  blue: {
    card: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900',
    label: 'text-blue-600 dark:text-blue-400',
    value: 'text-blue-700 dark:text-blue-300',
  },
  green: {
    card: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900',
    label: 'text-green-600 dark:text-green-400',
    value: 'text-green-700 dark:text-green-300',
  },
  red: {
    card: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900',
    label: 'text-red-600 dark:text-red-400',
    value: 'text-red-700 dark:text-red-300',
  },
  purple: {
    card: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900',
    label: 'text-purple-600 dark:text-purple-400',
    value: 'text-purple-700 dark:text-purple-300',
  },
} as const;

export default function LogList({
  typeLabels,
  summaryItems,
  columnLabels,
  emptyIcon: EmptyIcon,
  emptyMessage,
  useFetch,
  userId,
}: LogListProps) {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, loading } = useFetch(userId, {
    page,
    page_size: 20,
    type: type || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const summary = data?.summary;
  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;
  const items = summaryItems(summary || {});

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          {items.map((item) => {
            const c = COLOR_MAP[item.color];
            return (
              <Card key={item.label} className={c.card}><CardContent className="pt-6">
                <p className={`text-xs ${c.label}`}>{item.label}</p>
                <p className={`text-xl font-bold ${c.value}`}>{formatAmount(item.value)}</p>
              </CardContent></Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="border rounded-md px-3 py-1.5 text-sm bg-background"
              value={type}
              onChange={(e) => { setType(e.target.value); setPage(1); }}
            >
              <option value="">전체 유형</option>
              {Object.entries(typeLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <DateRangeFilter
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={(v) => { setDateFrom(v); setPage(1); }}
              onDateToChange={(v) => { setDateTo(v); setPage(1); }}
            />
            {(type || dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setType(''); setDateFrom(''); setDateTo(''); setPage(1); }}>초기화</Button>
            )}
          </div>
        </CardContent>
      </Card>

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
              <EmptyIcon className="h-10 w-10 mb-3" />
              <p className="text-base font-medium">{emptyMessage}</p>
              <p className="text-sm">조건을 변경해주세요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left">유형</th>
                    <th className="px-4 py-2 text-right">{columnLabels.amount}</th>
                    <th className="px-4 py-2 text-right">{columnLabels.before}</th>
                    <th className="px-4 py-2 text-right">{columnLabels.after}</th>
                    <th className="px-4 py-2 text-left">설명</th>
                    <th className="px-4 py-2 text-left">일시</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.items.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <Badge variant="secondary" className="text-xs">
                          {typeLabels[log.type] || log.type}
                        </Badge>
                      </td>
                      <td className={`px-4 py-2 text-right font-mono ${log.amount >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {log.amount >= 0 ? '+' : ''}{formatAmount(log.amount)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-muted-foreground">{formatAmount(log.balance_before)}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatAmount(log.balance_after)}</td>
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
