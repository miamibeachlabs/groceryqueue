import { render } from 'preact';
import { App } from './ui/App.tsx';

const root = document.querySelector('#app');
if (!root) throw new Error('Missing application root');

render(<App />, root);
