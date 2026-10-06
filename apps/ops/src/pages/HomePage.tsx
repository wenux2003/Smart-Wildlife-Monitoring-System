import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Activity,
  Binoculars,
  ChartNoAxesCombined,
  ChevronDown,
  Footprints,
  Leaf,
  MapPin,
  Menu,
  Radio,
  ShieldCheck,
  Trees,
  X,
} from "lucide-react";
import { Brand } from "../components/Brand.js";
import { Reveal } from "../components/Reveal.js";
import { useAuth } from "../auth/AuthContext.js";

const capabilities = [
  {
    icon: Binoculars,
    title: "Every observation matters.",
    name: "Incident reporting",
    copy: "Bring ranger observations, community reports and camera-trap reviews into one shared picture.",
  },
  {
    icon: Footprints,
    title: "Leave fewer blind spots.",
    name: "Ranger patrols",
    copy: "Plan routes, capture field observations and understand where patrol effort is needed most.",
  },
  {
    icon: Radio,
    title: "Know when to respond.",
    name: "Wildlife monitoring",
    copy: "Connect collar movements with alerts and coordinate the people closest to the situation.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "See the bigger picture.",
    name: "Conservation insights",
    copy: "Explore incident patterns, patrol coverage and conflict trends to support better decisions.",
  },
];
export function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();
  return (
    <div className="home-page">
      <header className="site-header">
        <div className="nav-wrap">
          <Brand />
          <nav
            className={menuOpen ? "site-nav is-open" : "site-nav"}
            aria-label="Main navigation"
          >
            <a href="#mission" onClick={() => setMenuOpen(false)}>
              Our mission
            </a>
            <a href="#platform" onClick={() => setMenuOpen(false)}>
              The platform
            </a>
            <a href="#how-it-works" onClick={() => setMenuOpen(false)}>
              How it works
            </a>
            <Link className="nav-signin" to={user ? "/dashboard" : "/login"}>
              {user ? "My workspace" : "Sign in"}
              <ArrowUpRight size={16} />
            </Link>
          </nav>
          <button
            className="menu-toggle"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <img
            className="hero-image"
            src="/images/elephant.jpg"
            alt="Sri Lankan elephant in Udawalawe National Park"
            fetchPriority="high"
          />
          <div className="hero-shade" />
          <div className="hero-content content-width">
            <Reveal>
              <p className="eyebrow light">
                <span className="live-dot" /> BUILT FOR SRI LANKA’S WILDERNESS
              </p>
              <h1 id="hero-title">
                Their world.
                <br />
                Our responsibility<span className="sage-dot">.</span>
              </h1>
              <p className="hero-description">
                Better connected people.
                <br />
                Better protected wildlife.
              </p>
              <p className="hero-support">
                One shared platform for the rangers, communities and researchers
                caring for our wild places.
              </p>
              <div className="hero-actions">
                <Link
                  className="button button-cream"
                  to={user ? "/dashboard" : "/register"}
                >
                  {user ? "Open your workspace" : "Join the mission"}
                  <ArrowUpRight size={18} />
                </Link>
                <a className="hero-secondary" href="#platform">
                  Explore the platform
                  <ArrowRight size={17} />
                </a>
              </div>
            </Reveal>
          </div>
          <div className="hero-bottom content-width">
            <span>
              <Leaf size={15} /> Made for conservation. Built around people.
            </span>
            <a href="#mission" aria-label="Scroll to our mission">
              <ArrowDown size={17} />
            </a>
          </div>
          <div className="hero-caption">
            <span className="caption-cross">+</span>
            <div>
              WILD SPACES. SHARED FUTURES.
              <small>Protecting what cannot be replaced.</small>
            </div>
          </div>
        </section>
        <div className="purpose-strip">
          <div className="content-width">
            <span>ONE MISSION. A CONNECTED APPROACH.</span>
            <div>
              <Trees size={18} /> Wildlife protection
            </div>
            <div>
              <ShieldCheck size={18} /> Community wellbeing
            </div>
            <div>
              <Activity size={18} /> Informed action
            </div>
          </div>
        </div>
        <section className="mission section-space content-width" id="mission">
          <Reveal>
            <div className="section-kicker">
              <span>01 / OUR PURPOSE</span>
              <Leaf size={20} />
            </div>
            <div className="mission-grid">
              <h2>
                Protecting wildlife starts
                <br />
                with <em>working together.</em>
              </h2>
              <div>
                <p>
                  Out in the field, every observation can make a difference. But
                  information is only useful when it reaches the right people.
                </p>
                <p>
                  Wana Rakshaka brings field reporting, patrols, wildlife alerts
                  and conservation insights into a connected workspace—designed
                  around the people protecting Sri Lanka’s natural heritage.
                </p>
                <a className="inline-link" href="#how-it-works">
                  A simpler way to work together <ArrowUpRight size={17} />
                </a>
              </div>
            </div>
          </Reveal>
        </section>
        <section className="platform-section section-space" id="platform">
          <div className="content-width">
            <Reveal>
              <p className="section-kicker">02 / THE PLATFORM</p>
              <div className="section-title-row">
                <h2>
                  Four ways to make
                  <br />a lasting difference.
                </h2>
                <p>
                  A shared vision for conservation.
                  <br />
                  Four connected areas of work.
                </p>
              </div>
            </Reveal>
            <div className="capability-grid">
              {capabilities.map(({ icon: Icon, title, name, copy }, index) => (
                <Reveal key={name} delay={index * 70}>
                  <article className="capability-card">
                    <div className="capability-top">
                      <Icon size={27} strokeWidth={1.4} />
                      <span>0{index + 1}</span>
                    </div>
                    <p className="capability-name">{name}</p>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                    <span className="development-tag">In development</span>
                  </article>
                </Reveal>
              ))}
            </div>
            <p className="platform-note">
              The platform is taking shape. Account access is available now;
              conservation workflows are being developed.
            </p>
          </div>
        </section>
        <section
          id="how-it-works"
          className="how-section section-space content-width"
        >
          <Reveal>
            <p className="section-kicker">03 / HOW IT CONNECTS</p>
            <div className="section-title-row">
              <h2>
                From an observation
                <br />
                to informed action.
              </h2>
              <p>
                Designed to keep the whole team
                <br />
                moving in the same direction.
              </p>
            </div>
            <div className="steps">
              {[
                [
                  "Observe",
                  "Capture what’s happening in the field, from wildlife sightings to signs of conflict.",
                ],
                [
                  "Coordinate",
                  "Bring the right context to the people who can review, verify and respond.",
                ],
                [
                  "Understand",
                  "Turn records into a clearer picture of the park and its conservation needs.",
                ],
              ].map(([title, copy], i) => (
                <div key={title}>
                  <span className="step-number">0{i + 1}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>
        <section className="join-section">
          <div className="join-texture" aria-hidden="true" />
          <Reveal>
            <div className="content-width join-inner">
              <div>
                <p className="eyebrow light">
                  SMALL ACTIONS. A WILDER TOMORROW.
                </p>
                <h2>
                  Be part of something
                  <br />
                  <em>worth protecting.</em>
                </h2>
                <p>Your next chapter in conservation starts here.</p>
              </div>
              <Link
                className="button button-cream"
                to={user ? "/dashboard" : "/register"}
              >
                {user ? "Open workspace" : "Create your account"}
                <ArrowUpRight size={19} />
              </Link>
            </div>
          </Reveal>
        </section>
        <section className="faq section-space content-width">
          <div>
            <p className="section-kicker">A LITTLE MORE CLARITY</p>
            <h2>Before you step in.</h2>
          </div>
          <div className="faq-list">
            {[
              [
                "Who is Wana Rakshaka for?",
                "The platform is designed for rangers, park managers, liaison officers and conservation researchers working in Sri Lanka.",
              ],
              [
                "Can I create an account?",
                "Yes. New accounts start as Researchers, with no park data access until a park manager grants access to their park. Staff accounts are created by park managers.",
              ],
              [
                "Is the entire platform available?",
                "Account registration and sign-in are available. Incident, patrol, alert and analytics workflows are still in development for this university project.",
              ],
              [
                "Will it work without a connection?",
                "Offline incident collection and patrol recording are planned for the Ranger app. Account creation and sign-in currently need an internet connection.",
              ],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <ChevronDown size={18} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="site-footer content-width">
        <div>
          <Brand />
          <p>A shared commitment to Sri Lanka’s wild future.</p>
          <small className="photo-credit">
            Photo:{" "}
            <a
              href="https://commons.wikimedia.org/wiki/File:Sri_Lankan_elephant,_Udawalawe_NP.jpg"
              target="_blank"
              rel="noreferrer"
            >
              M.S Dulan De Silva
            </a>{" "}
            ·{" "}
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY-SA 4.0
            </a>{" "}
            · Cropped, mirrored and tinted.
          </small>
        </div>
        <div className="footer-right">
          <span>
            <MapPin size={14} /> Sri Lanka
          </span>
          <p>© {new Date().getFullYear()} Wana Rakshaka · Group 037</p>
          <small>
            A university project. Not an official government service.
          </small>
        </div>
      </footer>
    </div>
  );
}
