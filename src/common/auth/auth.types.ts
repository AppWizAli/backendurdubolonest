import { RoleCode, UserStatus } from '@prisma/client';

export interface AuthenticatedPrincipal {
  id: string;
  sessionId: string;
  roles: RoleCode[];
  permissions: string[];
  status: UserStatus;
}
