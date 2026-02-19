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
  usePaybackConfigs,
  createPaybackConfig,
  updatePaybackConfig,
  type PaybackConfig,
} from '@/hooks/use-reward-settings';

const fmt = (n: number) => Intl.NumberFormat('ko-KR').format(n);

const PAYBACK_TYPE_STYLES: Record<string, { label: string; cls: string }> = {
  cash: { label: '캐시', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  bonus: { label: '보너스', cls: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  point: { label: '포인트', cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
};

const PERIOD_STYLES: Record<string, { label: string; cls: string }> = {
  daily: { label: '일간', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  weekly: { label: '주간', cls: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  monthly: { label: '월간', cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
};

type FormData = {
  name: string;
  payback_percent: string;
  payback_type: string;
  period: string;
  min_loss_amount: string;
  max_payback_amount: string;
  is_active: boolean;
};

const defaultForm: FormData = {
  name: '',
  payback_percent: '0',
  payback_type: 'cash',
  period: 'daily',
  min_loss_amount: '0',
  max_payback_amount: '0',
  is_active: true,
};

export default function PaybackPage() {
  const toast = useToast();
  const { data, loading, error, refetch } = usePaybackConfigs();
  const [editing, setEditing] = useState<PaybackConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setShowForm(true);
  };

  const openEdit = (item: PaybackConfig) => {
    setEditing(item);
    setForm({
      name: item.name,
      payback_percent: String(item.payback_percent),
      payback_type: item.payback_type,
      period: item.period,
      min_loss_amount: String(item.min_loss_amount),
      max_payback_amount: String(item.max_payback_amount),
      is_active: item.is_active,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('이름을 입력해주세요');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        payback_percent: Number(form.payback_percent),
        payback_type: form.payback_type,
        period: form.period as PaybackConfig['period'],
        min_loss_amount: Number(form.min_loss_amount),
        max_payback_amount: Number(form.max_payback_amount),
        is_active: form.is_active,
      };
      if (editing) {
        await updatePaybackConfig(editing.id, body);
        toast.success('페이백이 수정되었습니다');
      } else {
        await createPaybackConfig(body);
        toast.success('페이백이 등록되었습니다');
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
          <h1 className="text-2xl font-bold">페이백 설정</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">페이백 비율 및 조건을 관리합니다.</p>
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
            등록된 페이백 설정이 없습니다
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">이름</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">비율(%)</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">유형</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">기간</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">최소손실</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">최대페이백</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">활성</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                  {data.map((item) => {
                    const typeStyle = PAYBACK_TYPE_STYLES[item.payback_type];
                    const periodStyle = PERIOD_STYLES[item.period];
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">{item.name}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono tabular-nums">{item.payback_percent}%</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-center">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${typeStyle?.cls || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {typeStyle?.label || item.payback_type}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-center">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${periodStyle?.cls || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {periodStyle?.label || item.period}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono tabular-nums text-gray-600 dark:text-gray-400">
                          {fmt(item.min_loss_amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono tabular-nums text-gray-600 dark:text-gray-400">
                          {fmt(item.max_payback_amount)}
                        </td>
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
            <DialogTitle>{editing ? '페이백 수정' : '페이백 등록'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>이름</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="페이백 이름"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>페이백 비율 (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.payback_percent}
                  onChange={(e) => setForm({ ...form, payback_percent: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>보상 유형</Label>
                <select
                  value={form.payback_type}
                  onChange={(e) => setForm({ ...form, payback_type: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="cash">캐시</option>
                  <option value="bonus">보너스</option>
                  <option value="point">포인트</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>기간</Label>
              <select
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="daily">일간</option>
                <option value="weekly">주간</option>
                <option value="monthly">월간</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>최소 손실액</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.min_loss_amount}
                  onChange={(e) => setForm({ ...form, min_loss_amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>최대 페이백 금액</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.max_payback_amount}
                  onChange={(e) => setForm({ ...form, max_payback_amount: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="payback-active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="payback-active">활성</Label>
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
