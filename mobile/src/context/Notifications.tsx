import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './Auth';
import { api } from '../lib/api';
import { sendLocalNotification, ensureNotificationChannel } from '../lib/push';

// Global notification state (port of the notifs state + poller in src/App.jsx).
// Drives the TopBar bell badge/panel and the TabBar unread/request dots.

export interface UnreadRow {
  other_id: string | number;
  name?: string;
  avatar?: string;
  unread: number;
}

export interface RequestRow {
  id: string | number;
  requester_name?: string;
  requester_exam?: string;
  requester_avatar?: string;
}

interface NotifValue {
  requests: RequestRow[];
  unread: UnreadRow[];
  totalCount: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  refresh: () => void;
  markAllRead: () => void;
  dismissOne: (otherId: string | number) => void;
}

const NotifCtx = createContext<NotifValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [unread, setUnread] = useState<UnreadRow[]>([]);
  const [open, setOpen] = useState(false);
  const seenRef = useRef<Set<string> | null>(null);

  // store rows + notify about conversations that weren't unread on the previous poll
  const applyUnread = useCallback((rows: UnreadRow[]) => {
    const ids = new Set(rows.map((r) => String(r.other_id)));
    if (seenRef.current === null) {
      seenRef.current = ids; // first load — baseline, no notifications
    } else {
      rows
        .filter((r) => !seenRef.current!.has(String(r.other_id)))
        .forEach((r) => {
          sendLocalNotification(r.name || 'New message', `${r.unread} new message${r.unread > 1 ? 's' : ''}`);
        });
      seenRef.current = ids;
    }
    setUnread(rows);
  }, []);

  const refresh = useCallback(() => {
    if (!user) return;
    api
      .connections()
      .then((d: { requests?: RequestRow[]; incoming?: RequestRow[] }) =>
        setRequests(d.requests || d.incoming || [])
      )
      .catch(() => {});
    api
      .unreadMessages()
      .then((d: { unread?: UnreadRow[] }) => applyUnread(d.unread || []))
      .catch(() => {});
  }, [user, applyUnread]);

  useEffect(() => {
    ensureNotificationChannel();
  }, []);

  useEffect(() => {
    if (!user) {
      seenRef.current = null;
      return;
    }
    refresh();
    // poll gently every 30s, only while the app is actually in the foreground
    const t = setInterval(() => {
      if (AppState.currentState === 'active') refresh();
    }, 30000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [user, refresh]);

  const markAllRead = useCallback(() => {
    applyUnread([]);
    api.markAllRead().catch(() => {});
  }, [applyUnread]);

  // web reloads notifications every time the bell is opened
  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const dismissOne = useCallback((otherId: string | number) => {
    setUnread((prev) => {
      const next = prev.filter((x) => x.other_id !== otherId);
      seenRef.current = new Set(next.map((r) => String(r.other_id)));
      return next;
    });
    api.markReadOne(otherId).catch(() => {});
  }, []);

  const totalCount = (user ? requests.length : 0) + (user ? unread.reduce((a, r) => a + (r.unread || 0), 0) : 0);

  const value = useMemo<NotifValue>(
    () => ({
      requests: user ? requests : [],
      unread: user ? unread : [],
      totalCount,
      open,
      setOpen,
      refresh,
      markAllRead,
      dismissOne,
    }),
    [user, requests, unread, totalCount, open, refresh, markAllRead, dismissOne]
  );

  return <NotifCtx.Provider value={value}>{children}</NotifCtx.Provider>;
}

export function useNotifications(): NotifValue {
  const ctx = useContext(NotifCtx);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
