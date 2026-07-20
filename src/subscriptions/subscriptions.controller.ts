import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentPrincipal } from '../common/auth/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { Permissions } from '../common/auth/permissions.decorator';
import { CancelSubscriptionDto, CreatePlanDto, CreateSubscriptionDto, ExtendSubscriptionDto, PaymentDto, SubscriptionHistoryQueryDto, UpdatePlanDto } from './dto/subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('Subscriptions') @ApiBearerAuth() @Controller('api/v1/subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}
  @Get('plans') @Permissions('subscriptions.read') plans() { return this.subscriptions.listPlans(); }
  @Post('plans') @Permissions('subscriptions.write') createPlan(@Body() d: CreatePlanDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.subscriptions.createPlan(d, p, r.requestId!); }
  @Patch('plans/:id') @Permissions('subscriptions.write') updatePlan(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdatePlanDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.subscriptions.updatePlan(id, d, p, r.requestId!); }
  @Get('me') me(@CurrentPrincipal() p: AuthenticatedPrincipal, @Query() q: SubscriptionHistoryQueryDto) { return this.subscriptions.listForUser(p.id, p, q); }
  @Get('users/:userId') @Permissions('subscriptions.read') user(@Param('userId', ParseUUIDPipe) id: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Query() q: SubscriptionHistoryQueryDto) { return this.subscriptions.listForUser(id, p, q); }
  @Post() @Permissions('subscriptions.write') subscribe(@Body() d: CreateSubscriptionDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.subscriptions.subscribe(d, p, r.requestId!); }
  @Post('payments') @Permissions('subscriptions.write') payment(@Body() d: PaymentDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.subscriptions.recordPayment(d, p, r.requestId!); }
  @Post(':id/extend') @Permissions('subscriptions.write') extend(@Param('id', ParseUUIDPipe) id: string, @Body() d: ExtendSubscriptionDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.subscriptions.extend(id, d, p, r.requestId!); }
  @Post(':id/cancel') @Permissions('subscriptions.write') cancel(@Param('id', ParseUUIDPipe) id: string, @Body() d: CancelSubscriptionDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.subscriptions.cancel(id, d, p, r.requestId!); }
  @Get('users/:userId/validate') @Permissions('subscriptions.read') validate(@Param('userId', ParseUUIDPipe) id: string) { return this.subscriptions.validate(id); }
  @Get('validate') validateMe(@CurrentPrincipal() p: AuthenticatedPrincipal) { return this.subscriptions.validate(p.id); }
}
