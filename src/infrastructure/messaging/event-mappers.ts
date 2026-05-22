import { randomUUID } from "node:crypto";

import {
  EmailVerificationRequested,
  EmailVerified,
  PasswordChanged,
  PasswordResetRequested,
  RoleChanged,
  UserRegistered,
} from "../../domain/user/events.js";
import type { DomainEvent } from "../../domain/shared/domain-event.js";

export interface OutboundEvent {
  routingKey: string;
  envelope: Record<string, unknown>;
}

const PRODUCER = "auth-service";

function envelope(
  eventType: string,
  occurredAt: Date,
  correlationId: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  return {
    eventId: randomUUID(),
    eventType,
    eventVersion: "1.0",
    occurredAt: occurredAt.toISOString(),
    correlationId,
    producer: PRODUCER,
    data,
  };
}

export function mapDomainEvent(
  e: DomainEvent,
  correlationId: string,
): OutboundEvent {
  if (e instanceof UserRegistered) {
    return {
      routingKey: "user.registered",
      envelope: envelope("user.registered", e.occurredAt, correlationId, {
        userId: e.userId,
        email: e.email.value,
        role: e.role,
      }),
    };
  }
  if (e instanceof EmailVerificationRequested) {
    return {
      routingKey: "user.email_verification_requested",
      envelope: envelope(
        "user.email_verification_requested",
        e.occurredAt,
        correlationId,
        {
          userId: e.userId,
          email: e.email.value,
          verificationToken: e.tokenPlain,
          expiresAt: e.expiresAt.toISOString(),
        },
      ),
    };
  }
  if (e instanceof EmailVerified) {
    return {
      routingKey: "user.email_verified",
      envelope: envelope("user.email_verified", e.occurredAt, correlationId, {
        userId: e.userId,
        email: e.email.value,
        verifiedAt: e.verifiedAt.toISOString(),
      }),
    };
  }
  if (e instanceof PasswordResetRequested) {
    return {
      routingKey: "user.password_reset_requested",
      envelope: envelope(
        "user.password_reset_requested",
        e.occurredAt,
        correlationId,
        {
          userId: e.userId,
          email: e.email.value,
          resetToken: e.tokenPlain,
          expiresAt: e.expiresAt.toISOString(),
        },
      ),
    };
  }
  if (e instanceof PasswordChanged) {
    return {
      routingKey: "user.password_changed",
      envelope: envelope("user.password_changed", e.occurredAt, correlationId, {
        userId: e.userId,
        email: e.email.value,
        changedAt: e.changedAt.toISOString(),
      }),
    };
  }
  if (e instanceof RoleChanged) {
    return {
      routingKey: "user.role_changed",
      envelope: envelope("user.role_changed", e.occurredAt, correlationId, {
        userId: e.userId,
        oldRole: e.oldRole,
        newRole: e.newRole,
        changedBy: e.changedBy,
        changedAt: e.changedAt.toISOString(),
      }),
    };
  }
  throw new Error(
    `No mapping registered for event type ${(e as { eventType?: string }).eventType ?? "<unknown>"}`,
  );
}
