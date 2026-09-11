import { render } from 'preact';
import { monthSimulation, thousandCycleSimulation } from './MonthSimulation.ts';
import './styles.css';

const number = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
const simulations = monthSimulation();
const longRun = thousandCycleSimulation();

const App = () => (
  <main>
    <header>
      <p class="eyebrow">DEVELOPMENT SCENARIO</p>
      <h1>One month in the pantry.</h1>
      <p>Deterministic counts and purchases, evaluated at the end of day 31.</p>
    </header>

    <section class="summary" aria-label="Month-end estimates">
      {simulations.map(({ name, estimate, tracker, actionsEntered }) => (
        <article>
          <h2>{name}</h2>
          <strong>{number.format(estimate.daysLeft)} days left</strong>
          <dl>
            <div><dt>Amount</dt><dd>{number.format(estimate.amount)}</dd></div>
            <div><dt>Used per day</dt><dd>{number.format(estimate.dailyUse)}</dd></div>
            <div><dt>Purchase cycle</dt><dd>{number.format(estimate.restockCycleDays)} days</dd></div>
            <div><dt>Actions entered</dt><dd>{actionsEntered}</dd></div>
            <div><dt>Tracker size</dt><dd>{JSON.stringify(tracker).length} bytes</dd></div>
          </dl>
        </article>
      ))}
    </section>

    <section class="proof">
      <h2>After 1,000 purchase cycles</h2>
      <p>
        The tracker is still {JSON.stringify(longRun).length} bytes and remembers exactly{' '}
        {longRun.cadence.intervals.length} recent purchase intervals.
      </p>
    </section>

    <section>
      <h2>Constant-space state retained</h2>
      <p>Every action is folded into this bounded summary. No event ledger is kept.</p>
      <div class="histories">
        {simulations.map(({ name, tracker }) => (
          <article>
            <h3>{name}</h3>
            <pre>{JSON.stringify(tracker, null, 2)}</pre>
          </article>
        ))}
      </div>
    </section>
  </main>
);

const root = document.querySelector('#simulation');
if (!root) throw new Error('Missing simulation root');
render(<App />, root);
