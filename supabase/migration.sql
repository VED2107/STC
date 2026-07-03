-- STC Tuition Platform - Supabase schema (optimized).
-- Safe to re-run in the Supabase SQL editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

----------------------------------------------------------------------
-- 1. CORE TABLES
----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin', 'super_admin')),
  avatar_url TEXT,
  parent_phone TEXT,
  profile_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill email column for existing installations
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Rerunnable super-admin role access.
-- This account inherits every admin RLS policy and is the only account allowed to use destructive reset tooling.
DO $$ BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('student', 'teacher', 'admin', 'super_admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Populate email from auth.users for existing profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL AND u.email IS NOT NULL;

UPDATE public.profiles p
SET role = 'super_admin',
    email = COALESCE(NULLIF(p.email, ''), u.email),
    updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = 'vedchauhan2107@gmail.com'
  AND p.role IS DISTINCT FROM 'super_admin';

CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  board TEXT NOT NULL CHECK (board IN ('GSEB', 'CBSE')),
  level TEXT NOT NULL CHECK (level IN ('1','2','3','4','5','6','7','8','9','SSC','HSC')),
  capacity INTEGER NOT NULL DEFAULT 30 CHECK (capacity >= 1),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_board_check;
  ALTER TABLE public.classes
    ADD CONSTRAINT classes_board_check
    CHECK (board IN ('GSEB', 'CBSE'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE public.classes
SET board = 'CBSE'
WHERE board = 'NCERT';

CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  bio TEXT,
  photo_url TEXT,
  qualification TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  is_online_only BOOLEAN NOT NULL DEFAULT false,
  thumbnail_url TEXT,
  video_link TEXT,
  pdf_url TEXT,
  fee_inr INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_type TEXT NOT NULL DEFAULT 'tuition' CHECK (student_type IN ('tuition', 'online')),
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fees tracking columns (backfill for existing installations)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS fees_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS fees_full_payment_paid BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS fees_installment1_paid BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS fees_installment2_paid BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS is_online_only BOOLEAN NOT NULL DEFAULT false;

UPDATE public.students
SET fees_installment1_paid = true,
    fees_installment2_paid = true
WHERE fees_full_payment_paid = true
  AND (fees_installment1_paid = false OR fees_installment2_paid = false);

DO $$ BEGIN
  ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_fees_full_payment_consistent;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.students
  ADD CONSTRAINT students_fees_full_payment_consistent
  CHECK (NOT fees_full_payment_paid OR (fees_installment1_paid AND fees_installment2_paid));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_fees ON public.students(fees_installment1_paid, fees_installment2_paid);
CREATE INDEX IF NOT EXISTS idx_students_fees_full_payment ON public.students(fees_full_payment_paid);

CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
  UNIQUE (student_id, course_id)
);

CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent')),
  late_minutes INTEGER CHECK (late_minutes IS NULL OR late_minutes >= 0),
  remarks TEXT,
  marked_by UUID NOT NULL REFERENCES public.profiles(id),
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  scan_method TEXT NOT NULL DEFAULT 'manual' CHECK (scan_method IN ('manual', 'qr')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);

-- Backfill columns for existing installations
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_in_at TIMESTAMPTZ;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_out_at TIMESTAMPTZ;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS scan_method TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL;
DO $$ BEGIN
  ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_teacher_id_fkey;
  ALTER TABLE public.attendance
    ADD CONSTRAINT attendance_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_scan_method_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.attendance ADD CONSTRAINT attendance_scan_method_check CHECK (scan_method IN ('manual', 'qr'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('pdf', 'notes', 'video', 'link')),
  file_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.materials
  ALTER COLUMN course_id DROP NOT NULL;

ALTER TABLE public.materials
  DROP CONSTRAINT IF EXISTS materials_course_id_fkey;

ALTER TABLE public.materials
  ADD CONSTRAINT materials_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL;

ALTER TABLE public.materials
  DROP CONSTRAINT IF EXISTS materials_type_check;

ALTER TABLE public.materials
  ADD CONSTRAINT materials_type_check
  CHECK (type IN ('pdf', 'notes', 'video', 'link'));

CREATE TABLE IF NOT EXISTS public.syllabus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, subject)
);

DO $$
DECLARE
  board_name TEXT;
  class_level TEXT;
  sort_seed INTEGER := 100;
BEGIN
  FOREACH board_name IN ARRAY ARRAY['GSEB', 'CBSE']
  LOOP
    FOREACH class_level IN ARRAY ARRAY['1','2','3','4','5','6','7','8','9']
    LOOP
      INSERT INTO public.classes (name, board, level, capacity, sort_order)
      SELECT
        'Class ' || class_level,
        board_name,
        class_level,
        30,
        sort_seed
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.classes
        WHERE board = board_name
          AND level = class_level
          AND name = 'Class ' || class_level
      );

      sort_seed := sort_seed + 1;
    END LOOP;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('absence', 'general', 'checkout')),
  message TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms')),
  delivery_type TEXT NOT NULL DEFAULT 'whatsapp' CHECK (delivery_type IN ('whatsapp', 'sms')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('sent', 'failed', 'pending')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Widen notifications type CHECK for existing installations
DO $$ BEGIN
  ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('absence', 'general', 'checkout'));
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.teacher_class_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_profile_id, class_id)
);

CREATE TABLE IF NOT EXISTS public.teacher_subject_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_profile_id, class_id, subject)
);

CREATE TABLE IF NOT EXISTS public.qr_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT md5(gen_random_uuid()::text || clock_timestamp()::text || random()::text),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL DEFAULT 'razorpay' CHECK (gateway IN ('razorpay')),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR')),
  amount_inr INTEGER NOT NULL DEFAULT 0 CHECK (amount_inr >= 0),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'captured', 'failed')),
  gateway_order_id TEXT UNIQUE,
  gateway_payment_id TEXT,
  gateway_signature TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notify PostgREST of schema changes
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- Backfill: ensure notifications.delivery_type / courses.subject are populated
UPDATE public.notifications SET delivery_type = channel
WHERE delivery_type IS NULL OR delivery_type NOT IN ('whatsapp', 'sms');

UPDATE public.courses SET subject = COALESCE(NULLIF(subject, ''), title)
WHERE subject IS NULL OR subject = '';

----------------------------------------------------------------------
-- 2. FUNCTIONS
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND public.is_admin() = false THEN
    RAISE EXCEPTION 'Not allowed to change role';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_student_phone_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.phone IS DISTINCT FROM OLD.phone
     AND auth.uid() = OLD.id
     AND public.is_admin() = false
     AND OLD.role = 'student'
     AND COALESCE(NULLIF(BTRIM(OLD.phone), ''), '') <> '' THEN
    RAISE EXCEPTION 'Student phone number can only be changed by admin after it is first saved';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'student'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NULLIF(profiles.full_name, ''), EXCLUDED.full_name),
    phone     = COALESCE(NULLIF(profiles.phone, ''), EXCLUDED.phone),
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_student_fee_flags()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.fees_full_payment_paid, false) THEN
    NEW.fees_installment1_paid := true;
    NEW.fees_installment2_paid := true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_attendance_teacher_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.teacher_id := (
    SELECT t.id
    FROM public.teachers t
    WHERE t.profile_id = NEW.marked_by
    LIMIT 1
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_attendance_session_teacher_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.teacher_id := (
    SELECT t.id
    FROM public.teachers t
    WHERE t.profile_id = NEW.created_by
    LIMIT 1
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'));
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
      AND lower(COALESCE(p.email, u.email)) = 'vedchauhan2107@gmail.com'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher');
$$;

CREATE OR REPLACE FUNCTION public.teacher_has_class_access(p_class_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_class_access tca
    WHERE tca.teacher_profile_id = auth.uid() AND tca.class_id = p_class_id
  );
$$;

CREATE OR REPLACE FUNCTION public.teacher_has_course_access(p_course_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses c
    JOIN public.teacher_class_access tca ON tca.class_id = c.class_id
    WHERE c.id = p_course_id AND tca.teacher_profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.student_has_material_access(p_material_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.materials m ON m.id = p_material_id
    WHERE s.profile_id = auth.uid() AND s.is_active = true
      AND (
        (s.student_type = 'tuition' AND s.class_id = m.class_id)
        OR (s.student_type = 'online' AND EXISTS (
          SELECT 1
          FROM public.enrollments e
          JOIN public.courses c ON c.id = e.course_id
          WHERE e.student_id = s.id
            AND e.status = 'active'
            AND (
              (m.course_id IS NOT NULL AND e.course_id = m.course_id)
              OR (m.course_id IS NULL AND c.class_id = m.class_id)
            )
        ))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.student_has_syllabus_access(p_class_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.profile_id = auth.uid() AND s.is_active = true
      AND (
        (s.student_type = 'tuition' AND s.class_id = p_class_id)
        OR (s.student_type = 'online' AND EXISTS (
          SELECT 1 FROM public.enrollments e
          JOIN public.courses c ON c.id = e.course_id
          WHERE e.student_id = s.id AND e.status = 'active' AND c.class_id = p_class_id
        ))
      )
  );
$$;

-- Enrollment synchronization
CREATE OR REPLACE FUNCTION public.sync_student_enrollments(p_student_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_class_id UUID; v_is_active BOOLEAN; v_student_type TEXT;
BEGIN
  SELECT class_id, is_active, student_type INTO v_class_id, v_is_active, v_student_type
  FROM public.students WHERE id = p_student_id;

  IF v_class_id IS NULL THEN RETURN; END IF;

  IF COALESCE(v_is_active, false) = false THEN
    UPDATE public.enrollments SET status = 'dropped'
    WHERE student_id = p_student_id AND status <> 'completed';
    RETURN;
  END IF;

  IF COALESCE(v_student_type, 'tuition') = 'online' THEN RETURN; END IF;

  INSERT INTO public.enrollments (student_id, course_id, status)
  SELECT p_student_id, c.id, 'active' FROM public.courses c
  WHERE c.class_id = v_class_id AND c.is_active = true AND COALESCE(c.is_online_only, false) = false
  ON CONFLICT (student_id, course_id) DO UPDATE SET status = 'active';

  UPDATE public.enrollments e SET status = 'dropped'
  FROM public.courses c
  WHERE e.course_id = c.id AND e.student_id = p_student_id
    AND e.status <> 'completed'
    AND (c.class_id <> v_class_id OR c.is_active = false);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_student_enrollment_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.sync_student_enrollments(NEW.id); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.handle_course_enrollment_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.enrollments SET status = 'dropped'
    WHERE course_id = OLD.id AND status <> 'completed';
    RETURN OLD;
  END IF;

  INSERT INTO public.enrollments (student_id, course_id, status)
  SELECT s.id, NEW.id, 'active' FROM public.students s
  WHERE s.class_id = NEW.class_id AND s.is_active = true
    AND s.student_type = 'tuition' AND NEW.is_active = true AND COALESCE(NEW.is_online_only, false) = false
  ON CONFLICT (student_id, course_id) DO UPDATE
  SET status = CASE WHEN NEW.is_active THEN 'active' ELSE 'dropped' END;

  UPDATE public.enrollments SET status = 'dropped'
  WHERE course_id = NEW.id AND status <> 'completed'
    AND (NEW.is_active = false OR student_id IN (
      SELECT id FROM public.students
      WHERE student_type = 'tuition' AND (class_id <> NEW.class_id OR is_active = false)
    ));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_absence_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'absent' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.notifications (student_id, type, message, channel, delivery_type, status)
    VALUES (NEW.student_id, 'absence', 'You were marked absent on ' || NEW.date::text, 'whatsapp', 'whatsapp', 'pending');
  END IF;
  RETURN NEW;
END;
$$;

----------------------------------------------------------------------
-- 3. TRIGGERS (loop-based for updated_at)
----------------------------------------------------------------------

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['profiles','classes','teachers','courses','students','course_payments','materials','syllabus'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at_%1$s ON public.%1$I', tbl);
    EXECUTE format('CREATE TRIGGER set_updated_at_%1$s BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', tbl);
  END LOOP;
END $$;

-- Profile-specific triggers
DROP TRIGGER IF EXISTS prevent_profile_role_change ON public.profiles;
CREATE TRIGGER prevent_profile_role_change
  BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_change();

DROP TRIGGER IF EXISTS prevent_tuition_student_phone_change ON public.profiles;
DROP TRIGGER IF EXISTS prevent_student_phone_change ON public.profiles;
CREATE TRIGGER prevent_student_phone_change
  BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_student_phone_change();

-- Auth trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enrollment sync triggers
DROP TRIGGER IF EXISTS sync_student_enrollments_on_students ON public.students;
CREATE TRIGGER sync_student_enrollments_on_students
  AFTER INSERT OR UPDATE OF class_id, is_active, student_type ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.handle_student_enrollment_sync();

DROP TRIGGER IF EXISTS normalize_student_fee_flags ON public.students;
CREATE TRIGGER normalize_student_fee_flags
  BEFORE INSERT OR UPDATE OF fees_full_payment_paid, fees_installment1_paid, fees_installment2_paid ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.normalize_student_fee_flags();

DROP TRIGGER IF EXISTS set_attendance_teacher_id ON public.attendance;
CREATE TRIGGER set_attendance_teacher_id
  BEFORE INSERT OR UPDATE OF marked_by ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_attendance_teacher_id();

DROP TRIGGER IF EXISTS sync_course_enrollments_on_courses ON public.courses;
CREATE TRIGGER sync_course_enrollments_on_courses
  AFTER INSERT OR UPDATE OF class_id, is_active ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.handle_course_enrollment_sync();

DROP TRIGGER IF EXISTS sync_course_enrollments_on_courses_delete ON public.courses;
CREATE TRIGGER sync_course_enrollments_on_courses_delete
  AFTER DELETE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.handle_course_enrollment_sync();

-- Absence notification trigger
DROP TRIGGER IF EXISTS on_attendance_absent ON public.attendance;
CREATE TRIGGER on_attendance_absent
  AFTER INSERT OR UPDATE OF status ON public.attendance
  FOR EACH ROW WHEN (NEW.status = 'absent')
  EXECUTE FUNCTION public.enqueue_absence_notification();

-- Backfill enrollments for existing data
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.students LOOP
    PERFORM public.sync_student_enrollments(r.id);
  END LOOP;
END $$;

----------------------------------------------------------------------
-- 4. INDEXES
----------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_profiles_role                       ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_classes_sort_order                   ON public.classes(sort_order);
CREATE INDEX IF NOT EXISTS idx_teachers_name                       ON public.teachers(name);
CREATE INDEX IF NOT EXISTS idx_courses_class_id                    ON public.courses(class_id);
CREATE INDEX IF NOT EXISTS idx_courses_class_subject               ON public.courses(class_id, subject);
CREATE INDEX IF NOT EXISTS idx_courses_teacher_id                  ON public.courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_courses_is_active                   ON public.courses(is_active);
CREATE INDEX IF NOT EXISTS idx_courses_online_active               ON public.courses(is_online_only, is_active);
CREATE INDEX IF NOT EXISTS idx_students_profile_id                 ON public.students(profile_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id                   ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_is_active                  ON public.students(is_active);
CREATE INDEX IF NOT EXISTS idx_students_class_active               ON public.students(class_id, is_active);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id              ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id               ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status                  ON public.enrollments(status);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id               ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_teacher_id               ON public.attendance(teacher_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class_id                 ON public.attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_course_id                ON public.attendance(course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date                     ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_materials_course_id                 ON public.materials(course_id);
CREATE INDEX IF NOT EXISTS idx_materials_class_id                  ON public.materials(class_id);
CREATE INDEX IF NOT EXISTS idx_materials_class_subject             ON public.materials(class_id, subject);
CREATE INDEX IF NOT EXISTS idx_materials_class_sort_order          ON public.materials(class_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_syllabus_class_id                   ON public.syllabus(class_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_class_subject               ON public.syllabus(class_id, subject);
CREATE INDEX IF NOT EXISTS idx_notifications_student_id            ON public.notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status_created_at     ON public.notifications(status, created_at);
CREATE INDEX IF NOT EXISTS idx_teacher_class_access_teacher        ON public.teacher_class_access(teacher_profile_id);
CREATE INDEX IF NOT EXISTS idx_teacher_class_access_class          ON public.teacher_class_access(class_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subject_access_teacher      ON public.teacher_subject_access(teacher_profile_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subject_access_class        ON public.teacher_subject_access(class_id);
CREATE INDEX IF NOT EXISTS idx_course_payments_student_id          ON public.course_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_course_payments_course_id           ON public.course_payments(course_id);
CREATE INDEX IF NOT EXISTS idx_course_payments_status              ON public.course_payments(status);
CREATE INDEX IF NOT EXISTS idx_course_payments_gateway_order_id    ON public.course_payments(gateway_order_id);

----------------------------------------------------------------------
-- 5. STORAGE BUCKET
----------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'materials', 'materials', true, 52428800,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp',
        'video/mp4','video/webm','text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

----------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (enable + policies)
----------------------------------------------------------------------

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'profiles','classes','teachers','courses','students','enrollments',
    'attendance','materials','syllabus','notifications','teacher_class_access','teacher_subject_access','course_payments'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

-- Drop all old policies in one batch
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles','classes','teachers','courses','students',
                        'enrollments','attendance','materials','syllabus',
                        'notifications','teacher_class_access','teacher_subject_access','course_payments')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Storage policies
DROP POLICY IF EXISTS "Admins manage material storage"  ON storage.objects;
DROP POLICY IF EXISTS "Teachers manage material storage" ON storage.objects;
DROP POLICY IF EXISTS "Public read material storage"     ON storage.objects;

-- classes
CREATE POLICY "Public read classes"  ON public.classes FOR SELECT USING (true);
CREATE POLICY "Admins manage classes" ON public.classes FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- courses
CREATE POLICY "Public read courses"  ON public.courses FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY "Admins manage courses" ON public.courses FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- teachers
CREATE POLICY "Public read teachers"  ON public.teachers FOR SELECT USING (true);
CREATE POLICY "Admins manage teachers" ON public.teachers FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Teachers update own teacher profile" ON public.teachers FOR UPDATE USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

-- profiles
CREATE POLICY "profiles_select"       ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "admins_select_all_profiles" ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "teachers_select_assigned_student_profiles" ON public.profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.profile_id = profiles.id AND public.teacher_has_class_access(s.class_id)));
CREATE POLICY "admins_manage_profiles" ON public.profiles FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "users_update_own_profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- students
CREATE POLICY "Students read own" ON public.students FOR SELECT
  USING (profile_id = auth.uid() OR public.is_admin() OR public.teacher_has_class_access(class_id));
CREATE POLICY "Admins manage students" ON public.students FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- enrollments
CREATE POLICY "Enrollments read own" ON public.enrollments FOR SELECT
  USING (
    student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid())
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = enrollments.course_id AND public.teacher_has_class_access(c.class_id))
  );
CREATE POLICY "Admins manage enrollments" ON public.enrollments FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- attendance
CREATE POLICY "Attendance read own" ON public.attendance FOR SELECT
  USING (
    student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid() AND student_type = 'tuition' AND is_active = true)
    OR public.is_admin()
    OR public.teacher_has_class_access(class_id)
  );
CREATE POLICY "Admins manage attendance"   ON public.attendance FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Teachers manage attendance" ON public.attendance FOR ALL USING (public.teacher_has_class_access(class_id)) WITH CHECK (public.teacher_has_class_access(class_id));

-- materials
CREATE POLICY "Authenticated read materials" ON public.materials FOR SELECT
  USING (public.is_admin() OR public.teacher_has_class_access(materials.class_id) OR public.student_has_material_access(materials.id));
CREATE POLICY "Admins manage materials"   ON public.materials FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Teachers manage materials" ON public.materials FOR ALL USING (public.teacher_has_class_access(materials.class_id)) WITH CHECK (public.teacher_has_class_access(materials.class_id));

-- syllabus
CREATE POLICY "Public read syllabus" ON public.syllabus FOR SELECT
  USING (public.is_admin() OR public.teacher_has_class_access(syllabus.class_id) OR public.student_has_syllabus_access(syllabus.class_id));
CREATE POLICY "Admins manage syllabus"   ON public.syllabus FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Teachers manage syllabus" ON public.syllabus FOR ALL USING (public.teacher_has_class_access(syllabus.class_id)) WITH CHECK (public.teacher_has_class_access(syllabus.class_id));

-- notifications
CREATE POLICY "Notifications read own" ON public.notifications FOR SELECT
  USING (student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid()) OR public.is_admin());
CREATE POLICY "Admins manage notifications" ON public.notifications FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- teacher_class_access
CREATE POLICY "Admins manage teacher class access" ON public.teacher_class_access FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Teachers read own class access" ON public.teacher_class_access FOR SELECT USING (teacher_profile_id = auth.uid());

-- teacher_subject_access
CREATE POLICY "Admins manage teacher subject access" ON public.teacher_subject_access FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Teachers read own subject access" ON public.teacher_subject_access FOR SELECT USING (teacher_profile_id = auth.uid());

-- course_payments
CREATE POLICY "Students read own course payments" ON public.course_payments FOR SELECT
  USING (student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid()) OR public.is_admin());
CREATE POLICY "Admins manage course payments" ON public.course_payments FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- storage policies
CREATE POLICY "Public read material storage"     ON storage.objects FOR SELECT USING (bucket_id = 'materials');
CREATE POLICY "Admins manage material storage"   ON storage.objects FOR ALL USING (bucket_id = 'materials' AND public.is_admin()) WITH CHECK (bucket_id = 'materials' AND public.is_admin());
CREATE POLICY "Teachers manage material storage" ON storage.objects FOR ALL USING (bucket_id = 'materials' AND public.is_teacher()) WITH CHECK (bucket_id = 'materials' AND public.is_teacher());

----------------------------------------------------------------------
-- 7. QR ATTENDANCE SYSTEM
----------------------------------------------------------------------

-- Enable RLS on qr_tokens
ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;

-- QR token policies (drop-then-create for re-run safety)
DROP POLICY IF EXISTS "Admins manage qr tokens" ON public.qr_tokens;
DROP POLICY IF EXISTS "Teachers read qr tokens" ON public.qr_tokens;
DROP POLICY IF EXISTS "Students read own qr token" ON public.qr_tokens;
CREATE POLICY "Admins manage qr tokens" ON public.qr_tokens FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Teachers read qr tokens" ON public.qr_tokens FOR SELECT USING (public.is_teacher());
CREATE POLICY "Students read own qr token" ON public.qr_tokens FOR SELECT
  USING (student_id IN (SELECT id FROM public.students WHERE profile_id = auth.uid()));

-- QR token indexes
CREATE INDEX IF NOT EXISTS idx_qr_tokens_student_id ON public.qr_tokens(student_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON public.qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_attendance_scan_method ON public.attendance(scan_method);
CREATE INDEX IF NOT EXISTS idx_attendance_check_in_at ON public.attendance(check_in_at);

-- Checkout notification function
CREATE OR REPLACE FUNCTION public.enqueue_checkout_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.check_out_at IS NOT NULL
     AND (OLD.check_out_at IS NULL OR TG_OP = 'INSERT') THEN
    INSERT INTO public.notifications (student_id, type, message, channel, delivery_type, status)
    VALUES (
      NEW.student_id,
      'checkout',
      'Check-out recorded at ' || to_char(NEW.check_out_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') || ' on ' || NEW.date::text,
      'whatsapp',
      'whatsapp',
      'pending'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_attendance_checkout ON public.attendance;
CREATE TRIGGER on_attendance_checkout
  AFTER INSERT OR UPDATE OF check_out_at ON public.attendance
  FOR EACH ROW WHEN (NEW.check_out_at IS NOT NULL)
  EXECUTE FUNCTION public.enqueue_checkout_notification();

----------------------------------------------------------------------
-- 8. SESSION-BASED ATTENDANCE HARDENING
----------------------------------------------------------------------

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  subject text not null default 'General Attendance',
  session_date date not null,
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid not null references public.profiles(id),
  teacher_id uuid references public.teachers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.attendance add column if not exists session_id uuid references public.attendance_sessions(id) on delete cascade;
alter table public.attendance_sessions add column if not exists teacher_id uuid references public.teachers(id) on delete set null;
do $$ begin
  alter table public.attendance_sessions drop constraint if exists attendance_sessions_teacher_id_fkey;
  alter table public.attendance_sessions
    add constraint attendance_sessions_teacher_id_fkey
    foreign key (teacher_id) references public.teachers(id) on delete set null;
exception when duplicate_object then null;
end $$;
alter table public.qr_tokens add column if not exists public_token text;
alter table public.qr_tokens alter column token set default md5(gen_random_uuid()::text || clock_timestamp()::text || random()::text);
alter table public.attendance drop constraint if exists attendance_student_id_date_key;
alter table public.attendance_sessions enable row level security;

create or replace function public.generate_qr_public_token(p_qr_token_id uuid, p_raw_token text)
returns text language sql immutable as $$
  select p_qr_token_id::text || '.' || md5(p_qr_token_id::text || '.' || p_raw_token);
$$;

create or replace function public.set_qr_public_token()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.id := coalesce(new.id, gen_random_uuid());
  new.token := coalesce(
    nullif(btrim(new.token), ''),
    md5(gen_random_uuid()::text || clock_timestamp()::text || random()::text)
  );
  new.public_token := public.generate_qr_public_token(new.id, new.token);
  return new;
end;
$$;

drop trigger if exists set_qr_public_token on public.qr_tokens;
create trigger set_qr_public_token
before insert or update of token on public.qr_tokens
for each row execute function public.set_qr_public_token();

update public.qr_tokens
set public_token = public.generate_qr_public_token(id, token)
where public_token is distinct from public.generate_qr_public_token(id, token);

create unique index if not exists idx_qr_tokens_public_token on public.qr_tokens(public_token);
create index if not exists idx_qr_tokens_student_public on public.qr_tokens(student_id, public_token);
create unique index if not exists idx_attendance_sessions_unique_daily
on public.attendance_sessions (class_id, coalesce(course_id, '00000000-0000-0000-0000-000000000000'::uuid), session_date);
create unique index if not exists idx_attendance_student_session_unique on public.attendance(student_id, session_id);
create index if not exists idx_attendance_session_id on public.attendance(session_id);
create index if not exists idx_attendance_sessions_teacher_id on public.attendance_sessions(teacher_id);
create index if not exists idx_attendance_sessions_date on public.attendance_sessions(session_date);
create index if not exists idx_attendance_sessions_class_id on public.attendance_sessions(class_id);
create index if not exists idx_attendance_sessions_course_id on public.attendance_sessions(course_id);
create index if not exists idx_attendance_sessions_active on public.attendance_sessions(is_active, session_date);
create index if not exists idx_attendance_sessions_class_subject_date on public.attendance_sessions(class_id, subject, session_date);

insert into public.attendance_sessions (class_id, course_id, subject, session_date, is_active, starts_at, created_by)
select distinct
  a.class_id,
  a.course_id,
  coalesce(nullif(c.subject, ''), 'General Attendance'),
  a.date,
  a.date = ((now() at time zone 'Asia/Kolkata')::date),
  coalesce(a.check_in_at, a.created_at, now()),
  a.marked_by
from public.attendance a
left join public.courses c on c.id = a.course_id
where a.session_id is null
on conflict do nothing;

update public.attendance a
set session_id = s.id
from public.attendance_sessions s
where a.session_id is null
  and s.class_id = a.class_id
  and s.session_date = a.date
  and coalesce(s.course_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(a.course_id, '00000000-0000-0000-0000-000000000000'::uuid);

update public.attendance a
set teacher_id = t.id
from public.teachers t
where t.profile_id = a.marked_by
  and a.teacher_id is distinct from t.id;

update public.attendance_sessions s
set teacher_id = t.id
from public.teachers t
where t.profile_id = s.created_by
  and s.teacher_id is distinct from t.id;

drop trigger if exists set_attendance_session_teacher_id on public.attendance_sessions;
create trigger set_attendance_session_teacher_id
before insert or update of created_by on public.attendance_sessions
for each row execute function public.set_attendance_session_teacher_id();

drop policy if exists "Attendance sessions read" on public.attendance_sessions;
drop policy if exists "Admins manage attendance sessions" on public.attendance_sessions;
drop policy if exists "Teachers manage attendance sessions" on public.attendance_sessions;

create policy "Attendance sessions read" on public.attendance_sessions for select
using (public.is_admin() or public.teacher_has_class_access(class_id));

create policy "Admins manage attendance sessions" on public.attendance_sessions for all
using (public.is_admin()) with check (public.is_admin());

create policy "Teachers manage attendance sessions" on public.attendance_sessions for all
using (public.teacher_has_class_access(class_id)) with check (public.teacher_has_class_access(class_id));

create or replace function public.verify_qr_public_token(p_student_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_parts text[];
  v_token_id uuid;
  v_signature text;
  v_token text;
  v_student_id uuid;
begin
  v_parts := regexp_split_to_array(coalesce(btrim(p_student_token), ''), '\.');
  if array_length(v_parts, 1) <> 2 then raise exception 'Invalid QR token'; end if;

  v_token_id := v_parts[1]::uuid;
  v_signature := v_parts[2];

  select token, student_id into v_token, v_student_id
  from public.qr_tokens
  where id = v_token_id;

  if v_token is null then raise exception 'QR token not found'; end if;
  if v_signature <> md5(v_token_id::text || '.' || v_token) then
    raise exception 'Invalid QR signature';
  end if;

  return v_student_id;
end;
$$;

----------------------------------------------------------------------
-- 8B. ADMIN DASHBOARD STATS RPC
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS TABLE (
  student_count   BIGINT,
  course_count    BIGINT,
  teacher_count   BIGINT,
  material_count  BIGINT,
  class_count     BIGINT,
  attendance_count BIGINT,
  fees_paid       BIGINT,
  fees_partial    BIGINT,
  fees_not_paid   BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.students)    AS student_count,
    (SELECT count(*) FROM public.courses)     AS course_count,
    (SELECT count(*) FROM public.teachers)    AS teacher_count,
    (SELECT count(*) FROM public.materials)   AS material_count,
    (SELECT count(*) FROM public.classes)     AS class_count,
    (SELECT count(*) FROM public.attendance)  AS attendance_count,
    (SELECT count(*) FROM public.students
     WHERE fees_full_payment_paid = true
        OR (fees_installment1_paid = true AND fees_installment2_paid = true)
    ) AS fees_paid,
    (SELECT count(*) FROM public.students
     WHERE fees_full_payment_paid = false
       AND (fees_installment1_paid = true OR fees_installment2_paid = true)
       AND NOT (fees_installment1_paid = true AND fees_installment2_paid = true)
    ) AS fees_partial,
    (SELECT count(*) FROM public.students
     WHERE fees_full_payment_paid = false
       AND fees_installment1_paid = false
       AND fees_installment2_paid = false
    ) AS fees_not_paid;
$$;

----------------------------------------------------------------------
-- 8C. PERFORMANCE INDEXES FOR DASHBOARD ORDER BY
----------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_students_created_at_desc  ON public.students(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teachers_created_at_desc  ON public.teachers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_courses_created_at_desc   ON public.courses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_classes_created_at_desc   ON public.classes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_materials_created_at_desc ON public.materials(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date   ON public.attendance(student_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_student_status ON public.attendance(student_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_student_status ON public.notifications(student_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_status ON public.enrollments(student_id, status);

----------------------------------------------------------------------
-- 9. BRANCHES (class subdivisions)
----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, name)
);

CREATE TABLE IF NOT EXISTS public.branch_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, subject)
);

CREATE INDEX IF NOT EXISTS idx_branches_class_id ON public.branches(class_id);
CREATE INDEX IF NOT EXISTS idx_branch_subjects_branch_id ON public.branch_subjects(branch_id);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read branches" ON public.branches;
DROP POLICY IF EXISTS "Admins manage branches" ON public.branches;
CREATE POLICY "Public read branches" ON public.branches FOR SELECT USING (true);
CREATE POLICY "Admins manage branches" ON public.branches FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public read branch subjects" ON public.branch_subjects;
DROP POLICY IF EXISTS "Admins manage branch subjects" ON public.branch_subjects;
CREATE POLICY "Public read branch subjects" ON public.branch_subjects FOR SELECT USING (true);
CREATE POLICY "Admins manage branch subjects" ON public.branch_subjects FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['branches'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at_%1$s ON public.%1$I', tbl);
    EXECUTE format('CREATE TRIGGER set_updated_at_%1$s BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', tbl);
  END LOOP;
END $$;

-- Students can optionally belong to a branch within their class
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_students_branch_id ON public.students(branch_id);

----------------------------------------------------------------------

-----------------------------------------------------------------------
-- Subject-wise attendance: drop the old (student_id, date) unique
-- constraint that blocks multiple sessions per student per day.
-- The unique index on (student_id, session_id) handles session records.
-- A partial index handles legacy (sessionless) records.
-----------------------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE public.attendance DROP CONSTRAINT attendance_student_id_date_key;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Legacy records (no session): unique per (student_id, date, course_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_no_session_unique
ON public.attendance(
  student_id,
  date,
  COALESCE(course_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
WHERE session_id IS NULL;

-----------------------------------------------------------------------

create or replace function public.mark_attendance(p_student_token text, p_session_id uuid, p_teacher_id uuid)
returns table (
  status text,
  attendance_id uuid,
  student_id uuid,
  student_name text,
  class_name text,
  subject text,
  session_date date,
  check_in_at timestamptz,
  check_out_at timestamptz,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_now timestamptz := now();
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_student_id uuid;
  v_student record;
  v_session record;
  v_attendance record;
begin
  if auth.uid() is null or auth.uid() <> p_teacher_id then raise exception 'Unauthorized actor'; end if;

  select role into v_role from public.profiles where id = auth.uid();
  if v_role not in ('admin', 'super_admin', 'teacher') then raise exception 'Only teachers and admins can mark attendance'; end if;

  select s.*, c.name as class_name
  into v_session
  from public.attendance_sessions s
  join public.classes c on c.id = s.class_id
  where s.id = p_session_id;

  if not found then raise exception 'Attendance session not found'; end if;
  if v_session.is_active is distinct from true then raise exception 'Attendance session is not active'; end if;
  if v_session.session_date <> v_today then raise exception 'Only today''s session accepts QR scans'; end if;

  if v_role = 'teacher' then
    if public.teacher_has_class_access(v_session.class_id) is not true then
      raise exception 'Teacher does not have class access for this session';
    end if;
  end if;

  v_student_id := public.verify_qr_public_token(p_student_token);

  select s.id, s.class_id, p.full_name as student_name
  into v_student
  from public.students s
  join public.profiles p on p.id = s.profile_id
  where s.id = v_student_id and s.is_active = true;

  if not found then raise exception 'Student not found or inactive'; end if;
  if v_student.class_id <> v_session.class_id then raise exception 'Student does not belong to this session''s class'; end if;

  select a.* into v_attendance
  from public.attendance as a
  where a.student_id = v_student_id
    and (
      a.session_id = p_session_id
      or (
        a.session_id is null
        and a.date = v_session.session_date
        and a.class_id = v_session.class_id
        and coalesce(a.course_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = coalesce(v_session.course_id, '00000000-0000-0000-0000-000000000000'::uuid)
      )
    )
  order by case when a.session_id = p_session_id then 0 else 1 end
  for update;

  if found and v_attendance.session_id is null then
    update public.attendance
    set session_id = p_session_id,
        class_id = v_session.class_id,
        course_id = v_session.course_id,
        date = v_session.session_date
    where id = v_attendance.id
    returning * into v_attendance;
  end if;

  if not found then
    insert into public.attendance (
      student_id, class_id, course_id, session_id, date, status, marked_by, check_in_at, scan_method
    ) values (
      v_student_id, v_session.class_id, v_session.course_id, p_session_id, v_session.session_date, 'present', p_teacher_id, v_now, 'qr'
    ) returning * into v_attendance;

    return query
    select 'checked_in', v_attendance.id, v_student_id, v_student.student_name, v_session.class_name, v_session.subject, v_session.session_date, v_attendance.check_in_at, v_attendance.check_out_at, v_student.student_name || ' checked in successfully';
  elsif v_attendance.check_out_at is not null then
    return query
    select 'already_done', v_attendance.id, v_student_id, v_student.student_name, v_session.class_name, v_session.subject, v_session.session_date, v_attendance.check_in_at, v_attendance.check_out_at, v_student.student_name || ' is already checked out for this session';
  elsif v_attendance.check_in_at is null then
    update public.attendance
    set check_in_at = v_now, status = 'present', marked_by = p_teacher_id, scan_method = 'qr'
    where id = v_attendance.id
    returning * into v_attendance;

    return query
    select 'checked_in', v_attendance.id, v_student_id, v_student.student_name, v_session.class_name, v_session.subject, v_session.session_date, v_attendance.check_in_at, v_attendance.check_out_at, v_student.student_name || ' checked in successfully';
  else
    update public.attendance
    set check_out_at = v_now, status = 'present', marked_by = p_teacher_id, scan_method = 'qr'
    where id = v_attendance.id
    returning * into v_attendance;

    return query
    select 'checked_out', v_attendance.id, v_student_id, v_student.student_name, v_session.class_name, v_session.subject, v_session.session_date, v_attendance.check_in_at, v_attendance.check_out_at, v_student.student_name || ' checked out successfully';
  end if;
end;
$$;

----------------------------------------------------------------------
-- 10. AUDIT LOGS
----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  summary TEXT NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_created ON public.audit_logs(entity_type, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read audit logs" ON public.audit_logs;
CREATE POLICY "Admins read audit logs" ON public.audit_logs FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "System inserts audit logs" ON public.audit_logs;
CREATE POLICY "System inserts audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor UUID;
  v_summary TEXT;
  v_details JSONB;
  v_entity_id UUID;
BEGIN
  BEGIN
    v_actor := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    v_entity_id := NEW.id;
    v_summary := TG_TABLE_NAME || ' created';
    v_details := jsonb_build_object('new', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := NEW.id;
    v_summary := TG_TABLE_NAME || ' updated';
    v_details := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    v_entity_id := OLD.id;
    v_summary := TG_TABLE_NAME || ' deleted';
    v_details := jsonb_build_object('old', to_jsonb(OLD));
  ELSE
    RETURN NULL;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, summary, details)
  VALUES (v_actor, CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' WHEN 'DELETE' THEN 'delete' END, TG_TABLE_NAME, v_entity_id, v_summary, v_details);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['students', 'teachers', 'courses', 'classes', 'materials', 'syllabus'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_log_%1$s ON public.%1$I', tbl);
    EXECUTE format(
      'CREATE TRIGGER audit_log_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger()',
      tbl
    );
  END LOOP;
END $$;

----------------------------------------------------------------------
-- 11. ATTENDANCE REPORTING RPCS
----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_class_attendance_summary(
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  class_id UUID,
  class_name TEXT,
  board TEXT,
  level TEXT,
  total_students BIGINT,
  total_records BIGINT,
  present_count BIGINT,
  absent_count BIGINT,
  attendance_rate NUMERIC
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT
    c.id AS class_id,
    c.name AS class_name,
    c.board,
    c.level,
    (SELECT count(*) FROM public.students s WHERE s.class_id = c.id AND s.is_active = true) AS total_students,
    count(a.id) AS total_records,
    count(a.id) FILTER (WHERE a.status = 'present') AS present_count,
    count(a.id) FILTER (WHERE a.status = 'absent') AS absent_count,
    CASE WHEN count(a.id) > 0
      THEN round((count(a.id) FILTER (WHERE a.status = 'present'))::numeric / count(a.id) * 100, 1)
      ELSE 0
    END AS attendance_rate
  FROM public.classes c
  LEFT JOIN public.attendance a ON a.class_id = c.id
    AND (p_date_from IS NULL OR a.date >= p_date_from)
    AND (p_date_to IS NULL OR a.date <= p_date_to)
  WHERE public.is_admin()
  GROUP BY c.id, c.name, c.board, c.level, c.sort_order
  ORDER BY c.sort_order, c.name;
$$;

CREATE OR REPLACE FUNCTION public.get_low_attendance_students(
  p_threshold INTEGER DEFAULT 75,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  class_id UUID,
  class_name TEXT,
  total_records BIGINT,
  present_count BIGINT,
  attendance_rate NUMERIC
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT
    s.id AS student_id,
    p.full_name AS student_name,
    c.id AS class_id,
    c.name AS class_name,
    count(a.id) AS total_records,
    count(a.id) FILTER (WHERE a.status = 'present') AS present_count,
    CASE WHEN count(a.id) > 0
      THEN round((count(a.id) FILTER (WHERE a.status = 'present'))::numeric / count(a.id) * 100, 1)
      ELSE 0
    END AS attendance_rate
  FROM public.students s
  JOIN public.profiles p ON p.id = s.profile_id
  JOIN public.classes c ON c.id = s.class_id
  LEFT JOIN public.attendance a ON a.student_id = s.id
    AND (p_date_from IS NULL OR a.date >= p_date_from)
    AND (p_date_to IS NULL OR a.date <= p_date_to)
  WHERE s.is_active = true AND public.is_admin()
  GROUP BY s.id, p.full_name, c.id, c.name
  HAVING count(a.id) > 0
    AND round((count(a.id) FILTER (WHERE a.status = 'present'))::numeric / count(a.id) * 100, 1) < p_threshold
  ORDER BY attendance_rate ASC, p.full_name;
$$;

CREATE OR REPLACE FUNCTION public.get_teacher_attendance_stats(
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  teacher_id UUID,
  teacher_name TEXT,
  total_sessions BIGINT,
  total_records BIGINT,
  present_count BIGINT
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT
    t.id AS teacher_id,
    t.name AS teacher_name,
    (SELECT count(*) FROM public.attendance_sessions asess
     WHERE asess.teacher_id = t.id
       AND (p_date_from IS NULL OR asess.session_date >= p_date_from)
       AND (p_date_to IS NULL OR asess.session_date <= p_date_to)
    ) AS total_sessions,
    count(a.id) AS total_records,
    count(a.id) FILTER (WHERE a.status = 'present') AS present_count
  FROM public.teachers t
  LEFT JOIN public.attendance a ON a.teacher_id = t.id
    AND (p_date_from IS NULL OR a.date >= p_date_from)
    AND (p_date_to IS NULL OR a.date <= p_date_to)
  WHERE public.is_admin()
  GROUP BY t.id, t.name
  ORDER BY t.name;
$$;

CREATE OR REPLACE FUNCTION public.get_monthly_attendance_trend(
  p_class_id UUID DEFAULT NULL,
  p_months INTEGER DEFAULT 12
)
RETURNS TABLE (
  month_start DATE,
  month_label TEXT,
  total_records BIGINT,
  present_count BIGINT,
  absent_count BIGINT,
  attendance_rate NUMERIC
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  WITH months AS (
    SELECT date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata') - (n || ' months')::interval)::date AS m
    FROM generate_series(0, p_months - 1) AS n
  )
  SELECT
    m.m AS month_start,
    to_char(m.m, 'Mon YYYY') AS month_label,
    count(a.id) AS total_records,
    count(a.id) FILTER (WHERE a.status = 'present') AS present_count,
    count(a.id) FILTER (WHERE a.status = 'absent') AS absent_count,
    CASE WHEN count(a.id) > 0
      THEN round((count(a.id) FILTER (WHERE a.status = 'present'))::numeric / count(a.id) * 100, 1)
      ELSE 0
    END AS attendance_rate
  FROM months m
  LEFT JOIN public.attendance a
    ON date_trunc('month', a.date)::date = m.m
    AND (p_class_id IS NULL OR a.class_id = p_class_id)
  WHERE public.is_admin()
  GROUP BY m.m
  ORDER BY m.m DESC;
$$;

----------------------------------------------------------------------
-- 12. SCALABILITY INDEXES FOR REPORTING
----------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON public.attendance(class_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_class_status ON public.attendance(class_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_date_status ON public.attendance(date, status);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date_status ON public.attendance(class_id, date, status);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_teacher_date ON public.attendance_sessions(teacher_id, session_date);
