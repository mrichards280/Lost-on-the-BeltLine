import { useState } from 'react';
import Link from 'next/link';

const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const ENTRY = 50;
const SHIRT = 22;
const HAT = 25;

export default function Register() {
  const [form, setForm] = useState({
    teamName: '',
    member1: '',
    member2: '',
    email: '',
    shirt: false,
    shirtSize: 'M',
    hat: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const total = ENTRY + (form.shirt ? SHIRT : 0) + (form.hat ? HAT : 0);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: form.teamName,
          member1: form.member1,
          member2: form.member2,
          email: form.email,
          merch: {
            shirt: form.shirt,
            shirtSize: form.shirt ? form.shirtSize : null,
            hat: form.hat,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not start checkout');

      // Stripe hosts the payment page; the team record is created by the
      // webhook once payment actually completes.
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <main className="wrap">
      <p className="eyebrow">Registration</p>
      <h1>Register your team</h1>
      <p className="lede">Two people per team. $50 covers both of you.</p>

      {error && <div className="notice bad">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="field">
            <label htmlFor="teamName">Team name</label>
            <input
              id="teamName"
              type="text"
              required
              maxLength={60}
              value={form.teamName}
              onChange={(e) => update('teamName', e.target.value)}
              placeholder="The Krog Street Krew"
            />
          </div>
          <div className="field">
            <label htmlFor="member1">Member 1</label>
            <input
              id="member1"
              type="text"
              required
              value={form.member1}
              onChange={(e) => update('member1', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="member2">Member 2</label>
            <input
              id="member2"
              type="text"
              required
              value={form.member2}
              onChange={(e) => update('member2', e.target.value)}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
            />
            <p className="muted" style={{ margin: '6px 0 0' }}>
              Your team code goes here. Bring it with you.
            </p>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Merch (optional)</h2>
          <div className="checkline">
            <input
              id="shirt"
              type="checkbox"
              checked={form.shirt}
              onChange={(e) => update('shirt', e.target.checked)}
            />
            <label htmlFor="shirt">Shirt &mdash; ${SHIRT}</label>
          </div>
          {form.shirt && (
            <div className="field" style={{ marginLeft: 30 }}>
              <label htmlFor="shirtSize">Size</label>
              <select
                id="shirtSize"
                value={form.shirtSize}
                onChange={(e) => update('shirtSize', e.target.value)}
              >
                {SHIRT_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="checkline">
            <input
              id="hat"
              type="checkbox"
              checked={form.hat}
              onChange={(e) => update('hat', e.target.checked)}
            />
            <label htmlFor="hat">Hat &mdash; ${HAT}</label>
          </div>
        </div>

        <div className="card">
          <p style={{ display: 'flex', justifyContent: 'space-between', margin: '0 0 16px' }}>
            <strong>Total</strong>
            <strong>${total}</strong>
          </p>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Taking you to checkout...' : `Pay $${total} and register`}
          </button>
        </div>
      </form>

      <p className="muted">
        <Link href="/">Back to the front page</Link>
      </p>
    </main>
  );
}
