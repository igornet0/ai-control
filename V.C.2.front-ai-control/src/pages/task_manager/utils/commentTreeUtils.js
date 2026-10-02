export const COMMENTS_COLLAPSE_LIMIT = 10;

export function buildCommentTree(comments) {
  const byId = new Map();
  const roots = [];

  (comments || []).forEach((comment) => {
    byId.set(comment.id, { ...comment, replies: [] });
  });

  (comments || []).forEach((comment) => {
    const node = byId.get(comment.id);
    if (!node) return;
    if (comment.parent_id && byId.has(comment.parent_id)) {
      byId.get(comment.parent_id).replies.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export function flattenCommentTree(nodes, depth = 0) {
  const flat = [];
  (nodes || []).forEach((node) => {
    flat.push({ ...node, depth });
    flat.push(...flattenCommentTree(node.replies, depth + 1));
  });
  return flat;
}

export function countCommentsInTree(nodes) {
  let count = 0;
  (nodes || []).forEach((node) => {
    count += 1;
    count += countCommentsInTree(node.replies);
  });
  return count;
}
