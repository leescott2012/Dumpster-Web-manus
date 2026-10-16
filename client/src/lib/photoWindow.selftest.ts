// Run: npx tsx client/src/lib/photoWindow.selftest.ts
import assert from "node:assert/strict";
import { pickPhotoWindow } from "./photoWindow";

var pool = Array.from({ length: 30 }, function(_, i) { return i; });
assert.deepEqual(pickPhotoWindow(pool, 20, 0), pool.slice(0, 20));
// Second run covers the 10 the first run missed, then wraps.
assert.deepEqual(pickPhotoWindow(pool, 20, 1), pool.slice(20).concat(pool.slice(0, 10)));
assert.deepEqual(pickPhotoWindow(pool, 20, 2), pool.slice(10, 30));
// Two runs together see every photo.
assert.equal(new Set(pickPhotoWindow(pool, 20, 0).concat(pickPhotoWindow(pool, 20, 1))).size, 30);
// Small pool: everything, every time.
assert.deepEqual(pickPhotoWindow([1, 2, 3], 20, 5), [1, 2, 3]);
assert.deepEqual(pickPhotoWindow([], 20, 1), []);
// Window never contains duplicates.
assert.equal(new Set(pickPhotoWindow(pool, 20, 7)).size, 20);
console.log("photoWindow selftest: ok");
