import Image from "next/image";
import { FOOTER } from "@/content/copy";
import { DOC_URLS, HOMIES_URL, REPO_URL } from "@/content/links";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Docs",
    links: [
      { label: "Self-host guide", href: DOC_URLS.selfHost },
      { label: "DIY iPhone", href: DOC_URLS.diyIphone },
      { label: "Telegate Connect", href: DOC_URLS.connect },
      { label: "OpenClaw & Hermes", href: DOC_URLS.openclawHermes },
      { label: "Grok Bot", href: DOC_URLS.grokbot },
      { label: "API", href: DOC_URLS.api },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "GitHub", href: REPO_URL },
      { label: "Roadmap", href: DOC_URLS.roadmap },
      { label: "Verification", href: DOC_URLS.verification },
      { label: "Icon notices", href: DOC_URLS.iconNotices },
      { label: "MIT licence", href: DOC_URLS.license },
    ],
  },
  {
    title: "Company",
    links: [{ label: "Homies", href: HOMIES_URL }],
  },
];

export function Footer() {
  return (
    <footer id="footer" className="relative z-[1] bg-footer-ground px-5 py-16 text-paper-fixed sm:px-8 sm:py-24">
      <div className="mx-auto grid max-w-[1240px] gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <Image src="/brand/telegate-icon.png" alt="" width={56} height={56} className="rounded-[15px]" />
            <span className="font-display text-[32px] font-extrabold tracking-[-0.04em]">telegate</span>
          </div>
          <p className="display-sm mt-5 text-[22px] text-mint">More life. Less screen.</p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="caption text-muted-on-dark">{col.title}</h3>
            <ul className="mt-4 space-y-2.5 text-[15px]">
              {col.links.map((l) => (
                <li key={l.label}>
                  <a href={l.href} target="_blank" rel="noopener" className="opacity-85 transition-opacity hover:opacity-100 hover:underline">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-14 max-w-[1240px] border-t border-line-on-dark pt-6 text-[13px] leading-relaxed text-muted-on-dark">
        {FOOTER.line} © {new Date().getFullYear()}.
      </p>
    </footer>
  );
}
