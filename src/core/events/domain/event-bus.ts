import { DomainEvent } from './domain-event';

export interface EventBus {
  publish<T>(
    event: DomainEvent<T>,
  ): Promise<void>;
}