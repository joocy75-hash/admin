'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserInquiries, replyToInquiry, type Inquiry } from '@/hooks/use-user-detail';
import { useToast } from '@/components/toast-provider';
import { MessageSquare } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  pending: '미답변', answered: '답변완료', closed: '종료',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  answered: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-100 text-gray-800',
};

const PERIOD_PRESETS = [
  { label: '오늘', days: 0 },
  { label: '7일', days: 7 },
  { label: '30일', days: 30 },
];

function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }

type Props = { userId: number };

export default function TabInquiries({ userId }: Props) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replying, setReplying] = useState(false);

  const { data, loading, refetch } = useUserInquiries(userId, {
    page,
    page_size: 20,
    status: statusFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const applyPreset = (days: number) => {
    const now = new Date();
    if (days === 0) {
      setDateFrom(toDateStr(now));
      setDateTo(toDateStr(now));
    } else {
      const from = new Date(now);
      from.setDate(from.getDate() - days);
      setDateFrom(toDateStr(from));
      setDateTo(toDateStr(now));
    }
    setPage(1);
  };

  const handleReply = async () => {
    if (!selected || !replyContent.trim()) return;
    setReplying(true);
    try {
      await replyToInquiry(userId, selected.id, replyContent);
      setReplyContent('');
      setSelected(null);
      refetch();
    } catch { toast.error('답변 등록 실패'); }
    finally { setReplying(false); }
  };

  const summary = data?.summary;
  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900"><CardContent className="pt-6">
            <p className="text-xs text-blue-600 dark:text-blue-400">전체 건수</p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{summary.total_count}</p>
          </CardContent></Card>
          <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"><CardContent className="pt-6">
            <p className="text-xs text-red-600 dark:text-red-400">미답변</p>
            <p className="text-xl font-bold text-red-700 dark:text-red-300">{summary.pending_count}</p>
          </CardContent></Card>
          <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900"><CardContent className="pt-6">
            <p className="text-xs text-green-600 dark:text-green-400">답변완료</p>
            <p className="text-xl font-bold text-green-700 dark:text-green-300">{summary.answered_count}</p>
          </CardContent></Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="border rounded-md px-3 py-1.5 text-sm bg-background"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">전체 상태</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {PERIOD_PRESETS.map((p) => (
              <Button key={p.label} variant="outline" size="sm" onClick={() => applyPreset(p.days)}>{p.label}</Button>
            ))}
            <Input type="date" className="w-36 h-8 text-sm" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
            <span className="text-muted-foreground">~</span>
            <Input type="date" className="w-36 h-8 text-sm" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          </div>
        </CardContent>
      </Card>

      {/* Detail View */}
      {selected && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{selected.title}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>닫기</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-sm whitespace-pre-wrap">{selected.content}</p>
              <p className="text-xs text-muted-foreground mt-2">{new Date(selected.created_at).toLocaleString('ko-KR')}</p>
            </div>
            {selected.replies.length > 0 && (
              <div className="space-y-2">
                {selected.replies.map((r) => (
                  <div key={r.id} className="p-3 rounded-lg border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950">
                    <p className="text-sm whitespace-pre-wrap">{r.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">관리자 · {new Date(r.created_at).toLocaleString('ko-KR')}</p>
                  </div>
                ))}
              </div>
            )}
            {selected.status !== 'closed' && (
              <div className="space-y-2">
                <textarea
                  className="w-full min-h-[80px] rounded-md border px-3 py-2 text-sm bg-background"
                  placeholder="답변을 입력하세요..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                />
                <Button size="sm" onClick={handleReply} disabled={replying || !replyContent.trim()}>
                  {replying ? '등록 중...' : '답변 등록'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
              <MessageSquare className="h-10 w-10 mb-3" />
              <p className="text-base font-medium">문의 내역이 없습니다</p>
              <p className="text-sm">조건을 변경해주세요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left">제목</th>
                    <th className="px-4 py-2 text-center">상태</th>
                    <th className="px-4 py-2 text-left">등록일</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.items.map((inq) => (
                    <tr
                      key={inq.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => setSelected(inq)}
                    >
                      <td className="px-4 py-2 font-medium">{inq.title}</td>
                      <td className="px-4 py-2 text-center">
                        <Badge className={STATUS_COLORS[inq.status] || ''} variant="secondary">
                          {STATUS_LABELS[inq.status] || inq.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(inq.created_at).toLocaleString('ko-KR')}</td>
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
