import { describe, expect, it } from 'vitest';
import { isPrivateOrReservedIp } from '@/lib/security/ip';

describe('isPrivateOrReservedIp', () => {
  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '10.255.255.255',
    '127.0.0.1',
    '127.1.2.3',
    '100.64.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.0.0.1',
    '192.0.2.5',
    '192.168.1.1',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.9',
    '224.0.0.1',
    '240.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'fe80::1%eth0',
    'ff02::1',
    '2001:db8::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    '::ffff:169.254.169.254',
    '::ffff:7f00:1',
    '64:ff9b::7f00:1',
    '2002:7f00:1::1',
    '2001:0:4136:e378:8000:63bf:3fff:fdd2',
  ])('blocks %s', (ip) => expect(isPrivateOrReservedIp(ip)).toBe(true));

  it.each([
    '1.1.1.1',
    '8.8.8.8',
    '31.13.71.36',
    '157.240.1.35',
    '172.15.0.1',
    '172.32.0.1',
    '2606:4700:4700::1111',
    '2a03:2880:f12f:83:face:b00c:0:25de',
    '::ffff:8.8.8.8',
  ])('allows public %s', (ip) => expect(isPrivateOrReservedIp(ip)).toBe(false));

  it('fails closed for non-IP input and malformed addresses', () => {
    expect(isPrivateOrReservedIp('example.com')).toBe(true);
    expect(isPrivateOrReservedIp('')).toBe(true);
    expect(isPrivateOrReservedIp('999.1.1.1')).toBe(true);
    expect(isPrivateOrReservedIp('1.2.3')).toBe(true);
    expect(isPrivateOrReservedIp('2130706433')).toBe(true); // decimal-encoded 127.0.0.1
    expect(isPrivateOrReservedIp('0x7f.0.0.1')).toBe(true);
  });
});
