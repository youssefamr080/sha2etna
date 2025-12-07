-- ============================================================
-- SHA2ETNA - Enhanced Database Schema V2.0
-- ============================================================
-- This is an ADDITIVE migration - it does NOT drop existing tables
-- Run this AFTER the initial schema (supabase_schema.sql) is in place
-- ============================================================
-- Existing tables use:
--   - profiles (not users) with UUID ids
--   - camelCase column names with quotes: "groupId", "payerId", etc.
--   - groups.members is UUID[] array
--   - groups.created_by is UUID
-- ============================================================

-- ============================================================
-- PROFILES TABLE - Add new columns
-- ============================================================
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS instapay_link TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- ============================================================
-- GROUPS TABLE - Add new columns
-- ============================================================
ALTER TABLE groups
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{"allow_member_invite": false, "require_approval": false}',
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================================
-- GROUP_MEMBERS TABLE - Add new columns
-- ============================================================
ALTER TABLE group_members
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"can_add_expense": true, "can_edit_expense": false, "can_delete_expense": false}',
ADD COLUMN IF NOT EXISTS invited_by UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================================
-- EXPENSES TABLE - Add new columns
-- ============================================================
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recurring_frequency TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- PAYMENTS TABLE - Add new columns
-- ============================================================
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash',
ADD COLUMN IF NOT EXISTS reference_number TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================================
-- BILLS TABLE - Add new columns (already has dueDate and reminderDays)
-- ============================================================
ALTER TABLE bills
ADD COLUMN IF NOT EXISTS auto_split BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================================
-- SHOPPING_ITEMS TABLE - Add new columns
-- ============================================================
ALTER TABLE shopping_items
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS estimated_price DECIMAL(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS actual_price DECIMAL(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================================
-- CHAT_MESSAGES TABLE - Add new columns
-- ============================================================
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS reply_to TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================================
-- NOTIFICATIONS TABLE - Add new columns
-- ============================================================
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';

-- ============================================================
-- NEW: SYNC_LOG TABLE - For offline sync tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  data JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NULL,
  error_message TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_log_user ON sync_log(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sync_log_pending ON sync_log(status) WHERE status = 'pending';

-- ============================================================
-- NEW: USER_DEVICES TABLE - For push notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  device_type TEXT NOT NULL,
  device_name TEXT DEFAULT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_token)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices(user_id) WHERE is_active = TRUE;

-- ============================================================
-- NEW: ACTIVITY_LOG TABLE - For audit trail
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT DEFAULT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_group ON activity_log(group_id);
CREATE INDEX IF NOT EXISTS idx_activity_date ON activity_log(created_at DESC);

-- ============================================================
-- FUNCTION: Calculate Group Balances
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_group_balances(p_group_id TEXT)
RETURNS TABLE(user_id UUID, balance DECIMAL) AS $$
BEGIN
  RETURN QUERY
  WITH expense_contributions AS (
    SELECT e."payerId" as uid, SUM(e.amount) as paid
    FROM expenses e
    WHERE e."groupId" = p_group_id AND (e.deleted_at IS NULL OR e.deleted_at IS NULL)
    GROUP BY e."payerId"
  ),
  expense_shares AS (
    SELECT es.user_id as uid, SUM(es.amount) as owed
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    WHERE e."groupId" = p_group_id AND (e.deleted_at IS NULL OR e.deleted_at IS NULL)
    GROUP BY es.user_id
  ),
  payment_made AS (
    SELECT p."from" as uid, SUM(p.amount) as amount
    FROM payments p
    WHERE p."groupId" = p_group_id 
      AND p.status IN ('CONFIRMED', 'COMPLETED') 
      AND (p.deleted_at IS NULL OR p.deleted_at IS NULL)
    GROUP BY p."from"
  ),
  payment_received AS (
    SELECT p."to" as uid, SUM(p.amount) as amount
    FROM payments p
    WHERE p."groupId" = p_group_id 
      AND p.status IN ('CONFIRMED', 'COMPLETED') 
      AND (p.deleted_at IS NULL OR p.deleted_at IS NULL)
    GROUP BY p."to"
  ),
  all_members AS (
    SELECT DISTINCT unnest(members) as uid FROM groups WHERE id = p_group_id
  )
  SELECT 
    am.uid as user_id,
    COALESCE(ec.paid, 0) - COALESCE(es.owed, 0) + COALESCE(pm.amount, 0) - COALESCE(pr.amount, 0) as balance
  FROM all_members am
  LEFT JOIN expense_contributions ec ON ec.uid = am.uid
  LEFT JOIN expense_shares es ON es.uid = am.uid
  LEFT JOIN payment_made pm ON pm.uid = am.uid
  LEFT JOIN payment_received pr ON pr.uid = am.uid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Transfer Group Ownership
-- ============================================================
CREATE OR REPLACE FUNCTION transfer_group_ownership(
  p_group_id TEXT,
  p_current_owner_id UUID,
  p_new_owner_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_group RECORD;
BEGIN
  SELECT * INTO v_group FROM groups WHERE id = p_group_id AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GROUP_NOT_FOUND';
  END IF;
  
  IF v_group.created_by != p_current_owner_id THEN
    RAISE EXCEPTION 'NOT_GROUP_OWNER';
  END IF;
  
  IF NOT (p_new_owner_id = ANY(v_group.members)) THEN
    RAISE EXCEPTION 'NEW_OWNER_NOT_MEMBER';
  END IF;
  
  UPDATE groups SET created_by = p_new_owner_id WHERE id = p_group_id;
  
  UPDATE group_members SET role = 'member' WHERE group_id = p_group_id AND user_id = p_current_owner_id;
  UPDATE group_members SET role = 'admin' WHERE group_id = p_group_id AND user_id = p_new_owner_id;
  
  INSERT INTO activity_log (group_id, user_id, action, target_type, target_id, details)
  VALUES (p_group_id, p_current_owner_id, 'ownership_transferred', 'group', p_group_id, 
    jsonb_build_object('new_owner_id', p_new_owner_id::TEXT));
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Remove Member from Group
-- ============================================================
CREATE OR REPLACE FUNCTION remove_group_member(
  p_group_id TEXT,
  p_admin_id UUID,
  p_member_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_group RECORD;
  v_balance DECIMAL;
BEGIN
  SELECT * INTO v_group FROM groups WHERE id = p_group_id AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GROUP_NOT_FOUND';
  END IF;
  
  IF v_group.created_by != p_admin_id THEN
    RAISE EXCEPTION 'NOT_GROUP_ADMIN';
  END IF;
  
  IF p_admin_id = p_member_id THEN
    RAISE EXCEPTION 'CANNOT_REMOVE_SELF';
  END IF;
  
  SELECT balance INTO v_balance 
  FROM calculate_group_balances(p_group_id) 
  WHERE user_id = p_member_id;
  
  IF v_balance IS NOT NULL AND ABS(v_balance) > 0.01 THEN
    RAISE EXCEPTION 'MEMBER_HAS_BALANCE';
  END IF;
  
  UPDATE group_members 
  SET left_at = NOW() 
  WHERE group_id = p_group_id AND user_id = p_member_id;
  
  UPDATE groups 
  SET members = array_remove(members, p_member_id) 
  WHERE id = p_group_id;
  
  INSERT INTO activity_log (group_id, user_id, action, target_type, target_id, details)
  VALUES (p_group_id, p_admin_id, 'member_removed', 'member', p_member_id::TEXT, '{}');
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Delete Group (Soft Delete)
-- ============================================================
CREATE OR REPLACE FUNCTION delete_group(
  p_group_id TEXT,
  p_admin_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_group RECORD;
  v_has_balance BOOLEAN;
BEGIN
  SELECT * INTO v_group FROM groups WHERE id = p_group_id AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GROUP_NOT_FOUND';
  END IF;
  
  IF v_group.created_by != p_admin_id THEN
    RAISE EXCEPTION 'NOT_GROUP_ADMIN';
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM calculate_group_balances(p_group_id) WHERE ABS(balance) > 0.01
  ) INTO v_has_balance;
  
  IF v_has_balance THEN
    RAISE EXCEPTION 'GROUP_HAS_OUTSTANDING_BALANCES';
  END IF;
  
  UPDATE groups SET deleted_at = NOW() WHERE id = p_group_id;
  UPDATE group_members SET left_at = NOW() WHERE group_id = p_group_id AND left_at IS NULL;
  
  INSERT INTO activity_log (group_id, user_id, action, target_type, target_id, details)
  VALUES (p_group_id, p_admin_id, 'group_deleted', 'group', p_group_id, '{}');
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Regenerate Invite Code
-- ============================================================
CREATE OR REPLACE FUNCTION regenerate_invite_code(
  p_group_id TEXT,
  p_admin_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_group RECORD;
  v_new_code TEXT;
BEGIN
  SELECT * INTO v_group FROM groups WHERE id = p_group_id AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GROUP_NOT_FOUND';
  END IF;
  
  IF v_group.created_by != p_admin_id THEN
    RAISE EXCEPTION 'NOT_GROUP_ADMIN';
  END IF;
  
  v_new_code := 'SHA2-' || UPPER(substring(md5(random()::text) from 1 for 4));
  
  UPDATE groups SET code = v_new_code WHERE id = p_group_id;
  
  INSERT INTO activity_log (group_id, user_id, action, target_type, details)
  VALUES (p_group_id, p_admin_id, 'invite_code_regenerated', 'group', '{}');
  
  RETURN v_new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Leave Group with Balance Check
-- ============================================================
CREATE OR REPLACE FUNCTION leave_group(
  p_group_id TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_balance DECIMAL;
BEGIN
  SELECT balance INTO v_balance 
  FROM calculate_group_balances(p_group_id) 
  WHERE user_id = p_user_id;
  
  IF v_balance IS NOT NULL AND ABS(v_balance) > 0.01 THEN
    RAISE EXCEPTION 'CANNOT_LEAVE_WITH_BALANCE';
  END IF;
  
  UPDATE groups 
  SET members = array_remove(members, p_user_id) 
  WHERE id = p_group_id AND deleted_at IS NULL;
  
  UPDATE group_members 
  SET left_at = NOW() 
  WHERE group_id = p_group_id AND user_id = p_user_id;
  
  INSERT INTO activity_log (group_id, user_id, action, target_type, target_id)
  VALUES (p_group_id, p_user_id, 'member_left', 'member', p_user_id::TEXT);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Get Group Statistics
-- ============================================================
CREATE OR REPLACE FUNCTION get_group_statistics(p_group_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_expenses', (
      SELECT COALESCE(SUM(amount), 0) 
      FROM expenses 
      WHERE "groupId" = p_group_id AND deleted_at IS NULL
    ),
    'expense_count', (
      SELECT COUNT(*) 
      FROM expenses 
      WHERE "groupId" = p_group_id AND deleted_at IS NULL
    ),
    'total_payments', (
      SELECT COALESCE(SUM(amount), 0) 
      FROM payments 
      WHERE "groupId" = p_group_id AND status IN ('CONFIRMED', 'COMPLETED') AND deleted_at IS NULL
    ),
    'payment_count', (
      SELECT COUNT(*) 
      FROM payments 
      WHERE "groupId" = p_group_id AND status IN ('CONFIRMED', 'COMPLETED') AND deleted_at IS NULL
    ),
    'member_count', (
      SELECT array_length(members, 1) 
      FROM groups 
      WHERE id = p_group_id
    ),
    'pending_payments', (
      SELECT COUNT(*) 
      FROM payments 
      WHERE "groupId" = p_group_id AND status = 'PENDING' AND deleted_at IS NULL
    ),
    'categories', (
      SELECT COALESCE(jsonb_object_agg(category, amount), '{}'::JSONB)
      FROM (
        SELECT category, SUM(amount) as amount
        FROM expenses
        WHERE "groupId" = p_group_id AND deleted_at IS NULL
        GROUP BY category
      ) cat
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGER: Auto-update timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER: Activity logging for expenses
-- ============================================================
CREATE OR REPLACE FUNCTION log_expense_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (group_id, user_id, action, target_type, target_id, details)
    VALUES (NEW."groupId", NEW."payerId", 'expense_added', 'expense', NEW.id, 
      jsonb_build_object('amount', NEW.amount, 'description', NEW.description));
  ELSIF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    INSERT INTO activity_log (group_id, user_id, action, target_type, target_id, details)
    VALUES (NEW."groupId", NEW."payerId", 'expense_deleted', 'expense', NEW.id, '{}');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_expense_changes ON expenses;
CREATE TRIGGER log_expense_changes
  AFTER INSERT OR UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION log_expense_activity();

-- ============================================================
-- TRIGGER: Activity logging for payments
-- ============================================================
CREATE OR REPLACE FUNCTION log_payment_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (group_id, user_id, action, target_type, target_id, details)
    VALUES (NEW."groupId", NEW."from", 'payment_initiated', 'payment', NEW.id, 
      jsonb_build_object('amount', NEW.amount, 'to', NEW."to"::TEXT));
  ELSIF TG_OP = 'UPDATE' AND OLD.status != 'CONFIRMED' AND NEW.status = 'CONFIRMED' THEN
    INSERT INTO activity_log (group_id, user_id, action, target_type, target_id, details)
    VALUES (NEW."groupId", NEW."to", 'payment_confirmed', 'payment', NEW.id, 
      jsonb_build_object('amount', NEW.amount, 'from', NEW."from"::TEXT));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_payment_changes ON payments;
CREATE TRIGGER log_payment_changes
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION log_payment_activity();

-- ============================================================
-- ENABLE RLS ON NEW TABLES
-- ============================================================
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Sync log - users can only see their own
CREATE POLICY "sync_log_user_policy" ON sync_log
FOR ALL USING (user_id = auth.uid());

-- User devices - users can only manage their own
CREATE POLICY "user_devices_user_policy" ON user_devices
FOR ALL USING (user_id = auth.uid());

-- Activity log - group members can view
CREATE POLICY "activity_log_members_policy" ON activity_log
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = activity_log.group_id AND gm.user_id = auth.uid() AND gm.left_at IS NULL
  )
);

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================
GRANT EXECUTE ON FUNCTION calculate_group_balances(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_group_ownership(TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_group_member(TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_group(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION regenerate_invite_code(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION leave_group(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_group_statistics(TEXT) TO authenticated;

-- ============================================================
-- DONE! V2.0 Schema Enhancement Complete
-- ============================================================
