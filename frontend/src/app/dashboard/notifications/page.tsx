'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Bell,
  AlertCircle,
  CheckCircle,
  Trash2,
  RefreshCw,
  Inbox,
} from 'lucide-react';
import { useNotifications, markAsRead, markAllAsRead, deleteNotification } from '@/hooks/use-notifications';
import { useToast } from '@/components/toast-provider';

// ─── Constants ───────────────────────────────────────────────────

const TYPE_TABS = [
  { key: '', label: '전체' },
  { key: 'transaction', label: '거래' },
  { key: 'user', label: '회원' },
  { key: 'system', label: '시스템' },
  { key: 'alert', label: '알림' },
  { key: 'settlement', label: '정산' },
];

const PRIORITY_STYLES: Record<string, { label: string; cls: string }> = {
  urgent: { label: '긴급', cls: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  high: { label: '높음', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  normal: { label: '보통', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  low: { label: '낮음', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

const TYPE_LABELS: Record<string, string> = {
  transaction: '거래',
  user: '회원',
  system: '시스템',
  alert: '알림',
  settlement: '정산',
};

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Page ────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const toast = useToast();

  const { data, loading, error, refetch } = useNotifications({
    page,
    page_size: 20,
    type: typeFilter || undefined,
  });

  const handleMarkAsRead = async (id: number) => {
    try {
      await markAsRead(id);
      toast.success('알림을 읽음 처리했습니다');
      refetch();
    } catch {
      toast.error('읽음 처리에 실패했습니다');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      toast.success('모든 알림을 읽음 처리했습니다');
      refetch();
    } catch {
      toast.error('읽음 처리에 실패했습니다');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteNotification(id);
      toast.success('알림을 삭제했습니다');
      refetch();
    } catch {
      toast.error('삭제에 실패했습니다');
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">알림 센터</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data ? (
              <>전체 <span className="font-semibold text-foreground">{data.total}</span>건 / 읽지 않음 <span className="font-semibold text-foreground">{data.unread_count}</span>건</>
            ) : '로딩 중...'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
            <CheckCircle className="mr-1 h-3.5 w-3.5" />모두 읽음
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />새로고침
          </Button>
        </div>
      </div>

      {/* Type Filter Tabs */}
      <Card>
        <CardContent className="py-3 px-5">
          <div className="flex gap-2 flex-wrap">
            {TYPE_TABS.map((tab) => (
              <Button
                key={tab.key}
                variant={typeFilter === tab.key ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setTypeFilter(tab.key); setPage(1); }}
              >
                {tab.label}
              </Button>
            ))}
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
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">유형</TableHead>
                    <TableHead>제목</TableHead>
                    <TableHead className="hidden md:table-cell">내용</TableHead>
                    <TableHead className="w-20 text-center">우선순위</TableHead>
                    <TableHead className="w-36">시간</TableHead>
                    <TableHead className="w-16 text-center">읽음</TableHead>
                    <TableHead className="w-24 text-center">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => {
                    const priority = PRIORITY_STYLES[item.priority];
                    return (
                      <TableRow
                        key={item.id}
                        className={!item.is_read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}
                      >
                        <TableCell>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted font-medium">
                            {TYPE_LABELS[item.type] || item.type}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {item.title}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground max-w-[300px] truncate">
                          {item.content}
                        </TableCell>
                        <TableCell className="text-center">
                          {priority ? (
                            <Badge variant="secondary" className={priority.cls}>
                              {priority.label}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">{item.priority}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground tabular-nums">
                          {formatDateTime(item.created_at)}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.is_read ? (
                            <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" />
                          ) : (
                            <Bell className="h-4 w-4 text-blue-500 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {!item.is_read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => handleMarkAsRead(item.id)}
                                title="읽음 처리"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                              onClick={() => handleDelete(item.id)}
                              title="삭제"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="border-t px-5 py-2.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {data.total}건 중 {(page - 1) * 20 + 1}~{Math.min(page * 20, data.total)}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline" size="sm" className="h-7 w-7 p-0"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      &lsaquo;
                    </Button>
                    <span className="px-2 text-sm">{page} / {totalPages}</span>
                    <Button
                      variant="outline" size="sm" className="h-7 w-7 p-0"
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      &rsaquo;
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
