// app/api/profile/route.ts

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/* ----------------------------------------------------------
   GET USER PROFILE
------------------------------------------------------------- */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set(name, value, options);
          },
          remove(name: string, options: any) {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          },
        },
      }
    );

    const { data, error: authError } = await supabase.auth.getUser();
    const user = data?.user;

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profileData, error } = await supabase
      .from('users')
      .select(`
        id, first_name, last_name, date_of_birth, phone, address, email, role,
        students (
          id, student_id, enrollment_date
        ),
        face_embeddings (
          quality_score, last_enrolled
        ),
        enrollments (
          status,
          courses (
            id, name
          )
        )
      `)
      .eq('id', user.id)
      .single();

    if (error || !profileData) {
      console.error('Profile fetch error:', error);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const student = profileData.students?.[0];
    const faceEmbedding = profileData.face_embeddings?.[0];
    const enrolledCourses =
      profileData.enrollments?.map((e: any) => ({
        id: e.courses.id,
        name: e.courses.name,
        status: e.status,
      })) ?? [];

    return NextResponse.json({
      user: {
        id: profileData.id,
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        date_of_birth: profileData.date_of_birth ?? null,
        phone: profileData.phone ?? null,
        address: profileData.address ?? null,
        email: profileData.email,
        role: profileData.role,
      },
      student:
        profileData.role === 'student' && student
          ? {
              id: student.id,
              user_id: profileData.id,
              student_id: student.student_id,
              enrollment_date: student.enrollment_date,
            }
          : undefined,
      faceEnrolled: !!faceEmbedding,
      faceQuality: faceEmbedding?.quality_score ?? null,
      lastEnrolled: faceEmbedding?.last_enrolled ?? null,
      enrolledCourses,
    });
  } catch (error) {
    console.error('Failed to fetch profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ----------------------------------------------------------
   UPDATE PROFILE
------------------------------------------------------------- */
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set(name, value, options);
          },
          remove(name: string, options: any) {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          },
        },
      }
    );

    const { data, error: authError } = await supabase.auth.getUser();
    const user = data?.user;

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const body = await request.json();

    const { first_name, last_name, email, date_of_birth, phone, address } = body;

    if (!first_name || !last_name || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('users')
      .update({
        first_name,
        last_name,
        email,
        date_of_birth: date_of_birth || null,
        phone: phone || null,
        address: address || null,
      })
      .eq('id', userId);

    if (error) {
      console.error('Supabase Update Error:', error);
      return NextResponse.json(
        { error: error.message ?? 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Failed to update profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}