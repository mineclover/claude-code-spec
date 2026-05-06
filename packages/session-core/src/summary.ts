/**
 * Sub-path entry that re-exports the summary schemas (host-only).
 *
 * Kept off the main barrel because it pulls zod into the consuming bundle;
 * the renderer needs only the type, which is exported from session-core's
 * default entry. Bun-side / Node-side consumers (cli-runner, electron host)
 * import from `@context-action/session-core/summary`.
 */

export {
  SummaryDecisionSchema,
  SummaryReferenceSchema,
  SummaryOpenItemSchema,
  SummaryNextActionSchema,
  SummaryCacheInvariantsSchema,
  SummaryModelOutputSchema,
  SummaryResultSchema,
  type SummaryModelOutput,
} from './summary/schema';
