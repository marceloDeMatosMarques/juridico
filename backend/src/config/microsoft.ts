export const microsoftConfig = {
  clientId: process.env.MICROSOFT_CLIENT_ID ?? '',
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
  tenantId: process.env.MICROSOFT_TENANT_ID ?? 'common',
  redirectUri: process.env.MICROSOFT_REDIRECT_URI ?? '',
  scopes: (process.env.MICROSOFT_SCOPES ?? 'Files.ReadWrite.All Calendars.ReadWrite Mail.Read offline_access User.Read').split(' '),
}

export const MS_TOKEN_URL = `https://login.microsoftonline.com/${microsoftConfig.tenantId}/oauth2/v2.0/token`
export const MS_AUTH_URL = `https://login.microsoftonline.com/${microsoftConfig.tenantId}/oauth2/v2.0/authorize`
