export function SetupNotice({
  title = "Supabase is not connected",
  body = "The page is ready. It will read the database after a project is configured.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <div className="frame max-w-2xl px-6 py-8">
      <h2 className="font-display text-2xl tracking-[0.08em]">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-mute">{body}</p>
      <ol className="mt-6 space-y-4 text-sm leading-6 text-paper">
        <li>
          Copy <code className="text-blood-bright">.env.example</code> to{" "}
          <code className="text-blood-bright">.env.local</code>.
        </li>
        <li>
          <p>Local project, with Docker:</p>
          <code className="mt-1 block text-blood-bright">npx supabase start</code>
          <code className="block text-blood-bright">npx supabase db reset</code>
          <code className="block text-blood-bright">npx supabase status</code>
        </li>
        <li>
          <p>Hosted project:</p>
          <code className="mt-1 block break-all text-blood-bright">npx supabase login</code>
          <code className="block break-all text-blood-bright">
            npx supabase link --project-ref YOUR_PROJECT_REF
          </code>
          <code className="block text-blood-bright">npx supabase db push</code>
        </li>
        <li>
          Put the project URL and keys in <code className="text-blood-bright">.env.local</code>. Do
          not invent them.
        </li>
      </ol>
    </div>
  );
}
