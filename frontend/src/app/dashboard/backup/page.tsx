'use client';

import { useState, useEffect } from 'react';
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
  Database,
  Plus,
  RefreshCw,
  Save,
  Loader2,
  Inbox,
  AlertCircle,
} from 'lucide-react';
import {
  useBackupList,
  useBackupSettings,
  createBackup,
  updateBackupSettings,
} from '@/hooks/use-backup';
import type { BackupSettings } from '@/hooks/use-backup';
import { useToast } from '@/components/toast-provider';

// ─── Constants ───────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  completed: { label: '완료', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
  in_progress: { label: '진행중', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  failed: { label: '실패', cls: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
};

const SCHEDULE_OPTIONS = [
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
  { value: 'monthly', label: '매월' },
];

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Settings Section ───────────────────────────────────────────

function SettingsSection() {
  const { data: settings, loading, refetch } = useBackupSettings();
  const [autoBackup, setAutoBackup] = useState(false);
  const [schedule, setSchedule] = useState<string>('daily');
  const [retentionDays, setRetentionDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (settings) {
      setAutoBackup(settings.auto_backup);
      setSchedule(settings.schedule);
      setRetentionDays(settings.retention_days);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateBackupSettings({
        auto_backup: autoBackup,
        schedule: schedule as BackupSettings['schedule'],
        retention_days: retentionDays,
      });
      toast.success('설정을 저장했습니다');
      refetch();
    } catch {
      toast.error('설정 저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4 px-5">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-4 px-5 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">백업 설정</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">자동 백업</label>
            <Button
              variant={autoBackup ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoBackup(!autoBackup)}
            >
              {autoBackup ? 'ON' : 'OFF'}
            </Button>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">스케줄</label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
            >
              {SCHEDULE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">보관 기간 (일)</label>
            <Input
              type="number"
              min={1}
              max={365}
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">백업 경로</label>
            <p className="text-sm text-muted-foreground py-2 px-3 bg-muted rounded-md font-mono">
              {settings?.backup_path ?? '/var/backups/db'}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            {saving ? '저장 중...' : '설정 저장'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Backup List Section ────────────────────────────────────────

function BackupListSection() {
  const { data, loading, error, refetch } = useBackupList();
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createBackup();
      toast.success('백업이 생성되었습니다');
      refetch();
    } catch {
      toast.error('백업 생성에 실패했습니다');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="text-sm font-semibold">백업 목록</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => refetch()}>
              <RefreshCw className="mr-1 h-3 w-3" />새로고침
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
              {creating ? '생성 중...' : '새 백업 생성'}
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
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
            <p className="text-sm">백업 파일이 없습니다</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>파일명</TableHead>
                <TableHead className="text-right">크기</TableHead>
                <TableHead>생성일시</TableHead>
                <TableHead className="text-center">상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => {
                const st = STATUS_STYLES[item.status];
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.filename}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums text-muted-foreground">
                      {formatSize(item.size)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {formatDateTime(item.created_at)}
                    </TableCell>
                    <TableCell className="text-center">
                      {st ? (
                        <Badge variant="secondary" className={st.cls}>{st.label}</Badge>
                      ) : (
                        <span className="text-xs">{item.status}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function BackupPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">백업 관리</h2>
        <p className="text-sm text-muted-foreground mt-0.5">데이터베이스 백업 설정 및 관리</p>
      </div>

      <SettingsSection />
      <BackupListSection />
    </div>
  );
}
