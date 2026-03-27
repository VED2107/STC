import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function isSafeRedirect(value: string | null) {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//"));
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectedFrom = requestUrl.searchParams.get("redirectedFrom");
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
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
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        redirectPath = "/";
      }
    }
  }

  return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
}
