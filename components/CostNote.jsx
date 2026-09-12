import {
  OUT_OF_POCKET_HIGH_CENTS,
  OUT_OF_POCKET_LOW_CENTS,
  formatUsd,
} from '@/lib/pricing';

// Said on the front page, on the form, in the invite and in the email. Finding
// out one stop at a time that the cookie isn't included is how a $50 event
// starts feeling like a $120 one.
export default function CostNote({ className = 'notice warn' }) {
  return (
    <div className={className}>
      <strong>Bring a card.</strong> Entry covers the hunt itself. Food, drinks and anything
      you make or take home at the stops are yours to pay for &mdash; budget about{' '}
      {formatUsd(OUT_OF_POCKET_LOW_CENTS)}&ndash;{formatUsd(OUT_OF_POCKET_HIGH_CENTS)} each
      on the day.
    </div>
  );
}
