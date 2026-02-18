'use client';

import { useState } from 'react';
import {
  useVipLevels,
  useVipLevelUsers,
  createVipLevel,
  updateVipLevel,
  deleteVipLevel,
  runAutoCheck,
  type VipLevel,
} from '@/hooks/use-vip';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { AlertCircle, Crown, Users, RefreshCw, Star } from 'lucide-react';
import { useToast } from '@/components/toast-provider';

const fmt = (n: number) => Intl.NumberFormat('ko-KR').format(n);

const LEVEL_COLORS: Record<number, string> = {
  0: 'bg-gray-100 text-gray-800',
  1: 'bg-green-100 text-green-800',
  2: 'bg-blue-100 text-blue-800',
  3: 'bg-purple-100 text-purple-800',
  4: 'bg-yellow-100 text-yellow-800',
  5: 'bg-orange-100 text-orange-800',
  6: 'bg-red-100 text-red-800',
  7: 'bg-pink-100 text-pink-800',
  8: 'bg-indigo-100 text-indigo-800',
  9: 'bg-emerald-100 text-emerald-800',
  10: 'bg-amber-100 text-amber-800',
};

const getLevelBadgeColor = (level: number) =>
  LEVEL_COLORS[level] || LEVEL_COLORS[level % 11] || 'bg-gray-100 text-gray-800';

// ─── Form ────────────────────────────────────────────────────────

type VipFormData = {
  level: string;
  name: string;
  color: string;
  min_deposit: string;
  min_betting: string;
  rolling_bonus_rate: string;
  losing_bonus_rate: string;
  withdrawal_limit: string;
  daily_withdrawal_count: string;
  benefits_description: string;
  active: boolean;
};

const defaultForm: VipFormData = {
  level: '0',
  name: '',
  color: '#3B82F6',
  min_deposit: '0',
  min_betting: '0',
  rolling_bonus_rate: '0',
  losing_bonus_rate: '0',
  withdrawal_limit: '0',
  daily_withdrawal_count: '0',
  benefits_description: '',
  active: true,
};

// ─── Main Page ───────────────────────────────────────────────────

export default function VipPage() {
  const toast = useToast();
  const { data, loading, error, refetch } = useVipLevels();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VipLevel | null>(null);
  const [form, setForm] = useState<VipFormData>(defaultForm);
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<VipLevel | null>(null);

  const [autoCheckLoading, setAutoCheckLoading] = useState(false);
  const [autoCheckResult, setAutoCheckResult] = useState<{
    upgraded: number; downgraded: number; unchanged: number;
  } | null>(null);
  const [autoCheckResultOpen, setAutoCheckResultOpen] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<VipLevel | null>(null);
  const [userPage, setUserPage] = useState(1);

  const { data: usersData, loading: usersLoading } = useVipLevelUsers(
    selectedLevel?.level ?? null,
    userPage,
    20
  );

  const totalUsers = data?.items.reduce((sum, l) => sum + l.user_count, 0) ?? 0;

  const openCreate = () => {
    setEditingItem(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (item: VipLevel) => {
    setEditingItem(item);
    setForm({
      level: String(item.level),
      name: item.name,
      color: item.color || '#3B82F6',
      min_deposit: String(item.min_deposit),
      min_betting: String(item.min_betting),
      rolling_bonus_rate: String(item.rolling_bonus_rate),
      losing_bonus_rate: String(item.losing_bonus_rate),
      withdrawal_limit: String(item.withdrawal_limit),
      daily_withdrawal_count: String(item.daily_withdrawal_count),
      benefits_description: item.benefits_description || '',
      active: item.active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        level: Number(form.level),
        name: form.name,
        color: form.color,
        min_deposit: Number(form.min_deposit),
        min_betting: Number(form.min_betting),
        rolling_bonus_rate: Number(form.rolling_bonus_rate),
        losing_bonus_rate: Number(form.losing_bonus_rate),
        withdrawal_limit: Number(form.withdrawal_limit),
        daily_withdrawal_count: Number(form.daily_withdrawal_count),
        benefits_description: form.benefits_description || null,
        active: form.active,
      };
      if (editingItem) {
        await updateVipLevel(editingItem.id, body);
      } else {
        await createVipLevel(body);
      }
      setDialogOpen(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: VipLevel) => {
    setPendingDelete(item);
    setConfirmOpen(true);
  };

  const confirmDeleteAction = async () => {
    if (!pendingDelete) return;
    try {
      await deleteVipLevel(pendingDelete.id);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '삭제 실패');
    }
    setConfirmOpen(false);
    setPendingDelete(null);
  };

  const handleAutoCheck = async () => {
    setAutoCheckLoading(true);
    try {
      const result = await runAutoCheck();
      setAutoCheckResult(result);
      setAutoCheckResultOpen(true);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '자동 체크 실패');
    } finally {
      setAutoCheckLoading(false);
    }
  };

  const openUsersSheet = (level: VipLevel) => {
    setSelectedLevel(level);
    setUserPage(1);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Delete Confirm */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>VIP 등급 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{pendingDelete?.name}&quot; 등급을 삭제합니다. 계속하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAction}>확인</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Auto Check Result Dialog */}
      <Dialog open={autoCheckResultOpen} onOpenChange={setAutoCheckResultOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>자동 등급 체크 완료</DialogTitle>
            <DialogDescription>등급 변동 결과입니다.</DialogDescription>
          </DialogHeader>
          {autoCheckResult && (
            <div className="space-y-3 py-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">승급</span>
                <Badge className="bg-blue-100 text-blue-800" variant="secondary">{autoCheckResult.upgraded}명</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">강등</span>
                <Badge className="bg-red-100 text-red-800" variant="secondary">{autoCheckResult.downgraded}명</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">변동 없음</span>
                <Badge className="bg-gray-100 text-gray-800" variant="secondary">{autoCheckResult.unchanged}명</Badge>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setAutoCheckResultOpen(false)}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'VIP 등급 수정' : 'VIP 등급 등록'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>레벨</Label>
                <Input
                  type="number"
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value })}
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label>등급명</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="예: VIP 1"
                />
              </div>
              <div className="space-y-2">
                <Label>색상</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="h-9 w-12 rounded border cursor-pointer"
                  />
                  <Input
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="flex-1"
                    placeholder="#3B82F6"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>최소 입금액</Label>
                <Input type="number" value={form.min_deposit} onChange={(e) => setForm({ ...form, min_deposit: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>최소 베팅액</Label>
                <Input type="number" value={form.min_betting} onChange={(e) => setForm({ ...form, min_betting: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>롤링 보너스율 (%)</Label>
                <Input type="number" step="0.01" value={form.rolling_bonus_rate} onChange={(e) => setForm({ ...form, rolling_bonus_rate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>루징 보너스율 (%)</Label>
                <Input type="number" step="0.01" value={form.losing_bonus_rate} onChange={(e) => setForm({ ...form, losing_bonus_rate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>출금 한도</Label>
                <Input type="number" value={form.withdrawal_limit} onChange={(e) => setForm({ ...form, withdrawal_limit: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>일일 출금 횟수</Label>
                <Input type="number" value={form.daily_withdrawal_count} onChange={(e) => setForm({ ...form, daily_withdrawal_count: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>혜택 설명</Label>
              <Input
                value={form.benefits_description}
                onChange={(e) => setForm({ ...form, benefits_description: e.target.value })}
                placeholder="혜택 내용 (선택사항)"
              />
            </div>
            <div className="space-y-2">
              <Label>상태</Label>
              <select
                value={form.active ? 'true' : 'false'}
                onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="true">활성</option>
                <option value="false">비활성</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : editingItem ? '수정' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Users Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedLevel && (
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: selectedLevel.color }}
                  />
                  {selectedLevel.name} 회원 목록
                </span>
              )}
            </SheetTitle>
            <SheetDescription>
              레벨 {selectedLevel?.level} 등급에 속한 회원 목록입니다.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4 px-4">
            {usersLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !usersData?.items.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mb-3" />
                <p className="text-sm">이 등급에 해당하는 회원이 없습니다.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>아이디</TableHead>
                        <TableHead>이름</TableHead>
                        <TableHead className="text-right">잔액</TableHead>
                        <TableHead className="text-right">총 입금</TableHead>
                        <TableHead className="text-right">총 베팅</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>최근 접속</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersData.items.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell className="text-muted-foreground">{user.real_name || '-'}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(user.balance)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(user.total_deposit)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(user.total_bet)}</TableCell>
                          <TableCell>
                            <Badge
                              className={user.status === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}
                              variant="secondary"
                            >
                              {user.status === 'active' ? '정상' : user.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {user.last_login_at
                              ? new Date(user.last_login_at).toLocaleDateString('ko-KR')
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {usersData.total > usersData.page_size && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">전체: {usersData.total}명</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={userPage <= 1} onClick={() => setUserPage(Math.max(1, userPage - 1))}>
                        이전
                      </Button>
                      <span className="flex items-center text-sm text-muted-foreground">
                        {usersData.page} / {Math.ceil(usersData.total / usersData.page_size)}
                      </span>
                      <Button variant="outline" size="sm" disabled={userPage >= Math.ceil(usersData.total / usersData.page_size)} onClick={() => setUserPage(userPage + 1)}>
                        다음
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">VIP 등급 관리</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAutoCheck} disabled={autoCheckLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${autoCheckLoading ? 'animate-spin' : ''}`} />
            자동 등급 체크
          </Button>
          <Button onClick={openCreate}>+ 등급 등록</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 pt-0">
            <div className="rounded-lg bg-purple-100 p-3 dark:bg-purple-900">
              <Crown className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">총 등급 수</p>
              <p className="text-xl font-bold">{data?.total ?? 0}개</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-0">
            <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">전체 회원 분포</p>
              <p className="text-xl font-bold">{fmt(totalUsers)}명</p>
              {data?.items && data.items.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {data.items.map((level) => (
                    <span key={level.id} className="text-xs text-muted-foreground">
                      {level.name}: {level.user_count}명
                    </span>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-destructive">
          <AlertCircle className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">데이터를 불러오지 못했습니다</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Button variant="outline" className="mt-4" onClick={refetch}>다시 시도</Button>
        </div>
      ) : !data?.items.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Star className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">등록된 VIP 등급이 없습니다</p>
          <p className="text-sm">새 등급을 등록해주세요.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>레벨</TableHead>
                <TableHead>등급명</TableHead>
                <TableHead className="text-right">최소 입금</TableHead>
                <TableHead className="text-right">최소 베팅</TableHead>
                <TableHead className="text-right">롤링 보너스</TableHead>
                <TableHead className="text-right">루징 보너스</TableHead>
                <TableHead className="text-right">출금 한도</TableHead>
                <TableHead className="text-right">회원수</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((level) => (
                <TableRow
                  key={level.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openUsersSheet(level)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ backgroundColor: level.color }}
                      />
                      <Badge className={getLevelBadgeColor(level.level)} variant="secondary">
                        Lv.{level.level}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{level.name}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(level.min_deposit)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(level.min_betting)}</TableCell>
                  <TableCell className="text-right font-mono">{level.rolling_bonus_rate}%</TableCell>
                  <TableCell className="text-right font-mono">{level.losing_bonus_rate}%</TableCell>
                  <TableCell className="text-right font-mono">{fmt(level.withdrawal_limit)}</TableCell>
                  <TableCell className="text-right">
                    <Badge className="bg-gray-100 text-gray-800" variant="secondary">
                      {level.user_count}명
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={level.active ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}
                      variant="secondary"
                    >
                      {level.active ? '활성' : '비활성'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(level)}>수정</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-800"
                        onClick={() => handleDelete(level)}
                      >
                        삭제
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
