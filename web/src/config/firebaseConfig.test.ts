import { describe, it, expect } from 'vitest';
import { resolveConfig } from './firebaseConfig';

describe('resolveConfig', () => {
  it('returns prod config for app.zenuml.com (payment on)', () => {
    const c = resolveConfig('app.zenuml.com');
    expect(c.firebase.projectId).toBe('web-sequence-local');
    expect(c.firebase.authDomain).toBe('app.zenuml.com');
    expect(c.features.payment).toBe(true);
  });
  it('chrome extension host: payment off, prod project, firebaseapp authDomain', () => {
    const c = resolveConfig('kcpganeflmhffnlofpdmcjklmdpbbmef');
    expect(c.firebase.projectId).toBe('web-sequence-local');
    expect(c.firebase.authDomain).toBe('web-sequence-local.firebaseapp.com');
    expect(c.features.payment).toBe(false);
  });
  it('both Edge extension hosts map to prod project with payment off', () => {
    for (const host of ['dkbmlkgijbidhjiojpmfchklncgimlpd', 'lbdlpjkkjmclkacflkdoaacpafjdiido']) {
      const c = resolveConfig(host);
      expect(c.firebase.projectId).toBe('web-sequence-local');
      expect(c.features.payment).toBe(false);
    }
  });
  it('staging maps to staging project (storageBucket has no -27954 suffix)', () => {
    const c = resolveConfig('staging.zenuml.com');
    expect(c.firebase.projectId).toBe('staging-zenuml-27954');
    expect(c.firebase.storageBucket).toBe('staging-zenuml.appspot.com');
    expect(c.features.payment).toBe(true);
  });
  it('dev host carries an appId and dev project', () => {
    const c = resolveConfig('web-sequence-dev.web.app');
    expect(c.firebase.projectId).toBe('web-sequence-dev');
    expect(c.firebase.appId).toBe('1:269086080449:web:524e822dbd66f7bb594340');
  });
  it('unknown host falls back to staging default', () => {
    const c = resolveConfig('localhost');
    expect(c.firebase.projectId).toBe('staging-zenuml-27954');
    expect(c.features.payment).toBe(true);
  });
  it('prod paddle product IDs are the production set', () => {
    const c = resolveConfig('app.zenuml.com');
    expect(c.paddleProductBasicMonthly).toBe('879334');
    expect(c.paddleProductPlusMonthly).toBe('883078');
    expect(c.paddleProductBasicYearly).toBe('879927');
    expect(c.paddleProductPlusYearly).toBe('883082');
  });
});
