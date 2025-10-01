import type React from 'react';
import { Component, type ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: React.ErrorInfo) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleCopyError = async () => {
    const { error, errorInfo } = this.state;
    const errorText = `
Error: ${error?.message || 'Unknown error'}

Stack Trace:
${error?.stack || 'No stack trace'}

Component Stack:
${errorInfo?.componentStack || 'No component stack'}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorText);
      alert('Error details copied to clipboard');
    } catch (err) {
      console.error('Failed to copy error:', err);
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.state.errorInfo!);
      }

      return (
        <div className={styles.errorBoundary}>
          <div className={styles.errorHeader}>
            <h2 className={styles.errorTitle}>⚠️ Rendering Error</h2>
            <div className={styles.errorActions}>
              <button
                type="button"
                className={styles.errorButton}
                onClick={this.handleCopyError}
              >
                Copy Error
              </button>
              <button
                type="button"
                className={styles.errorButton}
                onClick={this.handleReset}
              >
                Reset
              </button>
            </div>
          </div>

          <div className={styles.errorContent}>
            <div className={styles.errorSection}>
              <h3 className={styles.errorSectionTitle}>Error Message</h3>
              <pre className={styles.errorMessage}>{this.state.error?.message}</pre>
            </div>

            <details className={styles.errorDetails}>
              <summary className={styles.errorDetailsSummary}>Stack Trace</summary>
              <pre className={styles.errorStack}>{this.state.error?.stack}</pre>
            </details>

            <details className={styles.errorDetails}>
              <summary className={styles.errorDetailsSummary}>Component Stack</summary>
              <pre className={styles.errorStack}>
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          </div>

          <div className={styles.errorFooter}>
            <p className={styles.errorHint}>
              💡 This error was caught by ErrorBoundary to prevent the entire app from
              crashing. Click "Reset" to try rendering again or "Copy Error" to report the
              issue.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
