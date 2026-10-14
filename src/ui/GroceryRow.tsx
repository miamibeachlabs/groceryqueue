import { useRef } from 'preact/hooks';
import type { Grocery, GroceryEstimate } from '../domain/Grocery.ts';
import type { StoreCatalog } from '../domain/Store.ts';

type Props = Readonly<{
  estimate: GroceryEstimate;
  stores: StoreCatalog;
  onRestock: (grocery: Grocery) => void;
  onOtherRestock: (grocery: Grocery) => void;
  onCount: (grocery: Grocery) => void;
  onRate: (grocery: Grocery) => void;
  onEdit: (grocery: Grocery) => void;
  onMove: (id: string, targetId: string, after: boolean) => void;
  onReleaseManualOrder: (id: string) => void;
  dragging: boolean;
  dropPosition?: 'before' | 'after';
  onDragStart: (id: string) => void;
  onDragPreview: (id: string, targetId: string, after: boolean) => void;
  onDragEnd: (id: string, targetId?: string, after?: boolean) => void;
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
  onRate,
  onEdit,
  onMove,
  onReleaseManualOrder,
  dragging,
  dropPosition,
  onDragStart,
  onDragPreview,
  onDragEnd,
}: Props) => {
  const { grocery, today, tomorrow } = estimate;
  const { amount, daysLeft } = today;
  const pointerId = useRef<number>();

  const targetAt = (x: number, y: number): HTMLElement | undefined =>
    document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-grocery-id]') ?? undefined;

  const finishDrag = (x: number, y: number) => {
    const target = targetAt(x, y);
    const targetId = target?.dataset.groceryId;
    if (target && targetId) {
      const bounds = target.getBoundingClientRect();
      onDragEnd(grocery.id, targetId, y > bounds.top + bounds.height / 2);
    } else {
      onDragEnd(grocery.id);
    }
    pointerId.current = undefined;
  };

  return (
    <li class={`${urgency(daysLeft)}${dragging ? ' dragging' : ''}${dropPosition ? ` drop-${dropPosition}` : ''}`}
      data-grocery-id={grocery.id}>
      <div class="item-description">
        <h2>
          {grocery.name}
          {grocery.manualRank !== undefined &&
            <span class="manual-badge">
              Manual <button type="button" onClick={() => onReleaseManualOrder(grocery.id)}>Release</button>
            </span>}
        </h2>
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
        <p class="rate">
          Uses about {number.format(today.dailyUse)} per day
          <button type="button" onClick={() => onRate(grocery)}>Adjust rate</button>
        </p>
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
        <button class="drag-handle" type="button"
          aria-label={`Drag ${grocery.name} to reorder. Use up and down arrows with a keyboard.`}
          onPointerDown={event => {
            pointerId.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            onDragStart(grocery.id);
          }}
          onPointerMove={event => {
            if (pointerId.current !== event.pointerId) return;
            const target = targetAt(event.clientX, event.clientY);
            const targetId = target?.dataset.groceryId;
            if (!targetId) return;
            const bounds = target.getBoundingClientRect();
            onDragPreview(grocery.id, targetId, event.clientY > bounds.top + bounds.height / 2);
          }}
          onPointerUp={event => {
            if (pointerId.current === event.pointerId)
              finishDrag(event.clientX, event.clientY);
          }}
          onPointerCancel={() => {
            pointerId.current = undefined;
            onDragEnd(grocery.id);
          }}
          onKeyDown={event => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault();
              const row = event.currentTarget.closest<HTMLElement>('[data-grocery-id]');
              const sibling = event.key === 'ArrowUp' ? row?.previousElementSibling : row?.nextElementSibling;
              const targetId = sibling instanceof HTMLElement ? sibling.dataset.groceryId : undefined;
              if (targetId) onMove(grocery.id, targetId, event.key === 'ArrowDown');
            }
          }}>
          <span aria-hidden="true">⠿</span>
        </button>
      </div>
    </li>
  );
};
