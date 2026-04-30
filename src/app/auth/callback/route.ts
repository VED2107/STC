import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ensureOnlineStudentAccess } from "@/lib/auth/self-signup";

function isSafeRedirect(value: string | null) {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//"));
}

function resolveDashboardPath(role: string | null | undefined) {
  if (role === "admin" || role === "super_admin") return "/admin";
  if (role === "teacher") return "/admin/attendance";
  return "/dashboard";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectedFrom = requestUrl.searchParams.get("redirectedFrom");
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  let redirectPath = "/login";

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const failureUrl = new URL("/login", requestUrl.origin);
      failureUrl.searchParams.set("error", error.message);
      return NextResponse.redirect(failureUrl);
    }

    if (isSafeRedirect(redirectedFrom)) {
      redirectPath = redirectedFrom!;
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await ensureOnlineStudentAccess({
          userId: user.id,
          fullName:
            typeof user.user_metadata?.full_name === "string"
              ? user.user_metadata.full_name
              : typeof user.user_metadata?.name === "string"
                ? user.user_metadata.name
                : user.email?.split("@")[0] ?? "",
          phone:
            typeof user.user_metadata?.phone === "string"
              ? user.user_metadata.phone
              : "",
        });

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, full_name, phone")
          .eq("id", user.id)
          .maybeSingle();

        if (
          profile?.role === "student" &&
          (!profile.full_name?.trim() || !profile.phone?.trim())
        ) {
          redirectPath = "/dashboard/settings?onboarding=1";
        } else {
          redirectPath = resolveDashboardPath(profile?.role);
        }
      }
    }
  }

  return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
}
