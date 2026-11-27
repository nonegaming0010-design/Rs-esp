# Rs-ESP Firestore Security Specification

## 1. Data Invariants
1. User profiles (`/users/{userId}`) store zero PII (no email/phone/address) and can only be created or updated by the verified authenticated owner (`request.auth.uid == userId && request.auth.token.email_verified == true`).
2. Sketches (`/sketches/{sketchId}`) must match their document ID, belong to `request.auth.uid` on create, start with `likesCount == 0`, and never allow `authorUid` or `createdAt` to mutate.
3. Private sketches (`visibility == 'private'`) are readable and listable strictly by their `authorUid`; non-owners and anonymous users receive `PERMISSION_DENIED`.
4. Public likes (`/sketches/{sketchId}/likes/{userId}`) are only permitted on `public` sketches and must be written/deleted in an atomic `WriteBatch` alongside `likesCount` (+/- 1) enforced via `existsAfter` and `getAfter`.
5. Comments (`/sketches/{sketchId}/comments/{commentId}`) are only allowed on `public` sketches verified against the parent sketch via `get()`, and can only be deleted by their author or a verified admin.
6. Admin moderation privileges apply strictly to verified (`email_verified == true`) `nonegaming0010@gmail.com` or delegated UIDs registered in `/admins/{uid}`, enabling sketch visibility/featured moderation, comment deletion, `/siteConfig/global` updates, and `/users` listing (non-admins continue receiving `PERMISSION_DENIED` on blanket user listing).

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Identity Spoofing on Sketch Create**: Authenticated user A submits `authorUid: "user_B"`.
2. **Ghost Field Injection (Shadow Update)**: Author updates a sketch with extra field `isFeatured: true`.
3. **Unverified Email Write**: Newly signed-up email user with `email_verified: false` attempts to publish a sketch.
4. **Private Sketch Read by Non-Owner**: User B tries `get` or `list` on User A's `visibility: "private"` sketch.
5. **Document ID Poisoning**: Attacker creates `/sketches/../../../bad` or a 500-char ID failing `isValidId()`.
6. **Code Size Resource Exhaustion**: Attacker writes a 250KB string into `code` exceeding `100000` chars.
7. **Likes Counter Forgery**: User updates `likesCount: 9999` directly without creating `/likes/{uid}`.
8. **Orphaned Like Write**: User creates `/sketches/{id}/likes/{uid}` without atomically incrementing parent `likesCount`.
9. **Commenting on Private Sketch**: User attempts to create a comment under a `visibility: "private"` sketch.
10. **Immutable Timestamp Tampering**: Client submits fake `createdAt` (`!= request.time`) or alters `createdAt` on update.
11. **Array Type / Size Poisoning**: Client submits 50 tags (`tags.size() > 8`) or a numeric element `tags: [123]`.
12. **Blanket User Listing**: Signed-in user attempts to `list` `/users` to scrape creator profiles.
