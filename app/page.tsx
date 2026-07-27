import { RentHunchGame } from "@/components/RentHunchGame";
import { MuteToggle } from "@/components/MuteToggle";
import { HowToPlay } from "@/components/HowToPlay";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/brand";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 pt-16 pb-16 gap-10">
      <HowToPlay />
      <MuteToggle />
      <header className="text-center px-14">
        <p className="eyebrow">Daily Rent Game · NYC</p>
        <h1 className="mt-2 text-4xl sm:text-5xl font-extrabold tracking-tight text-paper">
          {SITE_NAME}
        </h1>
        <p className="mt-3 text-base text-faint max-w-sm mx-auto">{SITE_TAGLINE}</p>
      </header>
      <RentHunchGame />
    </main>
  );
}
