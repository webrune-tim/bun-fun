Bun.serve({
    port: 5173,
    fetch(req) {
        console.log(req.url);
        return new Response("Hello, world!");
    },
});