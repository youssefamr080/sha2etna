-- Supabase Tables for Sha2etna App
-- Run this SQL in your Supabase SQL Editor

-- Drop existing tables (order matters because of FK references)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS shopping_items CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS expense_splits CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS debts CASCADE;
DROP TABLE IF EXISTS bills CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Profiles table (mirrors auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  password TEXT,
  members UUID[] DEFAULT '{}'::UUID[],
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group Members table (for better member management)
CREATE TABLE IF NOT EXISTS group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  "groupId" TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  "payerId" UUID NOT NULL REFERENCES profiles(id),
  amount DECIMAL NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "receiptUrl" TEXT,
  "splitBetween" UUID[] DEFAULT '{}'::UUID[],
  "splitAmounts" JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense Splits table (tracks individual shares)
CREATE TABLE IF NOT EXISTS expense_splits (
  id TEXT PRIMARY KEY,
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  amount DECIMAL NOT NULL,
  paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  UNIQUE(expense_id, user_id)
);

-- Debts table (personal and shared debts)
CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY,
  "from" UUID NOT NULL REFERENCES profiles(id),
  "to" UUID NOT NULL REFERENCES profiles(id),
  amount DECIMAL NOT NULL,
  description TEXT,
  "dueDate" TIMESTAMPTZ,
  "isPersonal" BOOLEAN DEFAULT FALSE,
  "groupId" TEXT REFERENCES groups(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid', 'overdue')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bills table (recurring bills)
CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  "groupId" TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  category TEXT NOT NULL,
  "dueDate" TIMESTAMPTZ NOT NULL,
  recurring BOOLEAN DEFAULT FALSE,
  "recurringPeriod" TEXT CHECK ("recurringPeriod" IN ('monthly', 'quarterly', 'yearly')),
  reminder BOOLEAN DEFAULT TRUE,
  "reminderDays" INTEGER DEFAULT 3,
  "lastPaid" TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  "from" UUID NOT NULL REFERENCES profiles(id),
  "to" UUID NOT NULL REFERENCES profiles(id),
  amount DECIMAL NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'CONFIRMED', 'REJECTED')),
  notes TEXT,
  "groupId" TEXT REFERENCES groups(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  "groupId" TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES profiles(id),
  text TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'system')),
  "imageUrl" TEXT
);

-- Shopping items table
CREATE TABLE IF NOT EXISTS shopping_items (
  id TEXT PRIMARY KEY,
  "groupId" TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  "addedBy" UUID NOT NULL REFERENCES profiles(id),
  completed BOOLEAN DEFAULT FALSE,
  "completedBy" UUID REFERENCES profiles(id),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  date BIGINT NOT NULL,
  data JSONB,
  "actionUrl" TEXT
);

-- User Settings table
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  notifications_enabled BOOLEAN DEFAULT TRUE,
  language TEXT DEFAULT 'ar',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) for critical tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Remove insecure demo policies if they exist
DROP POLICY IF EXISTS "Allow anonymous access to users" ON profiles;
DROP POLICY IF EXISTS "Allow anonymous access to groups" ON groups;
DROP POLICY IF EXISTS "Allow anonymous access to expenses" ON expenses;
DROP POLICY IF EXISTS "profiles_select_self" ON profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
DROP POLICY IF EXISTS "groups_select_members" ON groups;
DROP POLICY IF EXISTS "groups_insert_owner" ON groups;
DROP POLICY IF EXISTS "groups_update_admin" ON groups;
DROP POLICY IF EXISTS "groups_delete_admin" ON groups;
DROP POLICY IF EXISTS "expenses_members_select" ON expenses;
DROP POLICY IF EXISTS "expenses_members_mutate" ON expenses;

-- Secure profiles policies
CREATE POLICY "profiles_select_self" ON profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_select_group_members" ON profiles
FOR SELECT USING (
  auth.uid() = id OR EXISTS (
    SELECT 1
    FROM group_members gm_self
    JOIN group_members gm_other ON gm_self.group_id = gm_other.group_id
    WHERE gm_self.user_id = auth.uid()
      AND gm_other.user_id = profiles.id
  )
);

CREATE POLICY "profiles_insert_self" ON profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_self" ON profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Secure groups policies
CREATE POLICY "groups_select_members" ON groups
FOR SELECT
USING (
  auth.uid() = created_by
  OR EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = groups.id AND gm.user_id = auth.uid()
  )
);

CREATE POLICY "groups_insert_owner" ON groups
FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "groups_update_admin" ON groups
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = groups.id AND gm.user_id = auth.uid() AND gm.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = groups.id AND gm.user_id = auth.uid() AND gm.role = 'admin'
  )
);

CREATE POLICY "groups_delete_admin" ON groups
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = groups.id AND gm.user_id = auth.uid() AND gm.role = 'admin'
  )
);

-- Automatically provision profiles whenever a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone, avatar)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',
    COALESCE(NEW.raw_user_meta_data ->> 'avatar', 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || NEW.id)
  )
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      avatar = EXCLUDED.avatar;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper function to safely join groups via invite code
CREATE OR REPLACE FUNCTION public.join_group_with_code(
  p_code TEXT,
  p_user_id UUID,
  p_password TEXT DEFAULT NULL
)
RETURNS groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group groups%ROWTYPE;
  v_member_id TEXT;
BEGIN
  SELECT * INTO v_group FROM groups WHERE code = UPPER(p_code);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GROUP_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_group.password IS NOT NULL AND v_group.password <> COALESCE(p_password, '') THEN
    RAISE EXCEPTION 'INVALID_PASSWORD' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = v_group.id AND gm.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'ALREADY_MEMBER' USING ERRCODE = 'P0003';
  END IF;

  UPDATE groups
  SET members = (
    SELECT ARRAY_AGG(DISTINCT member_uid)
    FROM UNNEST(COALESCE(groups.members, '{}'::UUID[]) || ARRAY[p_user_id]) AS m(member_uid)
  )
  WHERE id = v_group.id;

  v_member_id := 'gm' || FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4);

  INSERT INTO group_members (id, group_id, user_id, role)
  VALUES (v_member_id, v_group.id, p_user_id, 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;

  SELECT * INTO v_group FROM groups WHERE id = v_group.id;
  RETURN v_group;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_group_with_code(TEXT, UUID, TEXT) TO authenticated;

-- Atomic expense update with split regeneration
CREATE OR REPLACE FUNCTION public.update_expense_with_splits(
  expense_id TEXT,
  new_amount DECIMAL,
  new_title TEXT,
  new_category TEXT,
  new_payer_id UUID,
  new_date TIMESTAMPTZ,
  new_notes TEXT,
  new_receipt_url TEXT,
  new_split_between UUID[],
  new_split_amounts JSONB,
  new_splits JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE expenses
  SET amount = new_amount,
      description = new_title,
      category = new_category,
      "payerId" = new_payer_id,
      date = new_date,
      notes = new_notes,
      "receiptUrl" = new_receipt_url,
      "splitBetween" = COALESCE(new_split_between, '{}'::UUID[]),
      "splitAmounts" = COALESCE(new_split_amounts, '{}'::JSONB)
  WHERE id = expense_id;

  DELETE FROM expense_splits WHERE expense_id = update_expense_with_splits.expense_id;

  IF new_splits IS NOT NULL AND jsonb_typeof(new_splits) = 'array' THEN
    INSERT INTO expense_splits (id, expense_id, user_id, amount, paid, paid_at)
    SELECT
      split_data.id,
      split_data.expense_id,
      split_data.user_id,
      split_data.amount,
      split_data.paid,
      split_data.paid_at
    FROM jsonb_to_recordset(new_splits) AS split_data(
      id TEXT,
      expense_id TEXT,
      user_id UUID,
      amount DECIMAL,
      paid BOOLEAN,
      paid_at TIMESTAMPTZ
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_expense_with_splits(
  TEXT,
  DECIMAL,
  TEXT,
  TEXT,
  UUID,
  TIMESTAMPTZ,
  TEXT,
  TEXT,
  UUID[],
  JSONB,
  JSONB
) TO authenticated;

-- Secure expenses policies (members only)
CREATE POLICY "expenses_members_select" ON expenses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = expenses."groupId" AND gm.user_id = auth.uid()
  )
);

CREATE POLICY "expenses_members_mutate" ON expenses
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = expenses."groupId" AND gm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = expenses."groupId" AND gm.user_id = auth.uid()
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses("groupId");
CREATE INDEX IF NOT EXISTS idx_expenses_payer ON expenses("payerId");
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_from ON payments("from");
CREATE INDEX IF NOT EXISTS idx_payments_to ON payments("to");
CREATE INDEX IF NOT EXISTS idx_chat_group ON chat_messages("groupId");
CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications("userId");
CREATE INDEX IF NOT EXISTS idx_debts_from ON debts("from");
CREATE INDEX IF NOT EXISTS idx_debts_to ON debts("to");
CREATE INDEX IF NOT EXISTS idx_bills_group ON bills("groupId");
CREATE INDEX IF NOT EXISTS idx_bills_due ON bills("dueDate");

