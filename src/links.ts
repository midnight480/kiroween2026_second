/**
 * Reference links on a task. Only http(s) URLs are kept. The service is recognised from the URL
 * so the card can show what kind of thing it is. Icons are drawn here: no official logos, no files.
 */
export type LinkKind =
  | "github-issue" | "github-pr" | "github"
  | "gdocs" | "gslides" | "gsheets" | "gdrive"
  | "word" | "powerpoint" | "excel" | "m365"
  | "web";

export interface LinkInfo {
  kind: LinkKind;
  /** Name of the service, shown next to the icon. */
  service: string;
  /** Short label for the chip: "#123", "repo", or the host. */
  label: string;
}

/** Parse and keep only http(s). Returns the normalised URL, or null. */
export function cleanUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.href;
  } catch {
    return null;
  }
}

const OFFICE_HOST = /(^|\.)(sharepoint\.com|onedrive\.live\.com|1drv\.ms|office\.com|officeapps\.live\.com|live\.com)$/i;

export function describe(url: string): LinkInfo {
  let u: URL;
  try { u = new URL(url); } catch { return { kind: "web", service: "Link", label: url }; }
  const host = u.hostname.replace(/^www\./, "");
  const path = decodeURIComponent(u.pathname);
  const all = decodeURIComponent(u.pathname + u.search).toLowerCase();

  if (host === "github.com") {
    const [owner, repo, kind, num] = path.split("/").filter(Boolean);
    if (owner && repo && (kind === "issues" || kind === "pull") && num && /^\d+$/.test(num)) {
      return { kind: kind === "pull" ? "github-pr" : "github-issue", service: "GitHub", label: `${repo}#${num}` };
    }
    return { kind: "github", service: "GitHub", label: repo ? `${owner}/${repo}` : owner ?? "github.com" };
  }
  if (host === "docs.google.com") {
    if (path.startsWith("/document")) return { kind: "gdocs", service: "Google Docs", label: "Docs" };
    if (path.startsWith("/presentation")) return { kind: "gslides", service: "Google Slides", label: "Slides" };
    if (path.startsWith("/spreadsheets")) return { kind: "gsheets", service: "Google Sheets", label: "Sheets" };
  }
  if (host === "drive.google.com") return { kind: "gdrive", service: "Google Drive", label: "Drive" };
  if (OFFICE_HOST.test(host)) {
    // SharePoint and OneDrive share links carry the type as /:w:/, /:p:/, /:x:/, or the file has an extension.
    if (/\/:w:\/|\.docx?\b|[?&]app=word/.test(all)) return { kind: "word", service: "Word", label: "Word" };
    if (/\/:p:\/|\.pptx?\b|[?&]app=powerpoint/.test(all)) return { kind: "powerpoint", service: "PowerPoint", label: "PowerPoint" };
    if (/\/:x:\/|\.xlsx?\b|[?&]app=excel/.test(all)) return { kind: "excel", service: "Excel", label: "Excel" };
    return { kind: "m365", service: "Microsoft 365", label: "OneDrive" };
  }
  // A plain link to an Office file somewhere else still says what it is.
  if (/\.docx?$/.test(path.toLowerCase())) return { kind: "word", service: "Word", label: host };
  if (/\.pptx?$/.test(path.toLowerCase())) return { kind: "powerpoint", service: "PowerPoint", label: host };
  if (/\.xlsx?$/.test(path.toLowerCase())) return { kind: "excel", service: "Excel", label: host };
  return { kind: "web", service: host, label: host };
}

/* ---------- icons: simple shapes in the service's colour, drawn for this app ---------- */
const page = (fill: string, inner: string) =>
  `<svg viewBox="0 0 16 16" aria-hidden="true" class="ico"><path d="M3 1h7l3 3v11H3z" fill="${fill}"/><path d="M10 1v3h3" fill="#0003"/>${inner}</svg>`;
const lines = `<path d="M5 7h6M5 9.5h6M5 12h4" stroke="#fff" stroke-width="1.1"/>`;
const slide = `<rect x="4.6" y="7" width="6.8" height="4.6" rx=".4" fill="none" stroke="#fff" stroke-width="1.1"/>`;
const grid = `<path d="M4.6 7h6.8v5H4.6zM4.6 9.5h6.8M8 7v5" fill="none" stroke="#fff" stroke-width="1"/>`;

const ICONS: Record<LinkKind, string> = {
  "github-issue": `<svg viewBox="0 0 16 16" aria-hidden="true" class="ico"><circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/></svg>`,
  "github-pr": `<svg viewBox="0 0 16 16" aria-hidden="true" class="ico"><circle cx="4" cy="3.5" r="1.7" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="4" cy="12.5" r="1.7" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="12.5" r="1.7" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4 5.2v5.6M12 10.8V6.5c0-1.4-1-2.3-2.3-2.3H7.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8.8 2.6 7 4.2l1.8 1.6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
  github: `<svg viewBox="0 0 16 16" aria-hidden="true" class="ico"><path d="M3 2.5h7.5a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3 11.5a2 2 0 0 1 2-2h7.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
  gdocs: page("#3b6fd8", lines),
  gslides: page("#e3a21a", slide),
  gsheets: page("#1f8a4c", grid),
  gdrive: `<svg viewBox="0 0 16 16" aria-hidden="true" class="ico"><path d="M5.5 2h5l4.5 8-2.5 4h-9L1 10z" fill="none" stroke="#3b6fd8" stroke-width="1.4"/><path d="M5.5 2 10 10H1M10.5 2 6 10" fill="none" stroke="#1f8a4c" stroke-width="1.2"/></svg>`,
  word: page("#2b5ca8", lines),
  powerpoint: page("#c4502a", slide),
  excel: page("#1d6b40", grid),
  m365: `<svg viewBox="0 0 16 16" aria-hidden="true" class="ico"><path d="M4.5 12.5a3 3 0 0 1-.3-6 4 4 0 0 1 7.6-.7 3.3 3.3 0 0 1 .7 6.7z" fill="none" stroke="#2b5ca8" stroke-width="1.4"/></svg>`,
  web: `<svg viewBox="0 0 16 16" aria-hidden="true" class="ico"><circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M1.7 8h12.6M8 1.7c-2.2 2.4-2.2 10.2 0 12.6M8 1.7c2.2 2.4 2.2 10.2 0 12.6" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>`,
};

export const icon = (kind: LinkKind): string => ICONS[kind];
