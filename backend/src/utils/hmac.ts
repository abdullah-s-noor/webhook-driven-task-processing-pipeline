import { createHmac, timingSafeEqual } from "crypto";

function createSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function signPayload(payload: string, secret: string): string {
  return createSignature(payload, secret);
}

export function verifySignature(
  payload: string,
  secret: string,
  signature: string
): boolean {
  const expectedSignature = createSignature(payload, secret);
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const actualBuffer = Buffer.from(signature, "hex");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}
