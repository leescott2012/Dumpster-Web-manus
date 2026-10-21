# Dumpster Instagram Scan

Reads the **public** posts of an Instagram profile and turns them into what Dumpster needs to learn a creator's style, in one run.

Built for [Dumpster](https://dumpster-web-manus.vercel.app), a photo-dump carousel builder. Private and personal use: it does not log in and never touches private accounts.

## What you get (per profile)
- **Ranked posts**: each post's caption, first line (hook), hashtags, mentions, likes, comments, views, format, location and posting time, with an engagement score (comments count 3x, views 0.05x). Posts where Instagram hides the like count are flagged `likesHidden` (likes treated as unknown, not zero or negative). Pinned posts are flagged `isPinned`.
- **Carousel order**: `slideUrls` in the order they appear (first slide = hook, last = ender), plus each slide's type and Instagram's auto description (`altText`).
- **Top comments**: the most-liked/replied comments on each post (`comments_top`: text, likes, replies). Usernames are not kept.
- **Top posts**: the 3 best-performing posts.
- **Formats**: how many carousel, single-image and video posts, and the average score of each.
- **Best posting time**: best weekday and 3-hour window by average engagement. Times are in UTC. Needs at least 8 dated, unpinned posts (pinned posts are old and would skew it).
- **Hashtags** used across the profile.
- For **post and reel links** instead of a profile: the image and video links of each post, with carousel slides in order.

## Input
| Field | What it does |
|---|---|
| `handles` | Public handles, with or without `@` |
| `postUrls` | `instagram.com/p/`, `/reel/` or `/tv/` links |
| `resultsPerProfile` | Recent posts to read per handle, 4 to 30 (default 12) |
| `upstreamTimeoutSecs` | Time allowed for the Instagram scraper per attempt (default 90) |
| `upstreamMemoryMbytes` | Memory for the Instagram scraper (default 1024) |
| `retryOnTimeout` | Retry once with 1.5x time if it times out (default on) |

## Output (one item per handle)
`mode`, `handle`, `ok`, `postCount`, `topPosts`, `posts`, `hashtags`, `formats`, `bestTimes`, or `ok: false` with an `error` (`bad_handle`, `no_public_posts`, `scrape_timeout`, `scrape_unavailable`).

## Cost
This actor is about $0.001 per run. It runs `apify/instagram-scraper` underneath, which charges about $0.0025 per post returned (12 posts is about $0.03). Both come out of your Apify usage.

## Notes
Scraping Instagram, even public pages, is against Instagram's terms of use. Use public data only, store totals and trends rather than other people's personal details, and expect Instagram to block or slow requests at times.
