import { useState } from 'preact/hooks';

type Action = 'count' | 'restock' | 'rate';

type Props = Readonly<{
  action: Action;
  name: string;
  suggestedAmount: number;
  onSubmit: (amount: number) => string | undefined;
  onCancel: () => void;
}>;

export const InventoryActionForm = ({
  action,
  name,
  suggestedAmount,
  onSubmit,
  onCancel,
}: Props) => {
  const [error, setError] = useState('');

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const amount = Number(data.get('amount'));
    if (!Number.isFinite(amount) || amount < 0 || (action === 'restock' && amount === 0)) {
      setError(action === 'count' || action === 'rate'
        ? 'Enter zero or more.'
        : 'Enter an amount greater than zero.');
      return;
    }

    const submitError = onSubmit(amount);
    if (submitError) setError(submitError);
  };

  const counting = action === 'count';
  const rate = action === 'rate';
  return (
    <form class="inventory-action" onSubmit={submit}>
      <label>
        <span>{counting ? `How much ${name} do you have?`
          : rate ? `How much ${name} do you use per day?`
          : `How much ${name} did you buy?`}</span>
        <input name="amount" type="number" inputMode="decimal" min={action === 'restock' ? 0.01 : 0}
          step="any" defaultValue={counting ? undefined : suggestedAmount} autoFocus required />
      </label>
      {rate && <p class="field-help">This takes effect now. Future counts will continue to refine the estimate.</p>}
      {error && <p class="error" role="alert">{error}</p>}
      <div class="form-actions">
        <button class="primary" type="submit">{counting ? 'Save count' : rate ? 'Save rate' : 'Add purchase'}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
};
