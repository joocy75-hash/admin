'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSettings, updateSetting, type SettingGroup } from '@/hooks/use-settings';
import { useToast } from '@/components/toast-provider';

const GROUP_LABELS: Record<string, string> = {
  general: '일반',
  security: '보안',
  commission: '커미션',
  settlement: '정산',
  notification: '알림',
  system: '시스템',
};

export default function SettingsPage() {
  const toast = useToast();
  const { data: groups, loading, error, refetch } = useSettings();
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  // Initialize edit values from loaded data
  useEffect(() => {
    if (groups.length > 0) {
      const values: Record<string, string> = {};
      for (const group of groups) {
        for (const item of group.items) {
          values[`${group.group_name}:${item.key}`] = item.value;
        }
      }
      setEditValues(values);
      // Open first group by default
      if (!openGroup) {
        setOpenGroup(groups[0].group_name);
      }
    }
  }, [groups, openGroup]);

  const handleSave = async (group: string, key: string) => {
    const compositeKey = `${group}:${key}`;
    const value = editValues[compositeKey];
    if (value === undefined) return;

    setSavingKeys((prev) => new Set(prev).add(compositeKey));
    try {
      await updateSetting(group, key, value);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '설정 저장 실패');
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(compositeKey);
        return next;
      });
    }
  };

  const getOriginalValue = (groups: SettingGroup[], group: string, key: string): string => {
    const g = groups.find((g) => g.group_name === group);
    const item = g?.items.find((i) => i.key === key);
    return item?.value || '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">시스템 설정</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">시스템 설정 값을 관리합니다.</p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-400">
            설정 항목이 없습니다
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const isOpen = openGroup === group.group_name;
            return (
              <Card key={group.group_name}>
                <CardHeader
                  className="cursor-pointer select-none"
                  onClick={() => setOpenGroup(isOpen ? null : group.group_name)}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {GROUP_LABELS[group.group_name] || group.group_name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">{group.items.length}개</span>
                      <span className="text-gray-400">{isOpen ? '▼' : '▶'}</span>
                    </div>
                  </div>
                </CardHeader>
                {isOpen && (
                  <CardContent>
                    <div className="space-y-4">
                      {group.items.map((item) => {
                        const compositeKey = `${group.group_name}:${item.key}`;
                        const currentValue = editValues[compositeKey] ?? item.value;
                        const originalValue = getOriginalValue(groups, group.group_name, item.key);
                        const isModified = currentValue !== originalValue;
                        const isSaving = savingKeys.has(compositeKey);

                        return (
                          <div key={item.id} className="flex items-start gap-4 py-2 border-b last:border-0 dark:border-gray-700">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{item.key}</span>
                                {isModified && (
                                  <span className="text-xs text-orange-500">수정됨</span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {item.value.length > 100 ? (
                                <textarea
                                  value={currentValue}
                                  onChange={(e) => setEditValues({ ...editValues, [compositeKey]: e.target.value })}
                                  rows={3}
                                  className="w-80 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-mono dark:bg-gray-900 dark:border-gray-700"
                                />
                              ) : (
                                <Input
                                  value={currentValue}
                                  onChange={(e) => setEditValues({ ...editValues, [compositeKey]: e.target.value })}
                                  className="w-80 h-8 text-sm font-mono"
                                />
                              )}
                              <Button
                                size="sm"
                                disabled={!isModified || isSaving}
                                onClick={() => handleSave(group.group_name, item.key)}
                                className="h-8"
                              >
                                {isSaving ? '...' : '저장'}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
