'use client';

export default function MemberCreateForm({
  username,
  creating,
  onUsernameChange,
  onCancel,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-border bg-muted/40 p-4">
      <div className="space-y-2">
        <label htmlFor="member-username" className="block text-[13px] font-medium text-foreground">
          用户名
        </label>
        <input
          id="member-username"
          name="member-username"
          value={username}
          onChange={(event) => onUsernameChange(event.target.value)}
          autoComplete="off"
          required
          autoFocus
          className="input"
        />
      </div>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="btn btn-default">
          取消
        </button>
        <button type="submit" disabled={creating} className="btn btn-primary">
          {creating ? '创建中...' : '确认创建'}
        </button>
      </div>
    </form>
  );
}
