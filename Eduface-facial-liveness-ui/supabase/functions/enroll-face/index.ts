// supabase/functions/enroll-face/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeBase64, decodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
// CONFIG
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const STORAGE_BUCKET = "verification-images";
// CORS HEADERS
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://localhost:3001",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
  "Access-Control-Allow-Credentials": "true"
};
// MAIN HANDLER
serve(async (req)=>{
  // HANDLE PREFlight (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: CORS_HEADERS,
      status: 204
    });
  }
  // ONLY ALLOW POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      error: "Method not allowed"
    }), {
      status: 405,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json"
      }
    });
  }
  try {
    const { student_uuid, student_id, images } = await req.json();
    if (!student_uuid || !student_id || !Array.isArray(images) || images.length < 12) {
      return new Response(JSON.stringify({
        error: "Invalid payload – need ≥12 images"
      }), {
        status: 400,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json"
        }
      });
    }
    // 1. Verify student
    const { data: student } = await supabase.from("students").select("id").eq("id", student_uuid).single();
    if (!student) throw new Error("Student not found");
    // 2. Count existing images
    const { data: existing } = await supabase.storage.from(STORAGE_BUCKET).list("", {
      search: student_id
    });
    const existingCount = existing?.length ?? 0;
    const inserts = [];
    const uploaded = [];
    for(let i = 0; i < images.length; i++){
      const { base64: b64, angle = "frontal" } = images[i];
      if (!b64) throw new Error(`Missing base64 for image ${i}`);
      let jpegBytes;
      try {
        jpegBytes = decodeBase64(b64);
      } catch (decodeErr) {
        console.error(`Base64 decode error for image ${i}:`, decodeErr);
        throw new Error(`Invalid base64 data for image ${i + 1}`);
      }
      const globalCount = existingCount + i + 1;
      const uid = crypto.randomUUID().slice(0, 8);
      const filename = `${student_id}_${globalCount}_${angle}_${uid}.jpg`;
      const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(filename, jpegBytes, {
        contentType: "image/jpeg",
        upsert: true
      });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filename);
      const publicUrl = urlData.publicUrl;
      if (!publicUrl || !publicUrl.startsWith("https://")) {
        console.error(`Public URL missing or invalid for file: ${filename}`);
        throw new Error(`Failed to generate public URL for image ${i + 1}`);
      }
      // Dummy embedding (512-dim)
      const dummyEmbedding = new Float32Array(512).fill(0);
      dummyEmbedding[0] = 1;
      const embBytes = new Uint8Array(dummyEmbedding.buffer);
      inserts.push({
        student_id: student_uuid,
        embedding: encodeBase64(embBytes),
        quality_score: 0.92,
        creation_timestamp: new Date().toISOString(),
        reference_image_url: publicUrl
      });
      uploaded.push(filename);
    }
    // Bulk insert
    const { error: insErr } = await supabase.from("face_embeddings").insert(inserts);
    if (insErr) throw insErr;
    const timestamp = new Date().toISOString();
    return new Response(JSON.stringify({
      success: true,
      quality_score: 0.92,
      timestamp,
      message: "Enrollment successful",
      uploaded,
      embeddings: inserts.length
    }), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("enroll-face error:", err);
    let errorMsg = "Internal error";
    if (typeof err === "object" && err !== null && "message" in err) {
      errorMsg = (err as any).message || errorMsg;
    } else if (typeof err === "string") {
      errorMsg = err;
    }
    return new Response(JSON.stringify({
      error: errorMsg
    }), {
      status: 500,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json"
      }
    });
  }
});
