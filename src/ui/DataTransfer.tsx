import { useState } from 'preact/hooks';
import type { Inventory } from '../domain/Grocery.ts';
import type { ImportPlan } from '../infrastructure/LocalInventory.ts';

type DataTransferProps = Readonly<{
  exportData: () => string;
  prepareImport: (text: string) => ImportPlan;
  replaceInventory: (inventory: Inventory) => void;
}>;

const download = (text: string, name: string): void => {
  const file = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const filename = (prefix: string): string =>
  `${prefix}-${new Date().toISOString().slice(0, 10)}.json`;

/** Browser-file boundary for moving an inventory between devices. */
export const DataTransfer = ({
  exportData,
  prepareImport,
  replaceInventory,
}: DataTransferProps) => {
  const [message, setMessage] = useState<string>();

  const exportInventory = () => {
    download(exportData(), filename('grocery-queue'));
    setMessage('Saved a copy of your Grocery Queue data.');
  };

  const importInventory = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    try {
      const plan = prepareImport(await file.text());
      const confirmed = window.confirm(
        'Replace this device’s Grocery Queue data? A backup of the current data will download first.',
      );
      if (!confirmed) return;
      download(plan.backup, filename('grocery-queue-backup'));
      replaceInventory(plan.inventory);
      setMessage('Imported your data. The previous data was saved as a backup.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not import that file.');
    }
  };

  return (
    <section class="data-transfer" aria-label="Data backup and restore">
      <div>
        <h2>Your data</h2>
        <p>Export a copy to move or edit it. Import replaces this device’s data after saving a backup.</p>
      </div>
      <div class="data-actions">
        <button type="button" onClick={exportInventory}>Export data</button>
        <label class="file-action">
          Import data
          <input type="file" accept="application/json,.json" onChange={importInventory} />
        </label>
      </div>
      {message && <p class="data-message" role="status">{message}</p>}
    </section>
  );
};
