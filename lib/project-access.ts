export function projectAccessStatus(userId: string | null | undefined, ownerId: string | null | undefined) {
  if (!userId) return 401 as const;
  if (!ownerId) return 404 as const;
  if (userId !== ownerId) return 403 as const;
  return 200 as const;
}
