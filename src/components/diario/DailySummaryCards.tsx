type DailySummaryCardsProps = {
  summary: {
    entriesCount: number;
    exitsCount: number;
    insideCount: number;

    entriesSubscriptionsCount: number;
    entriesRegularCount: number;

    exitsSubscriptionsCount: number;
    exitsRegularCount: number;

    insideSubscriptionsCount: number;
    insideRegularCount: number;

    revenueSessions: number;
    revenueSubscriptions: number;
    revenueTotal: number;

    averageStayMinutesOfExitedSessions: number;
    oldestInsideMinutes: number | null;
  };
};

type SummaryCardProps = {
  title: string;
  value: string;
  helper?: string;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) {
    return "0 min";
  }

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (mins > 0 || parts.length === 0) {
    parts.push(`${mins}m`);
  }

  return parts.join(" ");
}

function SummaryCard({ title, value, helper }: SummaryCardProps) {
  return (
    <article className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45 sm:text-xs">
        {title}
      </p>

      <p className="mt-2 text-2xl font-semibold tracking-tight text-black sm:text-[28px]">
        {value}
      </p>

      {helper ? (
        <p className="mt-1 text-sm leading-5 text-black/55">
          {helper}
        </p>
      ) : null}
    </article>
  );
}

export default function DailySummaryCards({
  summary,
}: DailySummaryCardsProps) {
  return (
    <div className="flex flex-col gap-3">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          title="Ingresos"
          value={String(summary.entriesCount)}
          helper={`${summary.entriesRegularCount} normales · ${summary.entriesSubscriptionsCount} mensualidad`}
        />

        <SummaryCard
          title="Salidas"
          value={String(summary.exitsCount)}
          helper={`${summary.exitsRegularCount} normales · ${summary.exitsSubscriptionsCount} mensualidad`}
        />

        <SummaryCard
          title="Dentro ahora"
          value={String(summary.insideCount)}
          helper={`${summary.insideRegularCount} normales · ${summary.insideSubscriptionsCount} mensualidad`}
        />

        <SummaryCard
          title="Recaudo"
          value={formatCurrency(summary.revenueTotal)}
          helper={`${formatCurrency(summary.revenueSessions)} normal · ${formatCurrency(summary.revenueSubscriptions)} mensualidades`}
        />
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <SummaryCard
          title="Mensualidades dentro"
          value={String(summary.insideSubscriptionsCount)}
        />

        <SummaryCard
          title="Normales dentro"
          value={String(summary.insideRegularCount)}
        />

        <SummaryCard
          title="Promedio estadía"
          value={formatDuration(summary.averageStayMinutesOfExitedSessions)}
          helper={
            summary.oldestInsideMinutes !== null
              ? `Más antiguo dentro: ${formatDuration(summary.oldestInsideMinutes)}`
              : "Sin vehículos activos"
          }
        />
      </section>
    </div>
  );
}