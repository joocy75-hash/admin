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
  useSpinConfigs,
  createSpinConfig,
  updateSpinConfig,
  type SpinConfig,
  type SpinPrize,
} from '@/hooks/use-reward-settings';

const DEFAULT_PRIZES: SpinPrize[] = [
  { label: '₩100,000', value: 100000, type: 'cash', probability: 5 },
  { label: '₩50,000', value: 50000, type: 'cash', probability: 10 },
  { label: '₩10,000', value: 10000, type: 'bonus', probability: 15 },
  { label: '₩5,000', value: 5000, type: 'bonus', probability: 20 },
  { label: '무료스핀', value: 1, type: 'free_spin', probability: 10 },
  { label: '₩1,000', value: 1000, type: 'point', probability: 15 },
  { label: '꽝', value: 0, type: 'nothing', probability: 25 },
];

const PRIZE_TYPE_LABELS: Record<string, string> = {
  cash: '캐시',
  bonus: '보너스',
  point: '포인트',
  free_spin: '무료스핀',
  nothing: '꽝',
};

type FormData = {
  name: string;
  prizes: SpinPrize[];
  max_spins_daily: string;
  is_active: boolean;
};

const defaultForm: FormData = {
  name: '',
  prizes: DEFAULT_PRIZES,
  max_spins_daily: '1',
  is_active: true,
};

export default function SpinPage() {
  const toast = useToast();
  const { data, loading, error, refetch } = useSpinConfigs();
  const [editing, setEditing] = useState<SpinConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setShowForm(true);
  };

  const openEdit = (item: SpinConfig) => {
    setEditing(item);
    setForm({
      name: item.name,
      prizes: item.prizes.length > 0 ? item.prizes : DEFAULT_PRIZES,
      max_spins_daily: String(item.max_spins_daily),
      is_active: item.is_active,
    });
    setShowForm(true);
  };

  const updatePrize = (index: number, field: keyof SpinPrize, value: string | number) => {
    const updated = [...form.prizes];
    updated[index] = { ...updated[index], [field]: value };
    setForm({ ...form, prizes: updated });
  };

  const addPrize = () => {
    setForm({
      ...form,
      prizes: [...form.prizes, { label: '', value: 0, type: 'nothing', probability: 0 }],
    });
  };

  const removePrize = (index: number) => {
    setForm({ ...form, prizes: form.prizes.filter((_, i) => i !== index) });
  };

  const totalProbability = form.prizes.reduce((sum, p) => sum + p.probability, 0);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('이름을 입력해주세요');
      return;
    }
    if (totalProbability !== 100) {
      toast.error(`확률 합계가 100%여야 합니다 (현재: ${totalProbability}%)`);
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        prizes: form.prizes,
        max_spins_daily: Number(form.max_spins_daily),
        is_active: form.is_active,
      };
      if (editing) {
        await updateSpinConfig(editing.id, body);
        toast.success('스핀 설정이 수정되었습니다');
      } else {
        await createSpinConfig(body);
        toast.success('스핀 설정이 등록되었습니다');
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
          <h1 className="text-2xl font-bold">럭키스핀 설정</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">럭키스핀 경품 및 확률을 관리합니다.</p>
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
            등록된 스핀 설정이 없습니다
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
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">경품수</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">일일스핀</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">활성</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                  {data.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">{item.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-center">{item.prizes.length}개</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-center font-mono">{item.max_spins_daily}회</td>
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
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? '스핀 설정 수정' : '스핀 설정 등록'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>이름</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="스핀 이름"
                />
              </div>
              <div className="space-y-2">
                <Label>일일 스핀 횟수</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.max_spins_daily}
                  onChange={(e) => setForm({ ...form, max_spins_daily: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="spin-active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="spin-active">활성</Label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>경품 목록</Label>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${totalProbability === 100 ? 'text-green-600' : 'text-red-600'}`}>
                    확률 합계: {totalProbability}%
                  </span>
                  <Button variant="outline" size="sm" onClick={addPrize}>경품 추가</Button>
                </div>
              </div>

              <div className="border rounded-md overflow-hidden dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">라벨</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">값</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">유형</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">확률(%)</th>
                      <th className="px-3 py-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {form.prizes.map((prize, idx) => (
                      <tr key={`prize-${idx}`}>
                        <td className="px-3 py-1.5">
                          <Input
                            value={prize.label}
                            onChange={(e) => updatePrize(idx, 'label', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            type="number"
                            value={prize.value}
                            onChange={(e) => updatePrize(idx, 'value', Number(e.target.value))}
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <select
                            value={prize.type}
                            onChange={(e) => updatePrize(idx, 'type', e.target.value)}
                            className="w-full border rounded-md px-2 py-1 text-sm bg-background h-8"
                          >
                            {Object.entries(PRIZE_TYPE_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={prize.probability}
                            onChange={(e) => updatePrize(idx, 'probability', Number(e.target.value))}
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-800"
                            onClick={() => removePrize(idx)}
                          >
                            X
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
