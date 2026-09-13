import { Globe, Terminal } from "lucide-react";
import type { SVGProps } from "react";
import type { HarnessKind } from "@/lib/harnesses";
import { ClaudeLogo, CodexLogo, GrokLogo, HermesLogo, HomiesLogo, OpenClawLogo } from "@/components/logos";

type Props = SVGProps<SVGSVGElement> & { kind: HarnessKind; className?: string; animated?: boolean };

/** Logo by harness kind. Mono marks inherit currentColor; OpenClaw and Homies keep their colours. */
export function HarnessLogo({ kind, className = "size-4", animated = false, ...rest }: Props) {
  switch (kind) {
    case "claude":
      return <ClaudeLogo className={className} title="" {...rest} />;
    case "codex":
      return <CodexLogo className={className} title="" {...rest} />;
    case "openclaw":
      return <OpenClawLogo className={className} title="" animated={animated} {...rest} />;
    case "hermes":
      return <HermesLogo className={className} title="" {...rest} />;
    case "grokbot":
      return <GrokLogo className={className} title="" {...rest} />;
    case "homies":
      return <HomiesLogo className={className} title="" {...rest} />;
    case "command":
      return <Terminal className={className} aria-hidden {...rest} />;
    case "webhook":
      return <Globe className={className} aria-hidden {...rest} />;
  }
}
