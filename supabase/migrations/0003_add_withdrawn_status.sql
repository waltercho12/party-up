-- Run standalone (separate transaction) before 0004, since a new enum
-- value can't be referenced by DML in the same transaction it was added in.
-- Represents an application auto-cancelled because the user got accepted
-- into a different party — distinct from 'rejected' (host declined) and
-- 'left' (was accepted, then departed).
alter type member_status add value 'withdrawn';
