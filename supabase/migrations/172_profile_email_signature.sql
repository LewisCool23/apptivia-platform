-- Migration 172: Add email_signature column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_signature TEXT;
