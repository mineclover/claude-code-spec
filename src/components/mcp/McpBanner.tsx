/**
 * McpBanner — small informational banner shown at the top of MCP-related pages
 * to clarify the relationship between the legacy file-based MCP config system
 * and the newer Registry + Policy + Compose-override model.
 *
 * Dismissal is shared across all MCP pages via a single localStorage key
 * (`mcp-banner-dismissed`). Once any page is dismissed the banner stays hidden
 * on all pages, and the preference persists across reloads.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './McpBanner.module.css';

const STORAGE_KEY = 'mcp-banner-dismissed';

export interface McpBannerProps {
  variant: 'legacy' | 'new';
  linkTo: string;
  linkLabel: string;
  text: string;
}

export function McpBanner({ variant, linkTo, linkLabel, text }: McpBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY);
      setVisible(dismissed !== 'true');
    } catch {
      // localStorage unavailable (e.g. privacy mode); default to showing the banner
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore write failures; still hide for this session
    }
    setVisible(false);
  };

  if (!visible) return null;

  const variantClass = variant === 'legacy' ? styles.legacy : styles.new;

  return (
    <div className={`${styles.banner} ${variantClass}`} role="note">
      <span className={styles.text}>
        {text}
        <Link to={linkTo} className={styles.link}>
          {linkLabel}
        </Link>
      </span>
      <button
        type="button"
        className={styles.dismiss}
        onClick={handleDismiss}
        aria-label="Dismiss banner"
      >
        ×
      </button>
    </div>
  );
}
