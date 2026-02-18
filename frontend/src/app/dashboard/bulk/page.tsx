'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  UsersRound,
  Send,
  Coins,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import {
  bulkUpdateStatus,
  bulkSendMessage,
  bulkGrantPoints,
} from '@/hooks/use-analytics';
import type { BulkOperationResult } from '@/hooks/use-analytics';
import { useToast } from '@/components/toast-provider';

// ─── Helpers ─────────────────────────────────────────────────────

function parseUserIds(text: string): number[] {
  return text
    .split(/[,\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0);
}

// ─── Result Display ─────────────────────────────────────────────

function ResultCard({ result }: { result: BulkOperationResult }) {
  return (
    <Card>
      <CardContent className="py-4 px-5 space-y-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span className="text-sm">성공: <strong>{result.success_count}</strong>건</span>
          </div>
          {result.fail_count > 0 && (
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm">실패: <strong>{result.fail_count}</strong>건</span>
            </div>
          )}
        </div>
        {result.errors.length > 0 && (
          <div className="bg-red-50 dark:bg-red-950 rounded-md p-3">
            <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">오류 내역:</p>
            <ul className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
              {result.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function BulkPage() {
  const [tab, setTab] = useState<'status' | 'message' | 'points'>('status');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">대량 작업</h2>
          <p className="text-sm text-muted-foreground mt-0.5">회원 일괄 상태 변경, 쪽지 발송, 포인트 지급</p>
        </div>
      </div>

      {/* Tab Buttons */}
      <div className="flex gap-2">
        <Button
          variant={tab === 'status' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('status')}
        >
          <UsersRound className="mr-1 h-3.5 w-3.5" />상태 변경
        </Button>
        <Button
          variant={tab === 'message' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('message')}
        >
          <Send className="mr-1 h-3.5 w-3.5" />쪽지 발송
        </Button>
        <Button
          variant={tab === 'points' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('points')}
        >
          <Coins className="mr-1 h-3.5 w-3.5" />포인트 지급
        </Button>
      </div>

      {tab === 'status' && <StatusTab />}
      {tab === 'message' && <MessageTab />}
      {tab === 'points' && <PointsTab />}
    </div>
  );
}

// ─── Status Change Tab ──────────────────────────────────────────

function StatusTab() {
  const [userIdsText, setUserIdsText] = useState('');
  const [status, setStatus] = useState('active');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkOperationResult | null>(null);
  const toast = useToast();

  const handleSubmit = async () => {
    const ids = parseUserIds(userIdsText);
    if (ids.length === 0) {
      toast.warning('유효한 회원 ID를 입력하세요');
      return;
    }
    if (!reason.trim()) {
      toast.warning('사유를 입력하세요');
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await bulkUpdateStatus(ids, status, reason.trim());
      setResult(res);
      toast.success(`${res.success_count}건 처리 완료`);
    } catch {
      toast.error('상태 변경에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="py-5 px-5 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">회원 ID (쉼표 또는 줄바꿈 구분)</label>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm bg-background font-mono min-h-[120px] resize-none"
              value={userIdsText}
              onChange={(e) => setUserIdsText(e.target.value)}
              placeholder={'1001\n1002\n1003\n또는 1001, 1002, 1003'}
            />
            {userIdsText.trim() && (
              <p className="text-xs text-muted-foreground mt-1">
                인식된 ID: {parseUserIds(userIdsText).length}개
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">변경할 상태</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="active">정상 (active)</option>
                <option value="suspended">정지 (suspended)</option>
                <option value="blocked">차단 (blocked)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">사유</label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="상태 변경 사유"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '처리 중...' : '상태 변경 실행'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && <ResultCard result={result} />}
    </>
  );
}

// ─── Message Tab ────────────────────────────────────────────────

function MessageTab() {
  const [userIdsText, setUserIdsText] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkOperationResult | null>(null);
  const toast = useToast();

  const handleSubmit = async () => {
    const ids = parseUserIds(userIdsText);
    if (ids.length === 0) {
      toast.warning('유효한 회원 ID를 입력하세요');
      return;
    }
    if (!title.trim()) {
      toast.warning('제목을 입력하세요');
      return;
    }
    if (!content.trim()) {
      toast.warning('내용을 입력하세요');
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await bulkSendMessage(ids, title.trim(), content.trim());
      setResult(res);
      toast.success(`${res.success_count}건 발송 완료`);
    } catch {
      toast.error('쪽지 발송에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="py-5 px-5 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">회원 ID (쉼표 또는 줄바꿈 구분)</label>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm bg-background font-mono min-h-[100px] resize-none"
              value={userIdsText}
              onChange={(e) => setUserIdsText(e.target.value)}
              placeholder={'1001, 1002, 1003'}
            />
            {userIdsText.trim() && (
              <p className="text-xs text-muted-foreground mt-1">
                인식된 ID: {parseUserIds(userIdsText).length}개
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">제목</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="쪽지 제목"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">내용</label>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm bg-background min-h-[120px] resize-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="쪽지 내용을 입력하세요..."
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '발송 중...' : '쪽지 발송'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && <ResultCard result={result} />}
    </>
  );
}

// ─── Points Tab ─────────────────────────────────────────────────

function PointsTab() {
  const [userIdsText, setUserIdsText] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('grant');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkOperationResult | null>(null);
  const toast = useToast();

  const handleSubmit = async () => {
    const ids = parseUserIds(userIdsText);
    if (ids.length === 0) {
      toast.warning('유효한 회원 ID를 입력하세요');
      return;
    }
    const amountNum = Number(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      toast.warning('유효한 금액을 입력하세요');
      return;
    }
    if (!reason.trim()) {
      toast.warning('사유를 입력하세요');
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await bulkGrantPoints(ids, amountNum, type, reason.trim());
      setResult(res);
      toast.success(`${res.success_count}건 처리 완료`);
    } catch {
      toast.error('포인트 처리에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="py-5 px-5 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">회원 ID (쉼표 또는 줄바꿈 구분)</label>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm bg-background font-mono min-h-[100px] resize-none"
              value={userIdsText}
              onChange={(e) => setUserIdsText(e.target.value)}
              placeholder={'1001, 1002, 1003'}
            />
            {userIdsText.trim() && (
              <p className="text-xs text-muted-foreground mt-1">
                인식된 ID: {parseUserIds(userIdsText).length}개
              </p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">금액</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="포인트 금액"
                min={1}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">유형</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="grant">지급</option>
                <option value="revoke">회수</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">사유</label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="포인트 지급/회수 사유"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '처리 중...' : type === 'grant' ? '포인트 지급' : '포인트 회수'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && <ResultCard result={result} />}
    </>
  );
}
