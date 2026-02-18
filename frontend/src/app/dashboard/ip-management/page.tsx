'use client';

import { useState } from 'react';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Globe,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  RefreshCw,
  AlertCircle,
  Inbox,
  ListPlus,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import {
  useIpRestrictions,
  useIpStats,
  createIpRestriction,
  updateIpRestriction,
  deleteIpRestriction,
  toggleIpRestriction,
  checkIp,
  bulkAddIps,
} from '@/hooks/use-ip-management';
import type { IpRestriction, IpCheckResult } from '@/hooks/use-ip-management';
import { useToast } from '@/components/toast-provider';

// ─── Constants ───────────────────────────────────────────────────

const TYPE_FILTERS = [
  { key: '', label: '전체' },
  { key: 'whitelist', label: '화이트리스트' },
  { key: 'blacklist', label: '블랙리스트' },
];

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Add IP Dialog ──────────────────────────────────────────────

function AddIpDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [ipAddress, setIpAddress] = useState('');
  const [type, setType] = useState<'whitelist' | 'blacklist'>('whitelist');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const handleSubmit = async () => {
    if (!ipAddress.trim()) return;
    setSubmitting(true);
    try {
      await createIpRestriction({
        ip_address: ipAddress.trim(),
        type,
        description: description.trim() || undefined,
      });
      toast.success('IP를 등록했습니다');
      setIpAddress('');
      setDescription('');
      onSuccess();
      onClose();
    } catch {
      toast.error('IP 등록에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>IP 등록</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">유형</label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={type}
              onChange={(e) => setType(e.target.value as 'whitelist' | 'blacklist')}
            >
              <option value="whitelist">화이트리스트</option>
              <option value="blacklist">블랙리스트</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">IP 주소</label>
            <Input
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="192.168.1.1 또는 192.168.1.0/24"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">설명</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="IP 등록 사유"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSubmit} disabled={submitting || !ipAddress.trim()}>
            {submitting ? '처리 중...' : '등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit IP Dialog ─────────────────────────────────────────────

function EditIpDialog({
  restriction,
  open,
  onClose,
  onSuccess,
}: {
  restriction: IpRestriction;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [ipAddress, setIpAddress] = useState(restriction.ip_address);
  const [type, setType] = useState(restriction.type);
  const [description, setDescription] = useState(restriction.description || '');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const handleSubmit = async () => {
    if (!ipAddress.trim()) return;
    setSubmitting(true);
    try {
      await updateIpRestriction(restriction.id, {
        ip_address: ipAddress.trim(),
        type,
        description: description.trim() || undefined,
      });
      toast.success('IP 정보를 수정했습니다');
      onSuccess();
      onClose();
    } catch {
      toast.error('수정에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>IP 수정</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">유형</label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={type}
              onChange={(e) => setType(e.target.value as 'whitelist' | 'blacklist')}
            >
              <option value="whitelist">화이트리스트</option>
              <option value="blacklist">블랙리스트</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">IP 주소</label>
            <Input
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">설명</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSubmit} disabled={submitting || !ipAddress.trim()}>
            {submitting ? '처리 중...' : '수정'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bulk Add Dialog ────────────────────────────────────────────

function BulkAddDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [text, setText] = useState('');
  const [type, setType] = useState<'whitelist' | 'blacklist'>('blacklist');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const handleSubmit = async () => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setSubmitting(true);
    try {
      const items = lines.map((ip) => ({ ip_address: ip, type }));
      const result = await bulkAddIps(items);
      toast.success(`${result.created}건 등록 완료`);
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length}건 실패`);
      }
      setText('');
      onSuccess();
      onClose();
    } catch {
      toast.error('대량 등록에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>IP 대량 등록</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">유형</label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={type}
              onChange={(e) => setType(e.target.value as 'whitelist' | 'blacklist')}
            >
              <option value="whitelist">화이트리스트</option>
              <option value="blacklist">블랙리스트</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">IP 목록 (줄당 1개)</label>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm bg-background font-mono min-h-[160px] resize-none"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'192.168.1.1\n10.0.0.0/24\n172.16.0.100'}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSubmit} disabled={submitting || !text.trim()}>
            {submitting ? '처리 중...' : '등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function IpManagementPage() {
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<IpRestriction | null>(null);
  const [checkInput, setCheckInput] = useState('');
  const [checkResult, setCheckResult] = useState<IpCheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  const { data: stats, loading: statsLoading, refetch: refetchStats } = useIpStats();
  const { data, loading, error, refetch } = useIpRestrictions(
    page,
    20,
    typeFilter || undefined
  );
  const toast = useToast();

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  const handleRefresh = () => {
    refetch();
    refetchStats();
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteIpRestriction(id);
      toast.success('IP를 삭제했습니다');
      handleRefresh();
    } catch {
      toast.error('삭제에 실패했습니다');
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await toggleIpRestriction(id);
      toast.success('상태를 변경했습니다');
      handleRefresh();
    } catch {
      toast.error('상태 변경에 실패했습니다');
    }
  };

  const handleCheck = async () => {
    if (!checkInput.trim()) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const result = await checkIp(checkInput.trim());
      setCheckResult(result);
    } catch {
      toast.error('IP 검사에 실패했습니다');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">IP 관리</h2>
          <p className="text-sm text-muted-foreground mt-0.5">IP 화이트리스트/블랙리스트 관리</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
            <ListPlus className="mr-1.5 h-3.5 w-3.5" />대량 등록
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />IP 등록
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="py-4 px-5"><Skeleton className="h-14 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="py-4 px-5">
                <p className="text-xs text-muted-foreground">화이트리스트</p>
                <p className="text-2xl font-bold mt-1">{stats?.whitelist_total?.toLocaleString() ?? '0'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 px-5">
                <p className="text-xs text-muted-foreground">블랙리스트</p>
                <p className="text-2xl font-bold mt-1 text-red-600">{stats?.blacklist_total?.toLocaleString() ?? '0'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 px-5">
                <p className="text-xs text-muted-foreground">활성</p>
                <p className="text-2xl font-bold mt-1 text-emerald-600">{stats?.active?.toLocaleString() ?? '0'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 px-5">
                <p className="text-xs text-muted-foreground">비활성</p>
                <p className="text-2xl font-bold mt-1 text-gray-500">{stats?.inactive?.toLocaleString() ?? '0'}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* IP Check Tool */}
      <Card>
        <CardContent className="py-3 px-5">
          <div className="flex items-center gap-3">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">IP 검사</span>
            <Input
              className="max-w-[240px]"
              value={checkInput}
              onChange={(e) => { setCheckInput(e.target.value); setCheckResult(null); }}
              placeholder="IP 주소 입력"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCheck(); }}
            />
            <Button size="sm" onClick={handleCheck} disabled={checking || !checkInput.trim()}>
              <Search className="mr-1 h-3.5 w-3.5" />{checking ? '검사 중...' : '검사'}
            </Button>
            {checkResult && (
              <div className="flex items-center gap-2">
                {checkResult.allowed ? (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                    <CheckCircle className="mr-1 h-3 w-3" />허용
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                    <XCircle className="mr-1 h-3 w-3" />차단
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="py-3 px-5">
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-muted-foreground mr-1">유형:</span>
            {TYPE_FILTERS.map((f) => (
              <Button
                key={f.key}
                variant={typeFilter === f.key ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setTypeFilter(f.key); setPage(1); }}
              >
                {f.label}
              </Button>
            ))}
            <Button variant="outline" size="sm" className="ml-auto h-7 text-xs" onClick={handleRefresh}>
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
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP 주소</TableHead>
                    <TableHead className="text-center">유형</TableHead>
                    <TableHead>설명</TableHead>
                    <TableHead className="text-center">상태</TableHead>
                    <TableHead>등록일</TableHead>
                    <TableHead className="w-32 text-center">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">{item.ip_address}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className={
                            item.type === 'whitelist'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          }
                        >
                          {item.type === 'whitelist' ? '화이트' : '블랙'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {item.description || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={item.is_active ? 'default' : 'secondary'}>
                          {item.is_active ? '활성' : '비활성'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">
                        {formatDateTime(item.created_at)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setEditTarget(item)}
                            title="수정"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleToggle(item.id)}
                            title={item.is_active ? '비활성화' : '활성화'}
                          >
                            {item.is_active ? (
                              <ToggleRight className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </Button>
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
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="border-t px-5 py-2.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{data.total}건 중 {(page - 1) * 20 + 1}~{Math.min(page * 20, data.total)}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(page - 1)}>&lsaquo;</Button>
                    <span className="px-2 text-sm">{page} / {totalPages}</span>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>&rsaquo;</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AddIpDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={handleRefresh}
      />
      <BulkAddDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onSuccess={handleRefresh}
      />
      {editTarget && (
        <EditIpDialog
          restriction={editTarget}
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}
