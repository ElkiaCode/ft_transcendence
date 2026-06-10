import {
  Controller,
  Delete,
  Param,
  Post,
  UseGuards,
  Get,
} from '@nestjs/common';
import { RelationshipsService } from './relationships.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';

@Controller('relationships')
@UseGuards(JwtAuthGuard)
export class RelationshipsController {
  constructor(private readonly relationshipsService: RelationshipsService) {}

  @Post('users/:id/friend-request')
  sendFriendRequest(
    @Param('id') targetUserId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.relationshipsService.sendFriendRequest(actor.sub, targetUserId);
  }

  @Post('users/:id/friend-accept')
  acceptFriendRequest(
    @Param('id') requesterUserId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.relationshipsService.acceptFriendRequest(
      actor.sub,
      requesterUserId,
    );
  }

  @Delete('users/:id/remove-friend')
  removeFriend(
    @Param('id') targetUserId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.relationshipsService.removeFriend(actor.sub, targetUserId);
  }

  @Post('users/:id/block')
  blockUser(
    @Param('id') targetUserId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.relationshipsService.blockUser(actor.sub, targetUserId);
  }

  @Delete('users/:id/unblock')
  unblockUser(
    @Param('id') targetUserId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.relationshipsService.unblockUser(actor.sub, targetUserId);
  }

  @Get('requests/incoming')
  incomingRequests(@CurrentUser() actor: JwtPayload) {
    return this.relationshipsService.getIncomingFriendRequests(actor.sub);
  }

  @Get('requests/outgoing')
  outgoingRequests(@CurrentUser() actor: JwtPayload) {
    return this.relationshipsService.getOutGoingFriendRequests(actor.sub);
  }
}
