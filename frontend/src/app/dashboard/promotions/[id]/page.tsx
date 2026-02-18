'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ArrowLeft, AlertCircle, Users, BarChart3, FileText } from 'lucide-react';
import {
  usePromotion,
  usePromotionParticipants,
  usePromotionDetailStats,
  updatePromotion,
  deletePromotion,
} from '@/hooks/use-promotions';
import { useToast } from '@/components/toast-provider';

const amountFormatter = new Intl.NumberFormat('ko-KR');

const PROMOTION_TYPES = [
  { value: 'first_deposit', label: '첫충전' },
  { value: 'reload', label: '재충전' },
  { value: 'cashback', label: '캐시백' },
  { value: 'event', label: '이벤트' },
  { value: 'attendance', label: '출석' },
  { value: 'referral', label: '추천' },
];

const BONUS_TYPES = [
  { value: 'percent', label: '비율 (%)' },
  { value: 'fixed', label: '고정금액 (USDT)' },
];

const TARGET_OPTIONS = [
  { value: 'all', label: '전체 회원' },
  { value: 'vip_level', label: 'VIP 레벨 이상' },
  { value: 'new_users', label: '신규 회원' },
];

const PARTICIPANT_STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  active: { label: '진행중', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  completed: { label: '완료', cls: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  expired: { label: '만료', cls: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400' },
  cancelled: { label: '취소', cls: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
};

const TABS = [
  { key: 'info', label: '프로모션 정보', icon: FileText },
  { key: 'participants', label: '참여자 목록', icon: Users },
  { key: 'stats', label: '통계', icon: BarChart3 },
];

export default function PromotionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const promotionId = Number(params.id);

  const [activeTab, setActiveTab] = useState('info');
  const [participantPage, setParticipantPage] = useState(1);

  const { data: promotion, loading, error } = usePromotion(promotionId);
  const { data: participantData, loading: participantsLoading } = usePromotionParticipants(promotionId, participantPage);
  const { data: detailStats, loading: statsLoading } = usePromotionDetailStats(promotionId);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '', type: '', description: '', bonus_type: '', bonus_value: '',
    min_deposit: '', max_bonus: '', wagering_multiplier: '', target: '',
    target_value: '', max_claims_per_user: '', max_total_claims: '',
    start_date: '', end_date: '',
  });
  const [editInit, setEditInit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (promotion && !editInit) {
      setEditForm({
        name: promotion.name,
        type: promotion.type,
        description: promotion.description || '',
        bonus_type: promotion.bonus_type,
        bonus_value: String(promotion.bonus_value),
        min_deposit: String(promotion.min_deposit),
        max_bonus: String(promotion.max_bonus),
        wagering_multiplier: String(promotion.wagering_multiplier),
        target: promotion.target,
        target_value: promotion.target_value || '',
        max_claims_per_user: String(promotion.max_claims_per_user),
        max_total_claims: String(promotion.max_total_claims),
        start_date: promotion.start_date ? promotion.start_date.slice(0, 16) : '',
        end_date: promotion.end_date ? promotion.end_date.slice(0, 16) : '',
      });
      setEditInit(true);
    }
  }, [promotion, editInit]);

  const updateField = (field: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!editForm.name.trim()) {
      setSaveError('프로모션 이름을 입력하세요');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const body: Record<string, unknown> = {
        name: editForm.name.trim(),
        type: editForm.type,
        description: editForm.description || null,
        bonus_type: editForm.bonus_type,
        bonus_value: parseFloat(editForm.bonus_value) || 0,
        min_deposit: parseFloat(editForm.min_deposit) || 0,
        max_bonus: parseFloat(editForm.max_bonus) || 0,
        wagering_multiplier: parseFloat(editForm.wagering_multiplier) || 1,
        target: editForm.target,
        target_value: editForm.target_value || null,
        max_claims_per_user: parseInt(editForm.max_claims_per_user) || 1,
        max_total_claims: parseInt(editForm.max_total_claims) || 0,
        start_date: editForm.start_date || null,
        end_date: editForm.end_date || null,
      };
      await updatePromotion(promotionId, body);
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '수정 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deletePromotion(promotionId);
      router.push('/dashboard/promotions');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '삭제 실패');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !promotion) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-medium text-destructive">{error || '프로모션을 찾을 수 없습니다'}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>뒤로</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{promotion.name}</h2>
          <p className="text-muted-foreground">ID: {promotion.id}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Promotion Info */}
      {activeTab === 'info' && (
        <div className="space-y-6">
          {saveError && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm dark:bg-red-950 dark:text-red-300">
              {saveError}
            </div>
          )}

          <Card>
            <CardHeader><CardTitle>기본 정보</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>프로모션 이름</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => updateField('name', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>유형</Label>
                  <select
                    value={editForm.type}
                    onChange={(e) => updateField('type', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                  >
                    {PROMOTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>대상</Label>
                  <select
                    value={editForm.target}
                    onChange={(e) => updateField('target', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                  >
                    {TARGET_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {editForm.target === 'vip_level' && (
                <div className="space-y-2">
                  <Label>VIP 최소 레벨</Label>
                  <Input
                    type="number"
                    min="1"
                    value={editForm.target_value}
                    onChange={(e) => updateField('target_value', e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>설명</Label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>보너스 설정</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>보너스 유형</Label>
                  <select
                    value={editForm.bonus_type}
                    onChange={(e) => updateField('bonus_type', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                  >
                    {BONUS_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>보너스 값</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.bonus_value}
                    onChange={(e) => updateField('bonus_value', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>최소 입금액</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.min_deposit}
                    onChange={(e) => updateField('min_deposit', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>최대 보너스</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.max_bonus}
                    onChange={(e) => updateField('max_bonus', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>배팅 배수</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={editForm.wagering_multiplier}
                    onChange={(e) => updateField('wagering_multiplier', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>제한 및 기간</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>1인당 최대 참여</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editForm.max_claims_per_user}
                    onChange={(e) => updateField('max_claims_per_user', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>전체 최대 참여</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editForm.max_total_claims}
                    onChange={(e) => updateField('max_total_claims', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>시작일</Label>
                  <Input
                    type="datetime-local"
                    value={editForm.start_date}
                    onChange={(e) => updateField('start_date', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>종료일</Label>
                  <Input
                    type="datetime-local"
                    value={editForm.end_date}
                    onChange={(e) => updateField('end_date', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">삭제</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>프로모션 삭제</AlertDialogTitle>
                  <AlertDialogDescription>
                    이 프로모션을 삭제합니다. 관련된 참여 기록도 함께 삭제됩니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
                    삭제
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" onClick={() => router.back()}>뒤로</Button>
          </div>
        </div>
      )}

      {/* Tab 2: Participants */}
      {activeTab === 'participants' && (
        <Card>
          <CardHeader>
            <CardTitle>참여자 목록</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {participantsLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !participantData?.items.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-lg font-medium">참여자가 없습니다</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">회원ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">닉네임</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">보너스금액</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">배팅요구</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">배팅완료</th>
                        <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">상태</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">참여일</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                      {participantData.items.map((p) => {
                        const statusStyle = PARTICIPANT_STATUS_STYLES[p.status];
                        const wageringPercent = p.wagering_required > 0
                          ? Math.min(100, Math.round((p.wagering_completed / p.wagering_required) * 100))
                          : 0;
                        return (
                          <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">
                              {p.username}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm">
                              {p.nickname || '-'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono tabular-nums">
                              {amountFormatter.format(p.bonus_amount)} USDT
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-mono tabular-nums text-gray-600 dark:text-gray-400">
                              {amountFormatter.format(p.wagering_required)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-mono tabular-nums">{amountFormatter.format(p.wagering_completed)}</span>
                                <span className="text-xs text-muted-foreground">({wageringPercent}%)</span>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-center">
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusStyle?.cls || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                                {statusStyle?.label || p.status}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {new Date(p.claimed_at).toLocaleDateString('ko-KR')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {participantData.total > participantData.page_size && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-sm text-gray-600 dark:text-gray-400">전체: {participantData.total}명</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setParticipantPage(Math.max(1, participantPage - 1))}
                        disabled={participantPage <= 1}
                        className="rounded-md border px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-700"
                      >
                        이전
                      </button>
                      <span className="px-3 py-1 text-sm">
                        {participantData.page} / {Math.ceil(participantData.total / participantData.page_size)}
                      </span>
                      <button
                        onClick={() => setParticipantPage(participantPage + 1)}
                        disabled={participantPage >= Math.ceil(participantData.total / participantData.page_size)}
                        className="rounded-md border px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-700"
                      >
                        다음
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Stats */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="py-4 px-5">
                <p className="text-xs text-muted-foreground">총 보너스 지급액</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <p className="text-2xl font-bold mt-1">
                    {amountFormatter.format(detailStats?.total_bonus_paid ?? 0)} <span className="text-sm font-normal text-muted-foreground">USDT</span>
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 px-5">
                <p className="text-xs text-muted-foreground">전환율</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <p className="text-2xl font-bold mt-1">
                    {detailStats?.conversion_rate?.toFixed(1) ?? '0'}%
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 px-5">
                <p className="text-xs text-muted-foreground">총 참여 수</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <p className="text-2xl font-bold mt-1">
                    {promotion.total_claims.toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Daily Claims Chart (simple bar display) */}
          <Card>
            <CardHeader><CardTitle>일별 참여 현황</CardTitle></CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : !detailStats?.daily_claims?.length ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mb-4 opacity-30" />
                  <p className="text-sm">통계 데이터가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {detailStats.daily_claims.map((day) => {
                    const maxCount = Math.max(...detailStats.daily_claims.map((d) => d.count), 1);
                    const widthPercent = (day.count / maxCount) * 100;
                    return (
                      <div key={day.date} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-20 shrink-0 tabular-nums">
                          {new Date(day.date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                        </span>
                        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-6 overflow-hidden">
                          <div
                            className="bg-blue-500 h-full rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                            style={{ width: `${Math.max(widthPercent, 2)}%` }}
                          >
                            {widthPercent > 15 && (
                              <span className="text-xs text-white font-medium">{day.count}</span>
                            )}
                          </div>
                        </div>
                        {widthPercent <= 15 && (
                          <span className="text-xs text-muted-foreground w-8 tabular-nums">{day.count}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
