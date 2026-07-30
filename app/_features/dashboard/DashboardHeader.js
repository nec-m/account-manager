'use client';

import { motion } from 'motion/react';
import SessionControls from '../auth/SessionControls';

export default function DashboardHeader({
  activeView,
  onViewChange,
  counts,
  user,
  authError,
  onLogout,
  onChangePassword,
  onUnauthorized,
}) {
  const {
    validAccountsCount,
    validPhonesCount,
    idlePhonesCount,
    invalidCount,
  } = counts;

  function NavItem({ id, label }) {
    const isActive = activeView === id;
    return (
      <button
        onClick={() => onViewChange(id)}
        className={`relative px-4 h-full flex items-center text-sm transition-colors ${
          isActive ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {label}
        {isActive && (
          <motion.div
            layoutId="nav-underline"
            className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground"
            transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
          />
        )}
      </button>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-panel">
        <div className="mx-auto flex min-h-16 max-w-[1440px] flex-wrap items-center gap-x-3 px-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex items-center gap-2 pr-2">
              <div className="font-sans text-xl font-bold tracking-tight text-foreground">Manager.</div>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">v1.2.2</span>
            </div>
            <div className="hidden xl:flex items-center gap-2 text-xs text-muted-foreground border-l border-border pl-4">
              <span>有效账号: <strong className="text-foreground">{validAccountsCount}</strong></span>
              <span className="text-border">•</span>
              <span>闲置手机号: <strong className="text-amber-600">{idlePhonesCount}</strong></span>
            </div>
          </div>

          <nav className="order-3 flex h-12 w-full min-w-0 gap-1 overflow-x-auto border-t border-border lg:order-none lg:h-16 lg:w-auto lg:border-t-0">
            <NavItem id="accounts" label={`Accounts (${validAccountsCount})`} />
            <NavItem id="phones" label={`Phones (${validPhonesCount})`} />
            <NavItem id="invalid" label={`Invalid (${invalidCount})`} />
          </nav>

          <SessionControls
            user={user}
            error={authError}
            onLogout={onLogout}
            onChangePassword={onChangePassword}
            onUnauthorized={onUnauthorized}
          />
        </div>
      </header>

      {authError && (
        <div role="alert" className="border-b border-danger/20 bg-danger-foreground px-5 py-2 text-center text-[13px] text-danger">
          {authError}
        </div>
      )}
    </>
  );
}
