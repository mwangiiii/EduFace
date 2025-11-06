// supabase/functions/enroll-face/index.ts
// Supabase Edge Function for facial recognition enrollment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authorization token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create a clean auth client to verify the JWT token
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Verify user is authenticated using the token
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Authenticated user:', user.id);

    // Create admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { student_id, student_uuid, images } = body;

    console.log('Enrollment request:', {
      student_id,
      student_uuid,
      imageCount: images?.length,
      user_id: user.id
    });

    // Validate input
    if (!student_uuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(student_uuid)) {
      return new Response(
        JSON.stringify({ error: 'Invalid student UUID' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!images || !Array.isArray(images) || images.length < 15) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request. Need at least 15 images.',
          received: images?.length || 0
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify student exists and belongs to authenticated user
    console.log('Querying student:', student_uuid);
    const { data: studentData, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, student_id, user_id')
      .eq('id', student_uuid)
      .single();

    if (studentError || !studentData) {
      console.error('Student verification error:', studentError);
      return new Response(
        JSON.stringify({
          error: 'Student not found',
          details: studentError?.message
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (studentData.user_id !== user.id) {
      console.error('User mismatch:', {
        student_user: studentData.user_id,
        auth_user: user.id
      });
      return new Response(
        JSON.stringify({
          error: 'Unauthorized: Student does not belong to this user'
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Student verified:', studentData);

    // Calculate quality metrics
    const frontalCount = images.filter((img: any) => img.angle === 'frontal').length;
    const leftCount = images.filter((img: any) => img.angle === 'left').length;
    const rightCount = images.filter((img: any) => img.angle === 'right').length;
    const angleBalance = Math.min(frontalCount, leftCount, rightCount) / 5;
    const totalQuality = (images.length / 15) * angleBalance;
    const qualityScore = Math.min(totalQuality, 1.0);

    console.log('Quality metrics:', {
      frontal: frontalCount,
      left: leftCount,
      right: rightCount,
      balance: angleBalance,
      quality: qualityScore
    });

    // TODO: Process images and generate real face embeddings
    // For now, create mock embedding as Float32Array (128-dimensional)
    const mockEmbedding = new Float32Array(128);
    mockEmbedding[0] = qualityScore; // Store quality in first dimension

    // Convert Float32Array to Uint8Array (BYTEA format)
    const embeddingBytes = new Uint8Array(mockEmbedding.buffer);

    // Check if enrollment already exists
    console.log('Checking existing embedding for:', student_uuid);
    const { data: existingEmbedding, error: existingError } = await supabaseAdmin
      .from('face_embeddings')
      .select('id')
      .eq('student_id', student_uuid)
      .maybeSingle();

    if (existingError) {
      console.error('Existing check error:', existingError);
      throw new Error(`Failed to check existing: ${existingError.message}`);
    }

    let result;
    const timestamp = new Date().toISOString();

    if (existingEmbedding) {
      // Update existing enrollment
      console.log('Updating existing enrollment');
      const { data, error: updateError } = await supabaseAdmin
        .from('face_embeddings')
        .update({
          embedding: embeddingBytes,
          quality_score: qualityScore,
          creation_timestamp: timestamp,
          updated_at: timestamp
        })
        .eq('student_id', student_uuid)
        .select();

      if (updateError) {
        console.error('Update error:', updateError);
        throw new Error(`Update failed: ${updateError.message}`);
      }
      result = data;
      console.log('Enrollment updated successfully');
    } else {
      // Insert new enrollment
      console.log('Inserting new enrollment');
      const { data, error: insertError } = await supabaseAdmin
        .from('face_embeddings')
        .insert({
          student_id: student_uuid,
          embedding: embeddingBytes,
          quality_score: qualityScore,
          creation_timestamp: timestamp,
          updated_at: timestamp
        })
        .select();

      if (insertError) {
        console.error('Insert error:', insertError);
        throw new Error(`Insert failed: ${insertError.message}`);
      }
      result = data;
      console.log('Enrollment created successfully');
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Face enrollment successful',
        quality_score: qualityScore,
        student_id: student_id,
        images_processed: images.length,
        timestamp: timestamp
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Enrollment function error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});