import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { LinkType, OrderStatus, PaymentTerms } from '@prisma/client';

export class OrderBodyDto {
  @IsString()
  clientId!: string;

  @IsString()
  vendorId!: string;

  @IsEnum(LinkType)
  linkType!: LinkType;

  @IsBoolean()
  articleWriting!: boolean;

  @IsOptional()
  @Type(() => Number)
  articleWritingFeeUsd?: number;

  @IsEnum(PaymentTerms)
  paymentTerms!: PaymentTerms;

  @IsInt()
  @Min(1)
  @Max(30)
  @Type(() => Number)
  deliveryDays!: number;

  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsDateString()
  orderDate!: string;

  /** Optional; one or more emails (comma / newline). Defaults from client record. */
  @IsOptional()
  @IsString()
  clientEmail?: string;

  @IsOptional()
  @IsString()
  paymentMethodNote?: string;
}
