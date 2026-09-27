import { useEffect, useMemo, useState } from "react";
import Cell from "./Cell";

interface Team {
  token: string;
  name: string;
  teamName: string | null;
  ip: string;
  category: string | null;
  affiliation: string | null;
}

const ALL = "all";

function readStoredBool(key: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "true";
  } catch {
    return fallback;
  }
}

function readStoredString(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode etc), setting just won't persist
  }
}

export default function App() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [wsPort, setWsPort] = useState(6080);
  const [vncPassword, setVncPassword] = useState("");
  const [filter, setFilter] = useState(() => readStoredString("filter", ""));
  const [category, setCategory] = useState(() => readStoredString("category", ALL));
  const [affiliation, setAffiliation] = useState(() => readStoredString("affiliation", ALL));
  const [columns, setColumns] = useState<number | "auto">("auto");
  const [fullToken, setFullToken] = useState<string | null>(null);
  const [lazyFullscreen, setLazyFullscreen] = useState(() => readStoredBool("lazyFullscreen", true));

  useEffect(() => writeStored("lazyFullscreen", String(lazyFullscreen)), [lazyFullscreen]);
  useEffect(() => writeStored("filter", filter), [filter]);
  useEffect(() => writeStored("category", category), [category]);
  useEffect(() => writeStored("affiliation", affiliation), [affiliation]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/teams");
        const data = await res.json();
        if (!cancelled) {
          setTeams(data.teams);
          setWsPort(data.wsPort);
          setVncPassword(data.vncPassword ?? "");
        }
      } catch {
        // network hiccup, retry next tick
      }
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullToken(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(teams.map((t) => t.category).filter((c): c is string => !!c))).sort(),
    [teams],
  );
  const affiliations = useMemo(
    () => Array.from(new Set(teams.map((t) => t.affiliation).filter((a): a is string => !!a))).sort(),
    [teams],
  );

  // lazy-render: teams that don't pass the filter are excluded from the
  // mapped list below, so React unmounts their Cell and the RFB connection
  // tears down with it — no background VNC traffic for hidden teams.
  const visible = useMemo(
    () =>
      teams.filter(
        (t) =>
          t.name.toLowerCase().includes(filter.toLowerCase()) &&
          (category === ALL || t.category === category) &&
          (affiliation === ALL || t.affiliation === affiliation),
      ),
    [teams, filter, category, affiliation],
  );

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center gap-3 bg-neutral-800 px-3 py-2 text-sm text-neutral-300">
        <input
          placeholder="Search team..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100 outline-none focus:border-neutral-500"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100"
        >
          <option value={ALL}>All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={affiliation}
          onChange={(e) => setAffiliation(e.target.value)}
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100"
        >
          <option value={ALL}>All affiliations</option>
          {affiliations.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setFilter("");
            setCategory(ALL);
            setAffiliation(ALL);
          }}
          className="rounded border border-neutral-700 px-2 py-1 text-neutral-300 hover:bg-neutral-700"
        >
          Clear filter
        </button>
        <label className="flex items-center gap-2">
          Columns
          <select
            value={columns}
            onChange={(e) => setColumns(e.target.value === "auto" ? "auto" : Number(e.target.value))}
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100"
          >
            <option value="auto">auto</option>
            {[2, 3, 4, 5, 6, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={lazyFullscreen}
            onChange={(e) => setLazyFullscreen(e.target.checked)}
          />
          Lazy load on fullscreen
        </label>
        <span className="ml-auto text-neutral-500">
          {visible.length}/{teams.length} teams
        </span>
      </div>
      <div
        className="grid flex-1 gap-1 overflow-auto p-1"
        style={{
          gridTemplateColumns:
            columns === "auto" ? "repeat(auto-fit, minmax(280px, 1fr))" : `repeat(${columns}, 1fr)`,
        }}
      >
        {visible
          .filter((t) => !lazyFullscreen || fullToken === null || t.token === fullToken)
          .map((t) => (
          <Cell
            key={t.token}
            name={t.name}
            teamName={t.teamName}
            token={t.token}
            wsPort={wsPort}
            vncPassword={vncPassword}
            isFull={t.token === fullToken}
            hasFull={fullToken !== null}
            onToggleFull={() => setFullToken((f) => (f === t.token ? null : t.token))}
          />
        ))}
      </div>
    </div>
  );
}
