import type React from 'react';
import { SettingsTab } from '../components/settings/SettingsTab';
import styles from './SettingsPage.module.css';

export const SettingsPage: React.FC = () => {
  return (
    <div className={styles.container}>
      <SettingsTab />
    </div>
  );
};
