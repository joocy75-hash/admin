'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import { createPromotion } from '@/hooks/use-promotions';

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

export default function NewPromotionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    type: 'first_deposit',
    description: '',
    bonus_type: 'percent',
    bonus_value: '',
    min_deposit: '',
    max_bonus: '',
    wagering_multiplier: '',
    target: 'all',
    target_value: '',
    max_claims_per_user: '1',
    max_total_claims: '0',
    start_date: '',
    end_date: '',
  });

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setError('프로모션 이름을 입력하세요');
      return;
    }
    if (!form.bonus_value || Number(form.bonus_value) <= 0) {
      setError('보너스 값을 입력하세요');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        type: form.type,
        description: form.description || null,
        bonus_type: form.bonus_type,
        bonus_value: parseFloat(form.bonus_value),
        min_deposit: parseFloat(form.min_deposit) || 0,
        max_bonus: parseFloat(form.max_bonus) || 0,
        wagering_multiplier: parseFloat(form.wagering_multiplier) || 1,
        target: form.target,
        target_value: form.target_value || null,
        max_claims_per_user: parseInt(form.max_claims_per_user) || 1,
        max_total_claims: parseInt(form.max_total_claims) || 0,
      };
      if (form.start_date) body.start_date = form.start_date;
      if (form.end_date) body.end_date = form.end_date;

      await createPromotion(body);
      router.push('/dashboard/promotions');
    } catch (err) {
      setError(err instanceof Error ? err.message : '생성 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">프로모션 등록</h2>
          <p className="text-muted-foreground">새로운 프로모션을 생성합니다.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Section 1: Basic Info */}
        <Card>
          <CardHeader><CardTitle>기본 정보</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>프로모션 이름 *</Label>
              <Input
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="예: 첫 충전 100% 보너스"
              />
            </div>

            <div className="space-y-2">
              <Label>유형 *</Label>
              <select
                value={form.type}
                onChange={(e) => updateForm('type', e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
              >
                {PROMOTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>설명</Label>
              <textarea
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                rows={3}
                placeholder="프로모션에 대한 설명을 입력하세요"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Bonus Settings */}
        <Card>
          <CardHeader><CardTitle>보너스 설정</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>보너스 유형 *</Label>
                <select
                  value={form.bonus_type}
                  onChange={(e) => updateForm('bonus_type', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                >
                  {BONUS_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>보너스 값 *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.bonus_value}
                  onChange={(e) => updateForm('bonus_value', e.target.value)}
                  placeholder={form.bonus_type === 'percent' ? '예: 100' : '예: 50'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>최소 입금액 (USDT)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.min_deposit}
                  onChange={(e) => updateForm('min_deposit', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>최대 보너스 (USDT)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.max_bonus}
                  onChange={(e) => updateForm('max_bonus', e.target.value)}
                  placeholder="0 = 제한없음"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>배팅 배수 (Wagering Multiplier)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={form.wagering_multiplier}
                onChange={(e) => updateForm('wagering_multiplier', e.target.value)}
                placeholder="예: 3 (보너스의 3배 배팅 필요)"
              />
              <p className="text-xs text-muted-foreground">보너스 금액 대비 필요한 배팅 배수입니다. (예: 3 = 보너스 x3 배팅 후 출금 가능)</p>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Target Settings */}
        <Card>
          <CardHeader><CardTitle>대상 설정</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>대상</Label>
              <select
                value={form.target}
                onChange={(e) => updateForm('target', e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
              >
                {TARGET_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {form.target === 'vip_level' && (
              <div className="space-y-2">
                <Label>VIP 최소 레벨</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.target_value}
                  onChange={(e) => updateForm('target_value', e.target.value)}
                  placeholder="예: 3"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 4: Limit Settings */}
        <Card>
          <CardHeader><CardTitle>제한 설정</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>1인당 최대 참여</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.max_claims_per_user}
                  onChange={(e) => updateForm('max_claims_per_user', e.target.value)}
                  placeholder="0 = 무제한"
                />
                <p className="text-xs text-muted-foreground">0 = 무제한</p>
              </div>
              <div className="space-y-2">
                <Label>전체 최대 참여</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.max_total_claims}
                  onChange={(e) => updateForm('max_total_claims', e.target.value)}
                  placeholder="0 = 무제한"
                />
                <p className="text-xs text-muted-foreground">0 = 무제한</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Period Settings */}
        <Card>
          <CardHeader><CardTitle>기간 설정</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>시작일</Label>
                <Input
                  type="datetime-local"
                  value={form.start_date}
                  onChange={(e) => updateForm('start_date', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>종료일</Label>
                <Input
                  type="datetime-local"
                  value={form.end_date}
                  onChange={(e) => updateForm('end_date', e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">비워두면 상시 운영됩니다.</p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? '등록 중...' : '프로모션 등록'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            취소
          </Button>
        </div>
      </form>
    </div>
  );
}
