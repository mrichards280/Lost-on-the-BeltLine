import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { normalizeTeamCode } from '@/lib/teamCode';
import { downscaleToDataUrl } from '@/lib/photo';
import { describeGaps, isEligible } from '@/lib/eligibility';

const STORAGE_KEY = 'beltline.teamCode';
const PAGE_TITLES = {
  ab: 'Passport pages A & B',
  cd: 'Passport pages C & D',
  bonus: 'Bonus page',
};

export default function Submit() {
  const router = useRouter();
  const page = typeof router.query.page === 'string' ? router.query.page : null;

  const [teamCode, setTeamCode] = useState(null);
  const [team, setTeam] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [claimedIds, setClaimedIds] = useState(new Set());
  const [selected, setSelected] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  // The three QR codes are identical across every passport, so the only thing
  // identifying the team is what is already in this phone's localStorage.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setTeamCode(saved);
  }, []);

  useEffect(() => {
    if (!page) return;
    supabase
      .from('challenges')
      .select('*')
      .eq('page', page)
      .order('category')
      .order('id')
      .then(({ data, error }) => {
        if (error) console.error('Could not load challenges', error);
        setChallenges(data ?? []);
      });
  }, [page]);

  const loadTeam = useCallback(async (code) => {
    const response = await fetch(`/api/team?code=${encodeURIComponent(code)}`);
    if (!response.ok) return null;
    const data = await response.json();
    setTeam(data);
    setClaimedIds(new Set(data.claims.map((claim) => claim.challengeId)));
    return data;
  }, []);

  useEffect(() => {
    if (teamCode) loadTeam(teamCode);
  }, [teamCode, loadTeam]);

  async function handleCodeSubmit(code) {
    const normalized = normalizeTeamCode(code);
    const found = await loadTeam(normalized);
    if (!found) return `No team with code ${normalized}. Check the email we sent you.`;
    window.localStorage.setItem(STORAGE_KEY, normalized);
    setTeamCode(normalized);
    return null;
  }

  function forgetTeam() {
    window.localStorage.removeItem(STORAGE_KEY);
    setTeamCode(null);
    setTeam(null);
    setClaimedIds(new Set());
    setSelected(null);
    setResult(null);
  }

  async function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      setPhoto(await downscaleToDataUrl(file));
    } catch (err) {
      console.error(err);
      setResult({ status: 'error', error: 'Could not read that photo. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function submitClaim() {
    if (!selected) return;
    setBusy(true);
    setResult(null);

    try {
      const response = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamCode, challengeId: selected.id, photo }),
      });
      const data = await response.json();
      setResult(data);

      if (data.status === 'success' || data.status === 'already_done') {
        setClaimedIds((prev) => new Set(prev).add(selected.id));
      }
      if (data.status === 'success') {
        setSelected(null);
        setPhoto(null);
        loadTeam(teamCode);
      }
    } catch {
      setResult({ status: 'error', error: 'No signal? Try that again in a second.' });
    } finally {
      setBusy(false);
    }
  }

  if (!page || !PAGE_TITLES[page]) {
    return (
      <main className="wrap">
        <h1>Scan a passport QR code</h1>
        <p className="lede">
          This page opens from the QR code on a passport page. Scan one to submit a challenge.
        </p>
        <p className="muted">
          <Link href="/leaderboard">Leaderboard</Link>
        </p>
      </main>
    );
  }

  if (!teamCode) {
    return <TeamCodeGate onSubmit={handleCodeSubmit} />;
  }

  return (
    <main className="wrap">
      <p className="eyebrow">{PAGE_TITLES[page]}</p>
      <h1>What did you just do?</h1>

      {team && (
        <p className="lede">
          {team.team.teamName} &middot; {team.standing.score} pts
          <br />
          <span className="muted">
            {isEligible(team.standing) ? 'Qualified for the main prize.' : describeGaps(team.standing)}
          </span>
        </p>
      )}

      <ClaimResult result={result} />

      <div className="card">
        {challenges.length === 0 && <p className="muted">Loading challenges...</p>}
        {challenges.map((challenge) => {
          const done = claimedIds.has(challenge.id);
          return (
            <button
              key={challenge.id}
              type="button"
              className={`choice${done ? ' done' : ''}`}
              aria-pressed={selected?.id === challenge.id}
              disabled={done}
              onClick={() => {
                setSelected(challenge);
                setResult(null);
              }}
            >
              <span className={`pill ${challenge.category}`}>{challenge.category}</span>
              <span className="grow">{challenge.name}</span>
              <span className="pts">{done ? 'done' : `${challenge.points} pts`}</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{selected.name}</h2>
          <div className="field">
            <label htmlFor="photo">Proof photo</label>
            <input
              id="photo"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhoto}
            />
          </div>
          {photo && (
            // A data: URL from the phone's own camera — nothing for next/image
            // to optimise, and it must render before any upload happens.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt="Your proof photo"
              style={{ width: '100%', borderRadius: 10, marginBottom: 14 }}
            />
          )}
          <button type="button" onClick={submitClaim} disabled={busy}>
            {busy ? 'Sending...' : 'Claim it'}
          </button>
        </div>
      )}

      <p className="muted">
        <Link href="/leaderboard">Leaderboard</Link>
        {' · '}
        <button type="button" className="link" onClick={forgetTeam}>
          Not {team?.team.teamName ?? teamCode}?
        </button>
      </p>
    </main>
  );
}

function ClaimResult({ result }) {
  if (!result) return null;

  if (result.status === 'success') {
    return (
      <div className="notice good">
        <strong>Claimed.</strong> {result.challengeName} &mdash; {result.points} points.
      </div>
    );
  }
  if (result.status === 'already_done') {
    return (
      <div className="notice warn">
        You already claimed {result.challengeName}. It only counts once.
      </div>
    );
  }
  if (result.status === 'full') {
    // A cap of 1 is a Golden Ticket someone else reached first; a larger cap is
    // a partner-business limit for the day. Same trigger, different sentence.
    return (
      <div className="notice warn">
        {result.exclusive
          ? `Another team got there first — ${result.challengeName} is claimed.`
          : `${result.challengeName} is full for today. Try another one.`}
      </div>
    );
  }
  return <div className="notice bad">{result.error ?? 'Something went wrong.'}</div>;
}

function TeamCodeGate({ onSubmit }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(await onSubmit(value));
    setBusy(false);
  }

  return (
    <main className="wrap">
      <p className="eyebrow">First scan</p>
      <h1>What&rsquo;s your team code?</h1>
      <p className="lede">
        It&rsquo;s in your registration email, like <strong>BELT-07</strong>. You only type
        this once &mdash; this phone remembers it for the rest of the hunt.
      </p>

      {error && <div className="notice bad">{error}</div>}

      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="code">Team code</label>
          <input
            id="code"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="BELT-07"
            required
          />
        </div>
        <button type="submit" disabled={busy}>
          {busy ? 'Checking...' : 'That’s us'}
        </button>
      </form>
    </main>
  );
}
