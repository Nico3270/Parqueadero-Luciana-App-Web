// src/app/page.tsx
import Link from "next/link";
import Script from "next/script";
import {
  ArrowRightLeft,
  CarFront,
  LayoutDashboard,
} from "lucide-react";
import { createEntryAction } from "@/actions/parking/createEntryAction";
import { lookupExitAction } from "@/actions/parking/lookupExitAction";
import { auth } from "@/auth";
import EntryPanel from "@/components/parking/EntryPanel";
import ExitLookupPanel from "@/components/parking/ExitLookupPanel";
import { redirect } from "next/navigation";

type HomePageProps = {
  searchParams?: Promise<{
    view?: string;
  }>;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default async function Home({ searchParams }: HomePageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const currentView = params?.view === "exit" ? "exit" : "entry";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <Script id="page-scroll-top" strategy="beforeInteractive">
        {`
          try {
            if ("scrollRestoration" in window.history) {
              window.history.scrollRestoration = "manual";
            }
            window.scrollTo(0, 0);
            window.addEventListener("load", function () {
              window.scrollTo(0, 0);
            });
            window.addEventListener("pageshow", function () {
              window.scrollTo(0, 0);
            });
          } catch (e) {}
        `}
      </Script>

      <main className="mx-auto w-full max-w-7xl px-3 py-0 sm:px-5 sm:py-4 lg:px-8 lg:py-0">
        <header className="mb-3 sm:mb-4">
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-1 shadow-sm sm:px-5 sm:py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-center text-lg font-semibold tracking-tight text-zinc-950 sm:text-xl lg:text-left">
                  Registro de parqueadero
                </h1>
              </div>

              <div className="hidden lg:flex">
                <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700">
                  <LayoutDashboard className="size-4 text-zinc-500" />
                  Panel principal
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="mb-3 lg:hidden">
          <div className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/?view=entry"
                scroll={false}
                className={cx(
                  "inline-flex min-h-14 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition",
                  currentView === "entry"
                    ? "bg-green-600 text-white shadow-sm"
                    : "border border-zinc-200 bg-white text-zinc-700"
                )}
                aria-current={currentView === "entry" ? "page" : undefined}
              >
                <CarFront
                  className={cx(
                    "size-5",
                    currentView === "entry" ? "text-white" : "text-zinc-500"
                  )}
                />
                Ingreso
              </Link>

              <Link
                href="/?view=exit"
                scroll={false}
                className={cx(
                  "inline-flex min-h-14 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition",
                  currentView === "exit"
                    ? "bg-red-600 text-white shadow-sm"
                    : "border border-zinc-200 bg-white text-zinc-700"
                )}
                aria-current={currentView === "exit" ? "page" : undefined}
              >
                <ArrowRightLeft
                  className={cx(
                    "size-5",
                    currentView === "exit" ? "text-white" : "text-zinc-500"
                  )}
                />
                Salida
              </Link>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:gap-5">
          <div className="lg:hidden">
            {currentView === "entry" ? (
              <EntryPanel action={createEntryAction} />
            ) : (
              <ExitLookupPanel action={lookupExitAction} />
            )}
          </div>

          <div className="hidden lg:col-span-6 lg:block">
            <EntryPanel action={createEntryAction} />
          </div>

          <div className="hidden lg:col-span-6 lg:block">
            <ExitLookupPanel action={lookupExitAction} />
          </div>
        </section>
      </main>
    </div>
  );
}