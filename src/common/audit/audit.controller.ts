import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/permissions.decorator';
import { AuditListDto } from './audit.dto';
import { AuditService } from './audit.service';

@ApiTags('Audit logs')
@ApiBearerAuth()
@Controller('api/v1/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Permissions('audit.read')
  list(@Query() query: AuditListDto) { return this.audit.list(query); }
}
