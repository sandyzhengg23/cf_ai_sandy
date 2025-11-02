/**
 * Simple script to get Google Calendar refresh token
 * 
 * Usage:
 * 1. Make sure you've added a redirect URI in Google Cloud Console:
 *    - Go to: https://console.cloud.google.com/apis/credentials
 *    - Edit your OAuth 2.0 Client ID
 *    - Add authorized redirect URI: http://localhost:3000/oauth2callback
 * 
 * 2. Run: node get-google-token.js
 * 
 * 3. Open the URL shown in the output
 * 
 * 4. After authorization, you'll be redirected to localhost
 * 
 * 5. Copy the "code" from the URL and run:
 *    node get-google-token.js <code>
 */

const http = require('http');

const CLIENT_ID = '27084618907-esam24esdeb29gdm7ekr3qf8gf8g0ufn.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

if (process.argv.length < 3) {
  // Step 1: Show authorization URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent'); // Important: forces refresh token

  console.log('\n📋 STEP 1: Authorize the app\n');
  console.log('1. Make sure you\'ve added this redirect URI in Google Cloud Console:');
  console.log('   http://localhost:3000/oauth2callback\n');
  console.log('2. Open this URL in your browser:\n');
  console.log(authUrl.toString());
  console.log('\n3. Sign in with your Google account');
  console.log('4. Click "Allow"');
  console.log('\n📋 STEP 2: Get the authorization code\n');
  console.log('5. You\'ll be redirected to localhost:3000');
  console.log('6. Copy the "code" parameter from the URL');
  console.log('   Example: http://localhost:3000/oauth2callback?code=4/0A...');
  console.log('   Copy everything after "code="\n');
  console.log('7. Run: node get-google-token.js <code>\n');

  // Start a simple server to catch the redirect
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const code = url.searchParams.get('code');
    
    if (code) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="font-family: Arial; padding: 40px;">
            <h1>✅ Authorization Code Received!</h1>
            <p><strong>Code:</strong></p>
            <pre style="background: #f0f0f0; padding: 10px; overflow-x: auto;">${code}</pre>
            <p>Now run this command in your terminal:</p>
            <pre style="background: #e8f5e9; padding: 10px;">node get-google-token.js ${code}</pre>
          </body>
        </html>
      `);
      console.log('\n✅ Code received! Check your terminal for the command to run.\n');
      setTimeout(() => server.close(), 5000);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Waiting for authorization...</h1></body></html>');
    }
  });

  server.listen(3000, () => {
    console.log('\n🌐 Local server started on http://localhost:3000');
    console.log('   (This will catch the OAuth redirect)\n');
  });

} else {
  // Step 2: Exchange code for tokens
  const code = process.argv[2];
  
  console.log('\n🔄 Exchanging code for tokens...\n');

  fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }),
  })
    .then(async (res) => {
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(JSON.stringify(data, null, 2));
      }
      
      if (data.refresh_token) {
        console.log('✅ SUCCESS! Refresh token obtained:\n');
        console.log('┌─────────────────────────────────────────────────────────┐');
        console.log(`│ ${data.refresh_token}`);
        console.log('└─────────────────────────────────────────────────────────┘\n');
        console.log('📝 Add this to your .dev.vars file:');
        console.log(`GOOGLE_REFRESH_TOKEN=${data.refresh_token}\n`);
      } else {
        console.log('⚠️  No refresh token in response. You may need to:');
        console.log('   - Make sure prompt=consent is in the auth URL');
        console.log('   - Revoke access and try again');
        console.log('\nResponse:', JSON.stringify(data, null, 2));
      }
    })
    .catch((err) => {
      console.error('❌ Error:', err.message);
      process.exit(1);
    });
}

