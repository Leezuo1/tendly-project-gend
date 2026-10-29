import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync('lib/utils/facebookCommentGroups.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new Function('exports', compiled)(loaded.exports);
const { groupCommentsByAuthor } = loaded.exports;
const comment = (commentId, authorId, extra = {}) => ({ pageId: '111', commentId, authorId, authorName: 'Cùng tên', ...extra });

test('groups by Page and author ID across posts, preserving input order and comments', () => {
  const comments = [comment('a', '222', { postId: 'p1', status: 'sent' }), comment('b', '333'),
    comment('c', '222', { postId: 'p2', status: 'review' }), comment('d', '222', { pageId: '999' })];
  const before = structuredClone(comments);
  const groups = groupCommentsByAuthor(comments);
  assert.deepEqual(groups.map((group) => group.map((c) => c.commentId)), [['a', 'c'], ['b'], ['d']]);
  assert.equal(groups[0][1], comments[2]);
  assert.deepEqual(comments, before);
});

test('missing IDs remain separate even with identical names or colliding comment and author IDs', () => {
  assert.deepEqual(groupCommentsByAuthor([comment('a', ''), comment('b', ''), comment('c', 'a')])
    .map((group) => group.map((c) => c.commentId)), [['a'], ['b'], ['c']]);
  assert.deepEqual(groupCommentsByAuthor([]), []);
});
