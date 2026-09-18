import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Users, Search, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [ackRisk, setAckRisk] = useState(false);

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
      loading: `Đang chuẩn bị đóng vai: ${user.display_name}...`,
      success: "Đã tạo phiên đóng vai",
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
    <div className="space-y-4 max-w-5xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="search"
          placeholder="Tên hoặc email"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-10 bg-card border border-border rounded-xl pl-10 pr-4 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Users size={14} className="text-primary" />
            {filteredUsers.length} tài khoản
          </h2>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isLoading}
            className="text-[12px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Làm mới
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Tên</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Vai trò</th>
                <th className="px-4 py-3 font-semibold">Đăng ký</th>
                <th className="px-4 py-3 font-semibold">Đăng nhập cuối</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 size={18} className="animate-spin inline mr-2" />
                    Đang tải…
                  </td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt=""
                            className="w-8 h-8 rounded-full border border-border object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full forest-gradient grid place-items-center text-white text-[10px] font-bold">
                            {user.display_name.substring(0, 2)}
                          </div>
                        )}
                        <span className="font-semibold">{user.display_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-sans tabular-nums text-[13px]">{user.email || "—"}</td>
                    <td className="px-4 py-3">
                      {user.role === "admin" ? (
                        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-warning">
                          <Shield size={11} /> Admin
                        </span>
                      ) : (
                        <span className="text-[12px] font-medium">Member</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-sans tabular-nums text-[13px] text-muted-foreground">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-4 py-3 font-sans tabular-nums text-[13px] text-muted-foreground">
                      {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.role === "admin" ? (
                        <span className="text-[12px] text-muted-foreground">Khóa</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAckRisk(false);
                            setPendingUser(user);
                          }}
                          disabled={impersonateMutation.isPending}
                          className="h-8 px-3 rounded-lg border border-border text-[12px] font-semibold hover:bg-muted"
                        >
                          Đóng vai
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Không tìm thấy người dùng phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog
        open={!!pendingUser}
        onOpenChange={(open) => {
          if (!open) {
            setPendingUser(null);
            setAckRisk(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Đăng nhập với tư cách {pendingUser?.display_name ?? "user này"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bạn sẽ rời phiên admin và xem journal đúng như user này. Banner vàng cho phép quay lại. Không dùng trên máy người khác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 accent-primary"
              checked={ackRisk}
              onChange={(e) => setAckRisk(e.target.checked)}
            />
            <span>Tôi hiểu phiên hiện tại sẽ bị thay bằng phiên của user này.</span>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingUser(null);
                setAckRisk(false);
              }}
            >
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!ackRisk || !pendingUser}
              onClick={() => {
                if (pendingUser) handleImpersonate(pendingUser);
              }}
            >
              Đăng nhập với tư cách này
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
