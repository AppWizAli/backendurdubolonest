import { Module } from '@nestjs/common';
import { AuditModule } from '../common/audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LegacyModule } from '../legacy/legacy.module';
import { AdminToolsController } from './admin-tools.controller';
import { AdminToolsService } from './admin-tools.service';

@Module({ imports: [PrismaModule, AuditModule, LegacyModule], controllers: [AdminToolsController], providers: [AdminToolsService] })
export class AdminToolsModule {}
