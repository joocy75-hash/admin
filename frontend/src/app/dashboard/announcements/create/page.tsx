'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import { createAnnouncement } from '@/hooks/use-announcements';

export default function CreateAnnouncementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    type: 'notice',
    title: '',
    content: '',
    target: 'all',
    start_date: '',
    end_date: '',
    is_active: true,
    sort_order: '0',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('제목을 입력하세요');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        type: form.type,
        title: form.title.trim(),
        content: form.content,
        target: form.target,
        is_active: form.is_active,
        sort_order: parseInt(form.sort_order) || 0,
      };
      if (form.start_date) body.start_date = form.start_date;
      if (form.end_date) body.end_date = form.end_date;

      await createAnnouncement(body);
      router.push('/dashboard/announcements');
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
          <h2 className="text-2xl font-bold tracking-tight">공지 등록</h2>
          <p className="text-muted-foreground">공지사항, 팝업, 배너를 등록합니다.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>공지 정보</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>}

            <div className="space-y-2">
              <label className="text-sm font-medium">타입 *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
              >
                <option value="notice">공지</option>
                <option value="popup">팝업</option>
                <option value="banner">배너</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">제목 *</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="제목을 입력하세요"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">내용</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={6}
                placeholder="내용을 입력하세요"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">타겟</label>
              <select
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
              >
                <option value="all">전체</option>
                <option value="agents">에이전트</option>
                <option value="users">회원</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">시작일</label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">종료일</label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">정렬 순서</label>
              <Input
                type="number"
                min="0"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="is_active" className="text-sm font-medium">활성</label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={loading}>{loading ? '등록 중...' : '등록'}</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>취소</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
