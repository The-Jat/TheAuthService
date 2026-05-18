export interface DomainEvent<T = any> {
  event: string;

  correlationId?: string;

  timestamp: string;

  service: string;

  requestId?: string;

  data: T;
}