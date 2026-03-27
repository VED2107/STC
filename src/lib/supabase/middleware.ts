import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtectedRoute =
    pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
  const isLoginRoute = pathname === "/login";

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (isLoginRoute || pathname.startsWith("/admin"))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, profile_reviewed_at")
      .eq("id", user.id)
      .maybeSingle();

    if (isLoginRoute) {
      const url = request.nextUrl.clone();
      url.pathname =
        profile?.role === "admin" || profile?.role === "teacher"
          ? "/admin"
          : "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (profile?.role !== "admin" && profile?.role !== "teacher") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  if (
    user &&
    pathname.startsWith("/dashboard") &&
    pathname !== "/dashboard/settings"
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, profile_reviewed_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "student" && !profile.profile_reviewed_at) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/settings";
      url.searchParams.set("onboarding", "1");
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
