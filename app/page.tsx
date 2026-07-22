import { RentHunchGame } from "@/components/RentHunchGame";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 pt-14 pb-16 gap-10">
      <header className="text-center">
        <p className="eyebrow">Daily Rent Game · Brooklyn</p>
        <h1 className="mt-3 text-5xl sm:text-6xl font-extrabold tracking-tight text-paper">
          Rent Hunch
        </h1>
        <p className="mt-3 text-base text-faint max-w-sm mx-auto">
          Study the listing. Lock your guess. See how close you got.
        </p>
      </header>
      <RentHunchGame />
    </main>
  );
}
