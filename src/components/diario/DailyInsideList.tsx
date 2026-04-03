type DailyInsideListItem = {
  id: string;
  plate: string;
  customerName: string | null;
  pricingUnit: "HOUR" | "SHIFT" | "MANUAL" | "SUBSCRIPTION";
  isSubscription: boolean;
  entryAt: string;
  durationMinutes: number;
};

type DailyInsideListProps = {
  items: DailyInsideListItem[];
};

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Bogota",
  }).format(new Date(value));
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

function getPricingLabel(
  pricingUnit: "HOUR" | "SHIFT" | "MANUAL" | "SUBSCRIPTION",
  isSubscription: boolean,
): string {
  if (isSubscription || pricingUnit === "SUBSCRIPTION") {
    return "Mensualidad";
  }

  switch (pricingUnit) {
    case "HOUR":
      return "Por horas";
    case "SHIFT":
      return "Jornada";
    case "MANUAL":
      return "Manual";
    default:
      return "Normal";
  }
}

export default function DailyInsideList({
  items,
}: DailyInsideListProps) {
  return (
    <section className="rounded-[28px] border border-black/10 bg-white shadow-sm">
      <div className="border-b border-black/8 px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-black">
              Vehículos dentro
            </h2>
            <p className="mt-1 text-sm text-black/55">
              Vista rápida de los vehículos que siguen activos para la fecha consultada.
            </p>
          </div>

          <span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs font-medium text-black/60">
            {items.length}
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-8 text-sm text-black/55 sm:px-5">
          No hay vehículos dentro para esta consulta.
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-black/8 text-xs uppercase tracking-[0.16em] text-black/45">
                  <th className="px-5 py-3 font-medium">Placa</th>
                  <th className="px-5 py-3 font-medium">Ingreso</th>
                  <th className="px-5 py-3 font-medium">Duración</th>
                  <th className="px-5 py-3 font-medium">Modalidad</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-black/6 last:border-b-0"
                  >
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold uppercase tracking-[0.08em] text-black">
                          {item.plate}
                        </span>
                        <span className="text-xs text-black/50">
                          {item.customerName ?? "Sin cliente"}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm text-black/70">
                      {formatTime(item.entryAt)}
                    </td>

                    <td className="px-5 py-4 text-sm text-black/70">
                      {formatDuration(item.durationMinutes)}
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs font-medium text-black/65">
                        {getPricingLabel(item.pricingUnit, item.isSubscription)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-4 md:hidden">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-3xl border border-black/8 bg-neutral-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold uppercase tracking-[0.08em] text-black">
                      {item.plate}
                    </p>
                    <p className="mt-1 truncate text-xs text-black/50">
                      {item.customerName ?? "Sin cliente"}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-black/65">
                    {getPricingLabel(item.pricingUnit, item.isSubscription)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-black/40">
                      Ingreso
                    </p>
                    <p className="mt-1 font-medium text-black/75">
                      {formatTime(item.entryAt)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-black/40">
                      Duración
                    </p>
                    <p className="mt-1 font-medium text-black/75">
                      {formatDuration(item.durationMinutes)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}