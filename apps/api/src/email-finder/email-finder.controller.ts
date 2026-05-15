import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { SubscriptionService } from '../subscription/subscription.service';
import { EmailFinderService } from './email-finder.service';

class FindFromUrlDto {
  @IsString()
  @MaxLength(2048)
  url!: string;
}

class FindBulkDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  urls!: string[];
}

@Controller('email-finder')
@UseGuards(JwtAuthGuard)
export class EmailFinderController {
  constructor(
    private readonly finder: EmailFinderService,
    private readonly subscription: SubscriptionService,
  ) {}

  @Post('from-url')
  async fromUrl(@CurrentUser() user: JwtUser, @Body() body: FindFromUrlDto) {
    await this.subscription.assertAndReserveFinderUrls(user.userId, [body.url]);
    const r = await this.finder.findEmailsFromSiteUrl(body.url);
    if (r.ok) return { emails: r.emails };
    if (r.reason === 'not_found') return { emails: [], notFound: true };
    return { emails: [], notFound: true };
  }

  @Post('from-urls')
  async fromUrls(@CurrentUser() user: JwtUser, @Body() body: FindBulkDto) {
    await this.subscription.assertAndReserveFinderUrls(user.userId, body.urls ?? []);
    const urls = body.urls ?? [];
    const out: { url: string; emails: string[]; notFound: boolean }[] = [];
    const chunk = 4;
    for (let i = 0; i < urls.length; i += chunk) {
      const slice = urls.slice(i, i + chunk);
      const part = await Promise.all(
        slice.map(async (url) => {
          const r = await this.finder.findEmailsFromSiteUrl(url);
          if (r.ok) return { url, emails: r.emails, notFound: r.emails.length === 0 };
          return { url, emails: [], notFound: true };
        }),
      );
      out.push(...part);
    }
    return { results: out };
  }
}

