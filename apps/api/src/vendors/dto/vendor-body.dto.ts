import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { DealStatus, PaymentTerms, SeoLinkAttribute, TatUnit } from '@prisma/client';

/** Required: siteUrl, nicheIds, countryIds, contactEmail (one or more); rest optional (defaults in service). */
export class VendorBodyDto {
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsString()
  @IsNotEmpty()
  siteUrl!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  nicheIds!: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  traffic?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  countryIds!: string[];

  @IsOptional()
  @IsString()
  languageId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  dr?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  mozDa?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  authorityScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  referringDomains?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  backlinks?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  trustFlow?: number;

  @IsOptional()
  @IsEnum(SeoLinkAttribute)
  seoLinkAttribute?: SeoLinkAttribute;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  seoLinkQuantity?: number;

  @IsOptional()
  @IsEnum(TatUnit)
  tatUnit?: TatUnit;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  tatValue?: number;

  @IsOptional()
  @IsString()
  currencyId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  guestPostCost?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  nicheEditCost?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  guestPostPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  nicheEditPrice?: number;

  @IsOptional()
  @IsEnum(PaymentTerms)
  paymentTerms?: PaymentTerms;

  @ValidateIf((o: VendorBodyDto) => o.paymentTerms === PaymentTerms.AFTER_LIVE_LINK)
  @IsOptional()
  @IsString()
  afterLiveOptionId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  paymentMethodIds?: string[];

  /** One or more emails, separated by comma, semicolon, or newline. */
  @IsString()
  @IsNotEmpty()
  contactEmail!: string;

  @IsOptional()
  @IsString()
  contactPageUrl?: string;

  @IsOptional()
  @IsEnum(DealStatus)
  dealStatus?: DealStatus;

  @IsOptional()
  @IsDateString()
  recordDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
