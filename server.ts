import { spawn, type Subprocess } from "bun";

const DOMJUDGE_URL = process.env.DOMJUDGE_URL ?? "http://10.10.220.112";
const API_USER = process.env.API_USER ?? "";
const API_PASS = process.env.API_PASS ?? "";
const VNC_PORT = Number(process.env.VNC_PORT ?? 5900);
const VNC_PASSWORD = process.env.VNC_PASSWORD ?? "";
const WS_PORT = Number(process.env.WS_PORT ?? 6080);
const HTTP_PORT = Number(process.env.HTTP_PORT ?? 8080);
const POLL_MS = Number(process.env.POLL_MS ?? 5000);

const TARGETS_FILE = new URL("./websockify-targets.conf", import.meta.url).pathname;
const DIST_DIR = new URL("./dist", import.meta.url).pathname;

interface Team {
  token: string;
  name: string;
  teamName: string | null;
  ip: string;
  category: string | null;
  affiliation: string | null;
}

let teams: Team[] = [];

function authHeaders() {
  return { Authorization: "Basic " + Buffer.from(`${API_USER}:${API_PASS}`).toString("base64") };
}

async function pollTeams() {
  try {
    const [usersRes, teamsRes] = await Promise.all([
      fetch(`${DOMJUDGE_URL}/api/v4/users`, { headers: authHeaders() }),
      fetch(`${DOMJUDGE_URL}/api/v4/teams`, { headers: authHeaders() }),
    ]);
    if (!usersRes.ok) throw new Error(`DOMjudge API /users ${usersRes.status}`);
    if (!teamsRes.ok) throw new Error(`DOMjudge API /teams ${teamsRes.status}`);
    const users: any[] = await usersRes.json();
    const domTeams: any[] = await teamsRes.json();
    const teamById = new Map(domTeams.map((t) => [t.id, t]));

    teams = users
      .filter((u) => u.team_id != null && u.last_ip != null)
      .map((u) => {
        const domTeam = teamById.get(u.team_id);
        return {
          token: String(u.id),
          name: u.name || u.username,
          teamName: domTeam?.name ?? null,
          ip: u.last_ip as string,
          category: domTeam?.group_ids?.[0] ?? null,
          affiliation: domTeam?.affiliation ?? null,
        };
      });
    await writeTargetsFile();
  } catch (err) {
    console.error("[poll] failed:", (err as Error).message);
  }
}

async function writeTargetsFile() {
  const lines = teams.map((t) => `${t.token}: ${t.ip}:${VNC_PORT}`).join("\n") + "\n";
  await Bun.write(TARGETS_FILE, lines);
}

await Bun.write(TARGETS_FILE, "");

let websockify: Subprocess | null = null;
function startWebsockify() {
  websockify = spawn(["websockify", "--target-config", TARGETS_FILE, String(WS_PORT)], {
    stdout: "inherit",
    stderr: "inherit",
  });
  websockify.exited.then((code) => {
    console.error(`[websockify] exited (${code}), restarting in 2s`);
    setTimeout(startWebsockify, 2000);
  });
}
startWebsockify();

function shutdown() {
  websockify?.kill();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

pollTeams();
setInterval(pollTeams, POLL_MS);

Bun.serve({
  port: HTTP_PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/api/teams") {
      return Response.json({ teams, wsPort: WS_PORT, vncPassword: VNC_PASSWORD });
    }
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(DIST_DIR + path);
    if (await file.exists()) return new Response(file);
    return new Response(Bun.file(DIST_DIR + "/index.html"));
  },
});

console.log(`[server] http://localhost:${HTTP_PORT}  websockify on ${WS_PORT}`);
