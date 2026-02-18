'use client';

import { useState } from 'react';
import {
  useSalaryConfigs,
  useSalaryPayments,
  useSalaryPaymentSummary,
  createSalaryConfig,
  updateSalaryConfig,
  deleteSalaryConfig,
  createSalaryPayment,
  approveSalaryPayment,
  paySalaryPayment,
  rejectSalaryPayment,
  type SalaryConfig,
  type SalaryPayment,
} from '@/hooks/use-salary';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { AlertCircle, Wallet, Clock, CheckCircle2, DollarSign } from 'lucide-react';
import { useToast } from '@/components/toast-provider';

const fmt = (n: number) => Intl.NumberFormat('ko-KR').format(n);

const SALARY_TYPE_LABELS: Record<string, string> = {
  fixed: '고정급',
  performance: '성과급',
  mixed: '혼합',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  approved: '승인',
  paid: '지급완료',
  rejected: '거부',
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const MAIN_TABS = [
  { key: 'config', label: '급여 설정' },
  { key: 'payment', label: '급여 지급 내역' },
];

// ─── Config Form ─────────────────────────────────────────────────

type ConfigFormData = {
  agent_id: string;
  salary_type: string;
  base_amount: string;
  min_active_users: string;
  min_betting_amount: string;
  min_deposit_amount: string;
  performance_bonus_rate: string;
  active: boolean;
};

const defaultConfigForm: ConfigFormData = {
  agent_id: '',
  salary_type: 'fixed',
  base_amount: '0',
  min_active_users: '0',
  min_betting_amount: '0',
  min_deposit_amount: '0',
  performance_bonus_rate: '0',
  active: true,
};

// ─── Payment Form ────────────────────────────────────────────────

type PaymentFormData = {
  agent_id: string;
  config_id: string;
  period_start: string;
  period_end: string;
  memo: string;
};

const defaultPaymentForm: PaymentFormData = {
  agent_id: '',
  config_id: '',
  period_start: '',
  period_end: '',
  memo: '',
};

// ─── Main Page ───────────────────────────────────────────────────

export default function SalaryPage() {
  const [mainTab, setMainTab] = useState('config');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">에이전트 급여 관리</h1>
      </div>

      <div className="flex gap-1 border-b">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              mainTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
            onClick={() => setMainTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mainTab === 'config' ? <ConfigTab /> : <PaymentTab />}
    </div>
  );
}

// ─── Config Tab ──────────────────────────────────────────────────

const ConfigTab = () => {
  const toast = useToast();
  const [agentFilter, setAgentFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SalaryConfig | null>(null);
  const [form, setForm] = useState<ConfigFormData>(defaultConfigForm);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SalaryConfig | null>(null);

  const { data, loading, error, refetch } = useSalaryConfigs(
    agentFilter ? Number(agentFilter) : undefined
  );

  const openCreate = () => {
    setEditingItem(null);
    setForm(defaultConfigForm);
    setDialogOpen(true);
  };

  const openEdit = (item: SalaryConfig) => {
    setEditingItem(item);
    setForm({
      agent_id: String(item.agent_id),
      salary_type: item.salary_type,
      base_amount: String(item.base_amount),
      min_active_users: String(item.min_active_users),
      min_betting_amount: String(item.min_betting_amount),
      min_deposit_amount: String(item.min_deposit_amount),
      performance_bonus_rate: String(item.performance_bonus_rate),
      active: item.active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        agent_id: Number(form.agent_id),
        salary_type: form.salary_type,
        base_amount: Number(form.base_amount),
        min_active_users: Number(form.min_active_users),
        min_betting_amount: Number(form.min_betting_amount),
        min_deposit_amount: Number(form.min_deposit_amount),
        performance_bonus_rate: Number(form.performance_bonus_rate),
        active: form.active,
      };
      if (editingItem) {
        await updateSalaryConfig(editingItem.id, body);
      } else {
        await createSalaryConfig(body);
      }
      setDialogOpen(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: SalaryConfig) => {
    setPendingDelete(item);
    setConfirmOpen(true);
  };

  const confirmDeleteAction = async () => {
    if (!pendingDelete) return;
    try {
      await deleteSalaryConfig(pendingDelete.id);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '삭제 실패');
    }
    setConfirmOpen(false);
    setPendingDelete(null);
  };

  return (
    <>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>급여 설정 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 급여 설정을 삭제합니다. 계속하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAction}>확인</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? '급여 설정 수정' : '급여 설정 등록'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>에이전트 ID</Label>
                <Input
                  type="number"
                  value={form.agent_id}
                  onChange={(e) => setForm({ ...form, agent_id: e.target.value })}
                  placeholder="에이전트 ID"
                  disabled={!!editingItem}
                />
              </div>
              <div className="space-y-2">
                <Label>급여 유형</Label>
                <select
                  value={form.salary_type}
                  onChange={(e) => setForm({ ...form, salary_type: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="fixed">고정급</option>
                  <option value="performance">성과급</option>
                  <option value="mixed">혼합</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>기본금</Label>
                <Input type="number" value={form.base_amount} onChange={(e) => setForm({ ...form, base_amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>성과 보너스율 (%)</Label>
                <Input type="number" value={form.performance_bonus_rate} onChange={(e) => setForm({ ...form, performance_bonus_rate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>최소 활성회원</Label>
                <Input type="number" value={form.min_active_users} onChange={(e) => setForm({ ...form, min_active_users: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>최소 베팅금액</Label>
                <Input type="number" value={form.min_betting_amount} onChange={(e) => setForm({ ...form, min_betting_amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>최소 입금금액</Label>
                <Input type="number" value={form.min_deposit_amount} onChange={(e) => setForm({ ...form, min_deposit_amount: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>상태</Label>
              <select
                value={form.active ? 'true' : 'false'}
                onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="true">활성</option>
                <option value="false">비활성</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : editingItem ? '수정' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filter + Add */}
      <div className="flex items-center justify-between">
        <Input
          type="number"
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          placeholder="에이전트 ID 검색"
          className="w-48 h-9"
        />
        <Button onClick={openCreate}>+ 급여 설정</Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-destructive">
          <AlertCircle className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">데이터를 불러오지 못했습니다</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Button variant="outline" className="mt-4" onClick={refetch}>다시 시도</Button>
        </div>
      ) : !data?.items.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Wallet className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">등록된 급여 설정이 없습니다</p>
          <p className="text-sm">새 급여 설정을 등록해주세요.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>에이전트</TableHead>
                <TableHead>급여 유형</TableHead>
                <TableHead className="text-right">기본금</TableHead>
                <TableHead className="text-right">보너스율</TableHead>
                <TableHead className="text-right">최소 활성회원</TableHead>
                <TableHead className="text-right">최소 베팅</TableHead>
                <TableHead className="text-right">최소 입금</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="font-medium">{item.agent_username || `#${item.agent_id}`}</span>
                    {item.agent_code && (
                      <span className="ml-1 text-xs text-muted-foreground">({item.agent_code})</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-purple-100 text-purple-800" variant="secondary">
                      {SALARY_TYPE_LABELS[item.salary_type] || item.salary_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{fmt(item.base_amount)}</TableCell>
                  <TableCell className="text-right font-mono">{item.performance_bonus_rate}%</TableCell>
                  <TableCell className="text-right">{item.min_active_users}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(item.min_betting_amount)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(item.min_deposit_amount)}</TableCell>
                  <TableCell>
                    <Badge
                      className={item.active ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}
                      variant="secondary"
                    >
                      {item.active ? '활성' : '비활성'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>수정</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-800"
                        onClick={() => handleDelete(item)}
                      >
                        삭제
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
};

// ─── Payment Tab ─────────────────────────────────────────────────

const PaymentTab = () => {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentFormData>(defaultPaymentForm);
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: string; payment: SalaryPayment } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const { data: summary, refetch: refetchSummary } = useSalaryPaymentSummary();
  const { data, loading, error, refetch } = useSalaryPayments({
    page,
    page_size: 20,
    agent_id: agentFilter ? Number(agentFilter) : undefined,
    status: statusFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const formatDate = (dt: string) =>
    new Date(dt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });

  const handleCreatePayment = async () => {
    setSaving(true);
    try {
      await createSalaryPayment({
        agent_id: Number(paymentForm.agent_id),
        config_id: Number(paymentForm.config_id),
        period_start: paymentForm.period_start,
        period_end: paymentForm.period_end,
        memo: paymentForm.memo || undefined,
      });
      setCreateOpen(false);
      setPaymentForm(defaultPaymentForm);
      refetch();
      refetchSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '생성 실패');
    } finally {
      setSaving(false);
    }
  };

  const openAction = (type: string, payment: SalaryPayment) => {
    setConfirmAction({ type, payment });
    setConfirmOpen(true);
  };

  const executeAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const { type, payment } = confirmAction;
      if (type === 'approve') await approveSalaryPayment(payment.id);
      else if (type === 'pay') await paySalaryPayment(payment.id);
      else if (type === 'reject') await rejectSalaryPayment(payment.id);
      refetch();
      refetchSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '처리 실패');
    } finally {
      setActionLoading(false);
      setConfirmOpen(false);
      setConfirmAction(null);
    }
  };

  const actionLabels: Record<string, string> = {
    approve: '승인',
    pay: '지급',
    reject: '거부',
  };

  const STATUS_FILTERS = [
    { key: '', label: '전체' },
    { key: 'pending', label: '대기' },
    { key: 'approved', label: '승인' },
    { key: 'paid', label: '지급완료' },
    { key: 'rejected', label: '거부' },
  ];

  return (
    <>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>급여 {confirmAction ? actionLabels[confirmAction.type] : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.payment.agent_username || `#${confirmAction?.payment.agent_id}`}의 급여를{' '}
              {confirmAction ? actionLabels[confirmAction.type] : ''}합니다. 계속하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={executeAction} disabled={actionLoading}>
              {actionLoading ? '처리 중...' : '확인'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>급여 지급 생성</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>에이전트 ID</Label>
                <Input
                  type="number"
                  value={paymentForm.agent_id}
                  onChange={(e) => setPaymentForm({ ...paymentForm, agent_id: e.target.value })}
                  placeholder="에이전트 ID"
                />
              </div>
              <div className="space-y-2">
                <Label>설정 ID</Label>
                <Input
                  type="number"
                  value={paymentForm.config_id}
                  onChange={(e) => setPaymentForm({ ...paymentForm, config_id: e.target.value })}
                  placeholder="급여 설정 ID"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>기간 시작</Label>
                <Input
                  type="date"
                  value={paymentForm.period_start}
                  onChange={(e) => setPaymentForm({ ...paymentForm, period_start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>기간 종료</Label>
                <Input
                  type="date"
                  value={paymentForm.period_end}
                  onChange={(e) => setPaymentForm({ ...paymentForm, period_end: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>메모</Label>
              <Input
                value={paymentForm.memo}
                onChange={(e) => setPaymentForm({ ...paymentForm, memo: e.target.value })}
                placeholder="메모 (선택사항)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button onClick={handleCreatePayment} disabled={saving}>
              {saving ? '생성 중...' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 pt-0">
            <div className="rounded-lg bg-yellow-100 p-3 dark:bg-yellow-900">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">대기중</p>
              <p className="text-xl font-bold">{summary?.pending_count ?? 0}건</p>
              <p className="text-sm font-mono text-muted-foreground">{fmt(summary?.pending_amount ?? 0)} USDT</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-0">
            <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900">
              <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">승인 대기</p>
              <p className="text-xl font-bold">{summary?.approved_count ?? 0}건</p>
              <p className="text-sm font-mono text-muted-foreground">{fmt(summary?.approved_amount ?? 0)} USDT</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-0">
            <div className="rounded-lg bg-green-100 p-3 dark:bg-green-900">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">이번달 지급 총액</p>
              <p className="text-xl font-bold font-mono">{fmt(summary?.monthly_paid_total ?? 0)}</p>
              <p className="text-sm text-muted-foreground">USDT</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Create */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex gap-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  statusFilter === f.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
                onClick={() => { setStatusFilter(f.key); setPage(1); }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Input
            type="number"
            value={agentFilter}
            onChange={(e) => { setAgentFilter(e.target.value); setPage(1); }}
            placeholder="에이전트 ID"
            className="w-32 h-9"
          />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="w-40 h-9"
          />
          <span className="text-muted-foreground text-sm">~</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="w-40 h-9"
          />
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ 급여 지급</Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-destructive">
          <AlertCircle className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">데이터를 불러오지 못했습니다</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Button variant="outline" className="mt-4" onClick={refetch}>다시 시도</Button>
        </div>
      ) : !data?.items.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Wallet className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">급여 지급 내역이 없습니다</p>
          <p className="text-sm">조건을 변경하거나 새로 생성해주세요.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>에이전트</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>기간</TableHead>
                <TableHead className="text-right">기본금</TableHead>
                <TableHead className="text-right">성과 보너스</TableHead>
                <TableHead className="text-right">공제</TableHead>
                <TableHead className="text-right">총액</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="font-medium">{item.agent_username || `#${item.agent_id}`}</span>
                    {item.agent_code && (
                      <span className="ml-1 text-xs text-muted-foreground">({item.agent_code})</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-purple-100 text-purple-800" variant="secondary">
                      {SALARY_TYPE_LABELS[item.salary_type] || item.salary_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(item.period_start)} ~ {formatDate(item.period_end)}
                  </TableCell>
                  <TableCell className="text-right font-mono">{fmt(item.base_amount)}</TableCell>
                  <TableCell className="text-right font-mono text-blue-600">{fmt(item.performance_bonus)}</TableCell>
                  <TableCell className="text-right font-mono text-red-600">-{fmt(item.deductions)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{fmt(item.total_amount)}</TableCell>
                  <TableCell>
                    <Badge
                      className={PAYMENT_STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-800'}
                      variant="secondary"
                    >
                      {PAYMENT_STATUS_LABELS[item.status] || item.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {item.status === 'pending' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-800"
                            onClick={() => openAction('approve', item)}
                          >
                            승인
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-800"
                            onClick={() => openAction('reject', item)}
                          >
                            거부
                          </Button>
                        </>
                      )}
                      {item.status === 'approved' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-600 hover:text-green-800"
                          onClick={() => openAction('pay', item)}
                        >
                          지급
                        </Button>
                      )}
                      {(item.status === 'paid' || item.status === 'rejected') && (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">전체: {data.total}건</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))}>
              이전
            </Button>
            <span className="flex items-center text-sm text-muted-foreground">
              {data.page} / {Math.ceil(data.total / data.page_size)}
            </span>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(data.total / data.page_size)} onClick={() => setPage(page + 1)}>
              다음
            </Button>
          </div>
        </div>
      )}
    </>
  );
};
