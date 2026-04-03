import { getDailyDashboardAction } from "@/actions/diario/getDailyDashboardAction";
import DailyEntriesList from "@/components/diario/DailyEntriesList";
import DailyExitsList from "@/components/diario/DailyExitsList";
import DailyHeader from "@/components/diario/DailyHeader";
import DailyInsideList from "@/components/diario/DailyInsideList";
import DailySummaryCards from "@/components/diario/DailySummaryCards";

type DiarioPageProps = {
  searchParams?: Promise<{
    date?: string | string[];
  }>;
};

function getSingleSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }

  return undefined;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date(value));
}

export default async function DiarioPage({ searchParams }: DiarioPageProps) {
  const resolvedSearchParams = await searchParams;
  const selectedDate = getSingleSearchParam(resolvedSearchParams?.date);

  const data = await getDailyDashboardAction({
    date: selectedDate,
  });

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <DailyHeader
          date={data.date}
          isToday={data.isToday}
          isFutureDate={data.isFutureDate}
          insideCount={data.summary.insideCount}
          uniqueVehiclesCount={data.summary.uniqueVehiclesCount}
        />

        <DailySummaryCards summary={data.summary} />

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
          <DailyInsideList items={data.insideNow} />

          <div className="grid gap-6">
            <DailyEntriesList items={data.entriesToday} />
            <DailyExitsList items={data.exitsToday} />
          </div>
        </section>

        <section className="rounded-[28px] border border-black/10 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold tracking-tight text-black">
            Depuración rápida
          </h2>

          <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-black/60 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-black/[0.03] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-black/40">
                Fecha
              </p>
              <p className="mt-1 font-medium text-black/75">
                {data.date}
              </p>
            </div>

            <div className="rounded-2xl bg-black/[0.03] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-black/40">
                Snapshot
              </p>
              <p className="mt-1 font-medium text-black/75">
                {formatDateTime(data.snapshotAt)}
              </p>
            </div>

            <div className="rounded-2xl bg-black/[0.03] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-black/40">
                Inicio rango
              </p>
              <p className="mt-1 font-medium text-black/75">
                {formatDateTime(data.range.startAt)}
              </p>
            </div>

            <div className="rounded-2xl bg-black/[0.03] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-black/40">
                Fin rango
              </p>
              <p className="mt-1 font-medium text-black/75">
                {formatDateTime(data.range.endAt)}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}