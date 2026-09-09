import type { Grocery, GroceryEstimate } from '../domain/Grocery.ts';
import type { StoreCatalog } from '../domain/Store.ts';

type Props = Readonly<{
  estimate: GroceryEstimate;
  stores: StoreCatalog;
  onEdit: (grocery: Grocery) => void;
}>;

const number = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });

const duration = (days: number): string =>
  days === 0 ? 'Out of stock'
  : !Number.isFinite(days) ? 'No depletion'
  : days < 1 ? 'Less than a day'
  : `About ${number.format(days)} days`;

const urgency = (days: number): string =>
  days <= 1 ? 'urgent' : days <= 3 ? 'soon' : '';

const horizonInDays = 7;

const positionOnHorizon = (days: number): number =>
  Math.min(100, 100 * days / horizonInDays);

const usageText = (grocery: Grocery): string => {
  const { amount, every, unit } = grocery.stock.usage;
  const plural = every === 1 ? unit : `${unit}s`;
  return `${number.format(amount)} every ${number.format(every)} ${plural}`;
};

export const GroceryRow = ({ estimate, stores, onEdit }: Props) => {
  const { grocery, today, tomorrow } = estimate;
  const { remaining, daysLeft } = today;
  const todayWidth = positionOnHorizon(daysLeft);
  const tomorrowWidth = positionOnHorizon(tomorrow.daysLeft);

  return (
    <li class={urgency(daysLeft)}>
      <div class="item-description">
        <h2>{grocery.name}</h2>
        <p>{number.format(remaining)} left · use {usageText(grocery)}</p>
        <div class="depletion" role="img"
          aria-label={`${duration(daysLeft)} today; ${duration(tomorrow.daysLeft)} tomorrow; seven-day scale`}>
          <span class="today" style={{ width: `${todayWidth}%` }} />
          <span class="tomorrow" style={{ width: `${tomorrowWidth}%` }} />
        </div>
        <div class="depletion-caption">
          <p class="depletion-key"><span>Today</span><span>Tomorrow</span></p>
          <p class="depletion-scale"><span>0</span><span>7 days</span></p>
        </div>
        <p class="stores">
          {grocery.storeIds
            .map(id => stores.find(store => store.id === id)?.name)
            .filter(Boolean)
            .join(' · ') || 'No store specified'}
        </p>
      </div>
      <div class="item-action">
        <span class="time-left">{duration(daysLeft)}</span>
        <button class="secondary" type="button" onClick={() => onEdit(grocery)}>
          Update
        </button>
      </div>
    </li>
  );
};
