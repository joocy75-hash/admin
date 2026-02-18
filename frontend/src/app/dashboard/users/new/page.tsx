'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import { createUser } from '@/hooks/use-users';

export default function NewUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    username: '',
    real_name: '',
    phone: '',
    email: '',
    referrer_code: '',
    level: '1',
    memo: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim()) {
      setError('아이디를 입력하세요');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        username: form.username.trim(),
        level: parseInt(form.level) || 1,
      };
      if (form.real_name) body.real_name = form.real_name;
      if (form.phone) body.phone = form.phone;
      if (form.email) body.email = form.email;
      if (form.referrer_code.trim()) body.referrer_code = form.referrer_code.trim();
      if (form.memo) body.memo = form.memo;

      const user = await createUser(body);
      router.push(`/dashboard/users/${user.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '회원 생성 실패');
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
          <h2 className="text-2xl font-bold tracking-tight">회원 등록</h2>
          <p className="text-muted-foreground">아이디가 추천인 코드로 사용됩니다.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>회원 정보</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>}

            <div className="space-y-2">
              <label className="text-sm font-medium">아이디 (추천인 코드) *</label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="영문, 숫자 조합" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">실명</label>
              <Input value={form.real_name} onChange={(e) => setForm({ ...form, real_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">전화번호</label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="010-0000-0000" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">이메일</label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">추천인 코드 (추천인의 아이디)</label>
              <Input value={form.referrer_code} onChange={(e) => setForm({ ...form, referrer_code: e.target.value })} placeholder="추천인 아이디 입력 (없으면 빈칸)" />
              <p className="text-xs text-muted-foreground">기존 회원의 아이디를 입력하면 해당 회원의 하위로 등록됩니다.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">레벨</label>
              <Input type="number" min="1" max="99" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">메모</label>
              <Input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={loading}>{loading ? '등록 중...' : '회원 등록'}</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>취소</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
