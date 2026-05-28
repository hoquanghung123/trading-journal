/**
 * Safely parses the RCLONE_CONFIG_ONEDRIVE INI-style string.
 */
export function parseRcloneConfig(configStr: string): Record<string, string> | null {
  if (!configStr) return null;
  const config: Record<string, string> = {};
  const lines = configStr.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("[") || trimmed.startsWith("#") || trimmed.startsWith(";")) {
      continue;
    }
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      config[key] = val;
    }
  }
  return config;
}

/**
 * Syncs a file byte array to OneDrive in the background using Microsoft Graph API.
 */
export async function syncToOneDrive(
  path: string,
  data: Uint8Array,
  contentType: string,
  rcloneConfigStr: string
): Promise<void> {
  try {
    const config = parseRcloneConfig(rcloneConfigStr);
    if (!config || !config.token || !config.drive_id) {
      console.warn("syncToOneDrive: Missing or incomplete RCLONE_CONFIG_ONEDRIVE environment variable (requires at least token and drive_id).");
      return;
    }

    const clientId = config.client_id || "b15665d9-eda6-4092-8539-0eec376afd59";
    const clientSecret = config.client_secret || "qtyfaBBYA403=unZUP40~_#";

    let tokenObj: any;
    try {
      tokenObj = JSON.parse(config.token);
    } catch (e: any) {
      console.error("syncToOneDrive: Failed to parse token JSON:", e.message);
      return;
    }

    const refreshToken = tokenObj.refresh_token;
    if (!refreshToken) {
      console.error("syncToOneDrive: Missing refresh_token in token JSON.");
      return;
    }

    // 1. Refresh Microsoft Graph OAuth Access Token
    const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error(`syncToOneDrive: Failed to refresh Microsoft token: ${tokenResponse.status} ${errText}`);
      return;
    }

    const tokenData = (await tokenResponse.json()) as any;
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      console.error("syncToOneDrive: No access_token returned from Microsoft.");
      return;
    }

    // 2. Upload file to OneDrive via Microsoft Graph API
    // OneDrive path in our daily backup is: onedrive:trading-journal-backups/r2_charts/
    const uploadUrl = `https://graph.microsoft.com/v1.0/drives/${config.drive_id}/root:/trading-journal-backups/r2_charts/${path}:/content`;

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": contentType,
      },
      body: data,
    });

    if (uploadResponse.ok) {
      console.log(`syncToOneDrive: Successfully synced ${path} to OneDrive!`);
    } else {
      const errText = await uploadResponse.text();
      console.error(`syncToOneDrive: Failed to upload ${path} to OneDrive: ${uploadResponse.status} ${errText}`);
    }
  } catch (error: any) {
    console.error("syncToOneDrive: Unexpected error during sync:", error.message);
  }
}
