import { useState } from 'preact/hooks';

type Action = 'count' | 'restock';

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
      setError(action === 'count' ? 'Enter zero or more.' : 'Enter an amount greater than zero.');
      return;
    }

    const submitError = onSubmit(amount);
    if (submitError) setError(submitError);
  };

  const counting = action === 'count';
  return (
    <form class="inventory-action" onSubmit={submit}>
      <label>
        <span>{counting ? `How much ${name} do you have?` : `How much ${name} did you buy?`}</span>
        <input name="amount" type="number" inputMode="decimal" min={counting ? 0 : 0.01}
          step="any" defaultValue={counting ? undefined : suggestedAmount} autoFocus required />
      </label>
      {error && <p class="error" role="alert">{error}</p>}
      <div class="form-actions">
        <button class="primary" type="submit">{counting ? 'Save count' : 'Add purchase'}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
};
