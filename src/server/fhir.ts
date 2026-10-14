import { randomUUID } from 'node:crypto';
import { ApiError, object, onlyKeys } from './security';

export function buildDraft(body: Record<string, unknown>) {
  onlyKeys(body, ['mode', 'patientIhsId', 'organizationIhsId', 'practitionerIhsId', 'encounterIhsId', 'measuredAt', 'measurements']);
  for (const key of ['patientIhsId', 'organizationIhsId', 'practitionerIhsId', 'encounterIhsId']) {
    if (typeof body[key] !== 'string' || !/^[A-Za-z0-9.-]{1,64}$/.test(body[key] as string) || /^\d{16}$/.test(body[key] as string)) throw new ApiError(400, 'Resolved IHS identifiers required; NIK is not a FHIR resource ID');
  }
  if (typeof body.measuredAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(body.measuredAt) || !Number.isFinite(Date.parse(body.measuredAt)) || Date.parse(body.measuredAt) > Date.now()) throw new ApiError(400, 'Valid measuredAt required');
  const measurements = object(body.measurements);
  onlyKeys(measurements, ['height_cm', 'weight_kg', 'pulse_bpm', 'temperature_c']);
  const definitions: Record<string, [string, string, number, number]> = {
    height_cm: ['8302-2', 'cm', 20, 250], weight_kg: ['29463-7', 'kg', 0.2, 500], pulse_bpm: ['8867-4', '/min', 20, 250], temperature_c: ['8310-5', 'Cel', 25, 45],
  };
  if (Object.keys(measurements).length === 0) throw new ApiError(400, 'Measured values required');
  const entry = Object.entries(measurements).map(([key, raw]) => {
    const measurement = object(raw);
    onlyKeys(measurement, ['value', 'source']);
    const [code, unit, min, max] = definitions[key];
    if (measurement.source !== 'measured' || typeof measurement.value !== 'number' || !Number.isFinite(measurement.value) || measurement.value < min || measurement.value > max) throw new ApiError(400, 'Only plausible measured values can be previewed');
    return { fullUrl: `urn:uuid:${randomUUID()}`, resource: { resourceType: 'Observation', status: 'preliminary', category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }], code: { coding: [{ system: 'http://loinc.org', code }] }, subject: { reference: `Patient/${body.patientIhsId}` }, encounter: { reference: `Encounter/${body.encounterIhsId}` }, performer: [{ reference: `Practitioner/${body.practitionerIhsId}` }], effectiveDateTime: body.measuredAt, valueQuantity: { value: measurement.value, unit, system: 'http://unitsofmeasure.org', code: unit } } };
  });
  // A collection is a local preview, never a transaction or confirmation of remote acceptance.
  return { resourceType: 'Bundle', type: 'collection', entry };
}
