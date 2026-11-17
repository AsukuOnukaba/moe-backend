export type ApprovePayoutAmountBody = {
  approvedAmount: number;
  currency?: string;
  reason?: string;
  exceptionApproved?: boolean;
  exceptionReason?: string;
};

export type MarkFundingNotRequiredBody = {
  reason: string;
};

export type RecordPayoutTransferBody = {
  amount: number;
  currency?: string;
  transferDate: string;
  payeeName: string;
  payeeDetails?: string;
  externalReference: string;
};

export type VerifyPayoutTransferBody = {
  notes: string;
};

export type DisputePayoutBody = {
  notes: string;
  transferId?: number;
  reverse?: boolean;
};
