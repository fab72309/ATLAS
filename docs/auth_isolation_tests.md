# Auth Isolation + Join Tests

## Setup
- `npx supabase db reset`
- `npm run dev`
- Create two users (User A, User B)

## Isolation (User A -> User B)
1. Login as User A.
2. Create an intervention, fill address + moyens + OCT + SITAC for ~30s.
3. Logout.
4. Login as User B.
5. Verify the UI is blank: no address, no moyens, no OCT/SITAC state, no active intervention.
6. Refresh the browser as User B and confirm state is still blank.
7. (Optional) Login back as User A and confirm no leakage from User B.

## Storage scoping
- In DevTools, confirm keys are namespaced as `atlas:v1:<userId>:<baseKey>`.
- On logout or user change, confirm old user keys are removed.

## Secure join (invite token)
1. Login as User A and create an intervention.
2. Open "Invite by QR Code" and generate a QR.
3. Confirm `public.intervention_invites` has a new row (token, uses_count=0).
4. Login as User B, open `#/join?token=...`.
5. Pick a command level and click Join.
6. Verify:
   - `public.intervention_members` has User B with `command_level` set.
   - `public.intervention_invites.uses_count` increments.
   - App navigates to `/situation/<command_level>/dictate`.
