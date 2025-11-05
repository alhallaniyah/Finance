/*
  # Add application roles (admin, manager, sales)

  Creates a dedicated enum and mapping table for user roles. Users are limited
  to viewing their own role, while the service role (anonymous key not included)
  can manage assignments.
*/

-- Create enum for roles when not already present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'manager', 'sales');
  END IF;
END $$;

-- Mapping table between auth.users and role
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'sales',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Keep timestamps fresh on updates
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_updated_at ON user_roles;
CREATE TRIGGER trigger_set_updated_at
  BEFORE UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Enable RLS and policies
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own role" ON user_roles;
CREATE POLICY "Users can view own role"
  ON user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages roles" ON user_roles;
CREATE POLICY "Service role manages roles"
  ON user_roles
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
