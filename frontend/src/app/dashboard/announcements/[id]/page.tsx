'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import { useAnnouncement, updateAnnouncement, deleteAnnouncement } from '@/hooks/use-announcements';

export default function AnnouncementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const announcementId = Number(params.id);

  const { data: announcement, loading, error } = useAnnouncement(announcementId);

  const [editForm, setEditForm] = useState({
    type: '', title: '', content: '', target: '',
    start_date: '', end_date: '', is_active: true, sort_order: '0',
  });
  const [editInit, setEditInit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  if (announcement && !editInit) {
    setEditForm({
      type: announcement.type,
      title: announcement.title,
      content: announcement.content || '',
      target: announcement.target,
      start_date: announcement.start_date ? announcement.start_date.slice(0, 10) : '',
      end_date: announcement.end_date ? announcement.end_date.slice(0, 10) : '',
      is_active: announcement.is_active,
      sort_order: String(announcement.sort_order),
    });
    setEditInit(true);
  }

  const handleSave = async () => {
    if (!editForm.title.trim()) {
      setSaveError('제목을 입력하세요');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const body: Record<string, unknown> = {
        type: editForm.type,
        title: editForm.title.trim(),
        content: editForm.content,
        target: editForm.target,
        is_active: editForm.is_active,
        sort_order: parseInt(editForm.sort_order) || 0,
        start_date: editForm.start_date || null,
        end_date: editForm.end_date || null,
      };
      await updateAnnouncement(announcementId, body);
      window.location.reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '수정 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('이 공지를 삭제합니다. 계속하시겠습니까?')) return;
    try {
      await deleteAnnouncement(announcementId);
      router.push('/dashboard/announcements');
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 실패');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;
  }

  if (error || !announcement) {
    return <div className="flex items-center justify-center h-64 text-red-500">{error || '공지를 찾을 수 없습니다'}</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">공지 상세</h2>
          <p className="text-muted-foreground">ID: {announcement.id}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>공지 수정</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {saveError && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{saveError}</div>}

            <div className="space-y-2">
              <label className="text-sm font-medium">타입</label>
              <select
                value={editForm.type}
                onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
              >
                <option value="notice">공지</option>
                <option value="popup">팝업</option>
                <option value="banner">배너</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">제목</label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">내용</label>
              <textarea
                value={editForm.content}
                onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                rows={6}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">타겟</label>
              <select
                value={editForm.target}
                onChange={(e) => setEditForm({ ...editForm, target: e.target.value })}
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
                  value={editForm.start_date}
                  onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">종료일</label>
                <Input
                  type="date"
                  value={editForm.end_date}
                  onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">정렬 순서</label>
              <Input
                type="number"
                min="0"
                value={editForm.sort_order}
                onChange={(e) => setEditForm({ ...editForm, sort_order: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={editForm.is_active}
                onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="is_active" className="text-sm font-medium">활성</label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                삭제
              </Button>
              <Button variant="outline" onClick={() => router.back()}>
                뒤로
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
