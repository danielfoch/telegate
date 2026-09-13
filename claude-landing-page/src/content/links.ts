export const REPO_URL = "https://github.com/danielfoch/telegate";

/**
 * The one-shot install prompt page in the repo. The default resolves once the
 * landing-page branch is merged to main; set NEXT_PUBLIC_INSTALL_DOC_URL on a
 * preview deployment to point at the branch path in the meantime.
 */
export const INSTALL_URL =
  process.env.NEXT_PUBLIC_INSTALL_DOC_URL ??
  `${REPO_URL}/blob/main/docs/ONE-SHOT-INSTALL.md`;

export const RELEASES_URL = `${REPO_URL}/releases`;

export const DOC_URLS = {
  readme: `${REPO_URL}#start-here`,
  selfHost: `${REPO_URL}/blob/main/docs/SELF-HOST.md`,
  diyIphone: `${REPO_URL}/blob/main/docs/DIY-IPHONE.md`,
  connect: `${REPO_URL}/blob/main/docs/CONNECT.md`,
  openclawHermes: `${REPO_URL}/blob/main/docs/integrations/OPENCLAW-HERMES.md`,
  grokbot: `${REPO_URL}/blob/main/docs/integrations/GROKBOT.md`,
  api: `${REPO_URL}/blob/main/docs/API.md`,
  roadmap: `${REPO_URL}/blob/main/docs/ROADMAP.md`,
  verification: `${REPO_URL}/blob/main/docs/VERIFICATION.md`,
  iconNotices: `${REPO_URL}/blob/main/docs/HARNESS-ICON-NOTICES.md`,
  brand: `${REPO_URL}/blob/main/docs/BRAND-AND-METRICS.md`,
  license: `${REPO_URL}/blob/main/LICENSE`,
} as const;

export const HOMIES_URL = "https://www.homiesai.com";
