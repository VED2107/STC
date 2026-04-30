import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

const RESET_TABLES = [
  "notifications",
  "course_payments",
  "attendance",
  "attendance_sessions",
  "qr_tokens",
  "enrollments",
  "materials",
  "syllabus",
  "students",
  "teacher_class_access",
  "courses",
  "teachers",
  "classes",
] as const;

async function removeStorageObjects(admin: ReturnType<typeof createAdminClient>, bucket: string) {
  async function walk(path = ""): Promise<string[]> {
    const { data, error } = await admin.storage.from(bucket).list(path, { limit: 1000 });

    if (error) {
      return [];
    }

    const files: string[] = [];
    for (const item of data ?? []) {
      const itemPath = path ? `${path}/${item.name}` : item.name;
      if (item.id) {
        files.push(itemPath);
      } else {
        files.push(...(await walk(itemPath)));
      }
    }
    return files;
  }

  const files = await walk();
  if (files.length === 0) {
    return 0;
  }

  const { error } = await admin.storage.from(bucket).remove(files);
  if (error) {
    throw new Error(error.message);
  }
  return files.length;
}

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, email")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (profile?.role !== "super_admin") {
      return NextResponse.json({ error: "Super admin access required" }, { status: 403 });
    }

    const admin = createAdminClient();
    const deletedRows: Record<string, number> = {};

    for (const table of RESET_TABLES) {
      const { count, error } = await admin
        .from(table)
        .delete({ count: "exact" })
        .neq("id", EMPTY_UUID);

      if (error) {
        return NextResponse.json({ error: `Failed to clear ${table}: ${error.message}` }, { status: 500 });
      }

      deletedRows[table] = count ?? 0;
    }

    const { count: profileCount, error: profilesError } = await admin
      .from("profiles")
      .delete({ count: "exact" })
      .neq("id", user.id);

    if (profilesError) {
      return NextResponse.json({ error: `Failed to clear profiles: ${profilesError.message}` }, { status: 500 });
    }

    deletedRows.profiles = profileCount ?? 0;

    let deletedAuthUsers = 0;
    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) {
        return NextResponse.json({ error: `Failed to list auth users: ${error.message}` }, { status: 500 });
      }

      const usersToDelete = (data.users ?? []).filter((authUser) => authUser.id !== user.id);
      for (const authUser of usersToDelete) {
        const { error: deleteUserError } = await admin.auth.admin.deleteUser(authUser.id);
        if (deleteUserError) {
          return NextResponse.json(
            { error: `Failed to delete auth user ${authUser.email ?? authUser.id}: ${deleteUserError.message}` },
            { status: 500 },
          );
        }
        deletedAuthUsers += 1;
      }

      if (usersToDelete.length === 0) {
        break;
      }
    }

    const deletedStorageObjects = await removeStorageObjects(admin, "materials");

    return NextResponse.json({
      success: true,
      deletedRows,
      deletedAuthUsers,
      deletedStorageObjects,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
