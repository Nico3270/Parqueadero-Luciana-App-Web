type DailyEntriesListItem = {
  id: string;
  plate: string;
  customerName: string | null;
  pricingUnit: "HOUR" | "SHIFT" | "MANUAL" | "SUBSCRIPTION";
  isSubscription: boolean;
  entryAt: string;
};

type DailyEntriesListProps = {
  items: DailyEntriesListItem[];
  maxItems?: number;
};

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Bogota",
  }).format(new Date(value));
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

export default function DailyEntriesList({
  items,
  maxItems = 8,
}: DailyEntriesListProps) {
  const visibleItems = items.slice(0, maxItems);

  return (
    <section className="rounded-[28px] border border-black/10 bg-white shadow-sm">
      <div className="border-b border-black/8 px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-black">
              Últimos ingresos
            </h2>
            <p className="mt-1 text-sm text-black/55">
              Entradas registradas en el día consultado.
            </p>
          </div>

          <span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs font-medium text-black/60">
            {items.length}
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-8 text-sm text-black/55 sm:px-5">
          No hubo ingresos registrados.
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
                      <span>
                        {getPricingLabel(item.pricingUnit, item.isSubscription)}
                      </span>
                      <span>•</span>
                      <span>{item.customerName ?? "Sin cliente"}</span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium text-black/75">
                      {formatTime(item.entryAt)}
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
                    {formatTime(item.entryAt)}
                  </span>
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
              Mostrando {visibleItems.length} de {items.length} ingresos.
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}