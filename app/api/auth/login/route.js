import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const body = await request.json();
    const KTERN_BASE_URL = process.env.KTERN_BASE_URL;
    
    const HEADERS = {
      'x-tenant-id': process.env.KTERN_TENANT_ID,
      'x-organization-id': process.env.KTERN_ORG_ID,
      'Content-Type': 'application/json',
      'Origin': 'https://qual.ktern.ai'
    };

    const res = await fetch(`${KTERN_BASE_URL}/auth/sign-in/email`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(body),
    });

    const data = await res.json();
    
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    
    const response = NextResponse.json(data);
    if (typeof res.headers.getSetCookie === 'function') {
      const setCookies = res.headers.getSetCookie();
      setCookies.forEach(cookieStr => {
        const parts = cookieStr.split(';');
        const [nameValue] = parts;
        const [name, ...valueParts] = nameValue.split('=');
        const value = valueParts.join('=');
        
        response.cookies.set({
          name: name.trim(),
          value: value.trim(),
          path: '/',
          httpOnly: cookieStr.toLowerCase().includes('httponly'),
          sameSite: 'lax',
          maxAge: 604800
        });
      });
    }

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
