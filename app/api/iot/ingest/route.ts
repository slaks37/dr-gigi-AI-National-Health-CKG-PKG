import { NextRequest, NextResponse } from 'next/server';

// In-memory telemetry cache for active sessions / devices
// In production, this can be synced with Firestore or Redis
const deviceTelemetryStore: Record<string, any> = {};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const deviceToken = req.headers.get('x-device-token') || req.headers.get('authorization');
    
    const {
      device_id,
      device_type, // 'smart_scale' | 'stadiometer' | 'blood_pressure' | 'pulse_oximeter' | 'thermometer' | 'all_in_one'
      patient_id,
      measurements,
      firmware_version,
      battery_level
    } = body;

    if (!device_id || !measurements) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: device_id and measurements are mandatory.'
      }, { status: 400 });
    }

    const timestamp = body.timestamp || new Date().toISOString();

    const record = {
      device_id,
      device_type: device_type || 'unknown_sensor',
      patient_id: patient_id || 'unassigned',
      firmware_version: firmware_version || '1.0.0',
      battery_level: battery_level !== undefined ? battery_level : 100,
      timestamp,
      measurements: {
        weight_kg: measurements.weight_kg !== undefined ? Number(measurements.weight_kg) : undefined,
        height_cm: measurements.height_cm !== undefined ? Number(measurements.height_cm) : undefined,
        systolic_mmhg: measurements.systolic_mmhg !== undefined ? Number(measurements.systolic_mmhg) : undefined,
        diastolic_mmhg: measurements.diastolic_mmhg !== undefined ? Number(measurements.diastolic_mmhg) : undefined,
        pulse_bpm: measurements.pulse_bpm !== undefined ? Number(measurements.pulse_bpm) : undefined,
        spo2_percent: measurements.spo2_percent !== undefined ? Number(measurements.spo2_percent) : undefined,
        temperature_c: measurements.temperature_c !== undefined ? Number(measurements.temperature_c) : undefined,
        head_circumference_cm: measurements.head_circumference_cm !== undefined ? Number(measurements.head_circumference_cm) : undefined,
        arm_circumference_cm: measurements.arm_circumference_cm !== undefined ? Number(measurements.arm_circumference_cm) : undefined
      }
    };

    // Store in memory by device_id and session
    deviceTelemetryStore[device_id] = record;
    if (patient_id) {
      deviceTelemetryStore[`patient_${patient_id}`] = record;
    }
    deviceTelemetryStore['latest'] = record;

    return NextResponse.json({
      success: true,
      message: 'Data telemetri IoT berhasil dicatat oleh sistem dr Gigi AI.',
      recorded_at: timestamp,
      device_id,
      summary: record.measurements
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error in /api/iot/ingest:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal Server Error processing IoT telemetry'
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('device_id');
  const patientId = searchParams.get('patient_id');

  if (deviceId && deviceTelemetryStore[deviceId]) {
    return NextResponse.json({
      success: true,
      data: deviceTelemetryStore[deviceId]
    });
  }

  if (patientId && deviceTelemetryStore[`patient_${patientId}`]) {
    return NextResponse.json({
      success: true,
      data: deviceTelemetryStore[`patient_${patientId}`]
    });
  }

  // Return latest record or all
  return NextResponse.json({
    success: true,
    latest: deviceTelemetryStore['latest'] || null,
    registered_devices: Object.keys(deviceTelemetryStore).filter(k => !k.startsWith('patient_') && k !== 'latest')
  });
}
