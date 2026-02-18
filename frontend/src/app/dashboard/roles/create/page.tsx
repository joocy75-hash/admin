'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import { usePermissions, createRole, updateRolePermissions } from '@/hooks/use-roles';

export default function CreateRolePage() {
  const router = useRouter();
  const { data: permissions, loading: permLoading } = usePermissions();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    display_name: '',
    description: '',
  });
  const [selectedPerms, setSelectedPerms] = useState<Set<number>>(new Set());

  // Group permissions by module
  const grouped = useMemo(() => {
    const map = new Map<string, typeof permissions>();
    for (const p of permissions) {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissions]);

  const togglePerm = (id: number) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleModule = (modulePerms: typeof permissions) => {
    const allSelected = modulePerms.every((p) => selectedPerms.has(p.id));
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      for (const p of modulePerms) {
        allSelected ? next.delete(p.id) : next.add(p.id);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('역할 코드명을 입력하세요');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        display_name: form.display_name.trim() || null,
        description: form.description.trim() || null,
      };
      const role = await createRole(body);

      // Assign permissions
      if (selectedPerms.size > 0) {
        await updateRolePermissions(role.id, Array.from(selectedPerms));
      }

      router.push('/dashboard/roles');
    } catch (err) {
      setError(err instanceof Error ? err.message : '역할 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">역할 생성</h2>
          <p className="text-muted-foreground">새 역할을 생성하고 권한을 할당합니다.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>역할 정보</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>}

            <div className="space-y-2">
              <label className="text-sm font-medium">코드명 (영문) *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: content_manager"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">표시명</label>
              <Input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="예: 컨텐츠 관리자"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">설명</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="역할에 대한 설명"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>권한 할당 ({selectedPerms.size}개 선택)</CardTitle>
          </CardHeader>
          <CardContent>
            {permLoading ? (
              <p className="text-gray-500">권한 로딩 중...</p>
            ) : (
              <div className="space-y-6">
                {grouped.map(([module, perms]) => (
                  <div key={module} className="space-y-2">
                    <div className="flex items-center gap-2 border-b pb-2 dark:border-gray-700">
                      <input
                        type="checkbox"
                        checked={perms.every((p) => selectedPerms.has(p.id))}
                        onChange={() => toggleModule(perms)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-semibold uppercase text-gray-700 dark:text-gray-300">
                        {module}
                      </span>
                      <span className="text-xs text-gray-400">({perms.length})</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pl-6">
                      {perms.map((perm) => (
                        <label key={perm.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedPerms.has(perm.id)}
                            onChange={() => togglePerm(perm.id)}
                            className="rounded border-gray-300"
                          />
                          <span className="text-gray-700 dark:text-gray-300">{perm.name}</span>
                          {perm.description && (
                            <span className="text-xs text-gray-400">{perm.description}</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>{loading ? '생성 중...' : '역할 생성'}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>취소</Button>
        </div>
      </form>
    </div>
  );
}
