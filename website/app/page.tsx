'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowUpRight,
  ArrowDown,
  ArrowRight,
  AudioLines,
  Copy,
  Check,
  Pause,
  Play,
  Mic,
  Monitor,
  Smartphone,
  CornerDownRight,
} from 'lucide-react';

const REPO = 'https://github.com/danielfoch/telegate';
const INSTALL = `${REPO}/blob/main/docs/INSTALL-WITH-AN-AGENT.md`;
const PROMPT =
  'Install Telegate on my iPhone from https://github.com/danielfoch/telegate. Follow docs/INSTALL-WITH-AN-AGENT.md, handle the setup you can, and guide me through pairing my computer and connecting my agents. Ask me only for what you can’t discover or do yourself.';
const examples = [
  {
    id: 'claude',
    name: 'Claude Code',
    short: 'Claude',
    prompt: 'Ask Claude to turn this idea into a working prototype.',
    reply: 'Delegating to Claude Code.',
    category: 'BUILD THE THING',
  },
  {
    id: 'codex',
    name: 'Codex',
    short: 'Codex',
    prompt: 'Get Codex to fix the mobile layout while I’m out.',
    reply: 'Sending the brief to Codex.',
    category: 'SHIP THE FIX',
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    short: 'OpenClaw',
    prompt: 'Ask OpenClaw to help plan my week before I get home.',
    reply: 'Delegating to OpenClaw.',
    category: 'GET AHEAD OF MONDAY',
  },
  {
    id: 'hermes',
    name: 'Hermes Agent',
    short: 'Hermes',
    prompt: 'Get Hermes to research the idea we just talked through.',
    reply: 'Sending your research brief to Hermes.',
    category: 'FOLLOW YOUR CURIOSITY',
  },
  {
    id: 'grok',
    name: 'Grok Bot',
    short: 'Grok Bot',
    prompt: 'Have Grok Bot draft that reply for me to review.',
    reply: 'Delegating to Grok Bot.',
    category: 'GET THE DRAFT STARTED',
  },
  {
    id: 'homies',
    name: 'HomiesAI',
    short: 'HomiesAI',
    prompt: 'Ask HomiesAI to prepare my listing presentation.',
    reply: 'Sending to your HomiesAI endpoint.',
    category: 'PREPARE FOR WHAT’S NEXT',
  },
  {
    id: 'openai',
    name: 'ChatGPT voice',
    short: 'ChatGPT',
    prompt: 'Help me turn this rough idea into a really good prompt.',
    reply: 'Let’s shape the brief, then choose your agent.',
    category: 'THINK IT THROUGH',
  },
];
const agents = [
  {
    id: 'codex',
    name: 'Codex',
    type: 'Local CLI',
    text: 'Turn a conversation into a coding task on your connected computer, using your existing Codex setup.',
    link: 'CONNECT.md',
  },
  {
    id: 'claude',
    name: 'Claude Code',
    type: 'Local CLI',
    text: 'Send a clear brief to Claude Code in the project folder you choose. It keeps its own tools and permissions.',
    link: 'CONNECT.md',
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    type: 'Local gateway',
    text: 'Delegate through your existing OpenClaw gateway and selected agent. Install and configure OpenClaw first.',
    link: 'integrations/OPENCLAW-HERMES.md',
  },
  {
    id: 'hermes',
    name: 'Hermes Agent',
    type: 'Local CLI',
    text: 'Hand research and longer tasks to your installed Hermes agent, using its existing models and tools.',
    link: 'integrations/OPENCLAW-HERMES.md',
  },
  {
    id: 'grok',
    name: 'Grok Bot',
    type: 'Cloud adapter',
    text: 'Send work to your Grok Bot webhook routine through the relay adapter. Requires its endpoint and completion callback.',
    link: 'integrations/GROKBOT.md',
  },
  {
    id: 'homies',
    name: 'HomiesAI',
    type: 'Custom endpoint',
    text: 'Originally inspired by HomiesAI. Connect it through a Telegate-compatible task endpoint; that provider endpoint must be built and configured.',
    link: 'API.md',
  },
];
const waveHeights = [
  12, 20, 31, 18, 44, 26, 55, 36, 62, 29, 50, 70, 42, 57, 33, 76, 49, 30, 64,
  40, 55, 26, 46, 66, 35, 52, 25, 40, 18, 30, 15,
];
function Logo({ id, size = 28 }: { id: string; size?: number }) {
  return (
    <span
      className={`agent-logo logo-${id}`}
      style={{ '--logo-size': `${size}px` } as CSSProperties}
    >
        <Image
          unoptimized
          src={`/logos/${id}.${id === 'homies' ? 'png' : 'svg'}`}
          width={size}
          height={size}
          alt=""
        />
    </span>
  );
}
function Wave({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`wave ${className}`}>
      {waveHeights.map((height, i) => (
        <i
          key={i}
          style={
            {
              '--height': `${height}px`,
              '--delay': `${-i * 0.11}s`,
              '--speed': `${0.6 + (i % 5) * 0.12}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
export default function Home() {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [answer, setAnswer] = useState(true);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>(
    'idle',
  );
  const [step, setStep] = useState(0);
  const promptField = useRef<HTMLTextAreaElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const storyRef = useRef<HTMLElement>(null);
  const example = examples[exampleIndex];
  const selectedAgent = agents.find((a) => a.id === example.id) ?? agents[1];
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    const observer = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry.isIntersecting),
      { threshold: 0 },
    );
    if (heroRef.current) observer.observe(heroRef.current);
    return () => {
      media.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    if (paused || reduced || !heroVisible) return;
    let start = Date.now();
    const tick = setInterval(() => {
      if (document.hidden) {
        start = Date.now();
        return;
      }
      const elapsed = Date.now() - start;
      if (elapsed >= 7200) {
        setExampleIndex((i) => (i + 1) % examples.length);
        setAnswer(false);
        start = Date.now();
      } else if (elapsed >= 1600) setAnswer(true);
    }, 200);
    return () => clearInterval(tick);
  }, [paused, reduced, heroVisible]);
  useEffect(() => {
    let frame = 0;
    let previousStep = -1;
    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const total = doc.scrollHeight - window.innerHeight;
      doc.style.setProperty(
        '--page-progress',
        `${total > 0 ? (window.scrollY / total) * 100 : 0}%`,
      );
      doc.classList.toggle('has-scrolled', window.scrollY > 70);
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        const p = Math.max(
          0,
          Math.min(
            1,
            -rect.top / Math.max(1, rect.height - window.innerHeight),
          ),
        );
        doc.style.setProperty('--hero-progress', String(reduced ? 0 : p));
      }
      if (storyRef.current) {
        const rect = storyRef.current.getBoundingClientRect();
        const p = Math.max(
          0,
          Math.min(
            1,
            -rect.top / Math.max(1, rect.height - window.innerHeight),
          ),
        );
        doc.style.setProperty('--story-progress', String(reduced ? 0 : p));
        const next = Math.min(2, Math.floor(p * 3));
        if (next !== previousStep) {
          setStep(next);
          previousStep = next;
        }
      }
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    update();
    const reveals = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            reveals.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 },
    );
    document
      .querySelectorAll('[data-reveal]')
      .forEach((el) => reveals.observe(el));
    document.documentElement.classList.add('motion-ready');
    return () => {
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
      cancelAnimationFrame(frame);
      reveals.disconnect();
      document.documentElement.classList.remove('motion-ready');
    };
  }, [reduced]);
  useEffect(() => {
    if (copyState !== 'copied') return;
    const timer = setTimeout(() => setCopyState('idle'), 3000);
    return () => clearTimeout(timer);
  }, [copyState]);
  function choose(id: string) {
    const index = examples.findIndex((e) => e.id === id);
    if (index >= 0) setExampleIndex(index);
    setAnswer(true);
    setPaused(true);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(PROMPT);
      setCopyState('copied');
    } catch {
      promptField.current?.focus();
      promptField.current?.select();
      setCopyState('manual');
    }
  }
  return (
    <main className={paused || reduced ? 'motion-paused' : ''}>
      <a className="skip-link" href="#install">
        Skip to installation
      </a>
      <header className="navigation">
        <a href="#top" className="brand" aria-label="Telegate home">
          <AudioLines aria-hidden="true" />
          telegate<span>↗</span>
        </a>
        <nav aria-label="Main navigation">
          <a className="how-link" href="#how-it-works">
            How it works
          </a>
          <a className="github-link" href={REPO}>
            <Image
              unoptimized
              src="/logos/github.svg"
              width="18"
              height="18"
              alt=""
            />
            GitHub
          </a>
          <a href={INSTALL} className="nav-install">
            Get Telegate <ArrowUpRight size={17} />
          </a>
        </nav>
      </header>
      <section
        id="top"
        className="hero-track"
        ref={heroRef}
        aria-labelledby="hero-heading"
      >
        <div className="hero">
          <div className="hero-photo">
            <Image
              unoptimized
              src="/images/coastal-voice.jpg"
              alt="A person enjoying a coastal walk while talking into their phone"
              width="1536"
              height="1024"
              fetchPriority="high"
            />
          </div>
          <div className="hero-shade" />
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="live-dot" /> OPEN SOURCE. OUT OF OFFICE.
            </div>
            <h1 id="hero-heading">
              Less screen.
              <br />
              More <em>life.</em>
            </h1>
            <p className="hero-description">
              Talk it through. Send it off.
              <br />
              Let your agents work while you live.
            </p>
            <div className="hero-actions">
              <a className="primary" href={INSTALL}>
                Open source — install now <ArrowUpRight size={23} />
              </a>
              <span className="hero-meta">
                iPhone + your agents. On your terms.
              </span>
            </div>
          </div>
          <div
            className="conversation-demo"
            aria-label="Example voice conversation"
          >
            <div className="demo-heading">
              <span>
                <i className="live-dot" /> VOICE DEMO
              </span>
              <button
                onClick={() => setPaused((p) => !p)}
                disabled={reduced}
                aria-label={
                  paused
                    ? 'Play example conversations'
                    : 'Pause example conversations'
                }
              >
                {paused || reduced ? <Play size={15} /> : <Pause size={15} />}
              </button>
            </div>
            <div key={`${example.id}-user`} className="bubble user-bubble">
              <span className="bubble-label">
                <Mic size={12} /> YOU
              </span>
              <p>“{example.prompt}”</p>
            </div>
            <div
              className={`reply-wrap ${answer || reduced ? 'is-answering' : ''}`}
            >
              <Wave className="return-wave" />
              <div key={`${example.id}-answer`} className="bubble agent-bubble">
                <AudioLines size={21} />
                <p>{example.reply}</p>
              </div>
            </div>
            <div className="example-controls">
              <span>Try an idea</span>
              <fieldset aria-label="Example agents">
                {examples.map((e) => (
                  <button
                    key={e.id}
                    title={e.name}
                    aria-label={`Show ${e.name} example`}
                    aria-pressed={example.id === e.id}
                    onClick={() => choose(e.id)}
                  >
                    <Logo id={e.id} size={19} />
                  </button>
                ))}
              </fieldset>
            </div>
            <p className="demo-caption">
              Illustrated conversations. Connect your agents first.
            </p>
          </div>
          <a href="#install" className="scroll-cue">
            <span>TAKE YOUR IDEAS FOR A WALK</span>
            <ArrowDown size={19} />
          </a>
          <span className="hero-coordinate" aria-hidden="true">
            THINK ANYWHERE / SHIP FROM HERE
          </span>
        </div>
      </section>
      <section
        id="install"
        className="install-section"
        aria-labelledby="install-heading"
      >
        <div className="section-kicker" data-reveal>
          <span>01 / MAKE IT YOURS</span>
          <span className="open-source-pill">
            <span className="live-dot" /> FREE & OPEN SOURCE
          </span>
        </div>
        <div className="install-grid">
          <div className="install-copy" data-reveal>
            <h2 id="install-heading">
              One prompt.
              <br />A little more
              <br />
              <em>freedom.</em>
            </h2>
            <p>
              You already have an agent.
              <br />
              Let it handle the setup.
            </p>
            <a className="text-link" href={INSTALL}>
              Open source — install now <ArrowUpRight size={21} />
            </a>
            <span className="link-note">
              Opens the install prompt on GitHub.
            </span>
          </div>
          <div className="prompt-column" data-reveal>
            <p className="prompt-intro">
              Or just copy + paste this prompt into your harness.
            </p>
            <div className="prompt-box">
              <div className="prompt-toolbar">
                <div>
                  <span className="terminal-dot" />
                  <span className="terminal-dot" />
                  <span className="terminal-dot" />
                </div>
                <span>CODEX / CLAUDE CODE</span>
                <CornerDownRight size={17} />
              </div>
              <label className="sr-only" htmlFor="install-prompt">
                Telegate installation prompt
              </label>
              <textarea
                id="install-prompt"
                ref={promptField}
                readOnly
                value={PROMPT}
                spellCheck={false}
              />
              <div className="prompt-bottom">
                <span>
                  No blanks to fill in.
                  <br />
                  No setup prompt to write.
                </span>
                <button className="copy-button" onClick={copy}>
                  {copyState === 'copied' ? (
                    <Check size={18} />
                  ) : (
                    <Copy size={18} />
                  )}{' '}
                  {copyState === 'copied' ? 'Copied!' : 'Copy prompt'}
                </button>
              </div>
            </div>
            <output className="copy-status">
              {copyState === 'manual'
                ? 'Prompt selected. Press ⌘C or use your device’s Copy menu.'
                : copyState === 'copied'
                  ? 'Ready to paste into Codex or Claude Code on your Mac.'
                  : 'Paste it into your coding agent on the Mac you want to connect.'}
            </output>
            <p className="setup-note">
              Community DIY preview. You’ll need a Mac, Xcode and an iPhone.
              Your agent guides Apple’s signing and device approvals. Bring your
              own OpenAI key; API usage and hosting costs are yours.
            </p>
          </div>
        </div>
      </section>
      <section
        id="how-it-works"
        className="story-track"
        ref={storyRef}
        aria-labelledby="phone-heading"
      >
        <div className="story-sticky">
          <div className="story-copy">
            <span className="section-label">02 / SAY IT OUT LOUD</span>
            <h2 id="phone-heading">
              Talk with
              <br />
              your <em>phone.</em>
            </h2>
            <p className="story-intro">
              A real conversation.
              <br />A better brief. A clear next move.
            </p>
            <div className="story-steps">
              {[
                [
                  'Find the idea.',
                  'Press your Action Button shortcut or open Telegate. Start talking while the thought is still fresh.',
                ],
                [
                  'Make it make sense.',
                  'Talk it through with Telegate voice. Add context, ask questions, and shape what you actually want done.',
                ],
                [
                  'Give it somewhere to go.',
                  'Choose the computer and agent. Send the brief, end the call, and check back in Tasks when you’re ready.',
                ],
              ].map(([title, body], i) => (
                <div
                  key={title}
                  className={`story-step ${step === i ? 'active' : ''}`}
                >
                  <span className="step-number">0{i + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="voice-provider">
              <Logo id="openai" size={21} />
              <span>
                Powered by OpenAI voice.
                <br />
                <strong>Connected to the agents you choose.</strong>
              </span>
            </div>
          </div>
          <figure className="phone-figure">
            <div className="phone-orbit" aria-hidden="true" />
            <Image
              unoptimized
              src="/images/telegate-phone.jpg"
              alt="Illustrative Telegate iPhone app showing a voice waveform and a brief ready to send to Claude"
              width="1024"
              height="1536"
              loading="lazy"
            />
            <div className="phone-live-pill">
              <AudioLines size={18} />
              <span>
                {
                  [
                    'Thinking out loud',
                    'Shaping your brief',
                    'Ready to delegate',
                  ][step]
                }
              </span>
              <span className="live-dot" />
            </div>
            <figcaption>
              Illustrative app preview · interface evolving
            </figcaption>
          </figure>
        </div>
      </section>
      <section className="agents-section" aria-labelledby="agents-heading">
        <div className="section-kicker" data-reveal>
          <span>03 / PUT THE IDEA TO WORK</span>
          <span>YOUR MODELS. YOUR TOOLS.</span>
        </div>
        <h2 id="agents-heading" data-reveal>
          While your agents
          <br />
          <em>work at home.</em>
        </h2>
        <p className="agents-intro" data-reveal>
          Or in the cloud. Same conversation. You choose where it goes.
        </p>
        <div className="routing-map" data-reveal>
          <div className="route-origin">
            <span className="route-voice">
              <Logo id="openai" size={20} /> Your conversation
            </span>
            <ArrowRight size={19} />
            <span className="route-telegate">
              <AudioLines size={24} /> telegate
            </span>
            <span className="brief-badge">
              Your brief <Check size={13} />
            </span>
          </div>
          <svg
            className="routing-lines"
            viewBox="0 0 1200 140"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {agents.map((a, i) => (
              <path
                key={a.id}
                className={selectedAgent.id === a.id ? 'route-active' : ''}
                d={`M600 0 V45 Q600 60 ${600 + (i < 3 ? -15 : 15)} 60 H${100 + i * 200 + (i < 3 ? 15 : -15)} Q${100 + i * 200} 60 ${100 + i * 200} 75 V140`}
              />
            ))}
          </svg>
          <div className="agent-destinations">
            {agents.map((agent) => (
              <button
                className={`destination ${selectedAgent.id === agent.id ? 'selected' : ''}`}
                key={agent.id}
                onClick={() => choose(agent.id)}
                aria-pressed={selectedAgent.id === agent.id}
              >
                <Logo id={agent.id} size={42} />
                <strong>{agent.name}</strong>
                <span>{agent.type}</span>
                <span className="destination-arrow">
                  <ArrowUpRight size={16} />
                </span>
              </button>
            ))}
          </div>
          <div className="route-locations">
            <span>
              <Monitor size={15} /> ON YOUR CONNECTED COMPUTER
            </span>
            <span>
              <AudioLines size={15} /> THROUGH A CLOUD ENDPOINT
            </span>
          </div>
          <div className="route-detail" aria-live="polite">
            <div>
              <Logo id={selectedAgent.id} size={25} />
              <p>
                <strong>{selectedAgent.name}.</strong> {selectedAgent.text}
              </p>
            </div>
            <a href={`${REPO}/blob/main/docs/${selectedAgent.link}`}>
              Connection guide <ArrowUpRight size={16} />
            </a>
          </div>
        </div>
        <div className="how-it-travels">
          <span>
            <Smartphone size={18} /> Talk on your phone
          </span>
          <ArrowRight />
          <span>
            <AudioLines size={18} /> Send a clear brief
          </span>
          <ArrowRight />
          <span>
            <Monitor size={18} /> Let the agent work
          </span>
        </div>
        <p className="agents-footnote">
          Keep your computer awake and Connect running. Local adapters use your
          existing agent accounts and permissions. Cloud integrations require
          their own setup.
        </p>
      </section>
      <footer className="site-footer">
        <div className="footer-top">
          <p>
            Built to get us away from our computers.
            <br />
            Open-sourced so you can, too.
          </p>
          <a href={INSTALL} className="primary">
            Get your day back <ArrowUpRight size={22} />
          </a>
        </div>
        <div className="footer-wordmark" aria-hidden="true">
          go live<span>↗</span>
        </div>
        <div className="footer-bottom">
          <a href="#top" className="brand">
            <AudioLines />
            telegate
          </a>
          <span>More life. Less screen.</span>
          <div>
            <a href={REPO}>
              GitHub <ArrowUpRight size={14} />
            </a>
            <a href={`${REPO}/blob/main/LICENSE`}>MIT license</a>
            <a href="/asset-notices.txt" download="telegate-credits.txt">
              Credits
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
