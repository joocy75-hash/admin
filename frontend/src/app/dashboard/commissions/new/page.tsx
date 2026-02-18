'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPolicy } from '@/hooks/use-commissions';

const GAME_CATEGORIES = [
  { value: '', label: '전체 (공통)' },
  { value: 'casino', label: '카지노' },
  { value: 'slot', label: '슬롯' },
  { value: 'mini_game', label: '미니게임' },
  { value: 'virtual_soccer', label: '가상축구' },
  { value: 'sports', label: '스포츠' },
  { value: 'esports', label: 'e스포츠' },
  { value: 'holdem', label: '홀덤' },
];

export default function NewPolicyPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [type, setType] = useState('rolling');
  const [gameCategory, setGameCategory] = useState('');
  const [minBetAmount, setMinBetAmount] = useState('0');
  const [priority, setPriority] = useState('0');
  const [levelCount, setLevelCount] = useState(3);
  const [rates, setRates] = useState<Record<string, string>>({ '1': '0.5', '2': '0.3', '3': '0.1' });

  const handleLevelCountChange = (count: number) => {
    setLevelCount(count);
    const newRates: Record<string, string> = {};
    for (let i = 1; i <= count; i++) {
      newRates[String(i)] = rates[String(i)] || '0';
    }
    setRates(newRates);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const levelRates: Record<string, number> = {};
      for (const [k, v] of Object.entries(rates)) {
        const num = parseFloat(v);
        if (!isNaN(num) && num > 0) levelRates[k] = num;
      }

      await createPolicy({
        name,
        type,
        level_rates: levelRates,
        game_category: gameCategory || null,
        min_bet_amount: parseFloat(minBetAmount) || 0,
        priority: parseInt(priority) || 0,
        active: true,
      });
      router.push('/dashboard/commissions');
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">커미션 정책 등록</h1>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border bg-white p-6 dark:bg-gray-900 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">정책명 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
              placeholder="예: 카지노 롤링"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">유형 *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
            >
              <option value="rolling">롤링 (베팅 기반)</option>
              <option value="losing">루징 / 죽장 (손실 기반)</option>
              <option value="deposit">입금 (입금 기반)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">게임 카테고리</label>
            <select
              value={gameCategory}
              onChange={(e) => setGameCategory(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
            >
              {GAME_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">최소 베팅금</label>
            <input
              type="number"
              value={minBetAmount}
              onChange={(e) => setMinBetAmount(e.target.value)}
              min="0"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">우선순위 (높을수록 우선)</label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="mt-1 w-32 rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
          />
        </div>

        {/* Level rates */}
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              단계별 비율 ({type === 'losing' ? '손실금' : '베팅금'}의 %)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">단계 수:</span>
              <select
                value={levelCount}
                onChange={(e) => handleLevelCountChange(Number(e.target.value))}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-2 space-y-2">
            {Array.from({ length: levelCount }, (_, i) => String(i + 1)).map((lvl) => (
              <div key={lvl} className="flex items-center gap-3">
                <span className="w-20 text-sm text-gray-600 dark:text-gray-400">{lvl}단계:</span>
                <input
                  type="number"
                  value={rates[lvl] || '0'}
                  onChange={(e) => setRates({ ...rates, [lvl]: e.target.value })}
                  step="0.01"
                  min="0"
                  max="100"
                  className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <span className="text-sm text-gray-400">%</span>
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            1단계 = 직속 에이전트, 2단계 = 상위, 3단계 = 상위의 상위, ...
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving || !name}
            className="rounded-md bg-blue-600 px-6 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '등록 중...' : '정책 등록'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-gray-300 px-6 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
