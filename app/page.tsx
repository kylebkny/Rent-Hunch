import { RentHunchGame } from "@/components/RentHunchGame";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 gap-8">
      <header className="text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Rent Hunch</h1>
        <p className="font-mono text-xs text-paper-dim uppercase tracking-[0.2em] mt-1">
          Guess today&apos;s Brooklyn rent
        </p>
      </header>
      <RentHunchGame />
    </main>
  );
}
