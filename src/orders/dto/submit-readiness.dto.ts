export type StandardReadinessPayload = {
  productAvailable: boolean;
  exactSpecMatch: boolean;
  quantityConfirmed: boolean;
  canFulfil: boolean;
  estimatedDispatchDate: string;
  fulfilmentIssue?: string | null;
};

export type DetailedReadinessPayload = {
  workDescription: string;
  specificationsConfirmed: boolean;
  dimensionsNotes?: string | null;
  materialsRequired: string;
  equipmentRequired: string;
  skillsConfirmed: boolean;
  capacityConfirmed: boolean;
  estimatedMaterialCost: number;
  proposedProductionDays: number;
  productionSteps: string[];
  limitations?: string | null;
  matchesCustomerRequirements: boolean;
};

export type SubmitReadinessBody = {
  cannotFulfil?: boolean;
  cannotFulfilReason?: string;
  acknowledgedRequirements?: boolean;
  reviewedRequirementsAt?: string;
  payload?: StandardReadinessPayload | DetailedReadinessPayload | Record<string, unknown>;
  /** When revising after changes_requested, client may omit and server creates next version. */
  clientKey?: string;
};

export type AdminReadinessDecisionBody = {
  decision: 'approve' | 'request_changes' | 'reject';
  reason?: string;
};

export type AdminExtendDeadlineBody = {
  extraHours: number;
  reason: string;
};
