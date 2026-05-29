import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://unqgoopxwjxjenkyxgxr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucWdvb3B4d2p4amVua3l4Z3hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzODUwNTEsImV4cCI6MjA5NDk2MTA1MX0.RmZEKnoZyQpsk2hvQGVx3QbWg9yOWYBaYKToOrFo7lI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'budget' },
})
