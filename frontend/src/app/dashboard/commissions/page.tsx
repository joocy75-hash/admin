'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePolicyList, deletePolicy, type CommissionPolicy } from '@/hooks/use-commissions';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertCircle, Percent } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  rolling: '롤링',
  losing: '루징 (죽장)',
  deposit: '입금',
};

const CATEGORY_LABELS: Record<string, string> = {
  casino: '카지노',
  slot: '슬롯',
  mini_game: '미니게임',
  virtual_soccer: '가상축구',
  sports: '스포츠',
  esports: 'e스포츠',
  holdem: '홀덤',
};

export default function CommissionPoliciesPage() {
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, loading, error, refetch } = usePolicyList({
    page,
    page_size: 20,
    type: typeFilter || undefined,
    game_category: categoryFilter || undefined,
  });

  const handleDelete = async (policy: CommissionPolicy) => {
    if (!confirm(`"${policy.name}" 정책을 비활성화합니다. 계속하시겠습니까?`)) return;
    try {
      await deletePolicy(policy.id);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const formatRates = (rates: Record<string, number>) => {
    return Object.entries(rates)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([lvl, rate]) => `L${lvl}: ${rate}%`)
      .join(', ');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">커미션 정책</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/commissions/overrides">
            <button className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800">
              에이전트 오버라이드
            </button>
          </Link>
          <Link href="/dashboard/commissions/ledger">
            <button className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800">
              커미션 원장
            </button>
          </Link>
          <Link href="/dashboard/commissions/new">
            <button className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              + 정책 등록
            </button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">전체 유형</option>
          <option value="rolling">롤링</option>
          <option value="losing">루징</option>
          <option value="deposit">입금</option>
        </select>
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
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-destructive">
          <AlertCircle className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">데이터를 불러오지 못했습니다</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Button variant="outline" className="mt-4" onClick={refetch}>다시 시도</Button>
        </div>
      ) : data?.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Percent className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">등록된 커미션 정책이 없습니다</p>
          <p className="text-sm">조건을 변경하거나 새로 등록해주세요.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">정책명</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">유형</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">카테고리</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">단계별 비율</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">최소 베팅</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">우선순위</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {data?.items.map((policy) => (
                <tr key={policy.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">{policy.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      policy.type === 'rolling' ? 'bg-blue-100 text-blue-800' :
                      policy.type === 'losing' ? 'bg-red-100 text-red-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {TYPE_LABELS[policy.type] || policy.type}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {policy.game_category ? CATEGORY_LABELS[policy.game_category] || policy.game_category : (
                      <span className="text-gray-400">전체</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{formatRates(policy.level_rates)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {Number(policy.min_bet_amount).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      policy.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {policy.active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-center">{policy.priority}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <Link href={`/dashboard/commissions/${policy.id}`}>
                        <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400">수정</button>
                      </Link>
                      <button
                        onClick={() => handleDelete(policy)}
                        className="text-red-600 hover:text-red-800"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            전체: {data.total}건
          </p>
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
