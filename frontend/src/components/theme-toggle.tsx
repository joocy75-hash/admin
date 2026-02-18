'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/hooks/use-theme';

const THEME_ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

const THEME_LABELS = {
  light: '라이트',
  dark: '다크',
  system: '시스템',
} as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = THEME_ICONS[theme];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="테마 변경">
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(THEME_ICONS) as Array<'light' | 'dark' | 'system'>).map((key) => {
          const ItemIcon = THEME_ICONS[key];
          return (
            <DropdownMenuItem
              key={key}
              onClick={() => setTheme(key)}
              className={theme === key ? 'bg-accent' : ''}
            >
              <ItemIcon className="mr-2 h-4 w-4" />
              {THEME_LABELS[key]}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
