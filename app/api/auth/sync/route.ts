import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateUser, logActivity } from '@/src/db/repository';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, email, displayName, photoUrl, role } = body;

    if (!uid || !email) {
      return NextResponse.json({ error: 'UID and Email are required' }, { status: 400 });
    }

    const user = await getOrCreateUser({
      uid,
      email,
      displayName,
      photoUrl,
      role: role || 'user',
    });

    // Log the login/active event
    await logActivity({
      userUid: uid,
      userEmail: email,
      module: 'auth',
      action: 'USER_SYNC_LOGIN',
      details: JSON.stringify({ displayName, role: user.role, time: new Date().toISOString() }),
    });

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error('Error in /api/auth/sync:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
