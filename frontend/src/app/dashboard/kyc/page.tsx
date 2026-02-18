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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  FileCheck,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Inbox,
  AlertCircle,
  ImageIcon,
} from 'lucide-react';
import {
  useKycDocuments,
  useKycDocument,
  useKycStats,
  approveKycDocument,
  rejectKycDocument,
  requestResubmit,
} from '@/hooks/use-kyc';
import type { KycDocument } from '@/hooks/use-kyc';
import { useToast } from '@/components/toast-provider';

// ─── Constants ───────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  pending: { label: '대기', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  approved: { label: '승인', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
  rejected: { label: '거부', cls: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  expired: { label: '만료', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  resubmit_requested: { label: '재제출', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  id_card: '신분증',
  passport: '여권',
  driver_license: '운전면허',
  utility_bill: '공과금영수증',
};

const STATUS_FILTERS = [
  { key: '', label: '전체' },
  { key: 'pending', label: '대기' },
  { key: 'approved', label: '승인' },
  { key: 'rejected', label: '거부' },
  { key: 'expired', label: '만료' },
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

// ─── Reject Reason Dialog ───────────────────────────────────────

function RejectDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(reason);
      setReason('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setReason(''); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>거부 사유 입력</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <label className="text-sm font-medium mb-1.5 block">거부 사유</label>
          <textarea
            className="w-full border rounded-md px-3 py-2 text-sm bg-background min-h-[80px] resize-none"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="거부 사유를 입력하세요..."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); setReason(''); }}>취소</Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting || !reason.trim()}
          >
            {submitting ? '처리 중...' : '거부'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Document Detail Panel ──────────────────────────────────────

function DocumentDetailPanel({
  docId,
  open,
  onClose,
  onActionComplete,
}: {
  docId: number | null;
  open: boolean;
  onClose: () => void;
  onActionComplete: () => void;
}) {
  const { data: doc, loading } = useKycDocument(docId);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const toast = useToast();

  const handleApprove = async () => {
    if (!doc) return;
    setActionLoading(true);
    try {
      await approveKycDocument(doc.id);
      toast.success('문서를 승인했습니다');
      onActionComplete();
      onClose();
    } catch {
      toast.error('승인에 실패했습니다');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!doc) return;
    try {
      await rejectKycDocument(doc.id, reason);
      toast.success('문서를 거부했습니다');
      setRejectDialogOpen(false);
      onActionComplete();
      onClose();
    } catch {
      toast.error('거부에 실패했습니다');
    }
  };

  const handleResubmit = async () => {
    if (!doc) return;
    setActionLoading(true);
    try {
      await requestResubmit(doc.id);
      toast.success('재제출을 요청했습니다');
      onActionComplete();
      onClose();
    } catch {
      toast.error('재제출 요청에 실패했습니다');
    } finally {
      setActionLoading(false);
    }
  };

  const renderImage = (url: string | null | undefined, label: string) => (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {url ? (
        <img src={url} alt={label} className="w-full rounded-md border object-cover max-h-[200px]" />
      ) : (
        <div className="flex items-center justify-center h-[120px] bg-muted rounded-md border">
          <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
        </div>
      )}
    </div>
  );

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent side="right" className="w-[900px] sm:max-w-[900px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>KYC 문서 상세</SheetTitle>
            <SheetDescription>문서 검토 및 승인/거부 처리</SheetDescription>
          </SheetHeader>

          {loading ? (
            <div className="p-4 space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-[200px] w-full" />
              <Skeleton className="h-[200px] w-full" />
            </div>
          ) : doc ? (
            <div className="p-4 space-y-6">
              {/* User Info */}
              <Card>
                <CardContent className="py-4 px-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">회원: {doc.username}</span>
                    {(() => {
                      const st = STATUS_STYLES[doc.status];
                      return st ? (
                        <Badge variant="secondary" className={st.cls}>{st.label}</Badge>
                      ) : (
                        <span className="text-xs">{doc.status}</span>
                      );
                    })()}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <p>문서 유형: {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}</p>
                    <p>문서 번호: {doc.document_number}</p>
                    <p>제출일: {formatDateTime(doc.submitted_at)}</p>
                    <p>검토일: {doc.reviewed_at ? formatDateTime(doc.reviewed_at) : '-'}</p>
                  </div>
                  {doc.reject_reason && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-sm text-red-700 dark:text-red-300">
                      거부 사유: {doc.reject_reason}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Document Images */}
              <div className="grid grid-cols-3 gap-4">
                {renderImage(doc.front_image_url, '앞면')}
                {renderImage(doc.back_image_url, '뒷면')}
                {renderImage(doc.selfie_image_url, '셀피')}
              </div>

              {/* Actions */}
              {doc.status === 'pending' && (
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleApprove} disabled={actionLoading}>
                    <CheckCircle className="mr-1.5 h-3.5 w-3.5" />승인
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setRejectDialogOpen(true)}
                    disabled={actionLoading}
                  >
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />거부
                  </Button>
                  <Button variant="outline" onClick={handleResubmit} disabled={actionLoading}>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />재제출 요청
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-30" />
              <p className="text-sm">문서를 찾을 수 없습니다</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <RejectDialog
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        onConfirm={handleReject}
      />
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function KycPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const { data: stats, loading: statsLoading, refetch: refetchStats } = useKycStats();
  const { data, loading, error, refetch } = useKycDocuments(
    page,
    20,
    statusFilter || undefined,
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  const handleRowClick = (doc: KycDocument) => {
    setSelectedDocId(doc.id);
    setPanelOpen(true);
  };

  const handleActionComplete = () => {
    refetch();
    refetchStats();
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">KYC 인증 관리</h2>
        <p className="text-sm text-muted-foreground mt-0.5">본인 인증 문서 검토 및 승인 관리</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        {statsLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="py-4 px-5"><Skeleton className="h-14 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="py-4 px-5">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <p className="text-xs text-muted-foreground">대기</p>
                </div>
                <p className="text-2xl font-bold mt-1 text-amber-600">{stats?.pending?.toLocaleString() ?? '0'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 px-5">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <p className="text-xs text-muted-foreground">승인</p>
                </div>
                <p className="text-2xl font-bold mt-1 text-emerald-600">{stats?.approved?.toLocaleString() ?? '0'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 px-5">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <p className="text-xs text-muted-foreground">거부</p>
                </div>
                <p className="text-2xl font-bold mt-1 text-red-600">{stats?.rejected?.toLocaleString() ?? '0'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 px-5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-gray-400" />
                  <p className="text-xs text-muted-foreground">만료</p>
                </div>
                <p className="text-2xl font-bold mt-1 text-gray-600">{stats?.expired?.toLocaleString() ?? '0'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 px-5">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-blue-500" />
                  <p className="text-xs text-muted-foreground">오늘 접수</p>
                </div>
                <p className="text-2xl font-bold mt-1 text-blue-600">{stats?.today_submitted?.toLocaleString() ?? '0'}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3 px-5">
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-muted-foreground mr-1">상태:</span>
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.key}
                variant={statusFilter === f.key ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setStatusFilter(f.key); setPage(1); }}
              >
                {f.label}
              </Button>
            ))}
            <Button variant="outline" size="sm" className="ml-auto h-7 text-xs" onClick={() => { refetch(); refetchStats(); }}>
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
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>회원</TableHead>
                    <TableHead>문서유형</TableHead>
                    <TableHead>문서번호</TableHead>
                    <TableHead className="text-center">상태</TableHead>
                    <TableHead>제출일</TableHead>
                    <TableHead>검토일</TableHead>
                    <TableHead className="w-20 text-center">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((doc) => {
                    const st = STATUS_STYLES[doc.status];
                    return (
                      <TableRow
                        key={doc.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(doc)}
                      >
                        <TableCell className="text-sm text-muted-foreground">{doc.id}</TableCell>
                        <TableCell className="font-medium">{doc.username}</TableCell>
                        <TableCell className="text-sm">
                          {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground font-mono">
                          {doc.document_number}
                        </TableCell>
                        <TableCell className="text-center">
                          {st ? (
                            <Badge variant="secondary" className={st.cls}>{st.label}</Badge>
                          ) : (
                            <span className="text-xs">{doc.status}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground tabular-nums">
                          {formatDateTime(doc.submitted_at)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground tabular-nums">
                          {doc.reviewed_at ? formatDateTime(doc.reviewed_at) : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => { e.stopPropagation(); handleRowClick(doc); }}
                          >
                            상세
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

      {/* Detail Panel */}
      <DocumentDetailPanel
        docId={selectedDocId}
        open={panelOpen}
        onClose={() => { setPanelOpen(false); setSelectedDocId(null); }}
        onActionComplete={handleActionComplete}
      />
    </div>
  );
}
