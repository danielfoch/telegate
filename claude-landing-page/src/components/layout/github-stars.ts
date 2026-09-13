import "server-only";

/** Build-time star count; null on any failure so the nav can hide it. */
export async function getStars(): Promise<number | null> {
  try {
    const res = await fetch("https://api.github.com/repos/danielfoch/telegate", {
      next: { revalidate: 3600 },
      headers: { Accept: "application/vnd.github+json", "User-Agent": "telegate-landing" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { stargazers_count?: number };
    return typeof json.stargazers_count === "number" ? json.stargazers_count : null;
  } catch {
    return null;
  }
}

export function formatStars(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}
