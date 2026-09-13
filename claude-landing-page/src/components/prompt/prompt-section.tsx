import { CornerRightDown } from "lucide-react";
import { TerminalCard } from "@/components/prompt/terminal-card";
import { Reveal } from "@/components/motion/reveal";
import { PROMPT } from "@/content/copy";
import { ONE_SHOT_PROMPT } from "@/content/one-shot-prompt";

export function PromptSection() {
  return (
    <section id="prompt" className="relative z-[1] bg-terminal px-5 pb-28 pt-4 text-paper-fixed sm:px-8 lg:pb-40">
      <div className="mx-auto max-w-[920px]">
        <Reveal amount={0.5}>
          <h2 className="display-sm flex flex-wrap items-center gap-3 text-[clamp(1.5rem,3vw,2.25rem)] font-bold">
            {PROMPT.h2}
            <CornerRightDown className="size-6 text-mint" aria-hidden />
          </h2>
          <p className="mt-4 max-w-[64ch] text-[16px] leading-[1.55] text-muted-on-dark">{PROMPT.sub}</p>
        </Reveal>
        <div className="mt-8">
          <TerminalCard text={ONE_SHOT_PROMPT} />
        </div>
        <p className="mt-4 text-center font-mono text-[12px] text-muted-on-dark">{PROMPT.under}</p>
      </div>
    </section>
  );
}
