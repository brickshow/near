import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const WINDOWS = "https://github.com/brickshow/near/tree/main/installers";
const LINUX_MAC = "https://github.com/brickshow/near/blob/linux/README.md";
const REPO = "https://github.com/brickshow/near/tree/linux";
const scenes = [
  {
    name: "Home",
    title: "A quiet place to begin.",
    body: "Start with a daily ASV passage. Read it, talk or type with NEAR, or open a reflection when you have a little more time.",
    src: "/screens/home.png",
    alt: "Real NEAR Home screen showing the daily Scripture, Talk to NEAR, Chat, Journey, and Home, Bible, Journey, Notes, Music, and Church navigation.",
  },
  {
    name: "Journey",
    title: "Build a rhythm that fits your life.",
    body: "Set personal faith goals, check in, and write Scripture reflections. Your goals and reflections are saved on this device.",
    src: "/screens/faith-journey.png",
    alt: "Real NEAR Faith Journey screen showing Journey, Reflect, and Saved sections and a Scripture reflection.",
  },
  {
    name: "Bible",
    title: "Read the passage, not just the reference.",
    body: "Browse the American Standard Version by book and chapter, keep your place, adjust the text, and listen with a NEAR voice.",
    src: "/screens/bible.png",
    alt: "Real NEAR Bible reader showing John chapter 1 in the American Standard Version with reading and text controls.",
  },
];

const features = [
  ["Keep your notes close", "Write and save personal notes on this device. Link a note to a Bible passage and return to it later."],
  ["Plan church events", "Add services, gatherings, and conversations to the Church Calendar. NEAR can remind you while the app is running."],
  ["Talk or type", "Use voice or text to talk with NEAR. Microphone transcription runs locally; messages sent to a connected cloud agent go to that provider."],
  ["Keep the app in reach", "NEAR lives in a compact desktop notch, with Home, Bible, Journey, Notes, Music, and Church a click away."],
];

function App() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>("[data-scene]")];
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.scene));
      });
    }, { rootMargin: "-34% 0px -42% 0px", threshold: 0 });
    nodes.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return <>
    <header className="topbar wrap">
      <a className="brand" href="#top" aria-label="NEAR home"><img src="/near-appicon.png" alt=""/><span>NEAR</span></a>
      <nav aria-label="Main navigation"><a href="#experience">Experience</a><a href="#features">What it does</a><a className="nav-cta" href="#get-near">Get NEAR</a></nav>
    </header>
    <main id="top">
      <section className="hero wrap">
        <div className="hero-copy"><h1>Make room for what matters.</h1><p className="lede">Scripture, reflection, and thoughtful conversation, close at hand while you work.</p><a className="button" href="#experience">Explore NEAR <span aria-hidden="true">↓</span></a></div>
        <div className="hero-device" aria-label="Real NEAR desktop app screen">
          <div className="laptop-screen"><div className="screen-inner"><img className="hero-screen" src="/screens/home.png" alt="The real NEAR Home screen, with the daily verse and links to chat, Journey, Bible, Notes, Music, and Church."/></div></div>
          <div className="laptop-base"/><span className="screen-caption">The real NEAR Home screen</span>
        </div>
      </section>

      <section id="experience" className="story wrap">
        <div className="story-intro"><h2>A small space for a deeper rhythm.</h2><p>Three real screens from the app. Move through them to see how a quiet moment can become a daily practice.</p>
          <div className="scene-index" aria-label={`Showing ${scenes[active].name}`}>{scenes.map((scene, index) => <a key={scene.name} className={active === index ? "selected" : ""} href={`#scene-${index}`} aria-current={active === index ? "step" : undefined}><span>{scene.name}</span></a>)}</div>
        </div>
        <div className="story-stage"><div className="story-preview"><div className="laptop-screen"><div className="screen-inner"><img key={scenes[active].src} className="real-product-screen" src={scenes[active].src} alt={scenes[active].alt}/></div></div></div>
          <div className="story-scenes">{scenes.map((scene, index) => <article className="scene" id={`scene-${index}`} data-scene={index} key={scene.name}><span className="scene-number">0{index + 1}</span><div><h3>{scene.title}</h3><p>{scene.body}</p></div></article>)}</div>
        </div>
      </section>

      <section id="features" className="features wrap"><div className="features-head"><h2>Useful, personal, and easy to return to.</h2></div><div className="feature-grid">{features.map(([title, body], index) => <article className="feature" key={title}><span className="feature-number">0{index + 1}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
        <p className="feature-note">NEAR works without connecting an AI service. If you choose a cloud agent, your messages are sent to that provider. Optional ASV Bible and speech resources are downloaded to your device.</p>
      </section>

      <section id="get-near" className="setup wrap"><div className="setup-head"><h2>NEAR — $10. A journey worth continuing.</h2><p>Commercial licenses are coming soon, with payment and licensing through Polar.sh. Purchases are not available yet.</p><p>The AI for Church Hackathon 2026 release is a temporary, full-featured 72-hour public preview. It starts automatically on first successful launch, keeps counting while the app is closed, and requires internet access for verification. No registration, payment, or license key is required. AI providers still require their own authentication. When access ends, your personal data stays on your device and can be exported or deleted.</p></div>
        <div className="platform-list">
          <article className="platform"><div><h3>Windows</h3><p>Download the available installer and follow the setup steps.</p></div><a className="platform-link" href={WINDOWS} target="_blank" rel="noreferrer">View installers <span aria-hidden="true">↗</span></a></article>
          <article className="platform"><div><h3>Linux</h3><p>Build a Debian package on your Linux distribution with the setup guide.</p></div><a className="platform-link" href={`${LINUX_MAC}#linux-development-and-builds`} target="_blank" rel="noreferrer">Linux guide <span aria-hidden="true">↗</span></a></article>
          <article className="platform"><div><h3>macOS</h3><p>Build the app or disk image on a Mac with the setup guide.</p></div><a className="platform-link" href={`${LINUX_MAC}#macos-development-and-builds`} target="_blank" rel="noreferrer">macOS guide <span aria-hidden="true">↗</span></a></article>
        </div>
        <a className="button setup-button" href={REPO} target="_blank" rel="noreferrer">Explore NEAR on GitHub <span aria-hidden="true">↗</span></a>
      </section>
    </main>
    <footer className="footer"><div className="wrap footer-inner"><div><a className="brand" href="#top"><img src="/near-appicon.png" alt=""/><span>NEAR</span></a><p>A quiet companion, close by.</p></div><nav aria-label="Footer navigation"><a href="#experience">Experience</a><a href="#features">Features</a><a href={REPO} target="_blank" rel="noreferrer">GitHub</a><a href={WINDOWS} target="_blank" rel="noreferrer">Windows installers</a></nav><small>© NEAR</small></div></footer>
  </>;
}

createRoot(document.getElementById("root")!).render(<App/>);