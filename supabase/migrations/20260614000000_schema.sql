-- Enable pgcrypto extension in extensions schema if not enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Create custom types / enums
CREATE TYPE public.user_role AS ENUM ('admin', 'mentor', 'student');
CREATE TYPE public.user_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.exam_status AS ENUM ('draft', 'published', 'completed');
CREATE TYPE public.attempt_status AS ENUM ('started', 'submitted', 'abandoned', 'auto_submitted');
CREATE TYPE public.question_option AS ENUM ('A', 'B', 'C', 'D');
CREATE TYPE public.difficulty_level AS ENUM ('easy', 'medium', 'hard');

-- 2. Create Users table (synchronized with auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT UNIQUE NOT NULL,
    role public.user_role NOT NULL DEFAULT 'student',
    status public.user_status NOT NULL DEFAULT 'pending',
    profile_picture TEXT,
    profile_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Subjects table
CREATE TABLE public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Mentor Subjects table (M-to-M link)
CREATE TABLE public.mentor_subjects (
    mentor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    PRIMARY KEY (mentor_id, subject_id)
);

-- 5. Create Student Subjects table (M-to-M link)
CREATE TABLE public.student_subjects (
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    PRIMARY KEY (student_id, subject_id)
);

-- 6. Create Question Bank table (Subject-wise, Difficulty, Tags)
CREATE TABLE public.question_bank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    question_title TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer public.question_option NOT NULL,
    difficulty public.difficulty_level NOT NULL DEFAULT 'medium',
    tags TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create Exams table
CREATE TABLE public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    description TEXT,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    total_marks INT DEFAULT 0,
    passing_marks INT DEFAULT 0,
    status public.exam_status NOT NULL DEFAULT 'draft',
    allow_backtracking BOOLEAN NOT NULL DEFAULT FALSE,
    randomize_questions BOOLEAN NOT NULL DEFAULT FALSE,
    randomize_options BOOLEAN NOT NULL DEFAULT FALSE,
    max_attempts INT NOT NULL DEFAULT 1,
    allow_retake BOOLEAN NOT NULL DEFAULT FALSE,
    warning_limit INT NOT NULL DEFAULT 3,
    auto_submit_after_limit BOOLEAN NOT NULL DEFAULT TRUE,
    exam_duration_minutes INT, -- overall timer
    show_result_after_submit BOOLEAN NOT NULL DEFAULT TRUE,
    show_correct_answers BOOLEAN NOT NULL DEFAULT TRUE,
    negative_marking BOOLEAN NOT NULL DEFAULT FALSE,
    negative_mark_value NUMERIC(4,2) DEFAULT 0.25,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Create Questions table (exam-specific)
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
    question_bank_id UUID REFERENCES public.question_bank(id) ON DELETE SET NULL,
    question_title TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer public.question_option NOT NULL,
    marks INT NOT NULL DEFAULT 1,
    time_limit INT NOT NULL DEFAULT 30, -- seconds
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Create Exam Attempts table
CREATE TABLE public.exam_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status public.attempt_status NOT NULL DEFAULT 'started',
    warnings_count INT NOT NULL DEFAULT 0,
    attempt_number INT NOT NULL DEFAULT 1,
    question_order UUID[] DEFAULT '{}', -- randomized order of question IDs
    option_orders JSONB DEFAULT '{}'::jsonb, -- mapping: question_id -> option array e.g., ["C", "B", "A", "D"]
    current_question_index INT DEFAULT 0,
    time_remaining_seconds INT,
    UNIQUE (exam_id, student_id, attempt_number)
);

-- 10. Create Exam Answers table
CREATE TABLE public.exam_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_option public.question_option,
    is_correct BOOLEAN,
    marks_obtained NUMERIC(6,2) DEFAULT 0.00,
    answered_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (attempt_id, question_id)
);

-- 11. Create Results table
CREATE TABLE public.results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID UNIQUE REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
    exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    total_questions INT NOT NULL,
    correct_answers INT NOT NULL,
    wrong_answers INT NOT NULL,
    skipped_questions INT NOT NULL,
    total_marks INT NOT NULL,
    obtained_marks NUMERIC(6,2) NOT NULL,
    percentage NUMERIC(5,2) NOT NULL,
    is_passed BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Create Rankings table (cached stats for leaderboards)
CREATE TABLE public.rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE, -- null if overall ranking
    rank INT NOT NULL,
    total_marks_obtained NUMERIC(8,2) NOT NULL,
    average_percentage public.difficulty_level, -- Not used, changing type to numeric
    average_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, subject_id)
);

-- 13. Create Cheating Logs table
CREATE TABLE public.cheating_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    details TEXT,
    logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Create Notifications table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- Null means broadcast
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Create Announcements table
CREATE TABLE public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    publish_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Create Activity Logs table
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cheating_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- Helper Database Functions
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = user_uuid AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_mentor(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = user_uuid AND role = 'mentor'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_mentor_of_subject(user_uuid UUID, subject_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.mentor_subjects
    WHERE mentor_id = user_uuid AND subject_id = subject_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_student_of_subject(user_uuid UUID, subject_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.student_subjects
    WHERE student_id = user_uuid AND subject_id = subject_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--------------------------------------------------------------------------------
-- Row Level Security (RLS) Policies
--------------------------------------------------------------------------------

-- Public Users Policies
CREATE POLICY "Allow public read for authenticated" ON public.users
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow update for users on their own profiles" ON public.users
    FOR UPDATE USING (auth.uid() = id OR public.is_admin(auth.uid()));

CREATE POLICY "Admin full access on users" ON public.users
    FOR ALL USING (public.is_admin(auth.uid()));

-- Subjects Policies
CREATE POLICY "Allow select for authenticated" ON public.subjects
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin full access on subjects" ON public.subjects
    FOR ALL USING (public.is_admin(auth.uid()));

-- Mentor Subjects Policies
CREATE POLICY "Allow read mentor subjects" ON public.mentor_subjects
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin full access on mentor subjects" ON public.mentor_subjects
    FOR ALL USING (public.is_admin(auth.uid()));

-- Student Subjects Policies
CREATE POLICY "Allow read student subjects" ON public.student_subjects
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin full access on student subjects" ON public.student_subjects
    FOR ALL USING (public.is_admin(auth.uid()));

-- Question Bank Policies
CREATE POLICY "Mentor and Admin read question bank" ON public.question_bank
    FOR SELECT USING (public.is_admin(auth.uid()) OR public.is_mentor(auth.uid()));

CREATE POLICY "Mentor and Admin modify question bank" ON public.question_bank
    FOR ALL USING (public.is_admin(auth.uid()) OR public.is_mentor_of_subject(auth.uid(), subject_id));

-- Exams Policies
CREATE POLICY "Select exams if enrolled or is admin/mentor" ON public.exams
    FOR SELECT USING (
        public.is_admin(auth.uid()) OR 
        public.is_mentor(auth.uid()) OR 
        (status = 'published' AND public.is_student_of_subject(auth.uid(), subject_id))
    );

CREATE POLICY "Mentor and Admin modify exams" ON public.exams
    FOR ALL USING (public.is_admin(auth.uid()) OR public.is_mentor_of_subject(auth.uid(), subject_id));

-- Questions Policies
CREATE POLICY "Select questions if admin/mentor or taking active attempt" ON public.questions
    FOR SELECT USING (
        public.is_admin(auth.uid()) OR 
        public.is_mentor(auth.uid()) OR 
        EXISTS (
            SELECT 1 FROM public.exam_attempts ea
            JOIN public.exams e ON e.id = ea.exam_id
            WHERE ea.student_id = auth.uid() 
              AND ea.exam_id = exam_id 
              AND ea.status = 'started'
        )
    );

CREATE POLICY "Mentor and Admin modify questions" ON public.questions
    FOR ALL USING (
        public.is_admin(auth.uid()) OR 
        EXISTS (
            SELECT 1 FROM public.exams e
            WHERE e.id = exam_id AND public.is_mentor_of_subject(auth.uid(), e.subject_id)
        )
    );

-- Exam Attempts Policies
CREATE POLICY "Select attempts if owner or admin/mentor" ON public.exam_attempts
    FOR SELECT USING (
        student_id = auth.uid() OR 
        public.is_admin(auth.uid()) OR 
        public.is_mentor(auth.uid())
    );

CREATE POLICY "Students insert own attempt" ON public.exam_attempts
    FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students modify own attempt or Admin/Mentor controls" ON public.exam_attempts
    FOR UPDATE USING (
        student_id = auth.uid() OR 
        public.is_admin(auth.uid()) OR 
        public.is_mentor(auth.uid())
    );

-- Exam Answers Policies
CREATE POLICY "Select answers if owner or admin/mentor" ON public.exam_answers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.exam_attempts ea
            WHERE ea.id = attempt_id AND ea.student_id = auth.uid()
        ) OR 
        public.is_admin(auth.uid()) OR 
        public.is_mentor(auth.uid())
    );

CREATE POLICY "Students insert own answers" ON public.exam_answers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.exam_attempts ea
            WHERE ea.id = attempt_id AND ea.student_id = auth.uid() AND ea.status = 'started'
        )
    );

CREATE POLICY "Students update own answers" ON public.exam_answers
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.exam_attempts ea
            WHERE ea.id = attempt_id AND ea.student_id = auth.uid() AND ea.status = 'started'
        )
    );

-- Results Policies
CREATE POLICY "Select results if owner or admin/mentor" ON public.results
    FOR SELECT USING (
        student_id = auth.uid() OR 
        public.is_admin(auth.uid()) OR 
        public.is_mentor(auth.uid())
    );

CREATE POLICY "Enable result actions" ON public.results
    FOR ALL USING (
        student_id = auth.uid() OR 
        public.is_admin(auth.uid()) OR 
        public.is_mentor(auth.uid())
    );

-- Rankings Policies
CREATE POLICY "Read rankings" ON public.rankings
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manage rankings" ON public.rankings
    FOR ALL USING (public.is_admin(auth.uid()));

-- Cheating Logs Policies
CREATE POLICY "Read cheating logs" ON public.cheating_logs
    FOR SELECT USING (public.is_admin(auth.uid()) OR public.is_mentor(auth.uid()));

CREATE POLICY "Students insert cheating logs" ON public.cheating_logs
    FOR INSERT WITH CHECK (student_id = auth.uid());

-- Notifications Policies
CREATE POLICY "Read own notifications" ON public.notifications
    FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Update own notifications (mark read)" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid());

-- Announcements Policies
CREATE POLICY "Read announcements" ON public.announcements
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin manage announcements" ON public.announcements
    FOR ALL USING (public.is_admin(auth.uid()));

-- Activity Logs Policies
CREATE POLICY "Read activity logs" ON public.activity_logs
    FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Insert activity logs" ON public.activity_logs
    FOR INSERT WITH CHECK (user_id = auth.uid());


--------------------------------------------------------------------------------
-- Auth Triggers & Synchronization
--------------------------------------------------------------------------------

-- Trigger logic to automatically synchronize auth.users with public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role_val public.user_role := 'student';
  user_status_val public.user_status := 'pending';
  meta_role TEXT;
  meta_full_name TEXT;
  meta_phone TEXT;
BEGIN
  -- Extract metadata from raw_user_meta_data JSON
  meta_role := new.raw_user_meta_data->>'role';
  meta_full_name := new.raw_user_meta_data->>'full_name';
  meta_phone := new.raw_user_meta_data->>'phone';

  IF meta_role = 'admin' THEN
    user_role_val := 'admin';
    user_status_val := 'approved';
  ELSIF meta_role = 'mentor' THEN
    user_role_val := 'mentor';
    user_status_val := 'pending';
  ELSE
    user_role_val := 'student';
    user_status_val := 'pending';
  END IF;

  INSERT INTO public.users (id, full_name, phone, email, role, status, profile_completed)
  VALUES (
    new.id,
    COALESCE(meta_full_name, split_part(new.email, '@', 1)),
    meta_phone,
    new.email,
    user_role_val,
    user_status_val,
    (meta_role = 'admin') -- admin is completed, others complete on first login/profile
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--------------------------------------------------------------------------------
-- Seeding Default Admin Account
--------------------------------------------------------------------------------

DO $$
DECLARE
    admin_id UUID := 'd3b07384-d113-4c9f-8636-f0894082260f'; -- Static UUID for reproducible seeding
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'luminous@shamshedhaider.com') THEN
        -- Insert into auth.users (encrypting password 'Luminous@123')
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            admin_id,
            'authenticated',
            'authenticated',
            'luminous@shamshedhaider.com',
            extensions.crypt('Luminous@123', extensions.gen_salt('bf')),
            now(),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            '{"role": "admin", "full_name": "SH Tech Zone Admin"}'::jsonb,
            now(),
            now(),
            '',
            '',
            '',
            ''
        );

        -- Insert into public.users (will also be handled by trigger, but ON CONFLICT safeguards it)
        INSERT INTO public.users (
            id,
            full_name,
            phone,
            email,
            role,
            status,
            profile_completed
        ) VALUES (
            admin_id,
            'SH Tech Zone Admin',
            '+8801700000000',
            'luminous@shamshedhaider.com',
            'admin',
            'approved',
            TRUE
        ) ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;
