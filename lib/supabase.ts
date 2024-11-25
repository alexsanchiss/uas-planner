import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gkjjegbhetkybajfjcva.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdramplZ2JoZXRreWJhamZqY3ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjkxNTc5MTcsImV4cCI6MjA0NDczMzkxN30.xihCj1PQDSftUmgmrDcOknu4SMwT5tqYmpcNBVPwH30';

export const supabase = createClient(supabaseUrl, supabaseKey);
