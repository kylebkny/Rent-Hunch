"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AddressAutocomplete, type ResolvedAddress } from "@/components/admin/AddressAutocomplete";
import { deriveTransit } from "@/lib/transit";
import {
  AMENITY_OPTIONS,
  BATH_OPTIONS,
  BED_OPTIONS,
  BOROUGHS,
  BROOKLYN_NEIGHBORHOODS,
} from "@/lib/listing-options";

interface Listing {
  id: string;
  neighborhood: string;
  city: string;
  beds: number;
  baths: number;
  sqft: number | null;
  amenities: string[];
  transit: string;
  nearby: string | null;
  actual_rent: number;
  photos: string[];
  listing_url: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  exr_listing_url: string | null;
  source: "manual" | "exr";
  review_status: "draft" | "ready";
  status: "active" | "used";
  is_off_market: boolean;
}

type Filter = "all" | "exr" | "manual" | "drafts" | "ready";

const EMPTY_FORM = {
  neighborhood: "",
  city: "Brooklyn",
  beds: "1",
  baths: "1",
  sqft: "",
  transit: "",
  nearby: "",
  actual_rent: "",
  listing_url: "",
};

export function AdminDashboard({ adminEmail }: { adminEmail: string }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [amenities, setAmenities] = useState<string[]>([]);
  const [customAmenity, setCustomAmenity] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [geo, setGeo] = useState<{ address: string; lat: number | null; lng: number | null }>({
    address: "",
    lat: null,
    lng: null,
  });
  const [schedule, setSchedule] = useState<{
    has_today: boolean;
    scheduled: { challenge_date: string; listing_id: string; label: string }[];
  }>({ has_today: false, scheduled: [] });
  const [schedListing, setSchedListing] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [tomorrow] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [syncing, setSyncing] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r1, r2] = await Promise.all([
      fetch("/api/admin/listings"),
      fetch("/api/admin/schedule"),
    ]);
    if (r1.ok) setListings((await r1.json()).listings ?? []);
    if (r2.ok) setSchedule(await r2.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- on-mount data fetch
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const byFilter =
      filter === "exr" ? listings.filter((l) => l.source === "exr")
      : filter === "manual" ? listings.filter((l) => l.source === "manual")
      : filter === "drafts" ? listings.filter((l) => l.review_status === "draft")
      : filter === "ready" ? listings.filter((l) => l.review_status === "ready")
      : listings;
    const q = search.trim().toLowerCase();
    if (!q) return byFilter;
    return byFilter.filter(
      (l) =>
        l.neighborhood.toLowerCase().includes(q) ||
        (l.address ?? "").toLowerCase().includes(q)
    );
  }, [listings, filter, search]);

  const counts = useMemo(
    () => ({
      exr: listings.filter((l) => l.source === "exr").length,
      drafts: listings.filter((l) => l.review_status === "draft").length,
      photoless: listings.filter((l) => l.source === "exr" && l.photos.length === 0).length,
    }),
    [listings]
  );

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "neighborhood" && (!f.transit || f.transit === deriveTransit(f.neighborhood))) {
        next.transit = deriveTransit(value);
      }
      return next;
    });
  }

  function toggleAmenity(a: string) {
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  function addCustomAmenity() {
    const a = customAmenity.trim();
    if (a && !amenities.includes(a)) setAmenities((prev) => [...prev, a]);
    setCustomAmenity("");
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setAmenities([]);
    setPhotos([]);
    setCustomAmenity("");
    setGeo({ address: "", lat: null, lng: null });
  }

  function handleResolved(r: ResolvedAddress) {
    setForm((f) => ({
      ...f,
      neighborhood: r.neighborhood ?? f.neighborhood,
      city: r.borough && BOROUGHS.includes(r.borough) ? r.borough : f.city,
      transit: r.transit ?? f.transit,
    }));
    setGeo({ address: r.address, lat: r.lat, lng: r.lng });
  }

  function startEdit(l: Listing) {
    setEditingId(l.id);
    setForm({
      neighborhood: l.neighborhood,
      city: l.city,
      beds: String(l.beds),
      baths: String(l.baths),
      sqft: l.sqft != null ? String(l.sqft) : "",
      transit: l.transit,
      nearby: l.nearby ?? "",
      actual_rent: String(l.actual_rent),
      listing_url: l.listing_url ?? "",
    });
    setAmenities(l.amenities ?? []);
    setPhotos(l.photos ?? []);
    setGeo({ address: l.address ?? "", lat: l.lat ?? null, lng: l.lng ?? null });
    setMessage(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setMessage(null);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (res.ok) {
        const { url } = await res.json();
        setPhotos((p) => [...p, url]);
      } else {
        setMessage("A photo failed to upload.");
      }
    }
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const payload = {
      neighborhood: form.neighborhood,
      city: form.city,
      beds: Number(form.beds),
      baths: Number(form.baths),
      sqft: form.sqft ? Number(form.sqft) : null,
      amenities,
      transit: form.transit,
      nearby: form.nearby,
      actual_rent: Number(form.actual_rent),
      photos,
      listing_url: form.listing_url,
      address: geo.address || null,
      lat: geo.lat,
      lng: geo.lng,
    };
    const res = editingId
      ? await fetch(`/api/admin/listings/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/admin/listings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    setSaving(false);
    if (res.ok) {
      setMessage(editingId ? "Listing updated." : "Listing saved.");
      resetForm();
      load();
    } else {
      setMessage((await res.json()).error ?? "Could not save.");
    }
  }

  async function patchListing(id: string, patch: Partial<Listing>) {
    const res = await fetch(`/api/admin/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) load();
    else setMessage((await res.json()).error ?? "Update failed.");
  }

  async function approve(id: string) {
    if (!window.confirm("Approve this listing for the game? Its rent will be shown publicly once it's featured.")) return;
    await patchListing(id, { review_status: "ready", is_off_market: true });
  }

  async function setAsToday(id: string, replace = false) {
    const res = await fetch("/api/admin/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing_id: id, replace }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`Now live as #${data.edition}.`);
      load();
      return;
    }
    // Today already has a challenge — offer to replace it.
    if (res.status === 409 && data.replaceable) {
      if (window.confirm("Today already has a challenge. Replace it? This clears today's plays for the current one.")) {
        setAsToday(id, true);
      }
      return;
    }
    setMessage(data.error ?? "Failed.");
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/listings/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (editingId === id) resetForm();
      load();
    } else setMessage((await res.json()).error ?? "Delete failed.");
  }

  async function addSchedule() {
    if (!schedListing || !schedDate) return;
    const res = await fetch("/api/admin/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing_id: schedListing, challenge_date: schedDate }),
    });
    const d = await res.json();
    setMessage(res.ok ? `Scheduled for ${schedDate}.` : d.error ?? "Could not schedule.");
    if (res.ok) {
      setSchedListing("");
      setSchedDate("");
      load();
    }
  }

  async function removeSchedule(date: string) {
    const res = await fetch(`/api/admin/schedule?date=${date}`, { method: "DELETE" });
    if (res.ok) load();
    else setMessage((await res.json()).error ?? "Could not unschedule.");
  }

  async function syncExr() {
    setSyncing(true);
    setMessage("Syncing EXR… this can take up to a minute.");
    try {
      const res = await fetch("/api/admin/sync-exr", { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        setMessage(d.error ?? "Sync failed.");
        return;
      }
      if (d.empty) {
        setMessage("Sync ran but found no listings (EXR markup may have changed, or the request was blocked).");
      } else {
        setMessage(
          `EXR sync: ${d.inserted} new draft(s), ${d.updated} updated, ${d.markedOffMarket} newly off-market — ${d.scraped} seen, ${d.skipped} skipped.`
        );
      }
      load();
    } catch {
      setMessage("Sync failed (timed out?). Try again.");
    } finally {
      setSyncing(false);
    }
  }

  async function backfillPhotos() {
    setEnriching(true);
    setMessage("Backfilling photos… up to a minute.");
    try {
      const res = await fetch("/api/admin/enrich-exr", { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        setMessage(d.error ?? "Backfill failed.");
        return;
      }
      setMessage(
        d.updated > 0
          ? `Added photos to ${d.updated} listing(s). ${d.remaining} still without photos — run again to continue.`
          : d.remaining === 0
            ? "All EXR listings have photos."
            : "No photos found this pass (EXR photo markup may have changed)."
      );
      load();
    } catch {
      setMessage("Backfill failed (timed out?). Try again.");
    } finally {
      setEnriching(false);
    }
  }

  const eligible = useMemo(
    () => listings.filter((l) => l.status === "active" && l.is_off_market && l.review_status === "ready"),
    [listings]
  );

  const shownAmenities = useMemo(
    () => [...AMENITY_OPTIONS, ...amenities.filter((a) => !AMENITY_OPTIONS.includes(a))],
    [amenities]
  );

  return (
    <main className="w-full max-w-3xl mx-auto px-4 py-10 flex flex-col gap-8">
      <header className="flex items-end justify-between">
        <div>
          <p className="eyebrow">Admin · {adminEmail}</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-paper">Listings</h1>
        </div>
        <Link href="/admin/analytics" className="text-sm text-faint hover:text-paper underline">Analytics →</Link>
      </header>

      {message && <p className="rounded-xl bg-paper text-ink px-4 py-2.5 text-sm">{message}</p>}

      <section className="rounded-3xl bg-paper text-ink p-6 flex flex-col gap-4 shadow-2xl shadow-black/40">
        <p className="eyebrow">Schedule</p>
        {!schedule.has_today && (
          <p className="text-sm text-red-600">⚠ No challenge is set for today. Use “Set as today” on a listing below.</p>
        )}
        {schedule.scheduled.length === 0 ? (
          <p className="text-sm text-muted">Nothing scheduled ahead. Queue upcoming days below.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {schedule.scheduled.map((s) => (
              <li key={s.challenge_date} className="flex items-center justify-between py-2 gap-3">
                <span className="min-w-0">
                  <span className="font-semibold tabular-nums">{s.challenge_date}</span>{" "}
                  <span className="text-muted">· {s.label}</span>
                </span>
                <button onClick={() => removeSchedule(s.challenge_date)} className="text-xs text-red-600 underline shrink-0">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {eligible.length === 0 ? (
          <p className="text-sm text-muted">
            No featurable listings yet. Approve a listing below (<span className="font-medium text-ink">Approve for game</span>) to schedule it.
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <select value={schedListing} onChange={(e) => setSchedListing(e.target.value)} className={inputClass}>
              <option value="">Choose a listing…</option>
              {eligible.map((l) => (
                <option key={l.id} value={l.id}>
                  {(l.address ? `${l.address} — ` : "") + l.neighborhood} · {l.beds === 0 ? "Studio" : `${l.beds}bd`}/{l.baths}ba · ${l.actual_rent.toLocaleString()}
                </option>
              ))}
            </select>
            <input type="date" value={schedDate} min={tomorrow} onChange={(e) => setSchedDate(e.target.value)} className={inputClass} />
            <button type="button" onClick={addSchedule} disabled={!schedListing || !schedDate} className="rounded-full bg-ink text-paper px-5 py-2 text-sm font-medium shrink-0 disabled:opacity-50">
              Schedule
            </button>
          </div>
        )}
      </section>

      <form onSubmit={handleSubmit} className="rounded-3xl bg-paper text-ink p-6 flex flex-col gap-4 shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between">
          <p className="eyebrow">{editingId ? "Edit listing" : "New listing"}</p>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-xs text-muted underline">
              Cancel edit
            </button>
          )}
        </div>

        <AddressAutocomplete onResolve={handleResolved} />
        {geo.address && (
          <p className="text-xs text-muted">
            📍 {geo.address}
            {geo.lat != null && geo.lng != null ? " · geocoded" : ""}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Neighborhood" required>
            <input
              list="neighborhoods"
              required
              value={form.neighborhood}
              onChange={(e) => setField("neighborhood", e.target.value)}
              className={inputClass}
            />
            <datalist id="neighborhoods">
              {BROOKLYN_NEIGHBORHOODS.map((n) => <option key={n} value={n} />)}
            </datalist>
          </Field>
          <Field label="Borough">
            <select value={form.city} onChange={(e) => setField("city", e.target.value)} className={inputClass}>
              {BOROUGHS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="Bedrooms" required>
            <select value={form.beds} onChange={(e) => setField("beds", e.target.value)} className={inputClass}>
              {BED_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Bathrooms" required>
            <select value={form.baths} onChange={(e) => setField("baths", e.target.value)} className={inputClass}>
              {BATH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Rent ($/mo)" required>
            <input type="number" min={0} required value={form.actual_rent} onChange={(e) => setField("actual_rent", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Sqft (optional)">
            <input type="number" min={0} value={form.sqft} onChange={(e) => setField("sqft", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Nearest train" required>
            <input required value={form.transit} onChange={(e) => setField("transit", e.target.value)} placeholder="Auto-filled from neighborhood" className={inputClass} />
          </Field>
          <Field label="Nearby (places)">
            <input value={form.nearby} onChange={(e) => setField("nearby", e.target.value)} placeholder="McCarren Park, …" className={inputClass} />
          </Field>
        </div>

        <Field label="Listing link (optional — shown on the reveal)">
          <input value={form.listing_url} onChange={(e) => setField("listing_url", e.target.value)} placeholder="https://…" className={inputClass} />
        </Field>

        <div className="flex flex-col gap-2">
          <span className="eyebrow">Amenities</span>
          <div className="flex flex-wrap gap-1.5">
            {shownAmenities.map((a) => {
              const on = amenities.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAmenity(a)}
                  className={`rounded-full px-3 py-1 text-sm border transition ${on ? "bg-ink text-paper border-ink" : "border-line text-muted hover:border-ink"}`}
                >
                  {a}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input
              value={customAmenity}
              onChange={(e) => setCustomAmenity(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomAmenity(); } }}
              placeholder="Add custom amenity"
              className={inputClass}
            />
            <button type="button" onClick={addCustomAmenity} className="rounded-xl border border-line px-4 text-sm shrink-0">Add</button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="eyebrow">Photos</span>
          <div className="flex flex-wrap gap-2">
            {photos.map((url, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Photo ${i + 1}`} className="h-16 w-24 object-cover rounded-lg" />
                <button type="button" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-ink text-paper text-xs">✕</button>
              </div>
            ))}
            <label className="h-16 w-24 rounded-lg border border-dashed border-line flex items-center justify-center text-xs text-muted cursor-pointer">
              {uploading ? "…" : "+ Add"}
              <input type="file" accept="image/*" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
            </label>
          </div>
        </div>

        <button type="submit" disabled={saving || uploading} className="rounded-full bg-ink text-paper font-semibold py-3 hover:bg-ink-soft transition disabled:opacity-50">
          {saving ? "Saving…" : editingId ? "Update listing" : "Save listing"}
        </button>
      </form>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="eyebrow">Listings ({filtered.length})</p>
            <button
              onClick={syncExr}
              disabled={syncing}
              className="rounded-full bg-paper/10 text-paper text-xs px-3 py-1 hover:bg-paper/20 transition disabled:opacity-50"
            >
              {syncing ? "Syncing EXR…" : "↻ Sync EXR now"}
            </button>
            {counts.photoless > 0 && (
              <button
                onClick={backfillPhotos}
                disabled={enriching}
                className="rounded-full bg-paper/10 text-paper text-xs px-3 py-1 hover:bg-paper/20 transition disabled:opacity-50"
              >
                {enriching ? "Backfilling…" : `📷 Backfill photos (${counts.photoless})`}
              </button>
            )}
          </div>
          <div className="flex gap-1 text-xs">
            {(["all", "exr", "manual", "drafts", "ready"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 transition ${filter === f ? "bg-paper text-ink" : "bg-paper/10 text-paper hover:bg-paper/20"}`}
              >
                {f === "exr" ? `EXR (${counts.exr})` : f === "drafts" ? `Drafts (${counts.drafts})` : f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search neighborhood or address…"
          className="w-full rounded-full bg-paper/10 text-paper placeholder:text-faint px-4 py-2 text-sm focus:outline-none"
        />

        {filtered.slice(0, 60).map((l) => {
          const viewUrl = l.listing_url || l.exr_listing_url;
          const featurable = l.is_off_market && l.review_status === "ready";
          return (
          <div key={l.id} className="rounded-2xl bg-paper text-ink p-4 flex gap-3 items-center shadow-lg shadow-black/30">
            {l.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.photos[0]} alt="" className="h-16 w-24 object-cover rounded-lg shrink-0" />
            ) : (
              <div className="h-16 w-24 rounded-lg bg-mist shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">
                {l.address ? l.address : l.neighborhood}
              </div>
              <div className="text-xs text-muted truncate">
                {l.neighborhood} · {l.beds === 0 ? "Studio" : `${l.beds}bd`}/{l.baths}ba · ${l.actual_rent.toLocaleString()}
                {viewUrl && (
                  <>
                    {" · "}
                    <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
                      view ↗
                    </a>
                  </>
                )}
              </div>
              <div className="text-xs text-muted flex gap-2 flex-wrap mt-0.5">
                <Tag>{l.source}</Tag>
                <Tag tone={l.review_status === "ready" ? "green" : "amber"}>{l.review_status}</Tag>
                <Tag>{l.status}</Tag>
                <Tag tone={l.is_off_market ? "green" : "amber"}>{l.is_off_market ? "off-market" : "on-market"}</Tag>
                <span>{l.photos.length} photo{l.photos.length === 1 ? "" : "s"}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0 text-xs">
              <button onClick={() => startEdit(l)} className="rounded-full border border-line px-3 py-1.5 font-medium">Edit</button>
              {featurable ? (
                <>
                  <button onClick={() => setAsToday(l.id)} className="rounded-full bg-ink text-paper px-3 py-1.5 font-medium">
                    {schedule.has_today ? "Replace today" : "Set as today"}
                  </button>
                  <button onClick={() => patchListing(l.id, { review_status: "draft" })} className="rounded-full border border-line px-3 py-1.5">Unpublish</button>
                </>
              ) : (
                <button onClick={() => approve(l.id)} className="rounded-full bg-ledger-green/90 text-paper px-3 py-1.5 font-medium" style={{ backgroundColor: "var(--color-success)" }}>
                  Approve for game
                </button>
              )}
              <button onClick={() => remove(l.id)} className="rounded-full border border-line px-3 py-1.5 text-red-600">Delete</button>
            </div>
          </div>
          );
        })}
        {filtered.length > 60 && (
          <p className="text-center text-xs text-faint">
            Showing 60 of {filtered.length}. Use search to narrow it down.
          </p>
        )}
      </section>
    </main>
  );
}

const inputClass =
  "w-full rounded-xl border border-line px-3 py-2 text-sm focus:outline-none focus:border-ink bg-paper";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="eyebrow">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: "green" | "amber" }) {
  const cls =
    tone === "green" ? "bg-success-bg text-success"
    : tone === "amber" ? "bg-amber-100 text-amber-700"
    : "bg-mist text-muted";
  return <span className={`rounded-full px-2 py-0.5 ${cls}`}>{children}</span>;
}
