import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** Required: siteUrl, nicheIds, countryIds, email (one or more); rest optional with service defaults. */
export class ClientBodyDto {
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsString()
  siteUrl!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  nicheIds!: string[];

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
  @Type(() => Number)
  traffic?: number;

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

  /** One or more emails, separated by comma, semicolon, or newline. */
  @IsString()
  email!: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;
}
