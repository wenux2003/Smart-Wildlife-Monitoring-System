import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import "./LandingFeedback.css";

const storageKey = "wr.landing-feedback";

export function LandingFeedback() {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("General feedback");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (message.trim().length < 10) {
      setError("Write at least 10 characters of feedback.");
      return;
    }
    try {
      let previous: unknown = [];
      try {
        previous = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      } catch {
        /* Recover from an invalid local draft. */
      }
      const entries = Array.isArray(previous) ? previous : [];
      localStorage.setItem(
        storageKey,
        JSON.stringify([
          ...entries,
          {
            name: name.trim(),
            topic,
            message: message.trim(),
            createdAt: new Date().toISOString(),
          },
        ]),
      );
      setSaved(true);
    } catch {
      setError(
        "Your browser could not save this feedback. Your text is still here; please try again.",
      );
    }
  }

  return (
    <section
      id="feedback"
      className="landing-feedback section-space"
      aria-labelledby="feedback-title"
    >
      <div className="content-width feedback-layout">
        <div className="feedback-intro">
          <p className="section-kicker">05 / YOUR FEEDBACK</p>
          <span className="feedback-intro-icon">
            <MessageCircle size={25} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <h2 id="feedback-title">
            Help us make
            <br />
            this better.
          </h2>
          <p>
            Your experience matters. Tell us what felt useful, what was
            confusing or what you would like to see next.
          </p>
          <ul>
            <li>What was easy to use?</li>
            <li>Where did you get stuck?</li>
            <li>What would help your park or community?</li>
          </ul>
        </div>
        <div className="feedback-panel">
          {saved ? (
            <div className="feedback-success" role="status" aria-live="polite">
              <CheckCircle2 size={36} strokeWidth={1.5} aria-hidden="true" />
              <h3>Thanks for sharing your thoughts.</h3>
              <p>
                Your feedback is saved in this browser only. It has not been
                sent to our team.
              </p>
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  setSaved(false);
                  setName("");
                  setTopic("General feedback");
                  setMessage("");
                }}
              >
                Add more feedback <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <form onSubmit={submit} aria-label="Website feedback">
              <div className="feedback-field-row">
                <label>
                  Your name <span>(optional)</span>
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    maxLength={60}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="How should we call you?"
                  />
                </label>
                <label>
                  What is this about?
                  <select
                    name="topic"
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                  >
                    {[
                      "General feedback",
                      "Ease of use",
                      "Feature idea",
                      "Something isn’t working",
                    ].map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="feedback-message">
                Your feedback
                <textarea
                  name="message"
                  rows={4}
                  minLength={10}
                  maxLength={1000}
                  required
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Share an idea or tell us about your experience…"
                  aria-describedby="feedback-message-hint"
                />
              </label>
              <p id="feedback-message-hint" className="feedback-message-hint">
                10–1,000 characters <span>{message.length}/1,000</span>
              </p>
              {error && (
                <p className="feedback-error" role="alert">
                  {error}
                </p>
              )}
              <div className="feedback-form-footer">
                <button type="submit" className="button button-green">
                  Send feedback <ArrowRight size={16} />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
