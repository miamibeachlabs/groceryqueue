import type { Grocery, GroceryEstimate } from '../domain/Grocery.ts';
import type { StoreCatalog } from '../domain/Store.ts';

type Props = Readonly<{
  estimate: GroceryEstimate;
  stores: StoreCatalog;
  onRestock: (grocery: Grocery) => void;
  onOtherRestock: (grocery: Grocery) => void;
  onCount: (grocery: Grocery) => void;
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

export const GroceryRow = ({
  estimate,
  stores,
  onRestock,
  onOtherRestock,
  onCount,
  onEdit,
}: Props) => {
  const { grocery, today, tomorrow } = estimate;
  const { amount, daysLeft } = today;

  return (
    <li class={urgency(daysLeft)}>
      <div class="item-description">
        <h2>{grocery.name}</h2>
        <div class="amount-line">
          <p>About {number.format(amount)} left</p>
          <button class="primary compact" type="button" onClick={() => onCount(grocery)}>
            <span class="wide-label">Update count</span><span class="phone-label">Update</span>
          </button>
          <p class="stores">
            {grocery.storeIds
              .map(id => stores.find(store => store.id === id)?.name)
              .filter(Boolean)
              .join(' · ') || 'No store specified'}
          </p>
        </div>
        <div class="depletion" role="img"
          aria-label={`${duration(daysLeft)} today; ${duration(tomorrow.daysLeft)} tomorrow; seven-day scale`}>
          <span class="today" style={{ width: `${positionOnHorizon(daysLeft)}%` }} />
          <span class="tomorrow" style={{ width: `${positionOnHorizon(tomorrow.daysLeft)}%` }} />
        </div>
        <div class="depletion-caption">
          <p class="depletion-key"><span>Today</span><span>Tomorrow</span></p>
          <p class="depletion-scale"><span>0</span><span>7 days</span></p>
        </div>
      </div>
      <div class="item-action">
        <span class="time-left">{duration(daysLeft)}</span>
        <div class="purchase-actions">
          <button class="primary" type="button" onClick={() => onRestock(grocery)}>
            Bought +{number.format(grocery.usualRestock)}
          </button>
          <button class="primary" type="button" onClick={() => onOtherRestock(grocery)}>
            <span class="wide-label">Bought other</span><span class="phone-label">Bought…</span>
          </button>
        </div>
        <button class="edit-details" type="button" onClick={() => onEdit(grocery)}>
          <span class="wide-label">Edit details</span><span class="phone-label">Edit</span>
        </button>
      </div>
    </li>
  );
};
