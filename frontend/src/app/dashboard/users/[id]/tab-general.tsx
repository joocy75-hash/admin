'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { updateUser } from '@/hooks/use-users';
import {
  type UserDetailData,
  updateBettingPermission,
  updateNullBettingConfig,
  updateGameRollingRate,
  createBankAccount,
  deleteBankAccount,
} from '@/hooks/use-user-detail';
import { Wallet, Star, TrendingUp, TrendingDown, Plus, Trash2, Save } from 'lucide-react';

const GAME_CATEGORIES = ['casino', 'slot', 'holdem', 'sports', 'shooting', 'coin', 'minigame'];
const GAME_LABELS: Record<string, string> = {
  casino: '카지노',
  slot: '슬롯',
  holdem: '홀덤',
  sports: '스포츠',
  shooting: '슈팅',
  coin: '코인',
  minigame: '미니게임',
};

const HOLDEM_PROVIDERS = ['revolution', 'skycity', 'wild'];
const PROVIDER_LABELS: Record<string, string> = {
  revolution: '레볼루션',
  skycity: '스카이시티',
  wild: '와일드',
};

function formatKRW(amount: number): string {
  return '\u20A9' + Number(amount).toLocaleString('ko-KR');
}

type Props = {
  detail: UserDetailData;
  userId: number;
  onRefetch: () => void;
};

export default function TabGeneral({ detail, userId, onRefetch }: Props) {
  const { user, statistics, bank_accounts, betting_permissions, null_betting_configs, game_rolling_rates } = detail;

  // Edit form
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    real_name: user.real_name || '',
    phone: user.phone || '',
    email: user.email || '',
    nickname: user.nickname || '',
    color: user.color || '',
    memo: user.memo || '',
  });
  const [saving, setSaving] = useState(false);

  // Bank account form
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState({ bank_name: '', account_number: '', holder_name: '' });

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (editForm.real_name !== (user.real_name || '')) body.real_name = editForm.real_name || null;
      if (editForm.phone !== (user.phone || '')) body.phone = editForm.phone || null;
      if (editForm.email !== (user.email || '')) body.email = editForm.email || null;
      if (editForm.nickname !== (user.nickname || '')) body.nickname = editForm.nickname || null;
      if (editForm.color !== (user.color || '')) body.color = editForm.color || null;
      if (editForm.memo !== (user.memo || '')) body.memo = editForm.memo || null;
      if (Object.keys(body).length > 0) {
        await updateUser(userId, body);
        onRefetch();
        setEditMode(false);
      }
    } catch { alert('수정 실패'); }
    finally { setSaving(false); }
  };

  const handleTogglePermission = async (category: string, currentAllow: boolean) => {
    try {
      await updateBettingPermission(userId, category, !currentAllow);
      onRefetch();
    } catch { alert('권한 변경 실패'); }
  };

  const handleNullBettingChange = async (category: string, value: string) => {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 0) return;
    try {
      await updateNullBettingConfig(userId, category, n, false);
      onRefetch();
    } catch { alert('공베팅 설정 실패'); }
  };

  const handleRollingRateChange = async (category: string, value: string, provider?: string) => {
    const rate = parseFloat(value);
    if (isNaN(rate) || rate < 0 || rate > 100) return;
    try {
      await updateGameRollingRate(userId, category, rate, provider);
      onRefetch();
    } catch { alert('롤링율 변경 실패'); }
  };

  const handleAddBank = async () => {
    if (!bankForm.bank_name || !bankForm.account_number || !bankForm.holder_name) {
      alert('모든 필드를 입력하세요');
      return;
    }
    try {
      await createBankAccount(userId, bankForm);
      setBankForm({ bank_name: '', account_number: '', holder_name: '' });
      setShowBankForm(false);
      onRefetch();
    } catch { alert('계좌 추가 실패'); }
  };

  const handleDeleteBank = async (accountId: number) => {
    if (!confirm('이 계좌를 삭제하시겠습니까?')) return;
    try {
      await deleteBankAccount(userId, accountId);
      onRefetch();
    } catch { alert('계좌 삭제 실패'); }
  };

  const getPermission = (category: string) => {
    return betting_permissions.find((p) => p.game_category === category)?.is_allowed ?? true;
  };

  const getNullBetting = (category: string) => {
    return null_betting_configs.find((c) => c.game_category === category)?.every_n_bets ?? 0;
  };

  const getRollingRate = (category: string, provider?: string) => {
    return game_rolling_rates.find(
      (r) => r.game_category === category && (provider ? r.provider === provider : !r.provider)
    )?.rolling_rate ?? 0;
  };

  return (
    <div className="space-y-6">
      {/* Asset Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Wallet className="h-4 w-4" />잔액</div>
            <p className="text-2xl font-bold mt-1 text-blue-600">{formatKRW(user.balance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Star className="h-4 w-4" />포인트</div>
            <p className="text-2xl font-bold mt-1 text-blue-600">{formatKRW(user.points)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="h-4 w-4" />총 입금액</div>
            <p className="text-2xl font-bold mt-1 text-blue-600">{formatKRW(statistics.total_deposit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingDown className="h-4 w-4" />총 출금액</div>
            <p className="text-2xl font-bold mt-1 text-red-600">{formatKRW(statistics.total_withdrawal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Game Rolling Rates */}
      <Card>
        <CardHeader><CardTitle className="text-base">게임별 롤링율 (%)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">게임</th>
                  <th className="pb-2 font-medium text-center">롤링율 (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {GAME_CATEGORIES.map((cat) => (
                  <tr key={cat}>
                    <td className="py-2 font-medium">{GAME_LABELS[cat]}</td>
                    <td className="py-2 text-center">
                      {cat === 'holdem' ? (
                        <div className="space-y-1">
                          {HOLDEM_PROVIDERS.map((prov) => (
                            <div key={prov} className="flex items-center justify-center gap-2">
                              <span className="text-xs text-muted-foreground w-20 text-right">{PROVIDER_LABELS[prov]}</span>
                              <Input
                                type="number"
                                className="w-20 h-7 text-center text-sm"
                                step="0.1"
                                min="0"
                                max="100"
                                defaultValue={getRollingRate(cat, prov)}
                                onBlur={(e) => handleRollingRateChange(cat, e.target.value, prov)}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Input
                          type="number"
                          className="w-20 h-7 text-center text-sm mx-auto"
                          step="0.1"
                          min="0"
                          max="100"
                          defaultValue={getRollingRate(cat)}
                          onBlur={(e) => handleRollingRateChange(cat, e.target.value)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Betting Permissions */}
      <Card>
        <CardHeader><CardTitle className="text-base">베팅 권한 설정</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {GAME_CATEGORIES.map((cat) => {
              const allowed = getPermission(cat);
              return (
                <button
                  key={cat}
                  onClick={() => handleTogglePermission(cat, allowed)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                    allowed
                      ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
                      : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
                  }`}
                >
                  <span className="text-sm font-medium">{GAME_LABELS[cat]}</span>
                  <Badge className={allowed ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'} variant="secondary">
                    {allowed ? '허용' : '차단'}
                  </Badge>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Null Betting Config */}
      <Card>
        <CardHeader><CardTitle className="text-base">누락(공베팅) 설정</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">N회 베팅마다 1회 누락 (0 = 미적용, 하위 상속)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {GAME_CATEGORIES.map((cat) => (
              <div key={cat} className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{GAME_LABELS[cat]}</label>
                <Input
                  type="number"
                  className="h-8 text-sm"
                  min="0"
                  defaultValue={getNullBetting(cat)}
                  onBlur={(e) => handleNullBettingChange(cat, e.target.value)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">신상 정보</CardTitle>
          {!editMode ? (
            <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
              <Edit className="h-3.5 w-3.5 mr-1" />수정
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>취소</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1" />{saving ? '저장 중...' : '저장'}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <InfoRow label="가입일" value={new Date(user.created_at).toLocaleDateString('ko-KR')} />
            <InfoRow label="최근 접속" value={user.last_login_at ? new Date(user.last_login_at).toLocaleString('ko-KR') : '-'} />
            {editMode ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">실명</label>
                  <Input className="h-8" value={editForm.real_name} onChange={(e) => setEditForm({ ...editForm, real_name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">닉네임</label>
                  <Input className="h-8" value={editForm.nickname} onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">연락처</label>
                  <Input className="h-8" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">이메일</label>
                  <Input className="h-8" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">색상</label>
                  <Input className="h-8" type="color" value={editForm.color || '#000000'} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} />
                </div>
              </>
            ) : (
              <>
                <InfoRow label="실명" value={user.real_name || '-'} />
                <InfoRow label="닉네임" value={user.nickname || '-'} />
                <InfoRow label="연락처" value={user.phone || '-'} />
                <InfoRow label="이메일" value={user.email || '-'} />
                <InfoRow label="색상" value={user.color ? <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: user.color }} /> : '-'} />
              </>
            )}
            <InfoRow label="가입 IP" value={user.registration_ip || '-'} />
            <InfoRow label="로그인 횟수" value={`${user.login_count}회`} />
          </div>
        </CardContent>
      </Card>

      {/* Bank Accounts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">출금 계좌 / 가상계좌</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowBankForm(!showBankForm)}>
            <Plus className="h-3.5 w-3.5 mr-1" />계좌 추가
          </Button>
        </CardHeader>
        <CardContent>
          {user.virtual_account_bank && (
            <div className="mb-4 p-3 rounded-lg border border-dashed">
              <p className="text-xs font-medium text-muted-foreground mb-1">가상계좌</p>
              <p className="text-sm">{user.virtual_account_bank} {user.virtual_account_number}</p>
            </div>
          )}
          {showBankForm && (
            <div className="mb-4 p-3 rounded-lg border bg-muted/30 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="은행명" className="h-8 text-sm" value={bankForm.bank_name} onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })} />
                <Input placeholder="계좌번호" className="h-8 text-sm" value={bankForm.account_number} onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })} />
                <Input placeholder="예금주" className="h-8 text-sm" value={bankForm.holder_name} onChange={(e) => setBankForm({ ...bankForm, holder_name: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddBank}>추가</Button>
                <Button variant="outline" size="sm" onClick={() => setShowBankForm(false)}>취소</Button>
              </div>
            </div>
          )}
          {bank_accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 출금 계좌가 없습니다</p>
          ) : (
            <div className="space-y-2">
              {bank_accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{acc.bank_name}</span>
                      {acc.is_primary && <Badge className="bg-blue-100 text-blue-800" variant="secondary">대표</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{acc.account_number} · {acc.holder_name}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteBank(acc.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Memo */}
      <Card>
        <CardHeader><CardTitle className="text-base">관리자 메모</CardTitle></CardHeader>
        <CardContent>
          {editMode ? (
            <textarea
              className="w-full min-h-[80px] rounded-md border px-3 py-2 text-sm bg-background"
              value={editForm.memo}
              onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{user.memo || '메모가 없습니다'}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}

function Edit({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}
