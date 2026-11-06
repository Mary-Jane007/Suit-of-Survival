export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="frame px-6 py-10">
      <h2 className="font-display text-2xl tracking-[0.06em]">{title}</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-mute">{body}</p>
    </div>
  );
}

export function QueryError({ message }: { message: string }) {
  return (
    <div className="border border-blood px-6 py-6">
      <p className="text-xs uppercase tracking-[0.18em] text-blood-bright">Database</p>
      <p className="mt-3 text-sm leading-6 text-paper">{message}</p>
    </div>
  );
}
