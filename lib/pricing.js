// Prices in cents, in one place. The registration form, the amount stored on
// the team, the Venmo deep link and the HQ payment list all read from here —
// if these ever disagree, someone Venmos the wrong number and it has to be
// sorted out by hand on hunt morning.
export const ENTRY_PRICE_CENTS = 5000;
export const SHIRT_PRICE_CENTS = 2200;
export const HAT_PRICE_CENTS = 2500;

export const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

// Returns the itemised breakdown as well as the total, because the Venmo note
// and the confirmation page both need to show the player what they are paying
// for — a bare "$72" invites a "wait, why?" text the night before.
export function priceRegistration(merch) {
  const items = [{ label: 'Hunt entry (team of 2)', cents: ENTRY_PRICE_CENTS }];

  if (merch?.shirt) {
    items.push({
      label: `Shirt (${merch.shirtSize})`,
      cents: SHIRT_PRICE_CENTS,
    });
  }
  if (merch?.hat) {
    items.push({ label: 'Hat', cents: HAT_PRICE_CENTS });
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
