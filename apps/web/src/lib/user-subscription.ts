/** Mirrors `/users/me` → `subscription` from the Nest API (see `SubscriptionService.mergeDashboardState`). */
export type UserSubscriptionState = {
  storedTier: string;
  effectiveTier: string;
  subscriptionEndsAt: string | null;
  planChosenAt: string | null;
  ymUtc: string;
  engagementStats: boolean;
  limits: {
    listsCreatedThisMonthMax: number | null;
    prospectsAddedThisMonthMax: number | null;
    campaignDraftsThisMonthMax: number | null;
    emailsSentThisMonthMax: number | null;
    finderUrlsThisMonthMax: number | null;
    mailboxSyncThisMonthMax: number | null;
    emailAccountsMax: number | null;
    foldersMax: number | null;
    templatesMax: number | null;
    campaignSendersMax: number | null;
  };
  usage: {
    listsCreatedThisMonth: number;
    prospectsAddedThisMonth: number;
    campaignDraftsThisMonth: number;
    emailsSentThisMonth: number;
    finderUrlsUsedThisMonth: number;
    mailboxSyncThisMonth: number;
  };
  banners: {
    monthlyEmailsExhausted: boolean;
    nearMonthlyEmailCap: boolean;
  };
};

export type UsersMePayload = {
  id: string;
  email: string;
  name: string | null;
  trashRetentionDays: number;
  themePreference?: string;
  trashToggles?: unknown;
  subscriptionTier: string;
  subscriptionEndsAt: string | null;
  planChosenAt: string | null;
  subscription: UserSubscriptionState;
};
