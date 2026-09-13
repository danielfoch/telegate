import { Nav } from "@/components/layout/nav";
import { GroundWatcher } from "@/components/layout/ground-watcher";
import { Footer } from "@/components/layout/footer";
import { formatStars, getStars } from "@/components/layout/github-stars";
import { Hero } from "@/components/hero/hero";
import { InstallBand } from "@/components/install/install-band";
import { PromptSection } from "@/components/prompt/prompt-section";
import { TalkSection } from "@/components/talk/talk-section";
import { TreeSection } from "@/components/tree/tree-section";
import { PricingSection } from "@/components/pricing/pricing-section";

export default async function Page() {
  const stars = await getStars();
  const show = stars !== null && stars >= 10;
  return (
    <>
      <GroundWatcher />
      <Nav stars={show ? stars : null} starsLabel={show && stars !== null ? formatStars(stars) : null} />
      <main id="main">
        <Hero />
        <InstallBand />
        <PromptSection />
        <TalkSection />
        <TreeSection />
        <PricingSection />
      </main>
      <Footer />
    </>
  );
}
