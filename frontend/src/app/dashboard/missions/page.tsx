'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useMissions,
  createMission,
  updateMission,
  deleteMission,
  type Mission,
} from '@/hooks/use-reward-settings';
import { useToast } from '@/components/toast-provider';

const amountFormatter = new Intl.NumberFormat('ko-KR');

const TYPE_STYLES: Record<string, { label: string; cls: string }> = {
  daily: { label: '일일', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  weekly: { label: '주간', cls: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  monthly: { label: '월간', cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
  special: { label: '특별', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
};

type FormData = {
  name: string;
  description: string;
  rules: string;
  type: string;
  bonus_amount: string;
  max_participants: string;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
};

const defaultForm: FormData = {
  name: '',
  description: '',
  rules: '',
  type: 'daily',
  bonus_amount: '0',
  max_participants: '0',
  is_active: true,
  starts_at: '',
  ends_at: '',
};

export default function MissionsPage() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const { data, total, loading, error, refetch } = useMissions(page, pageSize);
  const toast = useToast();
  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Mission | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);

  const activeCount = data.filter((d) => d.is_active).length;
  const inactiveCount = data.filter((d) => !d.is_active).length;

  const openCreate = () => {
    setEditingItem(null);
    setForm(defaultForm);
    setShowForm(true);
  };

  const openEdit = (item: Mission) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      description: item.description,
      rules: item.rules,
      type: item.type,
      bonus_amount: String(item.bonus_amount),
      max_participants: String(item.max_participants),
      is_active: item.is_active,
      starts_at: item.starts_at ? item.starts_at.slice(0, 16) : '',
      ends_at: item.ends_at ? item.ends_at.slice(0, 16) : '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.warning('미션명을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        description: form.description,
        rules: form.rules,
        type: form.type as Mission['type'],
        bonus_amount: Number(form.bonus_amount),
        max_participants: Number(form.max_participants),
        is_active: form.is_active,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
      };
      if (editingItem) {
        await updateMission(editingItem.id, body);
      } else {
        await createMission(body);
      }
      setShowForm(false);
      setEditingItem(null);
      setForm(defaultForm);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`"${name}" 미션을 삭제합니다. 계속하시겠습니까?`)) return;
    try {
      await deleteMission(id);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '삭제 실패');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingItem(null);
    setForm(defaultForm);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">미션 관리</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">미션을 관리합니다.</p>
        </div>
        <Button onClick={openCreate}>+ 미션 등록</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 px-5">
            <p className="text-xs text-gray-500 dark:text-gray-400">전체</p>
            <p className="text-2xl font-bold mt-1">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-5">
            <p className="text-xs text-gray-500 dark:text-gray-400">활성</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-5">
            <p className="text-xs text-gray-500 dark:text-gray-400">비활성</p>
            <p className="text-2xl font-bold mt-1 text-gray-500">{inactiveCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingItem ? '미션 수정' : '미션 등록'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">미션명</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="미션 이름"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">설명</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="미션 설명"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">규칙</label>
                <textarea
                  value={form.rules}
                  onChange={(e) => setForm({ ...form, rules: e.target.value })}
                  rows={3}
                  placeholder="미션 규칙"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">유형</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                >
                  <option value="daily">일일</option>
                  <option value="weekly">주간</option>
                  <option value="monthly">월간</option>
                  <option value="special">특별</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">보너스 금액</label>
                <Input
                  type="number"
                  value={form.bonus_amount}
                  onChange={(e) => setForm({ ...form, bonus_amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">최대 참여수</label>
                <Input
                  type="number"
                  value={form.max_participants}
                  onChange={(e) => setForm({ ...form, max_participants: e.target.value })}
                  placeholder="0 = 무제한"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">활성</label>
                <select
                  value={form.is_active ? 'true' : 'false'}
                  onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                >
                  <option value="true">활성</option>
                  <option value="false">비활성</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">시작일시</label>
                <Input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">종료일시</label>
                <Input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : editingItem ? '수정' : '등록'}
              </Button>
              <Button variant="outline" onClick={handleCancel}>취소</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-400">
            등록된 미션이 없습니다
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">미션명</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">유형</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">보너스</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">최대참여</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">기간</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">활성</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {data.map((item) => {
                const typeStyle = TYPE_STYLES[item.type];
                return (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium max-w-xs truncate">
                      {item.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${typeStyle?.cls || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {typeStyle?.label || item.type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono tabular-nums">
                      {amountFormatter.format(item.bonus_amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono tabular-nums text-gray-600 dark:text-gray-400">
                      {item.max_participants > 0 ? amountFormatter.format(item.max_participants) : '무제한'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {item.starts_at && item.ends_at
                        ? `${new Date(item.starts_at).toLocaleDateString('ko-KR')} ~ ${new Date(item.ends_at).toLocaleDateString('ko-KR')}`
                        : item.starts_at
                        ? `${new Date(item.starts_at).toLocaleDateString('ko-KR')} ~`
                        : '-'}
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
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(item)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {total}건 중 {(page - 1) * pageSize + 1}~{Math.min(page * pageSize, total)}건
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              이전
            </Button>
            <span className="text-sm py-1">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              다음
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
