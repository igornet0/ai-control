import { describe, expect, it } from 'vitest';
import {
  buildCommentTree,
  flattenCommentTree,
  countCommentsInTree,
} from './commentTreeUtils';

describe('commentTreeUtils', () => {
  const comments = [
    { id: 1, parent_id: null, content: 'root' },
    { id: 2, parent_id: 1, content: 'reply' },
    { id: 3, parent_id: null, content: 'root2' },
  ];

  it('builds nested tree', () => {
    const tree = buildCommentTree(comments);
    expect(tree).toHaveLength(2);
    expect(tree[0].replies).toHaveLength(1);
  });

  it('flattens with depth', () => {
    const flat = flattenCommentTree(buildCommentTree(comments));
    expect(flat).toHaveLength(3);
    expect(flat[1].depth).toBe(1);
  });

  it('counts all nodes', () => {
    expect(countCommentsInTree(buildCommentTree(comments))).toBe(3);
  });
});
