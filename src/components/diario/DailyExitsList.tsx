type DailyExitsListItem = {
  id: string;
  plate: string;
  customerName: string | null;
  pricingUnit: "HOUR" | "SHIFT" | "MANUAL" | "SUBSCRIPTION";
  isSubscription: boolean;
  exitAt: string | null;
  durationMinutes: number;
  amountPaid: number;
};

type DailyExitsListProps = {
  items: DailyExitsListItem[];
  maxItems?: number;
};

function formatTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Bogota",
  }).format(new Date(value));
}

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

export default function DailyExitsList({
  items,
  maxItems = 8,
}: DailyExitsListProps) {
  const visibleItems = items.slice(0, maxItems);

  return (
    <section className="rounded-[28px] border border-black/10 bg-white shadow-sm">
      <div className="border-b border-black/8 px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-black">
              Últimas salidas
            </h2>
            <p className="mt-1 text-sm text-black/55">
              Salidas cerradas en el día consultado.
            </p>
          </div>

          <span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs font-medium text-black/60">
            {items.length}
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-8 text-sm text-black/55 sm:px-5">
          No hubo salidas registradas.
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <div className="divide-y divide-black/6">
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold uppercase tracking-[0.08em] text-black">
                      {item.plate}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/50">
                      <span>{formatDuration(item.durationMinutes)}</span>
                      <span>•</span>
                      <span>
                        {getPricingLabel(item.pricingUnit, item.isSubscription)}
                      </span>
                      <span>•</span>
                      <span>{item.customerName ?? "Sin cliente"}</span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium text-black/75">
                      {formatTime(item.exitAt)}
                    </p>
                    <p className="mt-1 text-xs text-black/50">
                      {formatCurrency(item.amountPaid)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 p-4 md:hidden">
            {visibleItems.map((item) => (
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
                    {formatTime(item.exitAt)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-black/40">
                      Duración
                    </p>
                    <p className="mt-1 font-medium text-black/75">
                      {formatDuration(item.durationMinutes)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-black/40">
                      Pago
                    </p>
                    <p className="mt-1 font-medium text-black/75">
                      {formatCurrency(item.amountPaid)}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-black/40">
                    Modalidad
                  </p>
                  <p className="mt-1 text-sm font-medium text-black/75">
                    {getPricingLabel(item.pricingUnit, item.isSubscription)}
                  </p>
                </div>
              </article>
            ))}
          </div>

          {items.length > visibleItems.length ? (
            <div className="border-t border-black/6 px-4 py-3 text-xs text-black/45 sm:px-5">
              Mostrando {visibleItems.length} de {items.length} salidas.
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}