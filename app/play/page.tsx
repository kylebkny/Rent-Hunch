import { FreePlay } from "@/components/FreePlay";
import { MuteToggle } from "@/components/MuteToggle";

export default function PlayPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 pt-16 pb-16 gap-8">
      <MuteToggle />
      <header className="text-center px-14">
        <p className="eyebrow">Free play · no streak, just for fun</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-paper">Guess any listing</h1>
      </header>
      <FreePlay />
    </main>
  );
}
