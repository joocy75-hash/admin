'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/toast-provider';
import {
  useDepositBonusConfigs,
  createDepositBonusConfig,
  updateDepositBonusConfig,
  type DepositBonusConfig,
} from '@/hooks/use-reward-settings';

const fmt = (n: number) => Intl.NumberFormat('ko-KR').format(n);

const TYPE_STYLES: Record<string, { label: string; cls: string }> = {
  first_deposit: { label: '첫입금', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  every_deposit: { label: '매입금', cls: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
};

type FormData = {
  type: string;
  bonus_percent: string;
  max_bonus_amount: string;
  min_deposit_amount: string;
  rollover_multiplier: string;
  is_active: boolean;
};

const defaultForm: FormData = {
  type: 'first_deposit',
  bonus_percent: '0',
  max_bonus_amount: '0',
  min_deposit_amount: '0',
  rollover_multiplier: '1',
  is_active: true,
};

export default function DepositBonusPage() {
  const toast = useToast();
  const { data, loading, error, refetch } = useDepositBonusConfigs();
  const [editing, setEditing] = useState<DepositBonusConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setShowForm(true);
  };

  const openEdit = (item: DepositBonusConfig) => {
    setEditing(item);
    setForm({
      type: item.type,
      bonus_percent: String(item.bonus_percent),
      max_bonus_amount: String(item.max_bonus_amount),
      min_deposit_amount: String(item.min_deposit_amount),
      rollover_multiplier: String(item.rollover_multiplier),
      is_active: item.is_active,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        type: form.type as DepositBonusConfig['type'],
        bonus_percent: Number(form.bonus_percent),
        max_bonus_amount: Number(form.max_bonus_amount),
        min_deposit_amount: Number(form.min_deposit_amount),
        rollover_multiplier: Number(form.rollover_multiplier),
        is_active: form.is_active,
      };
      if (editing) {
        await updateDepositBonusConfig(editing.id, body);
        toast.success('입금보너스가 수정되었습니다');
      } else {
        await createDepositBonusConfig(body);
        toast.success('입금보너스가 등록되었습니다');
      }
      setShowForm(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">입금보너스 설정</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">첫입금 및 매입금 보너스를 관리합니다.</p>
        </div>
        <Button onClick={openCreate}>+ 추가</Button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-400">
            등록된 입금보너스 설정이 없습니다
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">유형</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">보너스비율(%)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">최대보너스</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">최소입금</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">롤오버(x배)</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">활성</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                  {data.map((item) => {
                    const typeStyle = TYPE_STYLES[item.type];
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-center">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${typeStyle?.cls || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {typeStyle?.label || item.type}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono tabular-nums">{item.bonus_percent}%</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono tabular-nums">{fmt(item.max_bonus_amount)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono tabular-nums text-gray-600 dark:text-gray-400">{fmt(item.min_deposit_amount)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono tabular-nums text-gray-600 dark:text-gray-400">x{item.rollover_multiplier}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-center">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            item.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {item.is_active ? '활성' : '비활성'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>수정</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? '입금보너스 수정' : '입금보너스 등록'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>유형</Label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="first_deposit">첫입금</option>
                <option value="every_deposit">매입금</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>보너스 비율 (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.bonus_percent}
                  onChange={(e) => setForm({ ...form, bonus_percent: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>롤오버 배수</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.rollover_multiplier}
                  onChange={(e) => setForm({ ...form, rollover_multiplier: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>최소 입금액</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.min_deposit_amount}
                  onChange={(e) => setForm({ ...form, min_deposit_amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>최대 보너스 금액</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.max_bonus_amount}
                  onChange={(e) => setForm({ ...form, max_bonus_amount: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="deposit-bonus-active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="deposit-bonus-active">활성</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : editing ? '수정' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
