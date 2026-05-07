import { useState, useEffect } from "react";
import {
  UserCircle,
  Palette,
  ToggleLeft,
  Mail,
  CheckCircle2,
  Loader2,
  Sparkles,
  Save,
  Bell,
  Send,
  HelpCircle,
  ShieldAlert,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSettings, updateSettings, type UserSettings } from "@/lib/settings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BackupButton } from "@/components/dashboard/BackupButton";

const ADMIN_EMAIL = "bsleducduy@gmail.com";

const PRESET_COLORS = [
  { name: "Forest Green", hex: "#4C763B" },
  { name: "Deep Blue", hex: "#0c3299" },
  { name: "Sunset Orange", hex: "#f97316" },
  { name: "Midnight Purple", hex: "#7c3aed" },
  { name: "Slate", hex: "#475569" },
  { name: "Amber", hex: "#d97706" },
];

export function AccountSettings() {
  const qc = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [localSettings, setLocalSettings] = useState<Partial<UserSettings>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["user_settings"],
    queryFn: fetchSettings,
  });

  // Sync local settings when data is loaded
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (patch: Partial<UserSettings>) => updateSettings(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_settings"] });
      toast.success("Settings saved successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSave = () => {
    mutation.mutate(localSettings);
  };

  const hasChanges = JSON.stringify(localSettings) !== JSON.stringify(settings);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 lg:p-10 animate-in fade-in duration-500">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border pb-8">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border-4 border-white shadow-xl overflow-hidden forest-gradient transition-transform group-hover:scale-105">
                <UserCircle className="w-16 h-16 text-white opacity-90" strokeWidth={1.5} />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 border-4 border-white shadow-lg flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-foreground">
                Account Settings
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="w-3 h-3 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">{user.email}</p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
                  Active Trader
                </span>
                <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                  PRO Plan
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Theme Section */}
          <section className="bg-white rounded-[32px] border border-border p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Interface Customization</h2>
                <p className="text-xs text-muted-foreground font-medium">
                  Personalize your trading dashboard
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Primary Accent Color
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.hex}
                    onClick={() => setLocalSettings({ ...localSettings, primaryColor: color.hex })}
                    className={`
                      group relative w-full aspect-square rounded-2xl transition-all active:scale-95
                      ${localSettings.primaryColor === color.hex ? "ring-4 ring-primary/20 scale-105" : "hover:scale-105"}
                    `}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  >
                    {localSettings.primaryColor === color.hex && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-white drop-shadow-md" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-4 pt-4 mt-4 border-t border-border/50">
                <div className="flex-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">
                    Custom Hex Code
                  </label>
                  <div className="flex gap-2">
                    <div
                      className="w-10 h-10 rounded-lg border border-border shadow-inner"
                      style={{ backgroundColor: localSettings.primaryColor }}
                    />
                    <input
                      type="text"
                      value={localSettings.primaryColor || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.match(/^#[0-9A-Fa-f]{0,6}$/)) {
                          setLocalSettings({ ...localSettings, primaryColor: val });
                        }
                      }}
                      className="flex-1 h-10 bg-muted/30 border-border rounded-lg px-3 font-mono text-sm font-bold focus:ring-primary/20 transition-all"
                      placeholder="#FFFFFF"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="bg-white rounded-[32px] border border-border p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Advanced Features</h2>
                <p className="text-xs text-muted-foreground font-medium">
                  Enable specialized journal tools
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-center justify-between p-6 bg-muted/20 rounded-2xl border border-border/50 cursor-pointer hover:bg-muted/30 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary border border-border/50 group-hover:scale-110 transition-transform">
                    <ToggleLeft className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-sm font-black uppercase tracking-widest text-foreground block">
                      Enable Trade Grading
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      Show A+, A, B options in execution modal
                    </span>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={localSettings.showTradeGrade ?? false}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, showTradeGrade: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-muted-foreground/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                </div>
              </label>
            </div>
          </section>

          {/* Notifications Section */}
          <section className="bg-white rounded-[32px] border border-border p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Notification Settings</h2>
                <p className="text-xs text-muted-foreground font-medium">
                  Manage how and when you want to be reminded
                </p>
              </div>
            </div>

            <div className="space-y-8">
              {/* Journal Reminders Grouped Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-foreground">
                      Journal Reminders
                    </h3>
                  </div>
                  <div className="group relative">
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help hover:text-primary transition-colors" />
                    <div className="absolute bottom-full right-0 mb-3 w-64 p-3 bg-gray-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none shadow-2xl z-50 font-medium leading-relaxed border border-white/10 scale-95 group-hover:scale-100 origin-bottom-right">
                      <div className="space-y-1.5">
                        <p className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-emerald-400" />
                          <span className="font-bold">Web Popup:</span> Theo giờ máy tính của bạn.
                        </p>
                        <p className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-[#0088cc]" />
                          <span className="font-bold">Telegram:</span> Gửi theo giờ Việt Nam (GMT+7).
                        </p>
                      </div>
                      <div className="absolute top-full right-2 border-8 border-transparent border-t-gray-900" />
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Daily Psychology */}
                  <div className="p-4 bg-muted/20 rounded-2xl border border-border/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-primary border border-border/50">
                          <Bell className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Daily Psychology</span>
                      </div>
                      <label className="relative cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={localSettings.dailyReminder ?? false}
                          onChange={(e) => setLocalSettings({ ...localSettings, dailyReminder: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-muted-foreground/20 rounded-full peer peer-focus:outline-none peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary shadow-inner transition-colors group-hover:bg-muted-foreground/30"></div>
                      </label>
                    </div>
                    <input
                      type="time"
                      value={localSettings.dailyReminderTime || "08:00"}
                      onChange={(e) => setLocalSettings({ ...localSettings, dailyReminderTime: e.target.value })}
                      className="w-full bg-white border border-border rounded-xl px-3 py-1.5 font-bold text-xs outline-none focus:ring-2 ring-primary/20 transition-all"
                    />
                  </div>

                  {/* Weekend Review */}
                  <div className="p-4 bg-muted/20 rounded-2xl border border-border/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-primary border border-border/50">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Weekend Review (Sat)</span>
                      </div>
                      <label className="relative cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={localSettings.weeklyReminder ?? false}
                          onChange={(e) => setLocalSettings({ ...localSettings, weeklyReminder: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-muted-foreground/20 rounded-full peer peer-focus:outline-none peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary shadow-inner transition-colors group-hover:bg-muted-foreground/30"></div>
                      </label>
                    </div>
                    <input
                      type="time"
                      value={localSettings.weeklyReminderTime || "09:00"}
                      onChange={(e) => setLocalSettings({ ...localSettings, weeklyReminderTime: e.target.value })}
                      className="w-full bg-white border border-border rounded-xl px-3 py-1.5 font-bold text-xs outline-none focus:ring-2 ring-primary/20 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Session Bias Reminders Grouped Section */}
              <div className="pt-6 border-t border-border/50 space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-foreground">
                    Session Bias Reminders
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Asian Session */}
                  <div className="p-4 bg-muted/20 rounded-2xl border border-border/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Asian Bias</span>
                      <label className="relative cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={localSettings.asianReminder ?? false}
                          onChange={(e) => setLocalSettings({ ...localSettings, asianReminder: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-muted-foreground/20 rounded-full peer peer-focus:outline-none peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary shadow-inner transition-colors group-hover:bg-muted-foreground/30"></div>
                      </label>
                    </div>
                    <input
                      type="time"
                      value={localSettings.asianTime || "07:30"}
                      onChange={(e) => setLocalSettings({ ...localSettings, asianTime: e.target.value })}
                      className="w-full bg-white border border-border rounded-xl px-3 py-1.5 font-bold text-xs outline-none focus:ring-2 ring-primary/20 transition-all"
                    />
                  </div>

                  {/* London Session */}
                  <div className="p-4 bg-muted/20 rounded-2xl border border-border/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-foreground">London Bias</span>
                      <label className="relative cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={localSettings.londonReminder ?? false}
                          onChange={(e) => setLocalSettings({ ...localSettings, londonReminder: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-muted-foreground/20 rounded-full peer peer-focus:outline-none peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary shadow-inner transition-colors group-hover:bg-muted-foreground/30"></div>
                      </label>
                    </div>
                    <input
                      type="time"
                      value={localSettings.londonTime || "13:00"}
                      onChange={(e) => setLocalSettings({ ...localSettings, londonTime: e.target.value })}
                      className="w-full bg-white border border-border rounded-xl px-3 py-1.5 font-bold text-xs outline-none focus:ring-2 ring-primary/20 transition-all"
                    />
                  </div>

                  {/* NY Session */}
                  <div className="p-4 bg-muted/20 rounded-2xl border border-border/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-foreground">NY Bias</span>
                      <label className="relative cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={localSettings.nyReminder ?? false}
                          onChange={(e) => setLocalSettings({ ...localSettings, nyReminder: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-muted-foreground/20 rounded-full peer peer-focus:outline-none peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary shadow-inner transition-colors group-hover:bg-muted-foreground/30"></div>
                      </label>
                    </div>
                    <input
                      type="time"
                      value={localSettings.nyTime || "19:00"}
                      onChange={(e) => setLocalSettings({ ...localSettings, nyTime: e.target.value })}
                      className="w-full bg-white border border-border rounded-xl px-3 py-1.5 font-bold text-xs outline-none focus:ring-2 ring-primary/20 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Telegram Section */}
          <section className="bg-white rounded-[32px] border border-border p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#0088cc]/10 text-[#0088cc]">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Telegram Integration</h2>
                <p className="text-xs text-muted-foreground font-medium">
                  Receive reminders directly on your phone
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className={`p-6 rounded-2xl border transition-all ${localSettings.telegramChatId ? "bg-emerald-50 border-emerald-100" : "bg-muted/20 border-border/50"}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg ${localSettings.telegramChatId ? "bg-emerald-500 shadow-emerald-500/20" : "bg-[#0088cc] shadow-[#0088cc]/20"}`}>
                      <Send className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-foreground">
                        {localSettings.telegramChatId ? "Connected to Telegram" : "Telegram Bot"}
                      </h3>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        {localSettings.telegramChatId 
                          ? "You are receiving notifications via Telegram" 
                          : "Connect your account to receive mobile alerts"}
                      </p>
                    </div>
                  </div>
                  
                  {localSettings.telegramChatId ? (
                    <button 
                      onClick={() => setLocalSettings({ ...localSettings, telegramChatId: "" })}
                      className="px-6 py-2.5 bg-white border border-rose-200 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <a
                      href={`https://t.me/ChartmateBot?start=${user.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-2.5 bg-[#0088cc] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#0088cc]/20 hover:opacity-90 active:scale-95 transition-all text-center"
                    >
                      Connect Now
                    </a>
                  )}
                </div>
              </div>

              {!localSettings.telegramChatId && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-800 font-medium leading-relaxed uppercase tracking-wider">
                    Tip: Click "Connect Now" to open our Telegram Bot. 
                    Press "Start" in the chat to automatically link your account.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Admin Zone — only visible to admin email */}
          {user?.email === ADMIN_EMAIL && (
            <section className="bg-rose-50 dark:bg-rose-950/20 rounded-[32px] border border-rose-200 dark:border-rose-800/40 p-8 shadow-sm space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-rose-700 dark:text-rose-300">Admin Zone</h2>
                  <p className="text-xs text-rose-500 dark:text-rose-400 font-medium">
                    Visible only to system administrator
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 dark:text-rose-400">
                  Database Backup
                </p>
                <p className="text-xs text-rose-600/70 dark:text-rose-400/70 font-medium leading-relaxed">
                  Export toàn bộ database thành file SQL và lưu đồng thời lên Cloudflare R2.
                  File sẽ được tải về máy ngay sau khi hoàn tất.
                </p>
                <BackupButton />
              </div>
            </section>
          )}

          {/* Save Button */}
          <div className="pt-4">
            <button
              onClick={handleSave}
              disabled={mutation.isPending || !hasChanges}
              className={`
                w-full py-4 rounded-[20px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all
                ${mutation.isPending ? "bg-muted text-muted-foreground" : "bg-primary text-white shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95"}
                ${!hasChanges && !mutation.isPending ? "opacity-50 grayscale cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              {mutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {mutation.isPending ? "Saving..." : "Save All Settings"}
            </button>
            {!hasChanges && !mutation.isPending && (
              <p className="text-center text-[10px] text-muted-foreground font-medium mt-3 uppercase tracking-widest">
                No changes to save
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
