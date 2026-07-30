"use client";

import { useRef, useState } from 'react';
import { Eye, EyeSlash } from '@phosphor-icons/react';

export default function LoginScreen({ error, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onLogin({ username, password });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-[100dvh] w-full items-center justify-center bg-background px-5 py-10 font-sans">
      <section className="w-full max-w-[400px]" aria-labelledby="login-title">
        <div className="mb-10 text-xl font-bold tracking-tight text-foreground">Manager.</div>
        <h1 id="login-title" className="text-3xl font-semibold tracking-tight text-foreground">
          登录账号管家
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">仅限已授权成员访问</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <label htmlFor="login-username" className="block text-[13px] font-medium text-foreground">
              用户名
            </label>
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              autoFocus
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="input"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="login-password" className="block text-[13px] font-medium text-foreground">
              密码
            </label>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="input pr-11"
              />
              <button
                type="button"
                title={showPassword ? '隐藏密码' : '显示密码'}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary"
              >
                {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div aria-live="polite" className="min-h-5 text-[13px] leading-5 text-danger">
            {error}
          </div>

          <button type="submit" disabled={submitting} className="btn btn-primary h-10 w-full">
            {submitting ? '登录中...' : '登录'}
          </button>
        </form>
      </section>
    </main>
  );
}
