// supabase/functions/rapid-handler/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400"
};
const SIAMESE_URL = "https://iixleiapsevgmndfxkmc.supabase.co/functions/v1/siamese-predict";
const BUCKET_NAME = "verification-images";
Deno.serve(async (req)=>{
  console.log("Request received:", req.method);
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders
    });
  }
  let supabaseAdmin;
  try {
    supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  } catch (err) {
    return new Response(JSON.stringify({
      error: "Server misconfigured",
      details: "Supabase client failed to initialize"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
  try {
    const body = await req.json();
    const { student_uuid, image, access_code } = body;
    console.log("Received payload:", {
      student_uuid: student_uuid?.substring(0, 8) + "...",
      access_code: access_code ? "[present]" : "[missing]",
      image_size: image?.length || 0
    });
    // === 1. VALIDATE INPUT ===
    if (!student_uuid || typeof student_uuid !== "string") {
      return badRequest("Missing or invalid student_uuid");
    }
    if (!image || typeof image !== "string") {
      return badRequest("Missing or invalid image", "Base64-encoded JPEG required");
    }
    if (!access_code || typeof access_code !== "string") {
      return badRequest("Missing access_code", "Session code is required");
    }
    // === 2. VALIDATE STUDENT ===
    console.log("Verifying student...");
    const { data: student, error: studentErr } = await supabaseAdmin.from("students").select("id, student_id").eq("id", student_uuid).single();
    if (studentErr || !student) {
      console.error("Student not found:", studentErr);
      return notFound("Student not found", "No student with provided UUID");
    }
    console.log("Student verified:", student.student_id);
    // === 3. VALIDATE SESSION (access_code only) ===
    console.log("Validating session with access_code...");
    const { data: session, error: sessionErr } = await supabaseAdmin.from("attendance_sessions").select("id, status").eq("access_code", access_code).in("status", [
      "in_progress",
      "scheduled"
    ]).single();
    if (sessionErr || !session) {
      console.error("Session not found or invalid:", sessionErr);
      return badRequest("Invalid session", "Access code not valid or session not active.");
    }
    console.log("Session validated (ID:", session.id, ")");
    // === 4. VERIFY FACE ENROLLMENT ===
    console.log("Checking face embeddings...");
    // Ensure we use the UUID for face_embeddings queries
    const { count, error: embedErr } = await supabaseAdmin
      .from("face_embeddings")
      .select("*", { count: "exact", head: true })
      .eq("student_id", student_uuid); // student_uuid is the UUID
    if (embedErr || !count || count === 0) {
      return notFound("Face not enrolled", "Please complete face enrollment first.");
    }
    console.log(`${count} face embedding(s) found`);
    // === 5. ASPECT FACE AUTH ===
    const aspectToken = await loginToAspectFace();
    if (!aspectToken) {
      throw new Error("Failed to authenticate with Aspect Face");
    }
    // === 6. LIVENESS CHECK ===
    console.log("Running liveness detection...");
    const livenessResult = await runLivenessCheck(aspectToken, image);
    const livenessScore = livenessResult.liveness_score || 0;
    const livenessPassed = livenessResult.success || livenessScore > 0.5;
    if (!livenessPassed) {
      return new Response(JSON.stringify({
        liveness: livenessResult,
        siamese: null,
        error: "Liveness check failed",
        details: "Spoofing detected. Ensure good lighting and real face."
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    console.log("Liveness passed:", livenessScore);
    // === 7. FETCH BEST REFERENCE IMAGE ===
    // Use UUID for fetching best reference image
    const { data: embedding } = await supabaseAdmin
      .from("face_embeddings")
      .select("reference_image_url, quality_score")
      .eq("student_id", student_uuid)
      .order("quality_score", { ascending: false })
      .limit(1)
      .single();
    if (!embedding?.reference_image_url) {
      return notFound("Reference image missing", "No valid reference image found.");
    }
    const filename = embedding.reference_image_url.split("/").pop();
    if (!filename) throw new Error("Invalid reference image URL");
    // === 8. DOWNLOAD REFERENCE IMAGE ===
    const { data: blob, error: dlErr } = await supabaseAdmin.storage.from(BUCKET_NAME).download(filename);
    if (dlErr || !blob) throw new Error("Failed to download reference image");
    const referenceBase64 = await blobToBase64(blob);
    console.log("Reference image loaded (quality:", embedding.quality_score, ")");
    // === 9. SIAMESE COMPARISON ===
    console.log("Running face comparison...");
    const siameseResult = await fetch(SIAMESE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image1: image,
        image2: referenceBase64
      })
    }).then((r)=>r.json());
    const similarity = siameseResult.similarity_score || siameseResult.similarity || 0;
    console.log("Face match score:", similarity);
    // === 10. SUCCESS ===
    return new Response(JSON.stringify({
      liveness: livenessResult,
      siamese: siameseResult,
      quality_score: embedding.quality_score,
      message: "Verification successful",
      details: {
        liveness_passed: true,
        liveness_score: livenessScore,
        face_match_score: similarity,
        enrollment_verified: true,
        session_verified: true
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({
      error: "Internal server error",
      details: err.message || "Verification failed"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
// === HELPER FUNCTIONS ===
function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}
function badRequest(error, details) {
  return new Response(JSON.stringify({
    error,
    details: details || error
  }), {
    status: 400,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
function notFound(error, details) {
  return new Response(JSON.stringify({
    error,
    details: details || error
  }), {
    status: 404,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
function forbidden(error, details) {
  return new Response(JSON.stringify({
    error,
    details: details || error
  }), {
    status: 403,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for(let i = 0; i < bytes.length; i++)binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
async function loginToAspectFace() {
  const login = Deno.env.get("ASPECT_LOGIN");
  const password = Deno.env.get("ASPECT_PASSWORD");
  const project = Deno.env.get("ASPECT_PROJECT");
  if (!login || !password || !project) return null;
  const body = new URLSearchParams({
    login,
    password,
    code_project: project
  });
  const res = await fetch("https://aspectface.com/api/v1/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.token || data.access_token || data.data?.token || data.auth?.token || null;
}
async function runLivenessCheck(token, image) {
  const project = Deno.env.get("ASPECT_PROJECT");
  const res = await fetch("https://aspectface.com/api/v1/liveness", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      code_project: project,
      images: [
        {
          data: image
        }
      ]
    })
  });
  return res.ok ? await res.json() : {
    success: false,
    liveness_score: 0
  };
}
