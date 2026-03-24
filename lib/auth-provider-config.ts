function isNonEmpty(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export type SocialAuthProviderId = "google" | "github" | "discord";

type EnvLike = Record<string, string | undefined> & {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  NEXT_PUBLIC_GOOGLE_AUTH_ENABLED?: string;
  GITHUB_ID?: string;
  GITHUB_SECRET?: string;
  NEXT_PUBLIC_GITHUB_AUTH_ENABLED?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  NEXT_PUBLIC_DISCORD_AUTH_ENABLED?: string;
};

const SOCIAL_AUTH_PROVIDERS: Array<{
  id: SocialAuthProviderId;
  configuredKeys: [keyof EnvLike, keyof EnvLike];
  uiKey: keyof EnvLike;
}> = [
  {
    id: "google",
    configuredKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    uiKey: "NEXT_PUBLIC_GOOGLE_AUTH_ENABLED",
  },
  {
    id: "github",
    configuredKeys: ["GITHUB_ID", "GITHUB_SECRET"],
    uiKey: "NEXT_PUBLIC_GITHUB_AUTH_ENABLED",
  },
  {
    id: "discord",
    configuredKeys: ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET"],
    uiKey: "NEXT_PUBLIC_DISCORD_AUTH_ENABLED",
  },
];

function isProviderConfiguredFromEnv(
  env: EnvLike,
  providerId: SocialAuthProviderId
) {
  const provider = SOCIAL_AUTH_PROVIDERS.find((item) => item.id === providerId);
  if (!provider) return false;

  return provider.configuredKeys.every((key) => isNonEmpty(env[key]));
}

function isProviderUiEnabledFromEnv(
  env: EnvLike,
  providerId: SocialAuthProviderId
) {
  const provider = SOCIAL_AUTH_PROVIDERS.find((item) => item.id === providerId);
  if (!provider) return false;
  return env[provider.uiKey] === "1";
}

export function getConfiguredSocialAuthProvidersFromEnv(env: EnvLike) {
  return SOCIAL_AUTH_PROVIDERS.filter((provider) =>
    isProviderConfiguredFromEnv(env, provider.id)
  ).map((provider) => provider.id);
}

export function getConfiguredSocialAuthProviders() {
  return getConfiguredSocialAuthProvidersFromEnv(process.env);
}

export function getSocialAuthUiProvidersFromEnv(env: EnvLike) {
  return SOCIAL_AUTH_PROVIDERS.filter((provider) =>
    isProviderUiEnabledFromEnv(env, provider.id)
  ).map((provider) => provider.id);
}

export function getSocialAuthUiProviders() {
  return getSocialAuthUiProvidersFromEnv(process.env);
}

export function isGoogleAuthConfiguredFromEnv(env: EnvLike) {
  return isProviderConfiguredFromEnv(env, "google");
}

export function isGoogleAuthConfigured() {
  return isGoogleAuthConfiguredFromEnv(process.env);
}

export function isGoogleAuthUiEnabledFromEnv(env: EnvLike) {
  return isProviderUiEnabledFromEnv(env, "google");
}

export function isGoogleAuthUiEnabled() {
  return isGoogleAuthUiEnabledFromEnv(process.env);
}

export function getGoogleAuthConfigStateFromEnv(env: EnvLike) {
  const configured = isGoogleAuthConfiguredFromEnv(env);
  const uiEnabled = isGoogleAuthUiEnabledFromEnv(env);

  return {
    configured,
    uiEnabled,
    consistent: configured === uiEnabled,
  };
}

export function getGoogleAuthConfigState() {
  return getGoogleAuthConfigStateFromEnv(process.env);
}

export function isGithubAuthConfiguredFromEnv(env: EnvLike) {
  return isProviderConfiguredFromEnv(env, "github");
}

export function isGithubAuthConfigured() {
  return isGithubAuthConfiguredFromEnv(process.env);
}

export function isDiscordAuthConfiguredFromEnv(env: EnvLike) {
  return isProviderConfiguredFromEnv(env, "discord");
}

export function isDiscordAuthConfigured() {
  return isDiscordAuthConfiguredFromEnv(process.env);
}
