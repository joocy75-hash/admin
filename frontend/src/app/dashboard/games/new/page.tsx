'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createGame, useProviderList } from '@/hooks/use-games';

const CATEGORIES = [
  { value: 'casino', label: '카지노' },
  { value: 'slot', label: '슬롯' },
  { value: 'mini_game', label: '미니게임' },
  { value: 'virtual_soccer', label: '가상축구' },
  { value: 'sports', label: '스포츠' },
  { value: 'esports', label: 'e스포츠' },
  { value: 'holdem', label: '홀덤' },
];

export default function NewGamePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: providerData } = useProviderList({ page_size: 100 });

  const [form, setForm] = useState({
    provider_id: '',
    name: '',
    code: '',
    category: 'casino',
    sort_order: '0',
    thumbnail_url: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      setError('이름과 코드를 입력하세요');
      return;
    }
    if (!form.provider_id) {
      setError('프로바이더를 선택하세요');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        provider_id: Number(form.provider_id),
        name: form.name.trim(),
        code: form.code.trim(),
        category: form.category,
        sort_order: parseInt(form.sort_order) || 0,
      };
      if (form.thumbnail_url.trim()) body.thumbnail_url = form.thumbnail_url.trim();

      await createGame(body);
      router.push('/dashboard/games');
    } catch (err) {
      setError(err instanceof Error ? err.message : '게임 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          &larr; 뒤로
        </button>
        <div>
          <h1 className="text-2xl font-bold">게임 등록</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">새 게임을 등록합니다.</p>
        </div>
      </div>

      <div className="rounded-lg border p-6 dark:border-gray-700">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm dark:bg-red-900/30 dark:text-red-400">{error}</div>}

          <div className="space-y-2">
            <label className="text-sm font-medium">프로바이더 *</label>
            <select
              value={form.provider_id}
              onChange={(e) => setForm({ ...form, provider_id: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
            >
              <option value="">프로바이더 선택</option>
              {providerData?.items.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">게임 이름 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: Baccarat Live"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">게임 코드 *</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="예: baccarat_live"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">카테고리 *</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">정렬 순서</label>
            <input
              type="number"
              min="0"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">썸네일 URL</label>
            <input
              type="text"
              value={form.thumbnail_url}
              onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
              placeholder="https://..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '등록 중...' : '게임 등록'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
