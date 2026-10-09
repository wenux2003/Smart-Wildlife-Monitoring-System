import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
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
import { ConservationStories } from "../components/ConservationStories.js";
import { LandingFeedback } from "../components/LandingFeedback.js";
import { useAuth } from "../auth/AuthContext.js";

const capabilities = [
  {
    icon: Binoculars,
    title: "Every observation matters.",
    name: "Incident reporting",
    audience: "Public reports · Staff review",
    copy: "Bring ranger observations, community reports and camera-trap reviews into one shared picture.",
  },
  {
    icon: Footprints,
    title: "Leave fewer blind spots.",
    name: "Ranger patrols",
    audience: "Ranger accounts",
    copy: "Record patrol tracks and waypoints, capture field observations and see where patrol effort is needed most.",
  },
  {
    icon: Radio,
    title: "Know when to respond.",
    name: "Wildlife monitoring",
    audience: "Park operations teams",
    copy: "Connect collar movements with alerts and coordinate the people closest to the situation.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "See the bigger picture.",
    name: "Conservation insights",
    audience: "Managers & approved researchers",
    copy: "Explore incident patterns, patrol coverage and conflict trends, then export reports to support better decisions.",
  },
];
export function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();
  const communityReportUrl = new URL(
    "/community/new",
    import.meta.env.VITE_PUBLIC_APP_URL?.trim() || "http://localhost:5173",
  ).href;
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
            <a href="#conservation-stories" onClick={() => setMenuOpen(false)}>
              Field stories
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
                <a className="button button-cream" href={communityReportUrl}>
                  Report a wildlife incident
                  <ArrowUpRight size={18} />
                </a>
                <Link
                  className="button button-ghost-light"
                  to={user ? "/dashboard" : "/register"}
                >
                  {user ? "Open your workspace" : "Register as a researcher"}
                  <ArrowUpRight size={18} />
                </Link>
              </div>
              <p className="hero-note">
                <ShieldCheck size={15} aria-hidden="true" /> No account needed
                to report an incident. Staff accounts are created by park
                managers.
              </p>
            </Reveal>
          </div>
          <div className="hero-bottom hero-bottom-center content-width">
            <a href="#mission" aria-label="Scroll to our mission">
              <ArrowDown size={17} />
            </a>
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
                  See how it works <ArrowDown size={17} />
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
                  A shared vision for conservation. <br />
                  Four connected areas of work.
                </p>
              </div>
            </Reveal>
            <div className="capability-grid">
              {capabilities.map(
                ({ icon: Icon, title, name, copy, audience }, index) => (
                  <Reveal key={name} delay={index * 70}>
                    <article className="capability-card">
                      <div className="capability-top">
                        <Icon size={27} strokeWidth={1.4} />
                        <span>0{index + 1}</span>
                      </div>
                      <p className="capability-name">{name}</p>
                      <h3>{title}</h3>
                      <p>{copy}</p>
                      <span className="capability-audience">{audience}</span>
                    </article>
                  </Reveal>
                ),
              )}
            </div>
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
                Designed to keep the whole team <br />
                moving in the same direction.
              </p>
            </div>
            <div className="steps">
              {[
                [
                  "Observe",
                  "Capture what’s happening in the field, from wildlife sightings to signs of conflict.",
                  "Rangers · villagers · camera traps · collars",
                ],
                [
                  "Coordinate",
                  "Bring the right context to the people who can review, verify and respond.",
                  "Liaison officers · park managers · rangers",
                ],
                [
                  "Understand",
                  "Turn records into a clearer picture of the park and its conservation needs.",
                  "Park managers · approved researchers",
                ],
              ].map(([title, copy, who], i) => (
                <div key={title}>
                  <span className="step-number">0{i + 1}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                  <span className="step-who">{who}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </section>
        <ConservationStories />
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
                <p>Two ways to get involved, whoever you are.</p>
              </div>
              <div className="join-paths">
                <div className="join-path">
                  <Binoculars size={22} aria-hidden="true" />
                  <h3>Saw something in the field?</h3>
                  <p>
                    Report elephants near homes, crop damage, snares or an
                    injured animal. No account needed.
                  </p>
                  <a className="button button-cream" href={communityReportUrl}>
                    Report an incident <ArrowUpRight size={18} />
                  </a>
                </div>
                <div className="join-path">
                  <ChartNoAxesCombined size={22} aria-hidden="true" />
                  <h3>Researcher or conservation partner?</h3>
                  <p>
                    Create an account, then ask the park manager for access to
                    the park you study.
                  </p>
                  <Link
                    className="button button-ghost-light"
                    to={user ? "/dashboard" : "/register"}
                  >
                    {user ? "Open workspace" : "Create a researcher account"}
                    <ArrowUpRight size={18} />
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
        <section className="faq section-space content-width">
          <div className="faq-intro">
            <p className="section-kicker">A LITTLE MORE CLARITY</p>
            <h2>Before you step in.</h2>
            <p>
              Answers about who the platform is for, how access works and what
              happens to a report once it is sent.
            </p>
          </div>
          <div className="faq-list">
            {[
              [
                "Who is Wana Rakshaka for?",
                "The platform is designed for rangers, park managers, liaison officers and conservation researchers working in Sri Lanka, and for anyone living near a park who wants to report a wildlife incident.",
              ],
              [
                "What happens after I report an incident?",
                "A liaison officer or park manager reviews the report, confirms the location if needed and assigns a ranger to respond. The outcome is recorded with the incident, and the report also feeds the park’s conflict and hotspot analysis.",
              ],
              [
                "Can I create an account?",
                "Yes. New accounts start as Researchers, with no park data access until a park manager grants access to their park. Staff accounts are created by park managers.",
              ],
              [
                "Can anyone use the staff tools?",
                "No. Anyone can submit a community incident report without a staff account. Incident review, patrols, wildlife monitoring and conservation reports are restricted to the appropriate roles and park assignments. Registering as a Researcher does not unlock park data; a park manager must grant access first.",
              ],
              [
                "Will it work without a connection?",
                "After signing in and loading assigned patrols online, Rangers can record incidents and patrol activity offline. Saved records synchronize when a connection is available. Map tiles, sign-in and conservation analytics need a connection.",
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
        <LandingFeedback />
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
        <nav className="footer-links" aria-label="Footer">
          <div>
            <span>Explore</span>
            <a href="#mission">Our mission</a>
            <a href="#platform">The platform</a>
            <a href="#how-it-works">How it works</a>
            <a href="#conservation-stories">Field stories</a>
            <a href="#feedback">Share feedback</a>
          </div>
          <div>
            <span>Get involved</span>
            <a href={communityReportUrl}>Community report</a>
            <Link to={user ? "/dashboard" : "/register"}>
              {user ? "My workspace" : "Researcher registration"}
            </Link>
            {!user && <Link to="/login">Staff sign in</Link>}
          </div>
        </nav>
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
