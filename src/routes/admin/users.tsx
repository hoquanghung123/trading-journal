import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  Users,
  Search,
  Eye,
  ArrowLeft,
  Loader2,
  Calendar,
  Shield,
  ShieldAlert,
  UserCheck,
  Mail,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

interface UserProfile {
  id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
}

// 1. Server Function to list all users securely (server-side authentication checks)
const listAllUsersFn = (createServerFn({ method: "GET" }) as any).handler(
  async () => {
    try {
      const request = getRequest();
      const authHeader = request?.headers?.get("authorization");
      if (!authHeader) throw new Error("Unauthorized: Missing authorization header");

      const token = authHeader.replace("Bearer ", "");
      if (!token) throw new Error("Unauthorized: Missing token");

      // Dynamically import server-side client to avoid bundling on client
      const { supabaseAdmin: rawAdmin } = await import("@/integrations/supabase/client.server");
      const supabaseAdmin = rawAdmin as any;

      // Verify caller is an authenticated admin
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) throw new Error("Unauthorized: Invalid session");

      const { data: callerProfile, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileErr || callerProfile?.role !== "admin") {
        throw new Error("Forbidden: Admin privileges required");
      }

      // Fetch all authenticated users
      const { data: authUsersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
      if (usersError) throw usersError;

      // Fetch all public profiles
      const { data: profilesData, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select("*");
      if (profilesError) throw profilesError;

      // Combine auth users with public profiles
      const combinedUsers: UserProfile[] = authUsersData.users.map((u: any) => {
        const profile = profilesData?.find((p: any) => p.id === u.id);
        return {
          id: u.id,
          email: u.email ?? null,
          display_name: profile?.display_name || u.user_metadata?.display_name || "Anonymous User",
          avatar_url: profile?.avatar_url || u.user_metadata?.avatar_url || null,
          role: profile?.role || "member",
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        };
      });

      // Sort by creation date (newest first)
      combinedUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return { success: true, users: combinedUsers };
    } catch (err: any) {
      console.error("listAllUsersFn failed:", err);
      return { success: false, error: err.message };
    }
  }
);

// 2. Server Function to securely generate magic impersonation link
const impersonateUserFn = (createServerFn({ method: "POST" }) as any).handler(
  async ({ data: { userId, email } }: { data: { userId: string; email: string } }) => {
    try {
      const request = getRequest();
      const authHeader = request?.headers?.get("authorization");
      if (!authHeader) throw new Error("Unauthorized: Missing authorization header");

      const token = authHeader.replace("Bearer ", "");
      if (!token) throw new Error("Unauthorized: Missing token");

      // Dynamically import server-side client
      const { supabaseAdmin: rawAdmin } = await import("@/integrations/supabase/client.server");
      const supabaseAdmin = rawAdmin as any;

      // Verify caller is an authenticated admin
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) throw new Error("Unauthorized: Invalid session");

      const { data: callerProfile, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileErr || callerProfile?.role !== "admin") {
        throw new Error("Forbidden: Admin privileges required");
      }

      // Log impersonation securely in server console
      console.log(`[Admin Action] Impersonation Triggered! Admin (${user.email} / ID: ${user.id}) is logging in as User: ${email} (ID: ${userId})`);

      // Determine redirect origin
      const host = request?.headers?.get("host") || "localhost:3000";
      const proto = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
      const origin = `${proto}://${host}`;

      // Generate secure action link
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: email,
        options: {
          redirectTo: `${origin}/`,
        },
      });

      if (linkError || !linkData?.properties?.action_link) {
        throw new Error(linkError?.message || "Failed to generate impersonation link");
      }

      return { success: true, actionLink: linkData.properties.action_link };
    } catch (err: any) {
      console.error("impersonateUserFn failed:", err);
      return { success: false, error: err.message };
    }
  }
);

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersDashboard,
});

function AdminUsersDashboard() {
  const [searchTerm, setSearchTerm] = useState("");

  // Query to fetch all users
  const { data: usersData, isLoading, refetch } = useQuery<{ success: boolean; users?: UserProfile[]; error?: string }>({
    queryKey: ["admin_users_list"],
    queryFn: async () => {
      // Get auth token from client SDK
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      // Call server function using custom headers for authorization
      const res = await (listAllUsersFn as any)({
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return res;
    },
  });

  // Mutation to run the impersonation action
  const impersonateMutation = useMutation({
    mutationFn: async (targetUser: UserProfile) => {
      if (!targetUser.email) throw new Error("User email is required for impersonation");

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // 1. Back up current admin session before impersonation
      if (session) {
        localStorage.setItem("chartmate_original_admin_session", JSON.stringify(session));
      }

      const res = await (impersonateUserFn as any)({
        data: { userId: targetUser.id, email: targetUser.email },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.success) {
        throw new Error(res.error || "Không thể khởi tạo phiên đóng vai");
      }

      return res.actionLink;
    },
    onSuccess: (actionLink) => {
      toast.success("Khởi tạo phiên đóng vai thành công!", {
        description: "Đang tự động đăng nhập và chuyển hướng...",
      });
      
      // 2. Chuyển hướng trình duyệt đến link đăng nhập của user kia
      setTimeout(() => {
        window.location.href = actionLink;
      }, 1000);
    },
    onError: (err: any) => {
      localStorage.removeItem("chartmate_original_admin_session");
      toast.error("Đóng vai thất bại", {
        description: err.message,
      });
    },
  });

  const handleImpersonate = (user: UserProfile) => {
    if (impersonateMutation.isPending) return;
    toast.promise(impersonateMutation.mutateAsync(user), {
      loading: `Đang chuẩn bị đóng vai user: ${user.display_name}...`,
      success: "Đã tạo link đóng vai!",
      error: (err) => `Lỗi: ${err.message}`,
    });
  };

  const filteredUsers = (usersData?.users || []).filter(
    (u) =>
      u.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10 font-sans relative overflow-hidden">
      {/* Light glows */}
      <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-15%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 relative z-10">
        
        {/* Navigation Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
              Về Terminal
            </Link>
            <span className="text-muted-foreground/30">|</span>
            <Link
              to="/admin/users"
              className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: "text-primary font-black" }}
            >
              👥 Users
            </Link>
            <span className="text-muted-foreground/30">|</span>
            <Link
              to="/admin/backups"
              className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: "text-primary font-black" }}
            >
              💾 Backups
            </Link>
          </div>
          <div className="h-6 px-3 rounded-full border border-primary/20 bg-primary/5 flex items-center justify-center self-start sm:self-auto">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">
              Admin Control Panel
            </span>
          </div>
        </div>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/40">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-glow-cyan">
              User Management
            </h1>
            <p className="text-xs text-muted-foreground/80 font-semibold mt-1">
              Quản lý danh sách các tài khoản người dùng đã đăng ký và hỗ trợ gỡ lỗi bằng cách Đóng vai (Impersonation).
            </p>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-3 h-12 px-6 rounded-xl font-black text-xs uppercase tracking-widest text-white forest-gradient hover:opacity-95 active:scale-95 transition-all shadow-lg shadow-primary/10 disabled:opacity-50"
          >
            Làm mới danh sách
          </button>
        </div>

        {/* Search Bar Widget */}
        <div className="relative max-w-md group">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            placeholder="Tìm kiếm user bằng tên hiển thị hoặc email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-card/45 border border-border/60 rounded-2xl pl-14 pr-6 py-4 text-sm font-bold outline-none focus:bg-card focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all text-foreground backdrop-blur-md"
          />
        </div>

        {/* Users Table Grid */}
        <div className="bg-card/30 rounded-3xl border border-border/50 overflow-hidden backdrop-blur-md">
          <div className="px-6 py-5 border-b border-border/40 bg-card/10 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
              <Users size={16} className="text-primary" />
              Danh sách tài khoản ({filteredUsers.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/30 text-muted-foreground/60 font-black uppercase tracking-widest">
                  <th className="px-6 py-4">Tên hiển thị & Avatar</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4 text-center">Vai trò</th>
                  <th className="px-6 py-4">Ngày đăng ký</th>
                  <th className="px-6 py-4">Lần đăng nhập cuối</th>
                  <th className="px-6 py-4 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 font-semibold text-muted-foreground">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 size={24} className="animate-spin text-primary" />
                        <span className="text-xs tracking-widest font-black uppercase text-muted-foreground/40">
                          Đang tải danh sách user...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-muted/10 transition-colors group/row"
                    >
                      {/* Name & Avatar */}
                      <td className="px-6 py-4 whitespace-nowrap text-foreground">
                        <div className="flex items-center gap-3">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt={user.display_name}
                              className="w-8 h-8 rounded-full border border-border bg-muted object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full forest-gradient flex items-center justify-center text-white text-[10px] font-black uppercase shadow-sm">
                              {user.display_name.substring(0, 2)}
                            </div>
                          )}
                          <span className="font-bold">{user.display_name}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-6 py-4 whitespace-nowrap text-foreground">
                        <div className="flex items-center gap-2">
                          <Mail size={12} className="text-muted-foreground/50" />
                          <span>{user.email || "N/A"}</span>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        {user.role === "admin" ? (
                          <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Shield size={10} />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <UserCheck size={10} />
                            Member
                          </span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar size={12} className="text-muted-foreground/50" />
                          <span>{formatDate(user.created_at)}</span>
                        </div>
                      </td>

                      {/* Last Sign In */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.last_sign_in_at ? (
                          <span>{formatDate(user.last_sign_in_at)}</span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>

                      {/* Impersonate Action */}
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        {user.role === "admin" ? (
                          <button
                            disabled
                            className="inline-flex items-center gap-2 h-8 px-3 rounded-lg border border-border/40 text-muted-foreground/30 cursor-not-allowed text-[10px] font-black uppercase tracking-wider"
                            title="Không thể đóng vai một tài khoản Admin khác"
                          >
                            <ShieldAlert size={12} />
                            Bị khóa
                          </button>
                        ) : (
                          <button
                            onClick={() => handleImpersonate(user)}
                            disabled={impersonateMutation.isPending}
                            className="inline-flex items-center gap-2 h-8 px-3 rounded-lg border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:text-white transition-all active:scale-95 text-[10px] font-black uppercase tracking-wider shadow-sm group-hover/row:border-primary/40"
                          >
                            <Eye size={12} />
                            Login As
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users size={24} className="text-muted-foreground/30 animate-pulse" />
                        <span className="text-xs tracking-widest font-black uppercase text-muted-foreground/30">
                          Không tìm thấy người dùng nào phù hợp.
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
