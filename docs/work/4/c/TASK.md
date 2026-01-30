# Phase 4, Stream C: Security Headers

## Goal
Implement security headers via CloudFront Function.

## Files
- `infrastructure/security-headers.js`

## CloudFront Function

```javascript
function handler(event) {
  var response = event.response;
  var headers = response.headers;
  var request = event.request;
  var uri = request.uri;

  // Base security headers for all responses
  headers['x-content-type-options'] = { value: 'nosniff' };
  headers['x-frame-options'] = { value: 'DENY' };
  headers['referrer-policy'] = { value: 'no-referrer' };
  headers['strict-transport-security'] = { 
    value: 'max-age=31536000; includeSubDomains' 
  };
  headers['permissions-policy'] = { 
    value: 'geolocation=(), microphone=(), camera=()' 
  };

  // Content Security Policy
  headers['content-security-policy'] = {
    value: "default-src 'self'; " +
           "script-src 'self'; " +
           "style-src 'self'; " +
           "connect-src 'self' https://api.sealed.fyi; " +
           "frame-ancestors 'none'; " +
           "base-uri 'self'; " +
           "form-action 'self'"
  };

  // Cache-Control varies by content type
  if (uri.endsWith('.html') || uri === '/' || uri === '/index.html') {
    // HTML: no caching, no local traces
    headers['cache-control'] = { value: 'no-store, max-age=0' };
  } else if (uri.match(/\.(js|css)$/)) {
    // Static assets: cache with versioned filenames
    headers['cache-control'] = { 
      value: 'public, max-age=31536000, immutable' 
    };
  }

  return response;
}
```

## Headers Summary

| Header | Value | Purpose |
|--------|-------|---------|
| Content-Security-Policy | See above | Prevent XSS, injection |
| X-Content-Type-Options | nosniff | Prevent MIME sniffing |
| X-Frame-Options | DENY | Prevent clickjacking |
| Referrer-Policy | no-referrer | Prevent URL leakage |
| Strict-Transport-Security | max-age=31536000 | Force HTTPS |
| Permissions-Policy | geolocation=()... | Disable unused APIs |
| Cache-Control | Varies | Control caching |

## Cache-Control Strategy
- `index.html`: `no-store` (always fetch fresh, no traces)
- `*.js`, `*.css`: `public, max-age=31536000, immutable` (versioned filenames)
- API responses: `no-store` (handled by API Gateway)

## Verification
Test with:
```bash
curl -I https://sealed.fyi
curl -I https://sealed.fyi/js/app.js
```

All security headers should be present.

## Exit Criteria
- [ ] CloudFront Function created
- [ ] Function associated with distribution
- [ ] All headers present on responses
- [ ] CSP tested with browser dev tools
- [ ] No CSP violations in console
- [ ] Code reviewed
