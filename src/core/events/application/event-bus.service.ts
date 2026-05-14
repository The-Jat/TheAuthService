import {
  Inject,
  Injectable,
} from '@nestjs/common';

import type { EventBus } from '../domain/event-bus';

import { DomainEvent } from '../domain/domain-event';

@Injectable()
export class EventBusService {
  constructor(
    @Inject('EventBus')
    private eventBus: EventBus,
  ) {}

  async publish<T>(
    event: DomainEvent<T>,
  ) {
    return this.eventBus.publish(event);
  }
}