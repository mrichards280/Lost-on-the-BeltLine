// Prices in cents, in one place. The registration form, the amount stored on
// the team, the Venmo deep link and the HQ payment list all read from here —
// if these ever disagree, someone Venmos the wrong number and it has to be
// sorted out by hand on hunt morning.
export const ENTRY_PRICE_CENTS = 5000;
export const TEAM_SIZE = 2;
export const PER_PERSON_CENTS = ENTRY_PRICE_CENTS / TEAM_SIZE;

export const SHIRT_PRICE_CENTS = 2200;
export const HAT_PRICE_CENTS = 2500;

export const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

// What the entry fee does NOT cover. Everything a team buys at a partner stop —
// the coffee, the flight, the cookie they decorate — comes out of their own
// pocket, and finding that out one stop at a time is how a $50 event starts
// feeling like a $120 one. So it is said on the front page, on the
// registration form and in the invite, not buried.
export const OUT_OF_POCKET_LOW_CENTS = 2500;
export const OUT_OF_POCKET_HIGH_CENTS = 4000;

// Returns the itemised breakdown as well as the total, because the Venmo note
// and the confirmation page both need to show the player what they are paying
// for — a bare "$72" invites a "wait, why?" text the night before.
//
// Merch is per person: each half of a team picks their own, and a shirt needs
// its wearer's size. `people` is a list of { name, merch }.
export function priceRegistration(people) {
  const items = [{ label: `Hunt entry (team of ${TEAM_SIZE})`, cents: ENTRY_PRICE_CENTS }];

  for (const person of people ?? []) {
    const who = person?.name?.trim();
    const suffix = who ? ` — ${who}` : '';

    if (person?.merch?.shirt) {
      items.push({
        label: `Shirt (${person.merch.shirtSize})${suffix}`,
        cents: SHIRT_PRICE_CENTS,
      });
    }
    if (person?.merch?.hat) {
      items.push({ label: `Hat${suffix}`, cents: HAT_PRICE_CENTS });
    }
  }

  return {
    items,
    totalCents: items.reduce((sum, item) => sum + item.cents, 0),
  };
}

export function formatUsd(cents) {
  // Every price here is a whole dollar amount, so drop the ".00" — "$72" is
  // what someone types into Venmo, not "$72.00".
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function validateMerch(merch) {
  if (merch?.shirt && !SHIRT_SIZES.includes(merch.shirtSize)) {
    return 'Pick a shirt size';
  }
  return null;
}

// Merch rows for the packing list at HQ, tagged with who they belong to so a
// two-shirt team doesn't turn into a guess at check-in.
export function merchLineItems(teamId, people) {
  const rows = [];
  for (const person of people ?? []) {
    if (person?.merch?.shirt) {
      rows.push({
        team_id: teamId,
        item: 'shirt',
        size: person.merch.shirtSize ?? null,
        person_name: person.name ?? null,
      });
    }
    if (person?.merch?.hat) {
      rows.push({ team_id: teamId, item: 'hat', size: null, person_name: person.name ?? null });
    }
  }
  return rows;
}
