import Link from "next/link";

type DailyHeaderProps = {
  date: string;
  isToday: boolean;
  isFutureDate: boolean;
  insideCount: number;
  uniqueVehiclesCount: number;
};

function formatDateLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);

  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(utcDate);
}

function getStatusLabel(
  isToday: boolean,
  isFutureDate: boolean,
): string {
  if (isToday) {
    return "Vista en tiempo real";
  }

  if (isFutureDate) {
    return "Fecha futura";
  }

  return "Cierre del día";
}

export default function DailyHeader({
  date,
  isToday,
  isFutureDate,
  insideCount,
  uniqueVehiclesCount,
}: DailyHeaderProps) {
  const headerDateLabel = formatDateLabel(date);
  const statusLabel = getStatusLabel(isToday, isFutureDate);

  return (
    <section className="rounded-[28px] border border-black/10 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/45">
            Resumen operativo
          </p>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-black sm:text-3xl">
            Diario
          </h1>

          <p className="mt-2 text-sm text-black/60 sm:text-base">
            {headerDateLabel}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="rounded-full bg-black/[0.04] px-3 py-1.5 text-black/65">
              {statusLabel}
            </span>

            <span className="rounded-full bg-black/[0.04] px-3 py-1.5 text-black/65">
              Dentro ahora: {insideCount}
            </span>

            <span className="rounded-full bg-black/[0.04] px-3 py-1.5 text-black/65">
              Vehículos únicos: {uniqueVehiclesCount}
            </span>
          </div>
        </div>

        <form
          action="/diario"
          method="get"
          className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto"
        >
          <label className="flex min-w-0 flex-1 flex-col gap-2 sm:min-w-[220px]">
            <span className="text-sm font-medium text-black/70">
              Fecha
            </span>

            <input
              type="date"
              name="date"
              defaultValue={date}
              max="9999-12-31"
              className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm text-black outline-none transition focus:border-black/25"
            />
          </label>

          <div className="flex gap-2">
            <Link
              href="/diario"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-black/10 px-4 text-sm font-medium text-black transition hover:bg-black/[0.03]"
            >
              Hoy
            </Link>

            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-black px-5 text-sm font-medium text-white transition hover:opacity-90"
            >
              Consultar
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}