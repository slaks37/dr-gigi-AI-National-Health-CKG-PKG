import { NextRequest, NextResponse } from 'next/server';
import { logActivity, getRecentActivityLogs } from '@/src/db/repository';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userUid, userEmail, module, action, details, metadata } = body;

    if (!module || !action) {
      return NextResponse.json({ error: 'Module and Action are required' }, { status: 400 });
    }

    const log = await logActivity({
      userUid: userUid || 'anonymous',
      userEmail: userEmail || null,
      module,
      action,
      details: typeof details === 'object' ? JSON.stringify(details) : details,
      metadata: typeof metadata === 'object' ? JSON.stringify(metadata) : metadata,
    });

    return NextResponse.json({ success: true, log });
  } catch (error: any) {
    console.error('Error in /api/activity POST:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const logs = await getRecentActivityLogs(100);
    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    console.error('Error in /api/activity GET:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
