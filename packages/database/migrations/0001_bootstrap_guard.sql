ALTER TABLE organizations
  ADD COLUMN singleton boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX organizations_singleton_idx ON organizations(singleton);

ALTER TABLE invitations
  ADD COLUMN accepted_by text REFERENCES users(id) ON DELETE SET NULL;
