/** Hours an artisan has to submit readiness after assignment. */
export const READINESS_RESPONSE_HOURS = 24;
export const READINESS_REMINDER_12H_HOURS = 12;
export const READINESS_REMINDER_20H_HOURS = 20;

/** Configurable high-value threshold (NGN). Override via ORDER_HIGH_VALUE_THRESHOLD_NGN. */
export const DEFAULT_HIGH_VALUE_THRESHOLD_NGN = 150_000;

export const READINESS_WORKFLOW_STATUSES = [
  'awaiting_response',
  'overdue',
  'submitted',
  'under_review',
  'changes_requested',
  'approved',
  'rejected',
  'cannot_fulfil',
] as const;

export type ReadinessWorkflowStatus = (typeof READINESS_WORKFLOW_STATUSES)[number];

export const READINESS_ASSESSMENT_STATUSES = [
  'draft',
  'submitted',
  'changes_requested',
  'approved',
  'rejected',
  'superseded',
  'cannot_fulfil',
] as const;

export type ReadinessAssessmentStatus =
  (typeof READINESS_ASSESSMENT_STATUSES)[number];

/** New Orders (Phase 1) — readiness-active orders still in the artisan intake queue. */
export const NEW_ORDERS_READINESS_STATUSES: ReadinessWorkflowStatus[] = [
  'awaiting_response',
  'overdue',
  'submitted',
  'under_review',
  'changes_requested',
  'approved',
];

export const ADMIN_READINESS_FILTERS = [
  'awaiting_response',
  'overdue',
  'submitted',
  'under_review',
  'changes_requested',
  'approved',
  'rejected',
  'cannot_fulfil',
] as const;

export type AdminReadinessFilter = (typeof ADMIN_READINESS_FILTERS)[number];
