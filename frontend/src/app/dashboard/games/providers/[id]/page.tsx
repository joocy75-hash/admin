'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProvider, useGameList, updateProvider, deleteProvider } from '@/hooks/use-games';

const CATEGORIES = [
  { value: 'casino', label: '카지노' },
  { value: 'slot', label: '슬롯' },
  { value: 'mini_game', label: '미니게임' },
  { value: 'virtual_soccer', label: '가상축구' },
  { value: 'sports', label: '스포츠' },
  { value: 'esports', label: 'e스포츠' },
  { value: 'holdem', label: '홀덤' },
];

const CATEGORY_LABELS: Record<string, string> = {
  casino: '카지노', slot: '슬롯', mini_game: '미니게임',
  virtual_soccer: '가상축구', sports: '스포츠', esports: 'e스포츠', holdem: '홀덤',
};

export default function ProviderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const providerId = Number(params.id);

  const { data: provider, loading } = useProvider(providerId);
  const { data: gamesData } = useGameList({ provider_id: providerId, page_size: 50 });

  const [editForm, setEditForm] = useState({
    name: '', code: '', category: '', api_url: '', api_key: '',
    description: '', is_active: true,
  });
  const [editInit, setEditInit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (provider && !editInit) {
    setEditForm({
      name: provider.name,
      code: provider.code,
      category: provider.category,
      api_url: provider.api_url || '',
      api_key: provider.api_key || '',
      description: provider.description || '',
      is_active: provider.is_active,
    });
    setEditInit(true);
  }

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        name: editForm.name.trim(),
        code: editForm.code.trim(),
        category: editForm.category,
        api_url: editForm.api_url.trim() || null,
        api_key: editForm.api_key.trim() || null,
        description: editForm.description.trim() || null,
        is_active: editForm.is_active,
      };
      await updateProvider(providerId, body);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '수정 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('이 프로바이더를 비활성화합니다. 계속하시겠습니까?')) return;
    try {
      await deleteProvider(providerId);
      router.push('/dashboard/games/providers');
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 실패');
    }
  };

  if (loading || !provider) {
    return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          &larr; 뒤로
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{provider.name}</h1>
            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
              provider.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
            }`}>
              {provider.is_active ? '활성' : '비활성'}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {provider.code} &middot; {CATEGORY_LABELS[provider.category] || provider.category}
          </p>
        </div>
      </div>

      {/* Edit Form */}
      <div className="rounded-lg border p-6 dark:border-gray-700 space-y-4 max-w-2xl">
        <h2 className="text-lg font-semibold">프로바이더 정보 수정</h2>
        {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm dark:bg-red-900/30 dark:text-red-400">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">이름</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">코드</label>
            <input
              type="text"
              value={editForm.code}
              onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">카테고리</label>
            <select
              value={editForm.category}
              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">상태</label>
            <select
              value={editForm.is_active ? 'true' : 'false'}
              onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'true' })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
            >
              <option value="true">활성</option>
              <option value="false">비활성</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">API URL</label>
          <input
            type="text"
            value={editForm.api_url}
            onChange={(e) => setEditForm({ ...editForm, api_url: e.target.value })}
            placeholder="https://api.provider.com"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">API Key</label>
          <input
            type="password"
            value={editForm.api_key}
            onChange={(e) => setEditForm({ ...editForm, api_key: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">설명</label>
          <textarea
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
          <button
            onClick={handleDelete}
            className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >
            비활성화
          </button>
        </div>
      </div>

      {/* Games List */}
      <div className="rounded-lg border dark:border-gray-700">
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold">
            소속 게임 ({gamesData?.total || 0}개)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">코드</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">이름</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">카테고리</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">활성</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">정렬</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {gamesData?.items.map((game) => (
                <tr key={game.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">{game.code}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
                    <Link href={`/dashboard/games/${game.id}`} className="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                      {game.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                      {CATEGORY_LABELS[game.category] || game.category}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-center">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      game.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {game.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                    {game.sort_order}
                  </td>
                </tr>
              ))}
              {(!gamesData?.items || gamesData.items.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    등록된 게임이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
