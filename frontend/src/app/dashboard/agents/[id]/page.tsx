'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  useAgent, updateAgent, resetAgentPassword, deleteAgent, type Agent,
} from '@/hooks/use-agents';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Save, KeyRound, Trash2, Network } from 'lucide-react';
import { useToast } from '@/components/toast-provider';
import CommissionRateTab from './commission-rate-tab';

const ROLE_LABELS: Record<string, string> = {
  super_admin: '슈퍼관리자',
  admin: '관리자',
  teacher: '총판',
  sub_hq: '부본사',
  agent: '에이전트',
  sub_agent: '서브에이전트',
};

type Ancestor = {
  id: number;
  username: string;
  agent_code: string;
  role: string;
  depth: number;
};

export default function AgentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const toast = useToast();
  const agentId = Number(id);
  const { agent, loading, error } = useAgent(agentId);

  const [tab, setTab] = useState<'info' | 'commission' | 'children' | 'ancestors'>('info');
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [children, setChildren] = useState<Agent[]>([]);
  const [ancestors, setAncestors] = useState<Ancestor[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(false);

  useEffect(() => {
    if (!agent) return;
    setEditForm({
      email: agent.email || '',
      status: agent.status,
      max_sub_agents: String(agent.max_sub_agents),
      memo: agent.memo || '',
    });
  }, [agent]);

  useEffect(() => {
    if (tab === 'children') {
      setChildrenLoading(true);
      apiClient.get<Agent[]>(`/api/v1/agents/${agentId}/children`)
        .then(setChildren)
        .catch(() => {})
        .finally(() => setChildrenLoading(false));
    }
    if (tab === 'ancestors') {
      apiClient.get<Ancestor[]>(`/api/v1/agents/${agentId}/ancestors`)
        .then(setAncestors)
        .catch(() => {});
    }
  }, [tab, agentId]);

  const set = (key: string, value: string) => setEditForm((p) => ({ ...p, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (editForm.email) body.email = editForm.email;
      body.status = editForm.status;
      body.max_sub_agents = parseInt(editForm.max_sub_agents) || 100;
      if (editForm.memo) body.memo = editForm.memo;
      else body.memo = null;

      await updateAgent(agentId, body);
      toast.success('저장 완료');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.warning('비밀번호는 6자 이상이어야 합니다');
      return;
    }
    if (!confirm('비밀번호를 초기화하시겠습니까?')) return;
    try {
      await resetAgentPassword(agentId, newPassword);
      setNewPassword('');
      toast.success('비밀번호 초기화 완료');
    } catch {
      toast.error('비밀번호 초기화 실패');
    }
  };

  const handleDelete = async () => {
    if (!confirm('이 에이전트를 비활성화하시겠습니까?')) return;
    try {
      await deleteAgent(agentId);
      router.push('/dashboard/agents');
    } catch {
      toast.error('삭제 실패');
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">로딩 중...</div>;
  }

  if (error || !agent) {
    return <div className="py-8 text-center text-red-500">{error || '에이전트를 찾을 수 없습니다'}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {agent.username}
              <span className="ml-2 text-sm font-normal text-muted-foreground font-mono">
                {agent.agent_code}
              </span>
            </h2>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline">{ROLE_LABELS[agent.role] || agent.role}</Badge>
              <Badge variant={agent.status === 'active' ? 'default' : 'destructive'}>
                {agent.status}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/agents/tree?root=${agentId}`)}
          >
            <Network className="h-4 w-4 mr-2" />
            트리 보기
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            비활성화
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">잔액</p>
            <p className="text-xl font-bold font-mono">{Number(agent.balance).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">대기 잔액</p>
            <p className="text-xl font-bold font-mono">{Number(agent.pending_balance).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">하위 에이전트</p>
            <p className="text-xl font-bold">{agent.children_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Depth</p>
            <p className="text-xl font-bold">{agent.depth}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['info', 'commission', 'children', 'ancestors'] as const).map((t) => (
          <button
            key={t}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTab(t)}
          >
            {t === 'info' && '기본 정보'}
            {t === 'commission' && '커미션 요율'}
            {t === 'children' && '하위 에이전트'}
            {t === 'ancestors' && '상위 경로'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">에이전트 정보 수정</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>상태</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-950"
                  value={editForm.status || ''}
                  onChange={(e) => set('status', e.target.value)}
                >
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                  <option value="banned">banned</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>이메일</Label>
                <Input value={editForm.email || ''} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>최대 하위</Label>
                <Input
                  type="number"
                  value={editForm.max_sub_agents || ''}
                  onChange={(e) => set('max_sub_agents', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>메모</Label>
                <Input value={editForm.memo || ''} onChange={(e) => set('memo', e.target.value)} />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? '저장 중...' : '저장'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">비밀번호 초기화</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>새 비밀번호</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="6자 이상"
                />
              </div>
              <Button variant="outline" onClick={handleResetPassword}>
                <KeyRound className="h-4 w-4 mr-2" />
                비밀번호 초기화
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'commission' && (
        <CommissionRateTab agentId={agentId} agent={agent} />
      )}

      {tab === 'children' && (
        <Card>
          <CardContent className="pt-6">
            {childrenLoading ? (
              <div className="py-4 text-center text-muted-foreground">로딩 중...</div>
            ) : children.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground">직속 하위 에이전트가 없습니다</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>코드</TableHead>
                    <TableHead>아이디</TableHead>
                    <TableHead>역할</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">잔액</TableHead>
                    <TableHead className="text-right">하위</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {children.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/dashboard/agents/${c.id}`)}
                    >
                      <TableCell className="font-mono text-xs">{c.agent_code}</TableCell>
                      <TableCell className="font-medium text-blue-600">{c.username}</TableCell>
                      <TableCell><Badge variant="outline">{ROLE_LABELS[c.role] || c.role}</Badge></TableCell>
                      <TableCell><Badge variant={c.status === 'active' ? 'default' : 'destructive'}>{c.status}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{Number(c.balance).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{c.children_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'ancestors' && (
        <Card>
          <CardContent className="pt-6">
            {ancestors.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground">최상위 에이전트입니다</div>
            ) : (
              <div className="space-y-2">
                {ancestors.map((a, i) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    style={{ marginLeft: `${i * 24}px` }}
                    onClick={() => router.push(`/dashboard/agents/${a.id}`)}
                  >
                    <span className="text-muted-foreground text-xs">Lv{a.depth}</span>
                    <span className="font-mono text-xs">{a.agent_code}</span>
                    <span className="font-medium">{a.username}</span>
                    <Badge variant="outline" className="text-xs">{ROLE_LABELS[a.role] || a.role}</Badge>
                  </div>
                ))}
                <div
                  className="flex items-center gap-3 p-3 rounded-lg border bg-blue-50 dark:bg-blue-950"
                  style={{ marginLeft: `${ancestors.length * 24}px` }}
                >
                  <span className="text-blue-600 text-xs font-bold">현재</span>
                  <span className="font-mono text-xs">{agent.agent_code}</span>
                  <span className="font-medium">{agent.username}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
