import { useState, useEffect, useCallback } from "react";

export interface ExtraImages {
  monthlyImg?: string;
  weeklyImg?: string;
  dailyImg?: string;
  h4Img?: string;
  h1Img?: string; // We can use the existing h1Img from DB, but keeping it here for consistency if needed, wait, trade already has h1Img, m15Img.
  // Actually, let's just store the ones that are NOT in DB.
}

export function useExtraImages(tradeId?: string) {
  const [extra, setExtra] = useState<ExtraImages>({});

  useEffect(() => {
    if (!tradeId) {
      setExtra({});
      return;
    }
    try {
      const data = localStorage.getItem(`trade_${tradeId}_extra_imgs`);
      if (data) {
        setExtra(JSON.parse(data));
      } else {
        setExtra({});
      }
    } catch (e) {
      setExtra({});
    }
  }, [tradeId]);

  const saveExtra = useCallback((tradeIdToSave: string, patch: Partial<ExtraImages>) => {
    setExtra((prev) => {
      const updated = { ...prev, ...patch };
      localStorage.setItem(`trade_${tradeIdToSave}_extra_imgs`, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { extra, setExtra: saveExtra };
}
