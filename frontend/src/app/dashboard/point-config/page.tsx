'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/toast-provider';
import {
  usePointConfigs,
  upsertPointConfig,
  type PointConfig,
} from '@/hooks/use-reward-settings';

const DEFAULT_CONFIGS: { key: string; description: string }[] = [
  { key: 'point_to_cash_rate', description: '포인트 → 캐시 전환 비율 (예: 1 = 1:1)' },
  { key: 'min_point_convert', description: '최소 전환 포인트' },
  { key: 'daily_point_convert_limit', description: '일일 포인트 전환 한도' },
];

export default function PointConfigPage() {
  const toast = useToast();
  const { data, loading, error, refetch } = usePointConfigs();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { value: string; description: string }>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const mergedData = (() => {
    const existing = new Map(data.map((item) => [item.key, item]));
    const result: (PointConfig | { id: null; key: string; value: string; description: string; created_at: null; updated_at: null })[] = [];

    for (const item of data) {
      result.push(item);
    }

    for (const def of DEFAULT_CONFIGS) {
      if (!existing.has(def.key)) {
        result.push({
          id: null,
          key: def.key,
          value: '',
          description: def.description,
          created_at: null,
          updated_at: null,
        });
      }
    }

    return result;
  })();

  useEffect(() => {
    const values: Record<string, { value: string; description: string }> = {};
    for (const item of mergedData) {
      values[item.key] = { value: item.value, description: item.description || '' };
    }
    setEditValues(values);
  }, [data]);

  const startEdit = (key: string) => {
    setEditingKey(key);
  };

  const cancelEdit = () => {
    const item = mergedData.find((i) => i.key === editingKey);
    if (item && editingKey) {
      setEditValues((prev) => ({
        ...prev,
        [editingKey]: { value: item.value, description: item.description || '' },
      }));
    }
    setEditingKey(null);
  };

  const handleSave = async (key: string) => {
    const editVal = editValues[key];
    if (!editVal) return;

    setSavingKey(key);
    try {
      await upsertPointConfig(key, {
        value: editVal.value,
        description: editVal.description || undefined,
      });
      toast.success(`${key} 설정이 저장되었습니다`);
      setEditingKey(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">포인트 설정</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">포인트 전환 및 제한 설정을 관리합니다.</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : mergedData.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-400">
            설정 항목이 없습니다
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">설정키</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">설정값</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">설명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 w-32">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                  {mergedData.map((item) => {
                    const isEditing = editingKey === item.key;
                    const isSaving = savingKey === item.key;
                    const editVal = editValues[item.key];

                    return (
                      <tr key={item.key} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-mono font-medium">
                          {item.key}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {isEditing ? (
                            <Input
                              value={editVal?.value || ''}
                              onChange={(e) => setEditValues((prev) => ({
                                ...prev,
                                [item.key]: { ...prev[item.key], value: e.target.value },
                              }))}
                              className="h-8 text-sm font-mono w-48"
                              autoFocus
                            />
                          ) : (
                            <span className="font-mono tabular-nums text-gray-700 dark:text-gray-300">
                              {item.value || <span className="text-gray-400 italic">미설정</span>}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {isEditing ? (
                            <Input
                              value={editVal?.description || ''}
                              onChange={(e) => setEditValues((prev) => ({
                                ...prev,
                                [item.key]: { ...prev[item.key], description: e.target.value },
                              }))}
                              className="h-8 text-sm w-64"
                              placeholder="설명 (선택)"
                            />
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">
                              {item.description || '-'}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {isEditing ? (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                className="h-7"
                                onClick={() => handleSave(item.key)}
                                disabled={isSaving}
                              >
                                {isSaving ? '...' : '저장'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7"
                                onClick={cancelEdit}
                              >
                                취소
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(item.key)}
                            >
                              수정
                            </Button>
                          )}
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
    </div>
  );
}
