/* CowTicket Management API plumbing shared by the content scripts
 * (migrate-pages, pull-events). Server-side only — never import from the app.
 *
 * Needs TICKET_API_URL, TICKET_ACCOUNT_ID and TICKET_ADMIN_API_KEY, loaded by
 * the caller's --env-file. */

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Run with: node --env-file=<env file> <script>`);
    process.exit(1);
  }
  return value;
}

export const API = requireEnv("TICKET_API_URL");
export const ACCOUNT_ID = requireEnv("TICKET_ACCOUNT_ID");
const ADMIN_KEY = requireEnv("TICKET_ADMIN_API_KEY");

let token = null;
async function getToken() {
  if (token) return token;
  const res = await fetch(`${API}/accounts/token`, {
    method: "POST",
    headers: { "api-key": ADMIN_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ accountId: ACCOUNT_ID, type: "admin" }),
  });
  if (!res.ok) throw new Error(`token exchange failed (${res.status}): ${await res.text()}`);
  token = (await res.json()).token;
  return token;
}

/** One authenticated call. `body` gets the accountId added. */
export async function api(path, { method = "GET", body } = {}) {
  const send = async () =>
    fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${await getToken()}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify({ accountId: ACCOUNT_ID, ...body }) : undefined,
    });
  let res = await send();
  // A read that hits a cold start can 5xx once; reads are safe to repeat.
  // Writes are never retried: a 500 there is a refusal with a reason.
  if (method === "GET" && res.status >= 500) res = await send();
  // Refusals carry the real reason as plain text in the body.
  if (!res.ok) throw new Error(`${method} ${path.split("?")[0]} → ${res.status}: ${(await res.text()).trim()}`);
  return res.json();
}

/** Query string with the accountId every read needs. */
export const q = (params) => new URLSearchParams({ accountId: ACCOUNT_ID, ...params }).toString();

/** Display width: Thai combining marks take no column. */
const width = (str) => [...str.replace(/[ัิ-ฺ็-๎]/g, "")].length;
const pad = (str, n) => str + " ".repeat(Math.max(0, n - width(str)));

export function printTable(list, cols) {
  const w = cols.map((c) => Math.max(width(c), ...list.map((r) => width(r[c]))));
  const line = (cells) => "│ " + cells.map((c, i) => pad(c, w[i])).join(" │ ") + " │";
  const rule = (l, m, r) => l + w.map((n) => "─".repeat(n + 2)).join(m) + r;
  console.log(rule("┌", "┬", "┐"));
  console.log(line(cols));
  console.log(rule("├", "┼", "┤"));
  for (const r of list) console.log(line(cols.map((c) => r[c])));
  console.log(rule("└", "┴", "┘"));
}

/** A value shortened for a table cell. */
export function short(v, max = 28) {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v).replace(/\s+/g, " ");
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
