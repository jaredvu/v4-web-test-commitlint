export enum LocalStorageKey {
  // Onboarding / Accounts
  EvmAddress = 'dydx.EvmAddress',
  DydxAddress = 'dydx.DydxAddress',
  OnboardingSelectedWalletType = 'dydx.OnboardingSelectedWalletType',
  WalletConnectionType = 'dydx.WalletConnectionType',
  OnboardingHasAcknowledgedTerms = 'dydx.OnboardingHasAcknowledgedTerms',
  EvmDerivedAddresses = 'dydx.EvmDerivedAddresses',

  // Notifications
  Notifications = 'dydx.Notifications',
  NotificationsLastUpdated = 'dydx.NotificationsLastUpdated',
  PushNotificationsEnabled = 'dydx.PushNotificationsEnabled',
  PushNotificationsLastUpdated = 'dydx.PushNotificationsLastUpdated',
  TransferNotifications = 'dydx.TransferNotifications',
  NotificationPreferences = 'dydx.NotificationPreferences',

  // UI State
  LastViewedMarket = 'dydx.LastViewedMarket',
  SelectedLocale = 'dydx.SelectedLocale',
  SelectedNetwork = 'dydx.SelectedNetwork',
  SelectedTheme = 'dydx.SelectedTheme',
  SelectedColorMode = 'dydx.SelectedColorMode',
  SelectedTradeLayout = 'dydx.SelectedTradeLayout',
  TradingViewChartConfig = 'dydx.TradingViewChartConfig',
  HasSeenLaunchIncentives = 'dydx.HasSeenLaunchIncentives',
}

export const LOCAL_STORAGE_VERSIONS = {
  [LocalStorageKey.EvmDerivedAddresses]: 'v2',
  [LocalStorageKey.NotificationPreferences]: 'v1',
  [LocalStorageKey.TransferNotifications]: 'v1',
  [LocalStorageKey.Notifications]: 'v1',
  // TODO: version all localStorage keys
};
