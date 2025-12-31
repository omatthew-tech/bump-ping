import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import LadybugLayer from '../components/LadybugLayer';
import { supabase } from '../lib/supabase';

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function HomePage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  const canSubmit = useMemo(() => isValidEmail(email) && status !== 'loading', [email, status]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!isValidEmail(email)) {
      setStatus('error');
      setMessage('Please enter a valid email address.');
      return;
    }

    if (!supabase) {
      setStatus('error');
      setMessage('Signup is not configured yet (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
      return;
    }

    setStatus('loading');
    const { error } = await supabase.from('early_access_signups').insert({
      email: email.trim().toLowerCase(),
      source: 'landing',
    });

    if (error) {
      setStatus('error');
      setMessage('Could not save your email. Please try again in a moment.');
      return;
    }

    setStatus('success');
    setMessage("You're on the list. We'll email you when early access opens.");
    setEmail('');
  };

  return (
    <div className="page">
      <div className="bgGlow" />
      <LadybugLayer />

      <main className="container">
        <section className="hero">
          <div className="wordmark">
            <div className="wordmarkBump">bump</div>
            <div className="wordmarkPing">Ping</div>
          </div>
          <p className="tagline">
            The only location based dating app - with women in control.
          </p>
        </section>

        <section className="card">
          <h2 className="cardTitle">Get early access</h2>
          <p className="cardSub">
            We’ll notify you when Bump Ping is available in the App Store.
          </p>

          <form onSubmit={submit} className="form">
            <label className="label" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              inputMode="email"
              autoComplete="email"
            />

            <button className="button" type="submit" disabled={!canSubmit}>
              {status === 'loading' ? 'Saving…' : 'Notify me'}
            </button>
          </form>

          {message ? (
            <div className={status === 'success' ? 'noteSuccess' : 'noteError'}>{message}</div>
          ) : null}

          <p className="legal">
            By signing up you agree to our{' '}
            <Link className="link" to="/terms">
              Terms
            </Link>{' '}
            &{' '}
            <Link className="link" to="/privacy">
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </main>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Bump Ping</span>
        <span className="footerLinks">
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </span>
      </footer>
    </div>
  );
}


