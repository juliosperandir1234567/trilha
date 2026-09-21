import { AvaliacaoClient } from "./avaliacao-client";

export default async function AvaliarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-primary-soft p-6 dark:bg-background">
      <AvaliacaoClient token={token} />
    </div>
  );
}
