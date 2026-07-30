"use client";

import { useState, useEffect } from 'react';

function getSafeRemaining(exp) {
  const numExp = Number(exp);
  if (!numExp || isNaN(numExp)) return 0;
  const remaining = Math.floor((numExp - Date.now()) / 1000);
  return isNaN(remaining) ? 0 : Math.max(0, remaining);
}

export default function TotpCountdown({ expires, onRefresh }) {
  const [timeLeft, setTimeLeft] = useState(() => getSafeRemaining(expires));

  useEffect(() => {
    setTimeLeft(getSafeRemaining(expires));
    const timer = setInterval(() => {
      const remaining = getSafeRemaining(expires);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expires]);

  if (timeLeft <= 0) {
    return (
      <div className="flex items-center justify-center gap-1.5 text-xs text-rose-600 mt-1 font-normal select-none">
        <span>已过期</span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-xs text-primary underline hover:opacity-80 transition-opacity font-medium ml-0.5"
          >
            点击刷新
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="text-xs text-muted-foreground mt-1 font-normal tracking-normal select-none flex items-center justify-center gap-1">
      <span>刷新倒计时：</span>
      <span className={`font-bold font-mono ${timeLeft <= 5 ? 'text-rose-600 animate-pulse' : 'text-emerald-700'}`}>
        {timeLeft}
      </span>
      <span>秒</span>
    </div>
  );
}
