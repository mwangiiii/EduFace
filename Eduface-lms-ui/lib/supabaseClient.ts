// src/lib/supabaseClient.ts
// Ensure your tsconfig.json has the path alias configured for '@/*' -> ['./src/*']

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Main Supabase client for admin operations with custom storage key
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: 'sb-admin-auth-token',
  }
})

/**
 * Helper function to create a new user WITHOUT switching the admin's session
 * This function:
 * 1. Saves the admin session
 * 2. Creates auth user (which temporarily switches session)
 * 3. Inserts user profile IMMEDIATELY while authenticated as new user
 * 4. Restores admin session
 * 
 * @param userData - User data including email, password, and metadata
 * @returns Object containing success status, user data, and error if any
 */
export const createUserWithoutSessionSwitch = async (userData: {
  email: string
  password: string
  metadata?: {
    first_name?: string
    last_name?: string
    role?: string
    [key: string]: any
  }
}) => {
  try {
    // Step 1: Get and validate admin session
    const { data: { session: adminSession }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !adminSession) {
      console.error('Admin session error:', sessionError)
      return { 
        success: false, 
        error: 'Admin session not found. Please log in again.',
        user: null
      }
    }

    // Store admin session tokens
    const adminAccessToken = adminSession.access_token
    const adminRefreshToken = adminSession.refresh_token

    console.log('Step 1: Admin session saved')

    // Step 2: Create the auth user using the MAIN client
    // This will temporarily switch the session to the new user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        emailRedirectTo: undefined,
        data: userData.metadata || {}
      }
    })

    if (signUpError || !authData.user) {
      console.error('Sign up error:', signUpError)
      
      // Restore admin session before returning
      await supabase.auth.setSession({
        access_token: adminAccessToken,
        refresh_token: adminRefreshToken
      })
      
      return { 
        success: false, 
        error: signUpError?.message || 'Failed to create auth user',
        user: null
      }
    }

    const newUserId = authData.user.id
    console.log('Step 2: Auth user created:', newUserId)

    // Step 3: Wait for session to fully switch (critical!)
    await new Promise(resolve => setTimeout(resolve, 200))

    // Get the current session to verify we're authenticated as the new user
    const { data: { session: newUserSession } } = await supabase.auth.getSession()
    console.log('Step 3: Current auth.uid():', newUserSession?.user?.id)
    console.log('Step 3: Matches new user ID?', newUserSession?.user?.id === newUserId)

    // If session didn't switch, we have a problem
    if (newUserSession?.user?.id !== newUserId) {
      console.error('ERROR: Session did not switch to new user!')
      // Restore admin session
      await supabase.auth.setSession({
        access_token: adminAccessToken,
        refresh_token: adminRefreshToken
      })
      return {
        success: false,
        error: 'Session synchronization failed. Please try again.',
        user: null
      }
    }

    // Step 4: Insert user profile IMMEDIATELY while authenticated as the new user
    // This is CRITICAL - the RLS policy "Users can insert own profile" requires auth.uid() = id
    const firstName = userData.metadata?.first_name || ''
    const lastName = userData.metadata?.last_name || ''
    const role = userData.metadata?.role || 'student'

    console.log('Step 4: Attempting to insert profile for user:', newUserId)

    const { data: insertData, error: profileError } = await supabase
      .from('users')
      .insert({
        id: newUserId,
        first_name: firstName,
        last_name: lastName,
        email: userData.email,
        role,
        status: 'active'
      })
      .select()

    console.log('Step 4: Insert result:', { insertData, profileError })

    // Step 5: Restore admin session IMMEDIATELY after insert (success or fail)
    console.log('Step 5: Restoring admin session')
    const { error: sessionRestoreError } = await supabase.auth.setSession({
      access_token: adminAccessToken,
      refresh_token: adminRefreshToken
    })

    if (sessionRestoreError) {
      console.error('Session restoration error:', sessionRestoreError)
      // Try to recover by refreshing session
      await supabase.auth.refreshSession()
    }

    // Verify admin session is restored
    const { data: { session: restoredSession } } = await supabase.auth.getSession()
    console.log('Step 5: Admin session restored?', restoredSession?.user?.id === adminSession.user.id)

    // Step 6: Return appropriate response
    if (profileError) {
      console.error('Profile creation error:', profileError)
      return { 
        success: false, // Changed to false since profile creation failed
        user: authData.user,
        error: `Profile creation failed: ${profileError.message}`
      }
    }

    console.log('Success: User created with profile')
    return { 
      success: true, 
      user: authData.user,
      error: null
    }

  } catch (error: any) {
    console.error('Unexpected error in createUserWithoutSessionSwitch:', error)
    
    // Attempt to restore admin session even on unexpected error
    try {
      const { data: { session: adminSession } } = await supabase.auth.getSession()
      if (adminSession) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token
        })
      }
    } catch (restoreErr) {
      console.error('Failed to restore admin session:', restoreErr)
    }
    
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred',
      user: null
    }
  }
}

// Export default client for general use
export default supabase