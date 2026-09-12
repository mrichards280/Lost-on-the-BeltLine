import { HAT_PRICE_CENTS, SHIRT_PRICE_CENTS, SHIRT_SIZES, formatUsd } from '@/lib/pricing';

// Merch is per person, so this picker appears once per person rather than once
// per team — `idPrefix` keeps the two instances' labels pointing at their own
// inputs when both are on screen.
export default function MerchPicker({ idPrefix, value, onChange, heading }) {
  const set = (field, next) => onChange({ ...value, [field]: next });

  return (
    <>
      {heading && <h3 className="merch-heading">{heading}</h3>}
      <div className="checkline">
        <input
          id={`${idPrefix}-shirt`}
          type="checkbox"
          checked={Boolean(value.shirt)}
          onChange={(e) => set('shirt', e.target.checked)}
        />
        <label htmlFor={`${idPrefix}-shirt`}>
          Shirt &mdash; {formatUsd(SHIRT_PRICE_CENTS)}
        </label>
      </div>
      {value.shirt && (
        <div className="field" style={{ marginLeft: 32 }}>
          <label htmlFor={`${idPrefix}-size`}>Size</label>
          <select
            id={`${idPrefix}-size`}
            value={value.shirtSize ?? 'M'}
            onChange={(e) => set('shirtSize', e.target.value)}
          >
            {SHIRT_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      )}
      <div className="checkline">
        <input
          id={`${idPrefix}-hat`}
          type="checkbox"
          checked={Boolean(value.hat)}
          onChange={(e) => set('hat', e.target.checked)}
        />
        <label htmlFor={`${idPrefix}-hat`}>Hat &mdash; {formatUsd(HAT_PRICE_CENTS)}</label>
      </div>
    </>
  );
}
