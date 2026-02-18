'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useProviderList, deleteProvider } from '@/hooks/use-games';

const CATEGORY_LABELS: Record<string, string> = {
  casino: '카지노', slot: '슬롯', mini_game: '미니게임',
  virtual_soccer: '가상축구', sports: '스포츠', esports: 'e스포츠', holdem: '홀덤',
};

export default function ProvidersPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, loading, refetch } = useProviderList({
    page,
    page_size: 20,
    category: categoryFilter || undefined,
    search: search || undefined,
    is_active: activeFilter === '' ? undefined : activeFilter === 'true',
  });

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}" 프로바이더를 비활성화합니다. 계속하시겠습니까?`)) return;
    try {
      await deleteProvider(id);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 실패');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">프로바이더 관리</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">게임 프로바이더를 등록하고 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/games">
            <button className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800">
              게임 목록
            </button>
          </Link>
          <Link href="/dashboard/games/providers/new">
            <button className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              + 프로바이더 등록
            </button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <input
          type="text"
          placeholder="이름 / 코드 검색"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
        />
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
        >
          <option value="">전체 카테고리</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={activeFilter}
          onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
        >
          <option value="">전체 상태</option>
          <option value="true">활성</option>
          <option value="false">비활성</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">코드</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">이름</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">카테고리</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">API URL</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">활성</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">등록일</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {data?.items.map((provider) => (
                <tr key={provider.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">{provider.code}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
                    <Link href={`/dashboard/games/providers/${provider.id}`} className="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                      {provider.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                      {CATEGORY_LABELS[provider.category] || provider.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-48 truncate">
                    {provider.api_url || <span className="text-gray-300 dark:text-gray-600">-</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-center">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      provider.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {provider.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(provider.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <Link href={`/dashboard/games/providers/${provider.id}`}>
                        <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400">수정</button>
                      </Link>
                      <button
                        onClick={() => handleDelete(provider.id, provider.name)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    등록된 프로바이더가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">전체: {data.total}개</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded-md border px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-700"
            >
              이전
            </button>
            <span className="px-3 py-1 text-sm">
              {data.page} / {Math.ceil(data.total / data.page_size)}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= Math.ceil(data.total / data.page_size)}
              className="rounded-md border px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-700"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
