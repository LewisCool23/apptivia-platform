import React from 'react';
import { createRoot } from 'react-dom/client';
import ApptiviaScorecard from './ApptiviaScorecard.tsx';
import './index.css';

const root = createRoot(document.getElementById('root'));
root.render(<ApptiviaScorecard />);
