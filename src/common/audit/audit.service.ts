import { Injectable } from '@nestjs/common';
import { AuditOutcome, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditListDto } from './audit.dto';

export interface AuditInput {
  actorId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  outcome: AuditOutcome;
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput): Promise<void> {
    await this.prisma.auditEvent.create({ data: input });
  }

  async write(input: AuditInput): Promise<void> {
    await this.record(input);
  }

  async list(query: AuditListDto) {
    const where: Prisma.AuditEventWhereInput = {
      ...(query.outcome ? { outcome: query.outcome as AuditOutcome } : {}),
      ...(query.search ? { OR: [{ action: { contains: query.search.trim(), mode: 'insensitive' } }, { resource: { contains: query.search.trim(), mode: 'insensitive' } }, { requestId: { contains: query.search.trim(), mode: 'insensitive' } }] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditEvent.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit, select: { id: true, actorId: true, action: true, resource: true, resourceId: true, outcome: true, requestId: true, ipAddress: true, metadata: true, createdAt: true, actor: { select: { username: true, email: true } } } }),
      this.prisma.auditEvent.count({ where }),
    ]);
    return { items, page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) };
  }
}
