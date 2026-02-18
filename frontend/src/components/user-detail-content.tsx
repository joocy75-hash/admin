'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useUserDetail, resetUserPassword, setUserPassword, suspendUser } from '@/hooks/use-user-detail';
import { updateUser } from '@/hooks/use-users';
import { ArrowLeft, X, Edit, KeyRound, Lock, Ban } from 'lucide-react';
import TabGeneral from '@/app/dashboard/users/[id]/tab-general';
import TabBetting from '@/app/dashboard/users/[id]/tab-betting';
import TabMoney from '@/app/dashboard/users/[id]/tab-money';
import TabPoints from '@/app/dashboard/users/[id]/tab-points';
import TabTransactions from '@/app/dashboard/users/[id]/tab-transactions';
import TabInquiries from '@/app/dashboard/users/[id]/tab-inquiries';
import TabReferral from '@/app/dashboard/users/[id]/tab-referral';
import TabMessages from '@/app/dashboard/users/[id]/tab-messages';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: '활성', color: 'bg-blue-100 text-blue-800' },
  suspended: { label: '정지', color: 'bg-red-100 text-red-800' },
  banned: { label: '차단', color: 'bg-red-100 text-red-800' },
};

const TAB_LIST = [
  { key: 'general', label: '기본 정보' },
  { key: 'betting', label: '베팅' },
  { key: 'money', label: '머니' },
  { key: 'points', label: '포인트' },
  { key: 'transactions', label: '입출금' },
  { key: 'inquiries', label: '문의내역' },
  { key: 'referral', label: '추천코드' },
  { key: 'messages', label: '쪽지' },
] as const;

type TabKey = (typeof TAB_LIST)[number]['key'];

type Props = {
  userId: number;
  onClose?: () => void;
  isSheet?: boolean;
};

export function UserDetailContent({ userId, onClose, isSheet }: Props) {
  const router = useRouter();
  const { data: detail, loading, refetch } = useUserDetail(userId);
  const [tab, setTab] = useState<TabKey>('general');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmDesc, setConfirmDesc] = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  const openConfirm = (title: string, desc: string, action: () => void) => {
    setConfirmTitle(title);
    setConfirmDesc(desc);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  const user = detail?.user;

  const handleResetPassword = async () => {
    openConfirm('비밀번호 초기화', '비밀번호를 초기화하시겠습니까?', async () => {
      try {
        await resetUserPassword(userId);
        alert('비밀번호가 초기화되었습니다.');
      } catch { alert('비밀번호 초기화 실패'); }
    });
  };

  const handleSetPassword = async () => {
    const pw = prompt('새 비밀번호를 입력하세요 (6자 이상):');
    if (!pw || pw.length < 6) { alert('비밀번호는 6자 이상이어야 합니다.'); return; }
    try {
      await setUserPassword(userId, pw);
      alert('비밀번호가 지정되었습니다.');
    } catch { alert('비밀번호 지정 실패'); }
  };

  const handleSuspend = async () => {
    if (!user) return;
    if (user.status === 'suspended') {
      openConfirm('정지 해제', '정지를 해제하시겠습니까?', async () => {
        try {
          await updateUser(userId, { status: 'active' });
          refetch();
        } catch { alert('정지 해제 실패'); }
      });
    } else {
      const reason = prompt('정지 사유를 입력하세요:');
      if (reason === null) return;
      try {
        await suspendUser(userId, reason || undefined);
        refetch();
      } catch { alert('정지 실패'); }
    }
  };

  if (loading || !detail || !user) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-12 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-64 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  const statusInfo = STATUS_MAP[user.status] || { label: user.status, color: 'bg-gray-100 text-gray-800' };

  return (
    <div className="flex flex-col h-full">
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => { confirmAction?.(); setConfirmOpen(false); }}>
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Common Header */}
      <div className="flex items-start justify-between p-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          {isSheet ? (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight">{user.username}</h2>
              <Badge className={statusInfo.color} variant="secondary">{statusInfo.label}</Badge>
              {user.nickname && <span className="text-muted-foreground text-sm">({user.nickname})</span>}
              <span className="text-xs text-muted-foreground">Lv.{user.level}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user.referrer_username ? `추천인: ${user.referrer_username}` : '추천인 없음'} · 가입: {new Date(user.created_at).toLocaleDateString('ko-KR')}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap shrink-0">
          <Button variant="outline" size="sm" onClick={() => setTab('general')}>
            <Edit className="h-3 w-3 mr-1" />수정
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetPassword}>
            <KeyRound className="h-3 w-3 mr-1" />초기화
          </Button>
          <Button variant="outline" size="sm" onClick={handleSetPassword}>
            <Lock className="h-3 w-3 mr-1" />비밀번호
          </Button>
          <Button
            variant={user.status === 'suspended' ? 'default' : 'destructive'}
            size="sm"
            onClick={handleSuspend}
          >
            <Ban className="h-3 w-3 mr-1" />
            {user.status === 'suspended' ? '해제' : '정지'}
          </Button>
        </div>
      </div>

      {/* 8 Tabs */}
      <div className="flex gap-0.5 border-b overflow-x-auto px-4 shrink-0">
        {TAB_LIST.map((t) => (
          <button
            key={t.key}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content - scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'general' && <TabGeneral detail={detail} userId={userId} onRefetch={refetch} />}
        {tab === 'betting' && <TabBetting userId={userId} />}
        {tab === 'money' && <TabMoney userId={userId} />}
        {tab === 'points' && <TabPoints userId={userId} />}
        {tab === 'transactions' && <TabTransactions userId={userId} />}
        {tab === 'inquiries' && <TabInquiries userId={userId} />}
        {tab === 'referral' && <TabReferral userId={userId} detail={detail} />}
        {tab === 'messages' && <TabMessages userId={userId} />}
      </div>
    </div>
  );
}
