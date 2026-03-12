// src/app/page.tsx
import { createEntryAction } from "@/actions/parking/createEntryAction";
import { lookupExitAction } from "@/actions/parking/lookupExitAction";
import { auth } from "@/auth";
import EntryPanel from "@/components/parking/EntryPanel";
import ExitLookupPanel from "@/components/parking/ExitLookupPanel";
import { redirect } from "next/navigation";



export default async function Home() {
  const session = await auth();

  // Protege /
  // if (!session?.user) {
  //   redirect("/auth/login");
  // }

  // const u = session.user;
  // const displayName = (u.name?.trim() || u.email?.trim() || "Operador").toString();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto w-full  px-4 py-2 sm:px-6 lg:px-8">
        {/* Título pequeño (sesión) */}
        <header className="mb-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Sesión
          </p>
          <h1 className="mt-1 text-base font-semibold tracking-tight text-zinc-900">
            {/* {displayName} */} Hola Nico
          </h1>
        </header>

        {/* Contenedor principal */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Placeholder: Estado */}
          <div className="lg:col-span-12">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-medium text-zinc-800">Estado</div>
              <div className="mt-1 text-sm text-zinc-500">
                (Aquí irá el bloque de ocupación / caja / alertas)
              </div>
            </div>
          </div>

          {/* Entrada: ya sin wrapper extra (EntryPanel ya es una card) */}
          <div className="lg:col-span-6">
            <EntryPanel action={createEntryAction} />
          </div>

          {/* Placeholder: Salida/Cobro */}
          <div className="lg:col-span-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      
              <div className="text-sm text-zinc-500">
                <ExitLookupPanel action={lookupExitAction} />
              </div>
            </div>
          </div>

          {/* Placeholder: Resumen/Actividad */}
          <div className="lg:col-span-12">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-medium text-zinc-800">Resumen</div>
              <div className="mt-1 text-sm text-zinc-500">
                (Aquí irán tarjetas y últimos movimientos)
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}