import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { Client } from 'pg';

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
if (!connectionString) {
  console.error('Error: DIRECT_URL or DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const storageSql = `
-- Create buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-assets', 'exam-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if they exist to prevent duplication errors
DROP POLICY IF EXISTS "Public Access Profile Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert Profile Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Profile Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Profile Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Access Exam Assets" ON storage.objects;
DROP POLICY IF EXISTS "Admin/Mentor Access Exam Assets" ON storage.objects;

-- Create storage policies
-- 1. Public Read access for profile-images
CREATE POLICY "Public Access Profile Images" ON storage.objects
    FOR SELECT USING (bucket_id = 'profile-images');

-- 2. Authenticated Insert access for profile-images
CREATE POLICY "Authenticated Insert Profile Images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'profile-images' AND auth.role() = 'authenticated');

-- 3. Authenticated Update/Delete own profile-images
CREATE POLICY "Authenticated Update Profile Images" ON storage.objects
    FOR UPDATE USING (bucket_id = 'profile-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated Delete Profile Images" ON storage.objects
    FOR DELETE USING (bucket_id = 'profile-images' AND auth.role() = 'authenticated');

-- 4. Public Access for exam-assets
CREATE POLICY "Public Access Exam Assets" ON storage.objects
    FOR SELECT USING (bucket_id = 'exam-assets');

-- 5. Admin/Mentor full access to exam-assets
CREATE POLICY "Admin/Mentor Access Exam Assets" ON storage.objects
    FOR ALL USING (
        bucket_id = 'exam-assets' AND (
            public.is_admin(auth.uid()) OR public.is_mentor(auth.uid())
        )
    );
`;

async function setupStorage() {
  console.log('Starting Supabase Storage configuration...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    await client.query(storageSql);
    console.log('Successfully configured Supabase Storage buckets and security policies!');
  } catch (err: any) {
    console.error('Error configuring storage:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupStorage();
