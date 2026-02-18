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
  ShieldAlert,
  AlertCircle,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  Inbox,
} from 'lucide-react';
import {
  useFraudAlerts,
  useFraudStats,
  useFraudRules,
  updateAlertStatus,
  createFraudRule,
  updateFraudRule,
  deleteFraudRule,
  toggleFraudRule,
} from '@/hooks/use-fraud';
import type { FraudRule } from '@/hooks/use-fraud';
import { useToast } from '@/components/toast-provider';

// ─── Constants ───────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, { label: string; cls: string }> = {
  critical: { label: 'Critical', cls: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  high: { label: 'High', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  medium: { label: 'Medium', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  low: { label: 'Low', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
};

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  open: { label: '미처리', cls: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400' },
  investigating: { label: '조사중', cls: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400' },
  resolved: { label: '해결', cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' },
  false_positive: { label: '오탐', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

const SEVERITY_FILTERS = [
  { key: '', label: '전체' },
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
  { key: 'critical', label: 'Critical' },
];

const STATUS_FILTERS = [
  { key: '', label: '전체' },
  { key: 'open', label: '미처리' },
  { key: 'investigating', label: '조사중' },
  { key: 'resolved', label: '해결' },
  { key: 'false_positive', label: '오탐' },
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

// ─── Alert Status Dialog ─────────────────────────────────────────

function StatusChangeDialog({
  alertId,
  currentStatus,
  open,
  onClose,
  onSuccess,
}: {
  alertId: number;
  currentStatus: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await updateAlertStatus(alertId, status, note || undefined);
      toast.success('상태를 변경했습니다');
      onSuccess();
      onClose();
    } catch {
      toast.error('상태 변경에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>알림 상태 변경</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">상태</label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {Object.entries(STATUS_STYLES).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">처리 메모</label>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm bg-background min-h-[80px] resize-none"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="처리 내용을 입력하세요..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '처리 중...' : '변경'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Rule Dialog ─────────────────────────────────────────────────

function RuleDialog({
  rule,
  open,
  onClose,
  onSuccess,
}: {
  rule: FraudRule | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(rule?.name || '');
  const [type, setType] = useState(rule?.rule_type || '');
  const [severity, setSeverity] = useState(rule?.severity || 'medium');
  const [conditions, setConditions] = useState(
    rule?.condition ? JSON.stringify(rule.condition, null, 2) : '{\n  \n}'
  );
  const [submitting, setSubmitting] = useState(false);
  const [condError, setCondError] = useState('');
  const toast = useToast();

  const handleSubmit = async () => {
    let parsedConditions: Record<string, unknown>;
    try {
      parsedConditions = JSON.parse(conditions);
    } catch {
      setCondError('유효한 JSON 형식이 아닙니다');
      return;
    }
    setCondError('');
    setSubmitting(true);

    const body = {
      name,
      rule_type: type,
      severity,
      condition: parsedConditions,
    };

    try {
      if (rule) {
        await updateFraudRule(rule.id, body);
        toast.success('규칙을 수정했습니다');
      } else {
        await createFraudRule(body);
        toast.success('규칙을 생성했습니다');
      }
      onSuccess();
      onClose();
    } catch {
      toast.error(rule ? '수정에 실패했습니다' : '생성에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{rule ? '규칙 수정' : '규칙 추가'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">이름</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="규칙 이름" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">유형</label>
              <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="예: duplicate_ip" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">심각도</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as 'low' | 'medium' | 'high' | 'critical')}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">조건 (JSON)</label>
            <textarea
              className={`w-full border rounded-md px-3 py-2 text-sm bg-background font-mono min-h-[120px] resize-none ${
                condError ? 'border-red-500' : ''
              }`}
              value={conditions}
              onChange={(e) => { setConditions(e.target.value); setCondError(''); }}
              placeholder='{ "threshold": 100 }'
            />
            {condError && <p className="text-xs text-red-500 mt-1">{condError}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSubmit} disabled={submitting || !name || !type}>
            {submitting ? '처리 중...' : rule ? '수정' : '추가'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function FraudPage() {
  const [tab, setTab] = useState<'alerts' | 'rules'>('alerts');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">FDS (이상거래 탐지)</h2>
          <p className="text-sm text-muted-foreground mt-0.5">이상 행위 탐지 및 규칙 관리</p>
        </div>
      </div>

      {/* Tab Buttons */}
      <div className="flex gap-2">
        <Button
          variant={tab === 'alerts' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('alerts')}
        >
          <ShieldAlert className="mr-1 h-3.5 w-3.5" />알림 목록
        </Button>
        <Button
          variant={tab === 'rules' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('rules')}
        >
          <Search className="mr-1 h-3.5 w-3.5" />규칙 관리
        </Button>
      </div>

      {tab === 'alerts' ? <AlertsTab /> : <RulesTab />}
    </div>
  );
}

// ─── Alerts Tab ──────────────────────────────────────────────────

function AlertsTab() {
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [editAlertId, setEditAlertId] = useState<number | null>(null);
  const [editAlertStatus, setEditAlertStatus] = useState('');

  const { data: stats, loading: statsLoading } = useFraudStats();
  const { data, loading, error, refetch } = useFraudAlerts({
    page,
    page_size: 20,
    severity: severityFilter || undefined,
    status: statusFilter || undefined,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  return (
    <>
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
                <p className="text-xs text-muted-foreground">총 알림</p>
                <p className="text-2xl font-bold mt-1">{stats?.total?.toLocaleString() ?? '0'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 px-5">
                <p className="text-xs text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold mt-1 text-red-600">{stats?.critical?.toLocaleString() ?? '0'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 px-5">
                <p className="text-xs text-muted-foreground">High</p>
                <p className="text-2xl font-bold mt-1 text-orange-600">{stats?.high?.toLocaleString() ?? '0'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 px-5">
                <p className="text-xs text-muted-foreground">조사중</p>
                <p className="text-2xl font-bold mt-1 text-amber-600">{stats?.investigating?.toLocaleString() ?? '0'}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3 px-5 space-y-2">
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-muted-foreground mr-1">심각도:</span>
            {SEVERITY_FILTERS.map((f) => (
              <Button
                key={f.key}
                variant={severityFilter === f.key ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setSeverityFilter(f.key); setPage(1); }}
              >
                {f.label}
              </Button>
            ))}
          </div>
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
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>회원</TableHead>
                    <TableHead>유형</TableHead>
                    <TableHead className="text-center">심각도</TableHead>
                    <TableHead className="hidden lg:table-cell">설명</TableHead>
                    <TableHead className="text-center">상태</TableHead>
                    <TableHead>감지시간</TableHead>
                    <TableHead className="w-20 text-center">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((alert) => {
                    const sev = SEVERITY_STYLES[alert.severity];
                    const st = STATUS_STYLES[alert.status];
                    return (
                      <TableRow key={alert.id}>
                        <TableCell className="font-medium">{alert.user_username}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{alert.alert_type}</TableCell>
                        <TableCell className="text-center">
                          {sev ? (
                            <Badge variant="secondary" className={sev.cls}>{sev.label}</Badge>
                          ) : (
                            <span className="text-xs">{alert.severity}</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-[300px] truncate">
                          {alert.description}
                        </TableCell>
                        <TableCell className="text-center">
                          {st ? (
                            <Badge variant="secondary" className={st.cls}>{st.label}</Badge>
                          ) : (
                            <span className="text-xs">{alert.status}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground tabular-nums">
                          {formatDateTime(alert.detected_at)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => { setEditAlertId(alert.id); setEditAlertStatus(alert.status); }}
                          >
                            <Pencil className="h-3 w-3 mr-1" />처리
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

      {/* Status Change Dialog */}
      {editAlertId !== null && (
        <StatusChangeDialog
          alertId={editAlertId}
          currentStatus={editAlertStatus}
          open={editAlertId !== null}
          onClose={() => setEditAlertId(null)}
          onSuccess={refetch}
        />
      )}
    </>
  );
}

// ─── Rules Tab ───────────────────────────────────────────────────

function RulesTab() {
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<FraudRule | null>(null);
  const { data, loading, error, refetch } = useFraudRules();
  const toast = useToast();

  const handleDelete = async (id: number) => {
    try {
      await deleteFraudRule(id);
      toast.success('규칙을 삭제했습니다');
      refetch();
    } catch {
      toast.error('삭제에 실패했습니다');
    }
  };

  const handleToggle = async (rule: FraudRule) => {
    try {
      await toggleFraudRule(rule.id, !rule.is_active);
      toast.success(rule.is_active ? '규칙을 비활성화했습니다' : '규칙을 활성화했습니다');
      refetch();
    } catch {
      toast.error('상태 변경에 실패했습니다');
    }
  };

  const handleEdit = (rule: FraudRule) => {
    setEditingRule(rule);
    setRuleDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingRule(null);
    setRuleDialogOpen(true);
  };

  return (
    <>
      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" />새로고침
        </Button>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />규칙 추가
        </Button>
      </div>

      {/* Rules Table */}
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
                  <TableHead>이름</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead className="text-center">심각도</TableHead>
                  <TableHead className="text-center">상태</TableHead>
                  <TableHead>생성일</TableHead>
                  <TableHead className="w-32 text-center">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((rule) => {
                  const sev = SEVERITY_STYLES[rule.severity];
                  return (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{rule.rule_type}</TableCell>
                      <TableCell className="text-center">
                        {sev ? (
                          <Badge variant="secondary" className={sev.cls}>{sev.label}</Badge>
                        ) : (
                          <span className="text-xs">{rule.severity}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                          {rule.is_active ? '활성' : '비활성'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">
                        {formatDateTime(rule.created_at)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleEdit(rule)}
                            title="수정"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleToggle(rule)}
                            title={rule.is_active ? '비활성화' : '활성화'}
                          >
                            {rule.is_active ? (
                              <ToggleRight className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            onClick={() => handleDelete(rule.id)}
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
          )}
        </CardContent>
      </Card>

      {/* Rule Dialog */}
      <RuleDialog
        rule={editingRule}
        open={ruleDialogOpen}
        onClose={() => { setRuleDialogOpen(false); setEditingRule(null); }}
        onSuccess={refetch}
      />
    </>
  );
}
