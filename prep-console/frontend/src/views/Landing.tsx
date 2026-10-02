import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import { BANK, DESIGNS, DSA, TRACKS } from "../content";

const ERRORS: Record<string, string> = {
  "not-invited": "That email has not been invited yet. Ask the admin to invite the address you signed in with.",
  disabled: "This account has been disabled. Contact the admin if you think that is a mistake.",
  unverified: "Your provider did not confirm that email address. Verify it with Google or GitHub, then try again.",
  "no-email": "Your provider did not share an email address, so we cannot match you to an invite.",
  failed: "Sign-in did not complete. Please try again.",
};

const topics = Object.values(TRACKS).reduce((n, t) => n + t.length, 0);
const designs = Object.values(DESIGNS).reduce((n, t) => n + t.length, 0);

const FEATURES = [
  { t: "Learn", d: `${Object.keys(TRACKS).length} tracks and ${topics} topics, from ML foundations and LLM internals to GPU performance, networking and engineering at scale. Each topic goes from first principles to the senior answer.` },
  { t: "Design", d: `${designs} design cases: classic product designs, infrastructure building blocks, AI system design, machine coding and ML coding from scratch.` },
  { t: "Drill", d: `${DSA.length} DSA problems grouped by the pattern that solves them, and ${BANK.length.toLocaleString()} short-answer questions with the answer you would give.` },
  { t: "Practise", d: "Timed mock rounds, spaced-repetition flashcards and an eight-week plan, with progress, streaks and review flags saved to your account." },
];

function GoogleIcon() {
  return (<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>);
}
function GitHubIcon() {
  return (<svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" /></svg>);
}

/** What a signed-out visitor sees: what the console is, and how to sign in. */
export function Landing() {
  const { config, devLogin } = useAuth();
  const [params] = useSearchParams();
  const err = params.get("auth");
  const [email, setEmail] = useState("");
  const [devErr, setDevErr] = useState("");

  const onDev = async (e: FormEvent) => {
    e.preventDefault();
    setDevErr("");
    try { await devLogin(email.trim()); } catch (x) { setDevErr(ERRORS[(x as Error).message] || (x as Error).message); }
  };
  const none = config.providers.length === 0 && !config.devLogin;

  return (
    <div className="landing">
      <header className="land-top">
        <div className="brand">
          <div className="mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#fbfcfd" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 14.5 C4.5 14.5 5.5 3.5 9 3.5 C12.5 3.5 13.5 14.5 16 14.5" /><circle cx="9" cy="3.5" r="1.7" fill="#fbfcfd" stroke="none" />
            </svg>
          </div>
          <div><span className="brand-t">Prep Console</span><span className="brand-s">AI Engineer Track</span></div>
        </div>
        <span className="land-tag">Invite only</span>
      </header>

      <main className="land-main">
        <section className="land-hero">
          <div className="land-copy">
            <div className="eyebrow">Interview preparation</div>
            <h1 className="land-h">Prepare for AI-engineer and senior engineering interviews, end to end.</h1>
            <p className="lede">One place to learn the material, drill the problems and rehearse the rounds, with your progress kept in your account across every device.</p>
            <div className="land-stats">
              <div><b>{topics}</b><span>topics</span></div>
              <div><b>{designs}</b><span>design cases</span></div>
              <div><b>{DSA.length}</b><span>DSA problems</span></div>
              <div><b>{BANK.length.toLocaleString()}</b><span>questions</span></div>
            </div>
          </div>

          <div className="card signin">
            <h2 className="signin-h">Sign in</h2>
            <p className="card-s">Use the Google or GitHub account for the email you were invited with.</p>
            {err && <p className="notice err" role="alert">{ERRORS[err] || "Sign-in failed. Please try again."}</p>}
            <div className="signin-btns">
              {config.providers.includes("google") && <a className="btn ghost signin-btn" href="/auth/login/google"><GoogleIcon />Continue with Google</a>}
              {config.providers.includes("github") && <a className="btn ghost signin-btn" href="/auth/login/github"><GitHubIcon />Continue with GitHub</a>}
            </div>
            {config.devLogin && (
              <form className="devlogin" onSubmit={onDev}>
                <div className="devlogin-h">Dev login <span>local only</span></div>
                <div className="devlogin-row">
                  <input type="email" required placeholder="you@example.com" aria-label="Email for dev login" value={email} onChange={e => setEmail(e.target.value)} />
                  <button className="btn" type="submit">Sign in</button>
                </div>
                {devErr && <p className="notice err" role="alert">{devErr}</p>}
              </form>
            )}
            {none && <p className="notice">Sign-in is not set up yet. The admin needs to add Google or GitHub OAuth keys to the server's <code>.env</code>.</p>}
            <p className="signin-foot">No invite yet? Ask the person who runs this console to add your email.</p>
          </div>
        </section>

        <section className="land-features">
          {FEATURES.map(f => (
            <div className="card" key={f.t}>
              <div className="card-t">{f.t}</div>
              <p className="card-s">{f.d}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="land-foot">Prep Console · progress is stored on this server and never shared.</footer>
    </div>
  );
}
