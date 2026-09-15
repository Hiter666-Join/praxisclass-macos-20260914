'use client';

import {
  BarChart3,
  BookOpen,
  CalendarClock,
  LayoutDashboard,
  MessageSquare,
  PenLine,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useSettingsStore } from '@/lib/store/settings';
import type { PlatformMode } from '@/lib/types/settings';

export interface PlatformNavItem {
  /** Suffix under the `platform.nav.*` i18n namespace. */
  key: string;
  icon: LucideIcon;
  /** Internal route. Absent for the settings action item. */
  href?: string;
  /** External URL opened in a new tab. */
  externalHref?: string;
  /** Opens the shared SettingsDialog instead of navigating. */
  action?: 'settings';
  /** Match the pathname exactly (used by the `/` creation page entry). */
  exact?: boolean;
}

function serviceUrl(configured: string | undefined, official: string): string {
  const value = configured?.trim();
  return value && /^https?:\/\//i.test(value) ? value : official;
}

export const ASTRONCLAW_URL = serviceUrl(
  process.env.NEXT_PUBLIC_ASTRONCLAW_URL,
  'https://agent.xfyun.cn/astron-claw/',
);
export const XINGCHEN_URL = serviceUrl(
  process.env.NEXT_PUBLIC_XINGCHEN_URL,
  'https://agent.xfyun.cn/agentbuilder',
);

export const TEACHER_NAV: PlatformNavItem[] = [
  { key: 'teacherHome', href: '/teacher', icon: LayoutDashboard, exact: true },
  { key: 'courses', href: '/teacher/courses', icon: BookOpen },
  { key: 'prepare', href: '/', icon: PenLine, exact: true },
  { key: 'dashboard', href: '/dashboard', icon: BarChart3 },
  { key: 'schedule', href: '/schedule', icon: CalendarClock },
  { key: 'settings', action: 'settings', icon: Settings },
];

export const STUDENT_NAV: PlatformNavItem[] = [
  { key: 'myCourses', href: '/student', icon: BookOpen, exact: true },
  { key: 'learning', href: '/student/dashboard', icon: BarChart3 },
  { key: 'feedback', href: '/student/feedback', icon: MessageSquare },
  { key: 'astronclaw', externalHref: ASTRONCLAW_URL, icon: Sparkles },
  { key: 'xingchen', externalHref: XINGCHEN_URL, icon: Sparkles },
  { key: 'settings', action: 'settings', icon: Settings },
];

export function getNavItems(mode: PlatformMode): PlatformNavItem[] {
  return mode === 'teacher' ? TEACHER_NAV : STUDENT_NAV;
}

export function isNavItemActive(pathname: string, item: PlatformNavItem): boolean {
  if (!item.href) return false;
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function usePlatformMode() {
  const mode = useSettingsStore((state) => state.mode);
  const setMode = useSettingsStore((state) => state.setMode);
  return { mode, setMode };
}

export function platformHomeHref(mode: PlatformMode): string {
  return mode === 'teacher' ? '/teacher' : '/student';
}
