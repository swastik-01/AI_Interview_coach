export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Proxy for NVIDIA API
    if (url.pathname.startsWith('/api-nvidia/')) {
      const targetUrl = new URL(request.url);
      targetUrl.hostname = 'integrate.api.nvidia.com';
      targetUrl.pathname = targetUrl.pathname.replace('/api-nvidia/', '/v1/');
      targetUrl.port = '';
      
      const newRequest = new Request(targetUrl.toString(), request);
      return fetch(newRequest);
    }

    // Proxy for Sarvam API
    if (url.pathname.startsWith('/api-sarvam/')) {
      const targetUrl = new URL(request.url);
      targetUrl.hostname = 'api.sarvam.ai';
      targetUrl.pathname = targetUrl.pathname.replace('/api-sarvam/', '/v1/');
      targetUrl.port = '';
      
      const newRequest = new Request(targetUrl.toString(), request);
      return fetch(newRequest);
    }

    // Serve all other static assets normally
    return env.ASSETS.fetch(request);
  }
}
