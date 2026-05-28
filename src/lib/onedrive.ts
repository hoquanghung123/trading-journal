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

async function logSyncResult(path: string, status: string, errorMessage?: string) {
  try {
    const supabaseUrl = (globalThis as any).SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = (globalThis as any).SUPABASE_SERVICE_ROLE_KEY || (globalThis as any).SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn("logSyncResult: Supabase credentials not found in global scope.");
      return;
    }
    
    await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/realtime_sync_logs`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path,
        status,
        error_message: errorMessage || null
      })
    });
  } catch (e) {
    console.error("logSyncResult failed:", e);
  }
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
    await logSyncResult(path, "starting", "Config length: " + (rcloneConfigStr || "").length);

    const config = parseRcloneConfig(rcloneConfigStr);
    if (!config || !config.token || !config.drive_id) {
      const msg = "Missing or incomplete RCLONE_CONFIG_ONEDRIVE environment variable (requires at least token and drive_id).";
      console.warn("syncToOneDrive:", msg);
      await logSyncResult(path, "failed_validation", msg);
      return;
    }

    const clientId = config.client_id || "b15665d9-eda6-4092-8539-0eec376afd59";
    const clientSecret = config.client_secret || "qtyfaBBYA403=unZUP40~_#";

    let tokenObj: any;
    try {
      tokenObj = JSON.parse(config.token);
    } catch (e: any) {
      const msg = "Failed to parse token JSON: " + e.message;
      console.error("syncToOneDrive:", msg);
      await logSyncResult(path, "failed_token_parse", msg);
      return;
    }

    const refreshToken = tokenObj.refresh_token;
    if (!refreshToken) {
      const msg = "Missing refresh_token in token JSON.";
      console.error("syncToOneDrive:", msg);
      await logSyncResult(path, "failed_no_refresh_token", msg);
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
      const msg = `Failed to refresh Microsoft token: ${tokenResponse.status} ${errText}`;
      console.error("syncToOneDrive:", msg);
      await logSyncResult(path, "failed_token_refresh", msg);
      return;
    }

    const tokenData = (await tokenResponse.json()) as any;
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      const msg = "No access_token returned from Microsoft.";
      console.error("syncToOneDrive:", msg);
      await logSyncResult(path, "failed_no_access_token", msg);
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
      body: data as any,
    });

    if (uploadResponse.ok) {
      console.log(`syncToOneDrive: Successfully synced ${path} to OneDrive!`);
      await logSyncResult(path, "success");
    } else {
      const errText = await uploadResponse.text();
      const msg = `Failed to upload to OneDrive: ${uploadResponse.status} ${errText}`;
      console.error("syncToOneDrive:", msg);
      await logSyncResult(path, "failed_upload", msg);
    }
  } catch (error: any) {
    const msg = "Unexpected error during sync: " + error.message;
    console.error("syncToOneDrive:", msg);
    await logSyncResult(path, "failed_unexpected", msg);
  }
}
