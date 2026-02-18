'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUserMessages, sendMessage, markMessageRead, type Message } from '@/hooks/use-user-detail';
import { Send, Mail, MailOpen } from 'lucide-react';

type Props = { userId: number };

export default function TabMessages({ userId }: Props) {
  const [page, setPage] = useState(1);
  const [direction, setDirection] = useState('');
  const [showSendForm, setShowSendForm] = useState(false);
  const [sendForm, setSendForm] = useState({ title: '', content: '' });
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<Message | null>(null);

  const { data, loading, refetch } = useUserMessages(userId, {
    page,
    page_size: 20,
    direction: direction || undefined,
  });

  const handleSend = async () => {
    if (!sendForm.title.trim() || !sendForm.content.trim()) {
      alert('제목과 내용을 입력하세요');
      return;
    }
    setSending(true);
    try {
      await sendMessage(userId, sendForm.title, sendForm.content);
      setSendForm({ title: '', content: '' });
      setShowSendForm(false);
      refetch();
    } catch { alert('쪽지 발송 실패'); }
    finally { setSending(false); }
  };

  const handleSelect = async (msg: Message) => {
    setSelected(msg);
    if (!msg.is_read && msg.receiver_type === 'user' && msg.receiver_id === userId) {
      try {
        await markMessageRead(userId, msg.id);
        refetch();
      } catch { /* ignore */ }
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={() => setShowSendForm(!showSendForm)}>
          <Send className="h-3.5 w-3.5 mr-1" />쪽지 보내기
        </Button>
        <select
          className="border rounded-md px-3 py-1.5 text-sm bg-background"
          value={direction}
          onChange={(e) => { setDirection(e.target.value); setPage(1); }}
        >
          <option value="">전체</option>
          <option value="sent">발송</option>
          <option value="received">수신</option>
        </select>
      </div>

      {/* Send Form */}
      {showSendForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">쪽지 보내기</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="제목"
              value={sendForm.title}
              onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })}
            />
            <textarea
              className="w-full min-h-[100px] rounded-md border px-3 py-2 text-sm bg-background"
              placeholder="내용을 입력하세요..."
              value={sendForm.content}
              onChange={(e) => setSendForm({ ...sendForm, content: e.target.value })}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSend} disabled={sending}>
                {sending ? '발송 중...' : '발송'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowSendForm(false)}>취소</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail View */}
      {selected && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{selected.title}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>닫기</Button>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 text-xs text-muted-foreground mb-3">
              <span>{selected.sender_type === 'admin' ? '관리자 → 유저' : '유저 → 관리자'}</span>
              <span>·</span>
              <span>{new Date(selected.created_at).toLocaleString('ko-KR')}</span>
              {selected.is_read && selected.read_at && (
                <>
                  <span>·</span>
                  <span className="text-blue-600">읽음 {new Date(selected.read_at).toLocaleString('ko-KR')}</span>
                </>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap">{selected.content}</p>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">로딩 중...</div>
          ) : !data?.items.length ? (
            <div className="p-8 text-center text-muted-foreground">쪽지 내역이 없습니다</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-center w-8" />
                    <th className="px-4 py-2 text-left">제목</th>
                    <th className="px-4 py-2 text-center">방향</th>
                    <th className="px-4 py-2 text-center">읽음</th>
                    <th className="px-4 py-2 text-left">일시</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.items.map((msg) => (
                    <tr
                      key={msg.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => handleSelect(msg)}
                    >
                      <td className="px-4 py-2 text-center">
                        {msg.is_read ? (
                          <MailOpen className="h-4 w-4 text-muted-foreground inline" />
                        ) : (
                          <Mail className="h-4 w-4 text-blue-500 inline" />
                        )}
                      </td>
                      <td className={`px-4 py-2 ${!msg.is_read ? 'font-medium' : ''}`}>{msg.title}</td>
                      <td className="px-4 py-2 text-center">
                        <Badge variant="secondary" className="text-xs">
                          {msg.sender_type === 'admin' ? '발송' : '수신'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-center">
                        {msg.is_read ? (
                          <span className="text-xs text-blue-600">읽음</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">안읽음</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(msg.created_at).toLocaleString('ko-KR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>이전</Button>
          <span className="flex items-center text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>다음</Button>
        </div>
      )}
    </div>
  );
}
