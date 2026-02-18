'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useUnreadCount, useRecentNotifications, markAsRead } from '@/hooks/use-notifications';
import type { Notification } from '@/hooks/use-notifications';

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  normal: 'bg-blue-500',
  low: 'bg-gray-400',
};

const TYPE_LABELS: Record<string, string> = {
  transaction: '거래',
  user: '회원',
  system: '시스템',
  alert: '알림',
  settlement: '정산',
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { count, refetch: refetchCount } = useUnreadCount();
  const { items, refetch: refetchRecent } = useRecentNotifications();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
      refetchCount();
      refetchRecent();
    }
    setOpen(false);
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const handleViewAll = () => {
    setOpen(false);
    router.push('/dashboard/notifications');
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] rounded-lg border bg-popover shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">알림</h3>
            {count > 0 && (
              <span className="text-xs text-muted-foreground">
                읽지 않은 알림 {count}건
              </span>
            )}
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                알림이 없습니다
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b last:border-b-0 ${
                    !item.is_read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                  }`}
                >
                  <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[item.priority] || 'bg-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                        {TYPE_LABELS[item.type] || item.type}
                      </span>
                      <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>
                    <p className="text-sm font-medium mt-1 truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.content}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="border-t px-4 py-2">
            <button
              onClick={handleViewAll}
              className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:underline py-1"
            >
              전체 보기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
