-- Allow invited users to mark their own invitations as accepted.
-- Without this, only admins/managers can UPDATE invitations, so the
-- AccountSetup page's acceptance update is silently blocked by RLS.
CREATE POLICY "Users can accept their own invitations"
  ON invitations FOR UPDATE
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (status = 'accepted');
