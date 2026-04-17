import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = (await request.json()) as {
      studentId?: string;
      feesAmount?: number;
      feesInstallment1Paid?: boolean;
      feesInstallment2Paid?: boolean;
    };

    if (!body.studentId) {
      return NextResponse.json({ error: "studentId is required" }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {};
    if (typeof body.feesAmount === "number") {
      updatePayload.fees_amount = body.feesAmount;
    }
    if (typeof body.feesInstallment1Paid === "boolean") {
      updatePayload.fees_installment1_paid = body.feesInstallment1Paid;
    }
    if (typeof body.feesInstallment2Paid === "boolean") {
      updatePayload.fees_installment2_paid = body.feesInstallment2Paid;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { error } = await supabase
      .from("students")
      .update(updatePayload)
      .eq("id", body.studentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
