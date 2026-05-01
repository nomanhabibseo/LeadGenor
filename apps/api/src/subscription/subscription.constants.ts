import type { SubscriptionTier } from '@prisma/client';

export const PLAN_PRICE_USD = {
  PRO: '12.99',
  BUSINESS: '29.99',
} as const;

export const PAYMENT_WHATSAPP_E164_PK = process.env.PAYMENT_WHATSAPP_DISPLAY || '03211174453';

/** UI + webhook copy; Pakistani MSISDN for Sadapay. */
export const PAYMENT_CONTACT_DISPLAY = PAYMENT_WHATSAPP_E164_PK;

export interface TierLimitsResolved {
  /** null = unlimited */
  listsPerMonth: number | null;
  prospectsAddedPerMonth: number | null;
  foldersMax: number | null;
  templatesMax: number | null;
  emailAccountsMax: number | null;
  campaignsDraftsPerMonth: number | null;
  sendersPerCampaign: number | null;
  mainSeqStepsMax: number | null;
  followUpSeqStepsMax: number | null;
  emailsSentPerMonth: number | null;
  finderUrlsPerMonth: number | null;
  mailboxSyncsPerMonth: number | null;
  maxRecipientsPerCampaignList: number | null;
  engagementStats: boolean;
}

export function resolvedLimits(storedTier: SubscriptionTier, effectiveTier: SubscriptionTier): TierLimitsResolved {
  void storedTier;
  if (effectiveTier === 'BUSINESS') {
    return {
      listsPerMonth: null,
      prospectsAddedPerMonth: null,
      foldersMax: null,
      templatesMax: null,
      emailAccountsMax: null,
      campaignsDraftsPerMonth: null,
      sendersPerCampaign: null,
      mainSeqStepsMax: null,
      followUpSeqStepsMax: null,
      emailsSentPerMonth: null,
      finderUrlsPerMonth: null,
      mailboxSyncsPerMonth: null,
      maxRecipientsPerCampaignList: null,
      engagementStats: true,
    };
  }
  if (effectiveTier === 'PRO') {
    return {
      listsPerMonth: null,
      prospectsAddedPerMonth: null,
      foldersMax: null,
      templatesMax: null,
      emailAccountsMax: null,
      campaignsDraftsPerMonth: null,
      sendersPerCampaign: null,
      mainSeqStepsMax: null,
      followUpSeqStepsMax: null,
      emailsSentPerMonth: 15_000,
      finderUrlsPerMonth: 3000,
      mailboxSyncsPerMonth: null,
      maxRecipientsPerCampaignList: null,
      engagementStats: true,
    };
  }
  return {
    listsPerMonth: 1,
    prospectsAddedPerMonth: 100,
    foldersMax: 1,
    templatesMax: 4,
    emailAccountsMax: 2,
    campaignsDraftsPerMonth: 1,
    sendersPerCampaign: 2,
    mainSeqStepsMax: 2,
    followUpSeqStepsMax: 1,
    emailsSentPerMonth: 100,
    finderUrlsPerMonth: 30,
    mailboxSyncsPerMonth: 2,
    maxRecipientsPerCampaignList: 100,
    engagementStats: false,
  };
}
