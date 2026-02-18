'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProvider } from '@/hooks/use-games';

const CATEGORIES = [
  { value: 'casino', label: '카지노' },
  { value: 'slot', label: '슬롯' },
  { value: 'mini_game', label: '미니게임' },
  { value: 'virtual_soccer', label: '가상축구' },
  { value: 'sports', label: '스포츠' },
  { value: 'esports', label: 'e스포츠' },
  { value: 'holdem', label: '홀덤' },
];

export default function NewProviderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    code: '',
    category: 'casino',
    api_url: '',
    api_key: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      setError('이름과 코드를 입력하세요');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        code: form.code.trim(),
        category: form.category,
      };
      if (form.api_url.trim()) body.api_url = form.api_url.trim();
      if (form.api_key.trim()) body.api_key = form.api_key.trim();
      if (form.description.trim()) body.description = form.description.trim();

      await createProvider(body);
      router.push('/dashboard/games/providers');
    } catch (err) {
      setError(err instanceof Error ? err.message : '프로바이더 생성 실패');
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
          <h1 className="text-2xl font-bold">프로바이더 등록</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">새 게임 프로바이더를 등록합니다.</p>
        </div>
      </div>

      <div className="rounded-lg border p-6 dark:border-gray-700">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm dark:bg-red-900/30 dark:text-red-400">{error}</div>}

          <div className="space-y-2">
            <label className="text-sm font-medium">프로바이더 이름 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: Evolution Gaming"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">프로바이더 코드 *</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="예: evolution"
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
            <label className="text-sm font-medium">API URL</label>
            <input
              type="text"
              value={form.api_url}
              onChange={(e) => setForm({ ...form, api_url: e.target.value })}
              placeholder="https://api.provider.com"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">API Key</label>
            <input
              type="password"
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              placeholder="API 키 입력"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">설명</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="프로바이더에 대한 설명"
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '등록 중...' : '프로바이더 등록'}
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
