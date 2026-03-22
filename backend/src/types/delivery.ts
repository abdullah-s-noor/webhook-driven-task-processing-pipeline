export type DeliveryStatus = "pending" | "success" | "failed";

export interface Delivery {
  id: string;
  jobId: string;
  subscriberId: string;
  status: DeliveryStatus;
  attemptCount: number;
  lastAttemptAt: Date | null;
}

export interface DeliveryAttempt {
  id: string;
  deliveryId: string;
  attemptNumber: number;
  statusCode: number | null;
  error: string | null;
  attemptedAt: Date;
}
