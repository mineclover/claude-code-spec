import type React from 'react';
import { useState } from 'react';
import styles from './RawDataActions.module.css';

interface RawDataActionsProps {
  rawData: unknown;
}

export const RawDataActions: React.FC<RawDataActionsProps> = ({ rawData }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyRaw = async () => {
    try {
      const rawJson = JSON.stringify(rawData, null, 2);
      await navigator.clipboard.writeText(rawJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy raw data:', err);
    }
  };

  const handleViewRaw = () => {
    const rawJson = JSON.stringify(rawData, null, 2);
    const popup = window.open('', '_blank', 'width=800,height=600');

    if (popup) {
      popup.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Raw Event Data</title>
            <style>
              body {
                margin: 0;
                padding: 20px;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                background-color: #1e1e1e;
                color: #d4d4d4;
              }
              pre {
                margin: 0;
                white-space: pre-wrap;
                word-wrap: break-word;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 10px;
                border-bottom: 1px solid #444;
              }
              .title {
                font-size: 18px;
                font-weight: 600;
              }
              .copy-button {
                padding: 6px 12px;
                background: #0e639c;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
              }
              .copy-button:hover {
                background: #1177bb;
              }
              .copy-button:active {
                background: #0d5a8f;
              }
              .copied {
                background: #14892c;
              }
              .copied:hover {
                background: #16a34a;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">Raw Event Data</div>
              <button class="copy-button" onclick="copyToClipboard()">Copy</button>
            </div>
            <pre id="json-content">${rawJson.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
            <script>
              function copyToClipboard() {
                const button = document.querySelector('.copy-button');
                const text = document.getElementById('json-content').textContent;
                navigator.clipboard.writeText(text).then(() => {
                  button.textContent = '✓ Copied';
                  button.classList.add('copied');
                  setTimeout(() => {
                    button.textContent = 'Copy';
                    button.classList.remove('copied');
                  }, 2000);
                }).catch(err => {
                  console.error('Failed to copy:', err);
                });
              }
            </script>
          </body>
        </html>
      `);
      popup.document.close();
    }
  };

  return (
    <div className={styles.rawActions}>
      <button
        type="button"
        className={styles.rawButton}
        onClick={handleCopyRaw}
        title="Copy raw event data to clipboard"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
      <button
        type="button"
        className={styles.rawButton}
        onClick={handleViewRaw}
        title="View raw event data in new window"
      >
        View
      </button>
    </div>
  );
};
