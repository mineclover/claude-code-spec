import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { MockSessionDataSource } from './data/mockDataSource';
import './styles.css';

const dataSource = new MockSessionDataSource();

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('#root element not found in index.html');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App dataSource={dataSource} />
  </React.StrictMode>,
);
