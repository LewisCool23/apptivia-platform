import React from 'react';
import { createRoot } from 'react-dom/client';
import ApptiviaScorecard from './ApptiviaScorecard';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container missing in index.html');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <ApptiviaScorecard />
  </React.StrictMode>
);
