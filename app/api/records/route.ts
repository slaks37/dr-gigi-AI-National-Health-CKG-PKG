import { NextRequest, NextResponse } from 'next/server';
import { saveMedicalRecord, getMedicalRecords, deleteMedicalRecord, logActivity } from '@/src/db/repository';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userUid = searchParams.get('userUid') || undefined;
    const role = searchParams.get('role') || undefined;

    const records = await getMedicalRecords(userUid, role);
    return NextResponse.json({ success: true, records });
  } catch (error: any) {
    console.error('Error in /api/records GET:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recordId, userUid, patientName, patientNik, recordType, analysisResult, payload, satusehatSynced, satusehatResourceId } = body;

    if (!recordId || !userUid || !patientName || !recordType) {
      return NextResponse.json({ error: 'Missing required record fields' }, { status: 400 });
    }

    const saved = await saveMedicalRecord({
      recordId,
      userUid,
      patientName,
      patientNik: patientNik || null,
      recordType,
      analysisResult: typeof analysisResult === 'object' ? JSON.stringify(analysisResult) : analysisResult,
      payload: typeof payload === 'object' ? JSON.stringify(payload) : payload,
      satusehatSynced: satusehatSynced || 'false',
      satusehatResourceId: satusehatResourceId || null,
    });

    // Log the event
    await logActivity({
      userUid,
      module: recordType,
      action: 'SAVE_MEDICAL_RECORD',
      details: JSON.stringify({ recordId, patientName, recordType }),
    });

    return NextResponse.json({ success: true, record: saved });
  } catch (error: any) {
    console.error('Error in /api/records POST:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const recordId = searchParams.get('recordId');
    const userUid = searchParams.get('userUid') || undefined;
    const role = searchParams.get('role') || undefined;

    if (!recordId) {
      return NextResponse.json({ error: 'recordId is required' }, { status: 400 });
    }

    const success = await deleteMedicalRecord(recordId, userUid, role);
    return NextResponse.json({ success });
  } catch (error: any) {
    console.error('Error in /api/records DELETE:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
