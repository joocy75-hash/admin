'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Network,
  Percent,
  Calculator,
  Wallet,
  Gamepad2,
  BarChart3,
  BarChart2,
  ScrollText,
  Settings,
  Megaphone,
  Shield,
  Handshake,
  LogOut,
  ShieldCheck,
  Gift,
  Crown,
  Banknote,
  Bell,
  ShieldAlert,
  Activity,
  Globe,
  UsersRound,
  FileCheck,
  PieChart,
  Database,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';

const navItems = [
  { label: '대시보드', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  { label: '에이전트 관리', href: '/dashboard/agents', icon: Network, permission: 'agents.view' },
  { label: '회원 관리', href: '/dashboard/users', icon: Users, permission: 'users.view' },
  { label: '커미션', href: '/dashboard/commissions', icon: Percent, permission: 'commission.view' },
  { label: '정산', href: '/dashboard/settlements', icon: Calculator, permission: 'settlement.view' },
  { label: '입출금', href: '/dashboard/transactions', icon: Wallet, permission: 'transaction.view' },
  { label: '게임 관리', href: '/dashboard/games', icon: Gamepad2, permission: 'game.view' },
  { label: 'VIP 등급', href: '/dashboard/vip', icon: Crown, permission: 'users.view' },
  { label: '한도 관리', href: '/dashboard/limits', icon: ShieldCheck, permission: 'setting.view' },
  { label: '프로모션', href: '/dashboard/promotions', icon: Gift, permission: 'announcement.view' },
  { label: '급여 관리', href: '/dashboard/salary', icon: Banknote, permission: 'agents.view' },
  { label: '파트너', href: '/dashboard/partner', icon: Handshake, permission: 'partner.view' },
  { label: '리포트', href: '/dashboard/reports', icon: BarChart3, permission: 'report.view' },
  { label: '감사 로그', href: '/dashboard/audit', icon: ScrollText, permission: 'audit_log.view' },
  { label: '공지 관리', href: '/dashboard/announcements', icon: Megaphone, permission: 'announcement.view' },
  { label: '알림', href: '/dashboard/notifications', icon: Bell, permission: 'notification.view' },
  { label: 'FDS', href: '/dashboard/fraud', icon: ShieldAlert, permission: 'fraud.view' },
  { label: '실시간 모니터링', href: '/dashboard/monitoring', icon: Activity, permission: 'monitoring.view' },
  { label: 'IP 관리', href: '/dashboard/ip-management', icon: Globe, permission: 'setting.view' },
  { label: '분석/RTP', href: '/dashboard/analytics', icon: BarChart2, permission: 'report.view' },
  { label: '대량 작업', href: '/dashboard/bulk', icon: UsersRound, permission: 'users.update' },
  { label: 'KYC 인증', href: '/dashboard/kyc', icon: FileCheck, permission: 'users.view' },
  { label: 'BI 대시보드', href: '/dashboard/bi', icon: PieChart, permission: 'report.view' },
  { label: '백업 관리', href: '/dashboard/backup', icon: Database, permission: 'setting.view' },
  { label: '역할/권한', href: '/dashboard/roles', icon: Shield, permission: 'role.view' },
  { label: '시스템 설정', href: '/dashboard/settings', icon: Settings, permission: 'setting.view' },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { user, logout, hasPermission } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await apiClient.post('/api/v1/auth/logout');
    } catch {
      // Ignore — stateless logout
    }
    logout();
    router.push('/login');
  };

  const visibleItems = navItems.filter((item) => hasPermission(item.permission));

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-white dark:bg-gray-950">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-lg font-bold">Game Admin</h1>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.username}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
          </div>
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-red-500 transition-colors"
            title="로그아웃"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
