'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createAgent } from '@/hooks/use-agents';
import { ArrowLeft } from 'lucide-react';

export default function NewAgentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    username: '',
    password: '',
    email: '',
    role: 'agent',
    agent_code: '',
    parent_id: '',
    max_sub_agents: '100',
    rolling_rate: '',
    losing_rate: '',
    memo: '',
  });

  const set = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        username: form.username,
        password: form.password,
        role: form.role,
        agent_code: form.agent_code,
        max_sub_agents: parseInt(form.max_sub_agents) || 100,
      };
      if (form.email) body.email = form.email;
      if (form.parent_id) body.parent_id = parseInt(form.parent_id);
      if (form.rolling_rate) body.rolling_rate = parseFloat(form.rolling_rate);
      if (form.losing_rate) body.losing_rate = parseFloat(form.losing_rate);
      if (form.memo) body.memo = form.memo;

      await createAgent(body);
      router.push('/dashboard/agents');
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
          <h2 className="text-2xl font-bold tracking-tight">에이전트 추가</h2>
          <p className="text-muted-foreground">새 에이전트를 생성합니다</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">아이디 *</Label>
                <Input
                  id="username"
                  required
                  minLength={3}
                  value={form.username}
                  onChange={(e) => set('username', e.target.value)}
                  placeholder="agent01"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호 *</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="6자 이상"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agent_code">에이전트 코드 *</Label>
                <Input
                  id="agent_code"
                  required
                  minLength={2}
                  value={form.agent_code}
                  onChange={(e) => set('agent_code', e.target.value.toUpperCase())}
                  placeholder="AGT001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">역할 *</Label>
                <select
                  id="role"
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-950"
                  value={form.role}
                  onChange={(e) => set('role', e.target.value)}
                >
                  <option value="admin">관리자</option>
                  <option value="teacher">총판</option>
                  <option value="sub_hq">부본사</option>
                  <option value="agent">에이전트</option>
                  <option value="sub_agent">서브에이전트</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="parent_id">상위 에이전트 ID</Label>
                <Input
                  id="parent_id"
                  type="number"
                  value={form.parent_id}
                  onChange={(e) => set('parent_id', e.target.value)}
                  placeholder="비워두면 최상위"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="agent@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_sub_agents">최대 하위</Label>
                <Input
                  id="max_sub_agents"
                  type="number"
                  value={form.max_sub_agents}
                  onChange={(e) => set('max_sub_agents', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rolling_rate">롤링 비율 (%)</Label>
                <Input
                  id="rolling_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.rolling_rate}
                  onChange={(e) => set('rolling_rate', e.target.value)}
                  placeholder="기본값 사용"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="losing_rate">죽장 비율 (%)</Label>
                <Input
                  id="losing_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.losing_rate}
                  onChange={(e) => set('losing_rate', e.target.value)}
                  placeholder="기본값 사용"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="memo">메모</Label>
              <Input
                id="memo"
                value={form.memo}
                onChange={(e) => set('memo', e.target.value)}
                placeholder="선택 사항"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? '생성 중...' : '에이전트 생성'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                취소
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
