"use client";

import { useState, useRef, useEffect } from 'react';
import { CaretDown, MagnifyingGlass, Check, UserCircle } from '@phosphor-icons/react';

export default function AccountSelectDropdown({ accounts = [], onSelect, placeholder = "选择绑定账号..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // 点击外部收起 Popover
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 打开 Popover 时自动聚焦搜索框
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  const filteredAccounts = accounts.filter(acc => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      (acc.site && acc.site.toLowerCase().includes(q)) ||
      (acc.username && acc.username.toLowerCase().includes(q)) ||
      (acc.note && acc.note.toLowerCase().includes(q))
    );
  });

  const handleSelect = (accId) => {
    onSelect(accId);
    setIsOpen(false);
  };

  return (
    <div className="relative flex-1" ref={containerRef}>
      {/* 触发器 Trigger 按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-xs bg-muted/80 hover:bg-muted border border-border rounded px-2 py-1.5 flex items-center justify-between gap-1 text-foreground transition-all duration-150 shadow-2xs group"
      >
        <span className="truncate text-muted-foreground group-hover:text-foreground">
          {placeholder}
        </span>
        <CaretDown size={14} className={`shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover 下拉选择面板 */}
      {isOpen && (
        <div className="absolute bottom-full mb-1 left-0 z-50 w-72 max-w-[90vw] bg-panel border border-border rounded-xl shadow-xl p-2 flex flex-col gap-1.5 animate-in fade-in-50 zoom-in-95 duration-100">
          {/* 搜索框 */}
          <div className="relative">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索站点 / 邮箱..."
              className="w-full pl-8 pr-2 py-1 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-foreground transition-all"
            />
          </div>

          {/* 可选账号列表 */}
          <div className="max-h-52 overflow-y-auto space-y-0.5 pr-0.5 custom-scrollbar">
            {filteredAccounts.length > 0 ? (
              filteredAccounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleSelect(acc.id)}
                  className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted/80 transition-colors flex items-center justify-between gap-2 group"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted/90 border border-border text-foreground font-mono">
                      {acc.site || '账号'}
                    </span>
                    <span className="truncate text-foreground/90 font-mono text-[11px]" title={acc.username}>
                      {acc.username}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="py-4 text-center text-xs text-muted-foreground">
                {search ? '未找到匹配的账号' : '暂无可选绑定的账号'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
