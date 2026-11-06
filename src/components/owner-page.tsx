export function OwnerPage({
  kicker,
  title,
  lede,
  children,
}: {
  kicker: string;
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.32em] text-blood-bright">{kicker}</p>
        <h1 className="mt-3 font-display text-4xl tracking-[0.08em] sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-mute">{lede}</p>
      </div>
      {children}
    </section>
  );
}
