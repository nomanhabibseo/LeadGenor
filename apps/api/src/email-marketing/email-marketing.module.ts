import { Module } from '@nestjs/common';
import { CampaignReplyDetectionService } from './campaign-reply-detection.service';
import { CampaignSendService } from './campaign-send.service';
import { EmailAccountsController } from './email-accounts.controller';
import { EmailAccountsService } from './email-accounts.service';
import { EmailCampaignsController } from './email-campaigns.controller';
import { EmailCampaignsService } from './email-campaigns.service';
import { EmailInboxController } from './email-inbox.controller';
import { EmailImapSyncService } from './email-imap-sync.service';
import { EmailInboxService } from './email-inbox.service';
import { EmailOAuthMailService } from './email-oauth-mail.service';
import { EmailListsController } from './email-lists.controller';
import { EmailListsService } from './email-lists.service';
import { EmailTemplatesController } from './email-templates.controller';
import { EmailTemplatesService } from './email-templates.service';
import { ListSyncService } from './list-sync.service';
import { OauthProvidersController } from './oauth-providers.controller';
import { PublicEmailController } from './public-email.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [
    EmailListsController,
    EmailTemplatesController,
    EmailAccountsController,
    EmailCampaignsController,
    EmailInboxController,
    PublicEmailController,
    OauthProvidersController,
  ],
  providers: [
    EmailListsService,
    EmailTemplatesService,
    EmailAccountsService,
    EmailCampaignsService,
    EmailInboxService,
    EmailImapSyncService,
    EmailOAuthMailService,
    CampaignSendService,
    CampaignReplyDetectionService,
    ListSyncService,
  ],
  exports: [EmailListsService, EmailAccountsService, EmailCampaignsService, EmailOAuthMailService],
})
export class EmailMarketingModule {}
