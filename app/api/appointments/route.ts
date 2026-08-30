import { NextRequest, NextResponse } from 'next/server';
import { saveAppointmentSql, getAppointmentsSql, logActivity } from '@/src/db/repository';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userUid = searchParams.get('userUid') || undefined;
    const role = searchParams.get('role') || undefined;

    const appointments = await getAppointmentsSql(userUid, role);
    return NextResponse.json({ success: true, appointments });
  } catch (error: any) {
    console.error('Error in /api/appointments GET:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { appointmentId, userUid, patientName, doctorName, clinicName, date, time, status, notes } = body;

    if (!appointmentId || !userUid || !patientName || !doctorName || !date || !time) {
      return NextResponse.json({ error: 'Missing required appointment fields' }, { status: 400 });
    }

    const saved = await saveAppointmentSql({
      appointmentId,
      userUid,
      patientName,
      doctorName,
      clinicName: clinicName || 'Klinik dr Gigi AI',
      date,
      time,
      status: status || 'scheduled',
      notes: notes || null,
    });

    await logActivity({
      userUid,
      module: 'appointment',
      action: 'BOOK_APPOINTMENT',
      details: JSON.stringify({ appointmentId, patientName, doctorName, date, time }),
    });

    return NextResponse.json({ success: true, appointment: saved });
  } catch (error: any) {
    console.error('Error in /api/appointments POST:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
