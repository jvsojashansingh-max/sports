import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { RequestUser } from '../../common/auth/request-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAction } from '../../common/decorators/require-action.decorator';
import { RequireIdempotency } from '../../common/decorators/require-idempotency.decorator';
import { ChatService } from './chat.service';
import {
  DeleteMessageDto,
  ListMessagesQueryDto,
  MuteParticipantDto,
  ReportMessageDto,
  ReviewMessageReportDto,
  SendMessageDto,
} from './chat.dto';
import { MessageReportStatus } from '@prisma/client';

@Controller()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @RequireAction('conversation.list')
  listConversations(@CurrentUser() user: RequestUser) {
    return this.chatService.listConversations(user);
  }

  @Post('venues/:venueId/support-conversation')
  @RequireAction('conversation.support.open')
  @RequireIdempotency()
  openVenueSupportConversation(@CurrentUser() user: RequestUser, @Param('venueId') venueId: string) {
    return this.chatService.openVenueSupportConversation(user, venueId);
  }

  @Get('conversations/:id/messages')
  @RequireAction('conversation.messages.read')
  listMessages(
    @CurrentUser() user: RequestUser,
    @Param('id') conversationId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.chatService.listMessages(user, conversationId, query);
  }

  @Post('conversations/:id/messages')
  @RequireAction('conversation.messages.send')
  @RequireIdempotency()
  sendMessage(
    @CurrentUser() user: RequestUser,
    @Param('id') conversationId: string,
    @Body() body: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user, conversationId, body);
  }

  @Post('vendor/conversations/:id/mute')
  @RequireAction('conversation.moderate')
  @RequireIdempotency()
  muteParticipant(
    @CurrentUser() user: RequestUser,
    @Param('id') conversationId: string,
    @Body() body: MuteParticipantDto,
  ) {
    return this.chatService.muteParticipant(user, conversationId, body);
  }

  @Post('vendor/messages/:id/delete')
  @RequireAction('conversation.moderate')
  @RequireIdempotency()
  deleteMessageByModerator(
    @CurrentUser() user: RequestUser,
    @Param('id') messageId: string,
    @Body() body: DeleteMessageDto,
  ) {
    return this.chatService.deleteMessageByModerator(user, messageId, body);
  }

  @Post('messages/:id/report')
  @RequireAction('message.report')
  @RequireIdempotency()
  reportMessage(
    @CurrentUser() user: RequestUser,
    @Param('id') messageId: string,
    @Body() body: ReportMessageDto,
  ) {
    return this.chatService.reportMessage(user, messageId, body);
  }

  @Get('admin/message-reports')
  @RequireAction('message.report.review')
  listMessageReports(@Query('status') status?: MessageReportStatus) {
    return this.chatService.listMessageReports(status);
  }

  @Post('admin/message-reports/:id/review')
  @RequireAction('message.report.review')
  @RequireIdempotency()
  reviewMessageReport(
    @CurrentUser() user: RequestUser,
    @Param('id') reportId: string,
    @Body() body: ReviewMessageReportDto,
  ) {
    return this.chatService.reviewMessageReport(user, reportId, body);
  }
}
