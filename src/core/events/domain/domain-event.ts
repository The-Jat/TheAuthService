export interface DomainEvent<T = any> {
  event: string;

  timestamp: string;

  service: string;

  requestId?: string;

  data: T;
}