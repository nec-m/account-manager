"use client";

import { useState } from 'react';
import { WarningCircle, ArrowClockwise } from '@phosphor-icons/react';
import { getDashboardCounts } from './_features/dashboard/dashboardData';
import DashboardHeader from './_features/dashboard/DashboardHeader';
import AccountsView from './_features/accounts/AccountsView';
import PhonesView from './_features/phones/PhonesView';
import useDashboardData from './_features/dashboard/useDashboardData';
import InvalidView from './_features/archive/InvalidView';

import CustomDialog from './_components/CustomDialog';
import DashboardSkeleton from './_components/DashboardSkeleton';
import LoginScreen from './_features/auth/LoginScreen';
import PasswordChangeForm from './_features/auth/PasswordChangeForm';
import useAuthSession from './_features/auth/useAuthSession';

export { normalizeDataPayload } from './_features/dashboard/dashboardData';

export default function Home() {
  const [activeView, setActiveView] = useState('accounts');
  const [dialog, setDialog] = useState({ isOpen: false });
  const {
    status,
    user,
    error: authError,
    login,
    logout,
    changePassword,
    handleUnauthorized,
  } = useAuthSession();
  const isAdmin = user?.role === 'admin';
  const dashboard = useDashboardData({
    status,
    isAdmin,
    onUnauthorized: handleUnauthorized,
    onDialogChange: setDialog,
  });
  const { data, loading, loadError } = dashboard.state;

  const handleLogout = async () => {
    dashboard.actions.prepareLogout();
    await logout();
  };

  if (status === 'checking') {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5 font-sans">
        <p aria-live="polite" className="text-sm text-muted-foreground">正在验证登录状态...</p>
      </main>
    );
  }

  if (status === 'anonymous') return <LoginScreen error={authError} onLogin={login} />;

  if (status === 'password-change-required') {
    return <PasswordChangeForm error={authError} onChangePassword={changePassword} />;
  }

  const counts = getDashboardCounts(data);
  let dashboardContent;
  if (loading) {
    dashboardContent = <DashboardSkeleton />;
  } else if (loadError) {
    dashboardContent = (
      <div role="alert" className="mx-auto flex min-h-[360px] max-w-xl flex-col items-center justify-center rounded-2xl border border-border bg-panel px-8 text-center shadow-xs">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-danger-foreground text-danger">
          <WarningCircle size={22} weight="bold" />
        </div>
        <h2 className="text-base font-semibold text-foreground">数据加载失败</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{loadError}</p>
        <button type="button" onClick={dashboard.actions.load} className="btn btn-primary mt-5">
          <ArrowClockwise size={15} weight="bold" />
          重新加载
        </button>
      </div>
    );
  } else {
    dashboardContent = (
      <div key={activeView}>
        {activeView === 'accounts' && <AccountsView data={data} onChange={dashboard.actions.change} isAdmin={isAdmin} onUnauthorized={dashboard.actions.handleUnauthorized} />}
        {activeView === 'phones' && <PhonesView data={data} onChange={dashboard.actions.change} isAdmin={isAdmin} onUnauthorized={dashboard.actions.handleUnauthorized} />}
        {activeView === 'invalid' && <InvalidView data={data} onChange={dashboard.actions.change} isAdmin={isAdmin} />}
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background font-sans">

      {/* Editorial Header */}
      <DashboardHeader
        activeView={activeView}
        onViewChange={setActiveView}
        counts={counts}
        user={user}
        authError={authError}
        onLogout={handleLogout}
        onChangePassword={changePassword}
        onUnauthorized={dashboard.actions.handleUnauthorized}
      />

      {/* Main Content */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8">
        {dashboardContent}
      </main>

      <CustomDialog
        {...dialog}
        onConfirm={() => setDialog({ isOpen: false })}
        onCancel={() => setDialog({ isOpen: false })}
      />
    </div>
  );
}
