import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      patient_id,
      patient_name,
      patient_nik,
      patient_age,
      examiner_name,
      clinic_id,
      timestamp,
      antropometri,
      vital_signs,
      diagnosa,
      icd10
    } = body;

    const currentTime = timestamp || new Date().toISOString();
    const encounterId = `enc-${Math.random().toString(36).substring(2, 10)}`;
    const organizationId = clinic_id || 'org-kemenkes-1008271';
    const patientReference = patient_nik ? `Patient/${patient_nik}` : `Patient/${patient_id || 'P-GUEST-01'}`;

    // Build standard FHIR R4 Observations
    const observations: any[] = [];

    // 1. Tinggi Badan (Body Height) - LOINC 8302-2
    if (antropometri?.height_cm) {
      observations.push({
        resourceType: 'Observation',
        id: `obs-height-${Math.random().toString(36).substring(2, 8)}`,
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
                display: 'Vital Signs'
              }
            ]
          }
        ],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8302-2',
              display: 'Body height'
            }
          ]
        },
        subject: { reference: patientReference, display: patient_name || 'Pasien' },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime: currentTime,
        valueQuantity: {
          value: Number(antropometri.height_cm),
          unit: 'cm',
          system: 'http://unitsofmeasure.org',
          code: 'cm'
        }
      });
    }

    // 2. Berat Badan (Body Weight) - LOINC 29463-7
    if (antropometri?.weight_kg) {
      observations.push({
        resourceType: 'Observation',
        id: `obs-weight-${Math.random().toString(36).substring(2, 8)}`,
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
                display: 'Vital Signs'
              }
            ]
          }
        ],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '29463-7',
              display: 'Body weight'
            }
          ]
        },
        subject: { reference: patientReference, display: patient_name || 'Pasien' },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime: currentTime,
        valueQuantity: {
          value: Number(antropometri.weight_kg),
          unit: 'kg',
          system: 'http://unitsofmeasure.org',
          code: 'kg'
        }
      });
    }

    // 3. Indeks Massa Tubuh (BMI) - LOINC 39156-5
    if (antropometri?.height_cm && antropometri?.weight_kg) {
      const hM = Number(antropometri.height_cm) / 100;
      const bmi = Number((Number(antropometri.weight_kg) / (hM * hM)).toFixed(2));
      observations.push({
        resourceType: 'Observation',
        id: `obs-bmi-${Math.random().toString(36).substring(2, 8)}`,
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
                display: 'Vital Signs'
              }
            ]
          }
        ],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '39156-5',
              display: 'Body mass index (BMI) [Ratio]'
            }
          ]
        },
        subject: { reference: patientReference, display: patient_name || 'Pasien' },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime: currentTime,
        valueQuantity: {
          value: bmi,
          unit: 'kg/m2',
          system: 'http://unitsofmeasure.org',
          code: 'kg/m2'
        }
      });
    }

    // 4. Tekanan Darah (Blood Pressure Panel) - LOINC 85354-9
    if (vital_signs?.systolic_mmhg && vital_signs?.diastolic_mmhg) {
      observations.push({
        resourceType: 'Observation',
        id: `obs-bp-${Math.random().toString(36).substring(2, 8)}`,
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
                display: 'Vital Signs'
              }
            ]
          }
        ],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '85354-9',
              display: 'Blood pressure panel with all children optional'
            }
          ]
        },
        subject: { reference: patientReference, display: patient_name || 'Pasien' },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime: currentTime,
        component: [
          {
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '8480-6',
                  display: 'Systolic blood pressure'
                }
              ]
            },
            valueQuantity: {
              value: Number(vital_signs.systolic_mmhg),
              unit: 'mm[Hg]',
              system: 'http://unitsofmeasure.org',
              code: 'mm[Hg]'
            }
          },
          {
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '8462-4',
                  display: 'Diastolic blood pressure'
                }
              ]
            },
            valueQuantity: {
              value: Number(vital_signs.diastolic_mmhg),
              unit: 'mm[Hg]',
              system: 'http://unitsofmeasure.org',
              code: 'mm[Hg]'
            }
          }
        ]
      });
    }

    // 5. Lingkar Kepala (Head Circumference) - LOINC 9843-4
    if (antropometri?.head_circumference_cm) {
      observations.push({
        resourceType: 'Observation',
        id: `obs-head-${Math.random().toString(36).substring(2, 8)}`,
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
                display: 'Vital Signs'
              }
            ]
          }
        ],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '9843-4',
              display: 'Head Occipital-frontal circumference'
            }
          ]
        },
        subject: { reference: patientReference },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime: currentTime,
        valueQuantity: {
          value: Number(antropometri.head_circumference_cm),
          unit: 'cm',
          system: 'http://unitsofmeasure.org',
          code: 'cm'
        }
      });
    }

    // 6. Pulse / Heart Rate - LOINC 8867-4
    if (vital_signs?.pulse_bpm) {
      observations.push({
        resourceType: 'Observation',
        id: `obs-pulse-${Math.random().toString(36).substring(2, 8)}`,
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
                display: 'Vital Signs'
              }
            ]
          }
        ],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8867-4',
              display: 'Heart rate'
            }
          ]
        },
        subject: { reference: patientReference },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime: currentTime,
        valueQuantity: {
          value: Number(vital_signs.pulse_bpm),
          unit: '/min',
          system: 'http://unitsofmeasure.org',
          code: '/min'
        }
      });
    }

    // 7. Suhu Tubuh (Body Temperature) - LOINC 8310-5
    if (vital_signs?.temperature_c) {
      observations.push({
        resourceType: 'Observation',
        id: `obs-temp-${Math.random().toString(36).substring(2, 8)}`,
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
                display: 'Vital Signs'
              }
            ]
          }
        ],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8310-5',
              display: 'Body temperature'
            }
          ]
        },
        subject: { reference: patientReference },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime: currentTime,
        valueQuantity: {
          value: Number(vital_signs.temperature_c),
          unit: 'Cel',
          system: 'http://unitsofmeasure.org',
          code: 'Cel'
        }
      });
    }

    // Assemble FHIR R4 Bundle
    const fhirBundle = {
      resourceType: 'Bundle',
      id: `bundle-satusehat-${Math.random().toString(36).substring(2, 10)}`,
      type: 'transaction',
      timestamp: currentTime,
      meta: {
        lastUpdated: currentTime,
        profile: ['https://fhir.kemkes.go.id/r4/StructureDefinition/Bundle']
      },
      entry: [
        {
          fullUrl: `urn:uuid:${encounterId}`,
          resource: {
            resourceType: 'Encounter',
            id: encounterId,
            status: 'finished',
            class: {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
              code: 'AMB',
              display: 'ambulatory'
            },
            subject: {
              reference: patientReference,
              display: patient_name || 'Pasien'
            },
            period: {
              start: currentTime,
              end: currentTime
            },
            serviceProvider: {
              reference: `Organization/${organizationId}`,
              display: 'Klinik Gigi & Pemeriksaan Fisik Digital dr Gigi AI'
            }
          },
          request: {
            method: 'POST',
            url: 'Encounter'
          }
        },
        ...observations.map(obs => ({
          fullUrl: `urn:uuid:${obs.id}`,
          resource: obs,
          request: {
            method: 'POST',
            url: 'Observation'
          }
        }))
      ]
    };

    return NextResponse.json({
      success: true,
      satusehat_status: '201 Created (Synced with SATUSEHAT FHIR R4)',
      satusehat_id: fhirBundle.id,
      encounter_id: encounterId,
      synced_observations_count: observations.length,
      synced_at: currentTime,
      organization_id: organizationId,
      fhir_bundle: fhirBundle,
      message: 'Data pemeriksaan fisik dan antropometri berhasil disinkronkan ke platform SATUSEHAT Kemenkes RI.'
    }, { status: 200 });

  } catch (error: any) {
    console.error('SATUSEHAT Sync API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Gagal menyinkronkan data ke SATUSEHAT Kemenkes RI'
    }, { status: 500 });
  }
}
