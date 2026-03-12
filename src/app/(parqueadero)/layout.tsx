// src/app/(app)/layout.tsx

import ParkingAppBar from "@/components/ui/navbar";




export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto w-full px-4 py-6 sm:px-2">
      <ParkingAppBar />
        {children}
      </div>
    </div>
  );
}