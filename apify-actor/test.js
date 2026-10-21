// Run: node test.js (no Apify needed)
import assert from 'node:assert/strict';
import { parseHandle, isPostUrl, usablePosts, normalizePost, bestTimes, formats, mediaFromPost } from './src/lib.js';

assert.equal(parseHandle('@sevnhalsey'), 'sevnhalsey');
assert.equal(parseHandle('instagram.com/john.doe/?igsh=x'), 'john.doe');
assert.equal(parseHandle('https://www.instagram.com/p/ABC/'), null); // reserved path 'p'
assert.equal(parseHandle('two words'), null);
assert.ok(isPostUrl('https://www.instagram.com/reel/Cx_1-a/'));
assert.ok(!isPostUrl('@name'));

assert.equal(usablePosts([{ error: 'x' }, { caption: 'hi' }, null, { likesCount: 3 }]).length, 2);
const p = normalizePost({ caption: 'Hook\nrest', likesCount: 10, commentsCount: 2, videoViewCount: 100, timestamp: '2026-10-19T14:05:00.000Z' });
assert.equal(p.firstLine, 'Hook');
assert.equal(p.score, 10 + 6 + 5);

// best times: needs 8 dated posts; Tuesday 12:00-15:00 UTC scores highest
const mk = (iso, likes) => normalizePost({ caption: 'c', likesCount: likes, timestamp: iso });
const few = [mk('2026-10-20T13:00:00Z', 100)];
assert.equal(bestTimes(few), null);
const many = [
  mk('2026-10-20T13:00:00Z', 500), mk('2026-10-27T12:30:00Z', 450), // Tuesdays 12-15
  mk('2026-10-21T03:00:00Z', 10), mk('2026-10-22T04:00:00Z', 20), mk('2026-10-23T05:00:00Z', 15),
  mk('2026-10-24T22:00:00Z', 30), mk('2026-10-25T23:00:00Z', 25), mk('2026-10-26T01:00:00Z', 12),
];
const bt = bestTimes(many);
assert.equal(bt.weekday, 'Tuesday');
assert.equal(bt.windowUtc, '12:00-15:00');
assert.equal(bt.sample, 8);

const f = formats([normalizePost({ images: [1, 2, 3], likesCount: 30 }), normalizePost({ likesCount: 10 }), normalizePost({ productType: 'clips', likesCount: 5 })]);
assert.equal(f.carousel.posts, 1); assert.equal(f.single.posts, 1); assert.equal(f.video.posts, 1);

const media = mediaFromPost({ type: 'Sidecar', images: ['a', 'b'], shortCode: 'XYZ' });
assert.deepEqual(media.map((m) => m.src), ['a', 'b']);
assert.equal(media[0].postUrl, 'https://www.instagram.com/p/XYZ/');
// hidden likes (-1) are unknown, not negative; comments text is kept without usernames
const hid = normalizePost({ caption: 'x', likesCount: -1, commentsCount: 9, latestComments: [{ text: 'Trim', ownerUsername: 'someone', likesCount: 3, repliesCount: 1 }, { text: '  ' }], images: ['u1', 'u2', 'u3'], isPinned: true, alt: 'Photo by S.' });
assert.equal(hid.likes, 0); assert.equal(hid.likesHidden, true); assert.equal(hid.score, 27);
assert.deepEqual(hid.comments_top, [{ text: 'Trim', likes: 3, replies: 1 }]);
assert.ok(!JSON.stringify(hid).includes('someone'));
assert.deepEqual(hid.slideUrls, ['u1', 'u2', 'u3']); assert.equal(hid.slides, 3); assert.equal(hid.isPinned, true);
// pinned posts do not count toward best times
const pinned = Array(8).fill(0).map((_, i) => normalizePost({ caption: 'c', likesCount: 10, timestamp: '2026-10-2' + (i % 8) + 'T03:00:00Z', isPinned: true }));
assert.equal(bestTimes(pinned), null);
console.log('ok');
