export async function onRequest() {
  return Response.json({
    success: true,
    message: "Fishit Monitor API (Cloudflare Pages) is running",
    time: Date.now(),
  });
}
