'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import { useRole, usePermissions, updateRole, deleteRole, updateRolePermissions } from '@/hooks/use-roles';

export default function RoleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const roleId = Number(params.id);

  const { data: role, loading, error } = useRole(roleId);
  const { data: allPermissions, loading: permLoading } = usePermissions();

  const [editForm, setEditForm] = useState({
    display_name: '',
    description: '',
  });
  const [editInit, setEditInit] = useState(false);
  const [selectedPerms, setSelectedPerms] = useState<Set<number>>(new Set());
  const [permInit, setPermInit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Initialize form from role data
  useEffect(() => {
    if (role && !editInit) {
      setEditForm({
        display_name: role.display_name || '',
        description: role.description || '',
      });
      setEditInit(true);
    }
  }, [role, editInit]);

  // Initialize selected permissions
  useEffect(() => {
    if (role && !permInit) {
      setSelectedPerms(new Set(role.permissions.map((p) => p.id)));
      setPermInit(true);
    }
  }, [role, permInit]);

  // Group permissions by module
  const grouped = useMemo(() => {
    const map = new Map<string, typeof allPermissions>();
    for (const p of allPermissions) {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allPermissions]);

  const togglePerm = (id: number) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleModule = (modulePerms: typeof allPermissions) => {
    const allSelected = modulePerms.every((p) => selectedPerms.has(p.id));
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      for (const p of modulePerms) {
        allSelected ? next.delete(p.id) : next.add(p.id);
      }
      return next;
    });
  };

  const handleSaveInfo = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await updateRole(roleId, {
        display_name: editForm.display_name.trim() || null,
        description: editForm.description.trim() || null,
      });
      window.location.reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '수정 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePermissions = async () => {
    setSavingPerms(true);
    setSaveError('');
    try {
      await updateRolePermissions(roleId, Array.from(selectedPerms));
      window.location.reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '권한 저장 실패');
    } finally {
      setSavingPerms(false);
    }
  };

  const handleDelete = async () => {
    if (role?.is_system) {
      alert('시스템 역할은 삭제할 수 없습니다.');
      return;
    }
    if (!confirm('이 역할을 삭제합니다. 계속하시겠습니까?')) return;
    try {
      await deleteRole(roleId);
      router.push('/dashboard/roles');
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 실패');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;
  }

  if (error || !role) {
    return <div className="flex items-center justify-center h-64 text-red-500">{error || '역할을 찾을 수 없습니다'}</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{role.display_name || role.name}</h2>
            {role.is_system && (
              <span className="inline-flex rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                시스템
              </span>
            )}
          </div>
          <p className="text-muted-foreground font-mono text-sm">{role.name}</p>
        </div>
      </div>

      {saveError && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{saveError}</div>}

      {/* Role Info */}
      <Card>
        <CardHeader><CardTitle>역할 정보</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">표시명</label>
            <Input
              value={editForm.display_name}
              onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">설명</label>
            <Input
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSaveInfo} disabled={saving}>
              {saving ? '저장 중...' : '정보 저장'}
            </Button>
            {!role.is_system && (
              <Button variant="destructive" onClick={handleDelete}>
                역할 삭제
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Permissions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>권한 관리 ({selectedPerms.size}개 선택)</CardTitle>
            <Button onClick={handleSavePermissions} disabled={savingPerms} size="sm">
              {savingPerms ? '저장 중...' : '권한 저장'}
            </Button>
          </div>
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
    </div>
  );
}
