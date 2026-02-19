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
  updateCommissionSettings,
  createWalletAddress,
  deleteWalletAddress,
} from '@/hooks/use-user-detail';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Save, Copy, Pencil } from 'lucide-react';
import { useToast } from '@/components/toast-provider';
import AssetSection from './asset-section';
import RollingRateSection from './rolling-rate-section';
import BettingPermissionSection from './betting-permission-section';

const GAME_CATEGORIES = ['casino', 'slot', 'holdem', 'sports', 'shooting', 'coin', 'mini_game'];
const GAME_LABELS: Record<string, string> = {
  casino: '카지노', slot: '슬롯', holdem: '홀덤', sports: '스포츠',
  shooting: '슈팅', coin: '코인', mini_game: '미니게임',
};

const COIN_OPTIONS = ['USDT', 'TRX', 'ETH', 'BTC', 'BNB'];
const NETWORK_OPTIONS = ['TRC20', 'ERC20', 'BEP20', 'BTC'];

type Props = {
  detail: UserDetailData;
  userId: number;
  onRefetch: () => void;
};

export default function TabGeneral({ detail, userId, onRefetch }: Props) {
  const toast = useToast();
  const { user, statistics, wallet_addresses, betting_permissions, null_betting_configs, game_rolling_rates } = detail;

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

  const [showWalletForm, setShowWalletForm] = useState(false);
  const [walletForm, setWalletForm] = useState({ coin_type: 'USDT', network: 'TRC20', address: '', label: '' });

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
    } catch { toast.error('수정 실패'); }
    finally { setSaving(false); }
  };

  const handleTogglePermission = async (category: string, currentAllow: boolean) => {
    try {
      await updateBettingPermission(userId, category, !currentAllow);
      onRefetch();
    } catch { toast.error('권한 변경 실패'); }
  };

  const handleNullBettingChange = async (category: string, value: string) => {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 0) return;
    try {
      await updateNullBettingConfig(userId, category, n, false);
      onRefetch();
    } catch { toast.error('공베팅 설정 실패'); }
  };

  const handleRollingRateChange = async (category: string, value: string, provider?: string) => {
    const rate = parseFloat(value);
    if (isNaN(rate) || rate < 0 || rate > 100) return;
    try {
      await updateGameRollingRate(userId, category, rate, provider);
      onRefetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '롤링율 변경 실패');
    }
  };

  const handleCommissionChange = async (data: { commission_type?: string; losing_rate?: number; commission_enabled?: boolean }) => {
    try {
      await updateCommissionSettings(userId, data);
      onRefetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '커미션 설정 변경 실패');
    }
  };

  const handleAddWallet = async () => {
    if (!walletForm.address) {
      toast.warning('지갑 주소를 입력하세요');
      return;
    }
    try {
      await createWalletAddress(userId, {
        coin_type: walletForm.coin_type,
        network: walletForm.network,
        address: walletForm.address,
        label: walletForm.label || undefined,
      });
      setWalletForm({ coin_type: 'USDT', network: 'TRC20', address: '', label: '' });
      setShowWalletForm(false);
      onRefetch();
    } catch { toast.error('지갑 추가 실패'); }
  };

  const handleDeleteWallet = async (walletId: number) => {
    if (!confirm('이 지갑 주소를 삭제하시겠습니까?')) return;
    try {
      await deleteWalletAddress(userId, walletId);
      onRefetch();
    } catch { toast.error('지갑 삭제 실패'); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="space-y-6">
      <AssetSection
        balance={user.balance}
        points={user.points}
        totalDeposit={statistics.total_deposit}
        totalWithdrawal={statistics.total_withdrawal}
      />

      {/* Commission Settings */}
      <Card>
        <CardHeader><CardTitle className="text-base">커미션 설정</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* ON/OFF */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">커미션 적용</p>
              <p className="text-xs text-muted-foreground">OFF 시 해당 회원 베팅에 커미션 미발생</p>
            </div>
            <Switch
              checked={user.commission_enabled}
              onCheckedChange={(v) => handleCommissionChange({ commission_enabled: v })}
            />
          </div>

          {/* Rolling / Losing selector */}
          {user.commission_enabled && (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium mb-2">커미션 유형</p>
                <p className="text-xs text-muted-foreground mb-2">롤링과 죽장은 동시 적용 불가</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={user.commission_type === 'rolling' ? 'default' : 'outline'}
                    onClick={() => handleCommissionChange({ commission_type: 'rolling' })}
                  >
                    롤링 (베팅금 %)
                  </Button>
                  <Button
                    size="sm"
                    variant={user.commission_type === 'losing' ? 'default' : 'outline'}
                    onClick={() => handleCommissionChange({ commission_type: 'losing' })}
                  >
                    죽장 (입출금 비례)
                  </Button>
                </div>
              </div>

              {/* Losing rate input (single value) */}
              {user.commission_type === 'losing' && (
                <div className="p-3 rounded-lg border bg-muted/30">
                  <label className="text-sm font-medium">죽장율 (%)</label>
                  <p className="text-xs text-muted-foreground mb-2">게임 구분 없이 입출금 비례 적용 (최대 50%)</p>
                  <div className="flex items-center gap-2">
                    <Input
                      key={`losing-${user.losing_rate}`}
                      type="number"
                      className="w-24 h-8 text-center text-sm"
                      step="0.1"
                      min="0"
                      max="50"
                      defaultValue={user.losing_rate}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= 0 && val <= 50) {
                          handleCommissionChange({ losing_rate: val });
                        }
                      }}
                    />
                    <span className="text-xs text-muted-foreground">/ 최대 50%</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rolling rates table - only visible when commission_type is rolling */}
      {user.commission_enabled && user.commission_type === 'rolling' && (
        <RollingRateSection
          rates={game_rolling_rates}
          onRateChange={handleRollingRateChange}
        />
      )}

      <BettingPermissionSection
        permissions={betting_permissions}
        onToggle={handleTogglePermission}
      />

      {/* Null Betting Config */}
      <Card>
        <CardHeader><CardTitle className="text-base">누락(공베팅) 설정</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">N회 베팅마다 1회 누락 (0 = 미적용, 하위 상속)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {GAME_CATEGORIES.map((cat) => {
              const val = null_betting_configs.find((c) => c.game_category === cat)?.every_n_bets ?? 0;
              return (
                <div key={cat} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{GAME_LABELS[cat]}</label>
                  <Input
                    key={`null-${cat}-${val}`}
                    type="number"
                    className="h-8 text-sm"
                    min="0"
                    defaultValue={val}
                    onBlur={(e) => handleNullBettingChange(cat, e.target.value)}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">신상 정보</CardTitle>
          {!editMode ? (
            <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1" />수정
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

      {/* Deposit Address */}
      {user.deposit_address && (
        <Card>
          <CardHeader><CardTitle className="text-base">입금 주소 (시스템 할당)</CardTitle></CardHeader>
          <CardContent>
            <div className="p-3 rounded-lg border border-dashed bg-green-50 dark:bg-green-950/20">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="bg-green-100 text-green-800">{user.deposit_network || 'TRC20'}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono break-all">{user.deposit_address}</code>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyToClipboard(user.deposit_address!)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wallet Addresses */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">출금 지갑 주소</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowWalletForm(!showWalletForm)}>
            <Plus className="h-3.5 w-3.5 mr-1" />지갑 추가
          </Button>
        </CardHeader>
        <CardContent>
          {showWalletForm && (
            <div className="mb-4 p-3 rounded-lg border bg-muted/30 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <select
                  className="h-8 rounded-md border px-2 text-sm bg-background"
                  value={walletForm.coin_type}
                  onChange={(e) => setWalletForm({ ...walletForm, coin_type: e.target.value })}
                >
                  {COIN_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  className="h-8 rounded-md border px-2 text-sm bg-background"
                  value={walletForm.network}
                  onChange={(e) => setWalletForm({ ...walletForm, network: e.target.value })}
                >
                  {NETWORK_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <Input placeholder="별칭 (선택)" className="h-8 text-sm" value={walletForm.label} onChange={(e) => setWalletForm({ ...walletForm, label: e.target.value })} />
              </div>
              <Input placeholder="지갑 주소" className="h-8 text-sm font-mono" value={walletForm.address} onChange={(e) => setWalletForm({ ...walletForm, address: e.target.value })} />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddWallet}>추가</Button>
                <Button variant="outline" size="sm" onClick={() => setShowWalletForm(false)}>취소</Button>
              </div>
            </div>
          )}
          {wallet_addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 출금 지갑이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {wallet_addresses.map((w) => (
                <div key={w.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="outline" className="text-xs">{w.coin_type}</Badge>
                      <Badge variant="secondary" className="text-xs">{w.network}</Badge>
                      {w.label && <span className="text-xs text-muted-foreground">{w.label}</span>}
                      {w.is_primary && <Badge className="bg-blue-100 text-blue-800" variant="secondary">대표</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      <code className="text-xs font-mono text-muted-foreground truncate">{w.address}</code>
                      <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => copyToClipboard(w.address)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteWallet(w.id)}>
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
