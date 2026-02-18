'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Gift, Users, DollarSign, AlertCircle, Plus, Pencil, Trash2, Power } from 'lucide-react';
import { useToast } from '@/components/toast-provider';
import {
  usePromotions,
  usePromotionStats,
  deletePromotion,
  togglePromotion,
} from '@/hooks/use-promotions';

const amountFormatter = new Intl.NumberFormat('ko-KR');

const TYPE_TABS = [
  { key: '', label: '전체' },
  { key: 'first_deposit', label: '첫충' },
  { key: 'reload', label: '재충' },
  { key: 'cashback', label: '캐시백' },
  { key: 'event', label: '이벤트' },
  { key: 'attendance', label: '출석' },
  { key: 'referral', label: '추천' },
];

const STATUS_TABS = [
  { key: '', label: '전체' },
  { key: 'true', label: '활성' },
  { key: 'false', label: '비활성' },
];

const TYPE_STYLES: Record<string, { label: string; cls: string }> = {
  first_deposit: { label: '첫충', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  reload: { label: '재충', cls: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  cashback: { label: '캐시백', cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
  event: { label: '이벤트', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
  attendance: { label: '출석', cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  referral: { label: '추천', cls: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300' },
};

const BONUS_TYPE_LABELS: Record<string, string> = {
  percent: '%',
  fixed: 'USDT',
};

export default function PromotionsPage() {
  const toast = useToast();
  const [typeFilter, setTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: stats, loading: statsLoading } = usePromotionStats();
  const { data, loading, error, refetch } = usePromotions({
    page,
    page_size: 20,
    type: typeFilter || undefined,
    is_active: activeFilter === '' ? undefined : activeFilter === 'true',
  });

  const handleToggle = async (id: number) => {
    try {
      await togglePromotion(id);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '상태 변경 실패');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deletePromotion(id);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '삭제 실패');
    }
  };

  const formatBonusValue = (type: string, value: number) => {
    if (type === 'percent') return `${value}%`;
    return `${amountFormatter.format(value)} USDT`;
  };

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950">
              <Gift className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">활성 프로모션</p>
              {statsLoading ? (
                <Skeleton className="h-8 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-bold">{stats?.active_count?.toLocaleString() ?? '0'}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950">
              <Users className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">총 참여 수</p>
              {statsLoading ? (
                <Skeleton className="h-8 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-bold">{stats?.total_participants?.toLocaleString() ?? '0'}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950">
              <DollarSign className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">총 보너스 지급액</p>
              {statsLoading ? (
                <Skeleton className="h-8 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-bold">{amountFormatter.format(stats?.total_bonus_paid ?? 0)}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">프로모션 관리</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            보너스, 이벤트, 쿠폰을 관리합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/promotions/coupons">
            <Button variant="outline" size="sm">쿠폰 관리</Button>
          </Link>
          <Link href="/dashboard/promotions/new">
            <Button size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" />새 프로모션</Button>
          </Link>
        </div>
      </div>

      {/* Type Filter Tabs */}
      <div className="flex gap-1 border-b">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              typeFilter === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
            onClick={() => { setTypeFilter(tab.key); setPage(1); }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground self-center mr-1">상태:</span>
        {STATUS_TABS.map((s) => (
          <Button
            key={s.key}
            variant={activeFilter === s.key ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => { setActiveFilter(s.key); setPage(1); }}
          >
            {s.label}
          </Button>
        ))}
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
          <Gift className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">등록된 프로모션이 없습니다</p>
          <p className="text-sm">조건을 변경하거나 새로 등록해주세요.</p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">이름</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">유형</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">보너스</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">최소입금</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">최대보너스</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">배팅요구</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">참여수</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">기간</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                  {data!.items.map((promo) => {
                    const typeStyle = TYPE_STYLES[promo.type];
                    return (
                      <tr key={promo.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
                          <Link href={`/dashboard/promotions/${promo.id}`} className="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                            {promo.name}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${typeStyle?.cls || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {typeStyle?.label || promo.type}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono tabular-nums">
                          {formatBonusValue(promo.bonus_type, promo.bonus_value)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono tabular-nums text-gray-600 dark:text-gray-400">
                          {amountFormatter.format(promo.min_deposit)} {BONUS_TYPE_LABELS.fixed}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono tabular-nums text-gray-600 dark:text-gray-400">
                          {amountFormatter.format(promo.max_bonus)} {BONUS_TYPE_LABELS.fixed}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono tabular-nums text-gray-600 dark:text-gray-400">
                          x{promo.wagering_multiplier}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-center">
                          <span className="font-medium">{promo.total_claims.toLocaleString()}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {promo.start_date && promo.end_date
                            ? `${new Date(promo.start_date).toLocaleDateString('ko-KR')} ~ ${new Date(promo.end_date).toLocaleDateString('ko-KR')}`
                            : promo.start_date
                            ? `${new Date(promo.start_date).toLocaleDateString('ko-KR')} ~`
                            : '상시'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-center">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            promo.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {promo.is_active ? '활성' : '비활성'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <div className="flex gap-1">
                            <Link href={`/dashboard/promotions/${promo.id}`}>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="편집">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title={promo.is_active ? '비활성화' : '활성화'}
                              onClick={() => handleToggle(promo.id)}
                            >
                              <Power className={`h-3.5 w-3.5 ${promo.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600 hover:text-red-800" title="삭제">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>프로모션 삭제</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    &quot;{promo.name}&quot; 프로모션을 삭제합니다. 이 작업은 되돌릴 수 없습니다.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>취소</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => handleDelete(promo.id)}
                                  >
                                    삭제
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
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

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            전체: {data.total}개
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
