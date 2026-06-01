import { proxyRequest } from '@/lib/proxy';

export async function GET(request, { params }) {
  const resolvedParams = await params;
  const endpoint = '/' + resolvedParams.ktern.join('/');
  return proxyRequest(request, endpoint);
}

export async function POST(request, { params }) {
  const resolvedParams = await params;
  const endpoint = '/' + resolvedParams.ktern.join('/');
  return proxyRequest(request, endpoint);
}

export async function PATCH(request, { params }) {
  const resolvedParams = await params;
  const endpoint = '/' + resolvedParams.ktern.join('/');
  return proxyRequest(request, endpoint);
}

export async function PUT(request, { params }) {
  const resolvedParams = await params;
  const endpoint = '/' + resolvedParams.ktern.join('/');
  return proxyRequest(request, endpoint);
}

export async function DELETE(request, { params }) {
  const resolvedParams = await params;
  const endpoint = '/' + resolvedParams.ktern.join('/');
  return proxyRequest(request, endpoint);
}
