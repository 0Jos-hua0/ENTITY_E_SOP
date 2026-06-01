import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function proxyRequest(request, endpoint, options = {}) {
  const KTERN_BASE_URL = process.env.KTERN_BASE_URL;
  const cookieStore = await cookies();
  const cookieString = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

  const headers = {
    'x-tenant-id': process.env.KTERN_TENANT_ID,
    'x-organization-id': process.env.KTERN_ORG_ID,
    'Content-Type': 'application/json',
    'Origin': 'https://qual.ktern.ai',
    'Cookie': cookieString,
    ...options.headers,
  };

  try {
    const url = `${KTERN_BASE_URL}${endpoint}`;
    
    let fetchOptions = {
      method: request.method,
      headers,
    };

    if (['POST', 'PATCH', 'PUT'].includes(request.method)) {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        fetchOptions.body = formData;
        delete fetchOptions.headers['Content-Type'];
      } else {
        const body = await request.text();
        if (body) fetchOptions.body = body;
      }
    }

    const res = await fetch(url, fetchOptions);

    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    let data;
    const resContentType = res.headers.get('content-type') || '';
    if (resContentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }
    
    console.log(`[PROXY] ${request.method} ${url} -> Status: ${res.status}`);
    if (res.status !== 200) console.log(`[PROXY] Error Response:`, data);
    if (endpoint === '/projects') console.log(`[PROXY] /projects Response:`, typeof data === 'string' ? data.substring(0, 200) : JSON.stringify(data).substring(0, 200));

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
