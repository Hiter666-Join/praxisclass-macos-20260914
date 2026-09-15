export const runtime = 'nodejs';

// Retire old clients without opening the local store, scheduling parsing jobs,
// or modifying previously saved files and remote Dify documents.
function removedLocalLibrary(): Response {
  return Response.json({ error: 'local_knowledge_removed' }, { status: 410 });
}

export { removedLocalLibrary as GET, removedLocalLibrary as POST };
