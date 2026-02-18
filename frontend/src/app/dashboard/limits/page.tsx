'use client';

import { useState } from 'react';
import {
  useTransactionLimits,
  useBettingLimits,
  createTransactionLimit,
  updateTransactionLimit,
  deleteTransactionLimit,
  createBettingLimit,
  updateBettingLimit,
  deleteBettingLimit,
  type TransactionLimit,
  type BettingLimit,
} from '@/hooks/use-limits';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { AlertCircle, Shield, Gamepad2 } from 'lucide-react';
import { useToast } from '@/components/toast-provider';

const fmt = (n: number) => Intl.NumberFormat('ko-KR').format(n);

const SCOPE_TABS = [
  { key: '', label: '전체' },
  { key: 'global', label: '전역(Global)' },
  { key: 'vip_level', label: 'VIP 등급별' },
  { key: 'user', label: '회원별' },
];

const SCOPE_LABELS: Record<string, string> = {
  global: '전역',
  vip_level: 'VIP 등급',
  user: '회원',
};

const TYPE_LABELS: Record<string, string> = {
  deposit: '입금',
  withdrawal: '출금',
};

const CATEGORY_LABELS: Record<string, string> = {
  casino: '카지노',
  slot: '슬롯',
  mini_game: '미니게임',
  virtual_soccer: '가상축구',
  sports: '스포츠',
  esports: 'e스포츠',
  holdem: '홀덤',
};

const MAIN_TABS = [
  { key: 'transaction', label: '입출금 한도' },
  { key: 'betting', label: '베팅 한도' },
];

// ─── Transaction Limit Form ──────────────────────────────────────

type TxFormData = {
  scope_type: string;
  scope_id: string;
  type: string;
  min_amount: string;
  max_amount: string;
  daily_limit: string;
  daily_count_limit: string;
  monthly_limit: string;
  active: boolean;
};

const defaultTxForm: TxFormData = {
  scope_type: 'global',
  scope_id: '',
  type: 'deposit',
  min_amount: '0',
  max_amount: '0',
  daily_limit: '0',
  daily_count_limit: '0',
  monthly_limit: '0',
  active: true,
};

// ─── Betting Limit Form ──────────────────────────────────────────

type BetFormData = {
  scope_type: string;
  scope_id: string;
  game_category: string;
  min_bet: string;
  max_bet: string;
  daily_loss_limit: string;
  active: boolean;
};

const defaultBetForm: BetFormData = {
  scope_type: 'global',
  scope_id: '',
  game_category: 'casino',
  min_bet: '0',
  max_bet: '0',
  daily_loss_limit: '0',
  active: true,
};

// ─── Main Page ───────────────────────────────────────────────────

export default function LimitsPage() {
  const [mainTab, setMainTab] = useState('transaction');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">한도 관리</h1>
      </div>

      {/* Main Tabs */}
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

      {mainTab === 'transaction' ? <TransactionLimitsTab /> : <BettingLimitsTab />}
    </div>
  );
}

// ─── Transaction Limits Tab ──────────────────────────────────────

const TransactionLimitsTab = () => {
  const toast = useToast();
  const [scopeFilter, setScopeFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TransactionLimit | null>(null);
  const [form, setForm] = useState<TxFormData>(defaultTxForm);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TransactionLimit | null>(null);

  const { data, loading, error, refetch } = useTransactionLimits(scopeFilter || undefined);

  const openCreate = () => {
    setEditingItem(null);
    setForm(defaultTxForm);
    setDialogOpen(true);
  };

  const openEdit = (item: TransactionLimit) => {
    setEditingItem(item);
    setForm({
      scope_type: item.scope_type,
      scope_id: item.scope_id ? String(item.scope_id) : '',
      type: item.type,
      min_amount: String(item.min_amount),
      max_amount: String(item.max_amount),
      daily_limit: String(item.daily_limit),
      daily_count_limit: String(item.daily_count_limit),
      monthly_limit: String(item.monthly_limit),
      active: item.active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        scope_type: form.scope_type,
        scope_id: form.scope_id ? Number(form.scope_id) : null,
        type: form.type,
        min_amount: Number(form.min_amount),
        max_amount: Number(form.max_amount),
        daily_limit: Number(form.daily_limit),
        daily_count_limit: Number(form.daily_count_limit),
        monthly_limit: Number(form.monthly_limit),
        active: form.active,
      };
      if (editingItem) {
        await updateTransactionLimit(editingItem.id, body);
      } else {
        await createTransactionLimit(body);
      }
      setDialogOpen(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: TransactionLimit) => {
    setPendingDelete(item);
    setConfirmOpen(true);
  };

  const confirmDeleteAction = async () => {
    if (!pendingDelete) return;
    try {
      await deleteTransactionLimit(pendingDelete.id);
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
            <AlertDialogTitle>한도 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 입출금 한도 설정을 삭제합니다. 계속하시겠습니까?
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
            <DialogTitle>{editingItem ? '입출금 한도 수정' : '입출금 한도 등록'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>적용 범위</Label>
                <select
                  value={form.scope_type}
                  onChange={(e) => setForm({ ...form, scope_type: e.target.value, scope_id: '' })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="global">전역</option>
                  <option value="vip_level">VIP 등급</option>
                  <option value="user">회원</option>
                </select>
              </div>
              {form.scope_type !== 'global' && (
                <div className="space-y-2">
                  <Label>{form.scope_type === 'vip_level' ? 'VIP 레벨' : '회원 ID'}</Label>
                  <Input
                    type="number"
                    value={form.scope_id}
                    onChange={(e) => setForm({ ...form, scope_id: e.target.value })}
                    placeholder={form.scope_type === 'vip_level' ? 'VIP 레벨 번호' : '회원 ID'}
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>유형</Label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="deposit">입금</option>
                  <option value="withdrawal">출금</option>
                </select>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>최소 금액</Label>
                <Input type="number" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>최대 금액</Label>
                <Input type="number" value={form.max_amount} onChange={(e) => setForm({ ...form, max_amount: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>일일 한도</Label>
                <Input type="number" value={form.daily_limit} onChange={(e) => setForm({ ...form, daily_limit: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>일일 횟수</Label>
                <Input type="number" value={form.daily_count_limit} onChange={(e) => setForm({ ...form, daily_count_limit: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>월 한도</Label>
                <Input type="number" value={form.monthly_limit} onChange={(e) => setForm({ ...form, monthly_limit: e.target.value })} />
              </div>
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

      {/* Scope Filter + Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {SCOPE_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                scopeFilter === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
              onClick={() => setScopeFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Button onClick={openCreate}>+ 한도 등록</Button>
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
          <Shield className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">등록된 입출금 한도가 없습니다</p>
          <p className="text-sm">새 한도를 등록해주세요.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>적용 범위</TableHead>
                <TableHead>유형</TableHead>
                <TableHead className="text-right">최소 금액</TableHead>
                <TableHead className="text-right">최대 금액</TableHead>
                <TableHead className="text-right">일일 한도</TableHead>
                <TableHead className="text-right">일일 횟수</TableHead>
                <TableHead className="text-right">월 한도</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge className="bg-gray-100 text-gray-800" variant="secondary">
                      {SCOPE_LABELS[item.scope_type] || item.scope_type}
                    </Badge>
                    {item.scope_name && (
                      <span className="ml-1 text-xs text-muted-foreground">({item.scope_name})</span>
                    )}
                    {item.scope_id && !item.scope_name && (
                      <span className="ml-1 text-xs text-muted-foreground">#{item.scope_id}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={item.type === 'deposit' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}
                      variant="secondary"
                    >
                      {TYPE_LABELS[item.type] || item.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{fmt(item.min_amount)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(item.max_amount)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(item.daily_limit)}</TableCell>
                  <TableCell className="text-right font-mono">{item.daily_count_limit}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(item.monthly_limit)}</TableCell>
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

// ─── Betting Limits Tab ──────────────────────────────────────────

const BettingLimitsTab = () => {
  const toast = useToast();
  const [scopeFilter, setScopeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BettingLimit | null>(null);
  const [form, setForm] = useState<BetFormData>(defaultBetForm);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BettingLimit | null>(null);

  const { data, loading, error, refetch } = useBettingLimits(
    scopeFilter || undefined,
    categoryFilter || undefined
  );

  const openCreate = () => {
    setEditingItem(null);
    setForm(defaultBetForm);
    setDialogOpen(true);
  };

  const openEdit = (item: BettingLimit) => {
    setEditingItem(item);
    setForm({
      scope_type: item.scope_type,
      scope_id: item.scope_id ? String(item.scope_id) : '',
      game_category: item.game_category,
      min_bet: String(item.min_bet),
      max_bet: String(item.max_bet),
      daily_loss_limit: String(item.daily_loss_limit),
      active: item.active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        scope_type: form.scope_type,
        scope_id: form.scope_id ? Number(form.scope_id) : null,
        game_category: form.game_category,
        min_bet: Number(form.min_bet),
        max_bet: Number(form.max_bet),
        daily_loss_limit: Number(form.daily_loss_limit),
        active: form.active,
      };
      if (editingItem) {
        await updateBettingLimit(editingItem.id, body);
      } else {
        await createBettingLimit(body);
      }
      setDialogOpen(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: BettingLimit) => {
    setPendingDelete(item);
    setConfirmOpen(true);
  };

  const confirmDeleteAction = async () => {
    if (!pendingDelete) return;
    try {
      await deleteBettingLimit(pendingDelete.id);
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
            <AlertDialogTitle>한도 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 베팅 한도 설정을 삭제합니다. 계속하시겠습니까?
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
            <DialogTitle>{editingItem ? '베팅 한도 수정' : '베팅 한도 등록'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>적용 범위</Label>
                <select
                  value={form.scope_type}
                  onChange={(e) => setForm({ ...form, scope_type: e.target.value, scope_id: '' })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="global">전역</option>
                  <option value="vip_level">VIP 등급</option>
                  <option value="user">회원</option>
                </select>
              </div>
              {form.scope_type !== 'global' && (
                <div className="space-y-2">
                  <Label>{form.scope_type === 'vip_level' ? 'VIP 레벨' : '회원 ID'}</Label>
                  <Input
                    type="number"
                    value={form.scope_id}
                    onChange={(e) => setForm({ ...form, scope_id: e.target.value })}
                    placeholder={form.scope_type === 'vip_level' ? 'VIP 레벨 번호' : '회원 ID'}
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>게임 종류</Label>
                <select
                  value={form.game_category}
                  onChange={(e) => setForm({ ...form, game_category: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
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
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>최소 베팅</Label>
                <Input type="number" value={form.min_bet} onChange={(e) => setForm({ ...form, min_bet: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>최대 베팅</Label>
                <Input type="number" value={form.max_bet} onChange={(e) => setForm({ ...form, max_bet: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>일일 손실 한도</Label>
                <Input type="number" value={form.daily_loss_limit} onChange={(e) => setForm({ ...form, daily_loss_limit: e.target.value })} />
              </div>
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

      {/* Filters + Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3 items-center">
          <div className="flex gap-1">
            {SCOPE_TABS.map((tab) => (
              <button
                key={tab.key}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  scopeFilter === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
                onClick={() => setScopeFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm bg-background"
          >
            <option value="">전체 게임</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <Button onClick={openCreate}>+ 한도 등록</Button>
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
          <Gamepad2 className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">등록된 베팅 한도가 없습니다</p>
          <p className="text-sm">새 한도를 등록해주세요.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>적용 범위</TableHead>
                <TableHead>게임 종류</TableHead>
                <TableHead className="text-right">최소 베팅</TableHead>
                <TableHead className="text-right">최대 베팅</TableHead>
                <TableHead className="text-right">일일 손실 한도</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge className="bg-gray-100 text-gray-800" variant="secondary">
                      {SCOPE_LABELS[item.scope_type] || item.scope_type}
                    </Badge>
                    {item.scope_name && (
                      <span className="ml-1 text-xs text-muted-foreground">({item.scope_name})</span>
                    )}
                    {item.scope_id && !item.scope_name && (
                      <span className="ml-1 text-xs text-muted-foreground">#{item.scope_id}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-purple-100 text-purple-800" variant="secondary">
                      {CATEGORY_LABELS[item.game_category] || item.game_category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{fmt(item.min_bet)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(item.max_bet)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(item.daily_loss_limit)}</TableCell>
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
