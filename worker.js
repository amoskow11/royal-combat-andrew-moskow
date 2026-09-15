// worker.js — the Cloudflare Worker entry point.
// Right now every request is handled by the static "assets" config in
// wrangler.jsonc (Hot-Seat and VS Computer are plain files, no server logic
// needed). This handler only runs for requests the assets layer doesn't
// serve. Phase 4 adds the room-code routing to a Durable Object here.
export default {
  async fetch(request) {
    return new Response('Not found', { status: 404 });
  },
};
