const KTERN_BASE_URL = 'https://qual.ktern.ai/api/v1';
const HEADERS = {
  'x-tenant-id': '8db2de94-5b70-4af3-9126-becf177133ff',
  'x-organization-id': '0b125485-a7d7-454e-9b00-8887d7beab17',
  'Content-Type': 'application/json',
  'Origin': 'https://qual.ktern.ai'
};

async function test() {
  console.log('Logging in...');
  const res = await fetch(`${KTERN_BASE_URL}/auth/sign-in/email`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      email: 'msivaram@kaartech.com',
      password: 'sivarametos@04'
    })
  });
  
  if (!res.ok) {
    console.error('Login failed', res.status, await res.text());
    return;
  }
  
  console.log('Login successful');
  let cookieString = '';
  if (typeof res.headers.getSetCookie === 'function') {
    cookieString = res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  } else {
    cookieString = res.headers.get('set-cookie');
  }
  
  console.log('Cookie String:', cookieString);
  
  console.log('Fetching projects...');
  const projRes = await fetch(`${KTERN_BASE_URL}/projects`, {
    method: 'GET',
    headers: {
      ...HEADERS,
      'Cookie': cookieString
    }
  });
  
  const text = await projRes.text();
  console.log('Projects Status:', projRes.status);
  console.log('Projects Response:', text.substring(0, 500));
}

test();
