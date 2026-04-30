"use server";

import { createAdminClient } from "@/lib/supabase/admin";

interface PhotoUploadInput {
  profileId: string;
  fileName: string;
  fileBase64: string;
  contentType: string;
}

interface PhotoUploadResult {
  profileId: string;
  success: boolean;
  error?: string;
}

/**
 * Upload a student photo using the admin (service-role) client.
 *
 * Accepts the image as a base64 string so it can be passed through
 * the server-action boundary. Stores the file in the "materials"
 * bucket under `students/{profileId}/` and updates `profiles.avatar_url`.
 */
export async function uploadStudentPhotoAdmin(
  input: PhotoUploadInput,
): Promise<PhotoUploadResult> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { profileId: input.profileId, success: false, error: "Server misconfigured" };
  }

  try {
    // Decode base64 to buffer
    const base64Data = input.fileBase64.includes(",")
      ? input.fileBase64.split(",")[1]
      : input.fileBase64;
    const buffer = Buffer.from(base64Data, "base64");

    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `students/${input.profileId}/avatar-${Date.now()}-${safeName}`;

    // Upload to storage using admin client (bypasses RLS)
    const { error: uploadError } = await admin.storage
      .from("materials")
      .upload(path, buffer, {
        upsert: true,
        contentType: input.contentType || "image/jpeg",
      });

    if (uploadError) {
      // If the bucket doesn't exist, try creating it
      if (
        uploadError.message?.includes("not found") ||
        uploadError.message?.includes("Bucket not found")
      ) {
        // Create the bucket and retry
        await admin.storage.createBucket("materials", {
          public: true,
          fileSizeLimit: 10 * 1024 * 1024, // 10 MB
          allowedMimeTypes: ["image/*", "application/pdf", "video/*"],
        });

        const { error: retryError } = await admin.storage
          .from("materials")
          .upload(path, buffer, {
            upsert: true,
            contentType: input.contentType || "image/jpeg",
          });

        if (retryError) {
          return {
            profileId: input.profileId,
            success: false,
            error: `Storage upload failed after bucket creation: ${retryError.message}`,
          };
        }
      } else {
        return {
          profileId: input.profileId,
          success: false,
          error: `Storage upload failed: ${uploadError.message}`,
        };
      }
    }

    // Build public URL
    // Use the public-facing URL for the avatar (not the internal Docker URL)
    const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicUrl = publicSupabaseUrl
      ? `${publicSupabaseUrl}/storage/v1/object/public/materials/${path}`
      : admin.storage.from("materials").getPublicUrl(path).data.publicUrl;

    // Update profile avatar_url
    const { error: updateError } = await admin
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", input.profileId);

    if (updateError) {
      return {
        profileId: input.profileId,
        success: false,
        error: `Profile update failed: ${updateError.message}`,
      };
    }

    return { profileId: input.profileId, success: true };
  } catch (error) {
    return {
      profileId: input.profileId,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
