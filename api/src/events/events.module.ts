import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventAuditLog } from './entities/event-audit-log.entity';
import { EventsSubscriber } from './events.subscriber';

@Module({
  imports: [TypeOrmModule.forFeature([EventAuditLog])],
  providers: [EventsSubscriber],
  exports: [TypeOrmModule, EventsSubscriber],
})
export class EventsModule {}
