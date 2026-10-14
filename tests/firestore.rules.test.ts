import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
let env: RulesTestEnvironment;
beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-drgigi-repair', firestore: { host: '127.0.0.1', port: 8088, rules: readFileSync('firestore.rules', 'utf8') } }); });
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/a'), { uid: 'a', email: 'a@example.test', role: 'admin' });
    await setDoc(doc(db, 'users/b'), { uid: 'b', email: 'b@example.test', role: 'patient' });
    await setDoc(doc(db, 'records/b-record'), { userId: 'b', assignedClinicianUids: ['assigned-doctor'] });
    await setDoc(doc(db, 'appointments/b-apt'), { userId: 'b', assignedClinicianUids: ['assigned-doctor'] });
  });
});
describe('Firestore authorization with synthetic identities', () => {
  it('denies anonymous reads', async () => { await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'records/b-record'))); });
  it('ignores privileged roles in user-editable legacy documents', async () => { await assertFails(getDoc(doc(env.authenticatedContext('a').firestore(), 'records/b-record'))); });
  it('denies self-promotion and cross-profile reads', async () => {
    const db = env.authenticatedContext('b', { email: 'b@example.test' }).firestore();
    await assertFails(updateDoc(doc(db, 'users/b'), { role: 'admin' }));
    await assertFails(getDoc(doc(db, 'users/a')));
  });
  it('allows only patient profile creation', async () => {
    const db = env.authenticatedContext('c', { email: 'c@example.test' }).firestore();
    await assertFails(setDoc(doc(db, 'users/c'), { uid: 'c', email: 'c@example.test', role: 'doctor' }));
    await assertSucceeds(setDoc(doc(db, 'users/c'), { uid: 'c', email: 'c@example.test', role: 'patient' }));
  });
  it('allows owner and assigned doctor; denies unassigned doctor', async () => {
    await assertSucceeds(getDoc(doc(env.authenticatedContext('b').firestore(), 'records/b-record')));
    await assertSucceeds(getDoc(doc(env.authenticatedContext('assigned-doctor', { role: 'doctor' }).firestore(), 'records/b-record')));
    await assertFails(getDoc(doc(env.authenticatedContext('other-doctor', { role: 'doctor' }).firestore(), 'records/b-record')));
  });
  it('requires server transactions for medical mutations, even for administrator', async () => {
    const db = env.authenticatedContext('admin', { role: 'admin' }).firestore();
    await assertFails(setDoc(doc(db, 'records/new'), { userId: 'admin' }));
    await assertFails(updateDoc(doc(db, 'records/b-record'), { is_accurate: true }));
    await assertFails(deleteDoc(doc(db, 'records/b-record')));
  });
  it('protects ownership and assignment in patient profiles', async () => {
    const db = env.authenticatedContext('b').firestore();
    await assertSucceeds(setDoc(doc(db, 'patients/p'), { id: 'p', name: 'Synthetic', userId: 'b' }));
    await assertFails(updateDoc(doc(db, 'patients/p'), { userId: 'a' }));
    await assertFails(updateDoc(doc(db, 'patients/p'), { assignedClinicianUids: ['attacker'] }));
  });
  it('makes audit events append-only to browser users', async () => {
    await assertFails(setDoc(doc(env.authenticatedContext('admin', { role: 'admin' }).firestore(), 'auditLogs/fake'), { actorUid: 'b' }));
  });
});
