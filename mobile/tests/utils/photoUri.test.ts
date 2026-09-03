import { isLocalUri, isRemoteUri, ensureFileUri } from '../../src/utils/photoUri';

describe('isLocalUri', () => {
  test('file:// is local', () => {
    expect(isLocalUri('file:///document/photos/a.jpg')).toBe(true);
  });

  test('content:// is local', () => {
    expect(isLocalUri('content://media/external/images/1')).toBe(true);
  });

  test('http(s) is not local', () => {
    expect(isLocalUri('https://storage.example.com/tree-photos/a.jpg')).toBe(false);
    expect(isLocalUri('http://storage.example.com/tree-photos/a.jpg')).toBe(false);
  });

  test('bare storage path (no scheme) is not local', () => {
    expect(isLocalUri('plantations/p1/parcelas/pc1/trees/t1.jpg')).toBe(false);
  });

  test('null/undefined/empty string is not local', () => {
    expect(isLocalUri(null)).toBe(false);
    expect(isLocalUri(undefined)).toBe(false);
    expect(isLocalUri('')).toBe(false);
  });
});

describe('isRemoteUri', () => {
  test('http(s) is remote', () => {
    expect(isRemoteUri('https://storage.example.com/tree-photos/a.jpg')).toBe(true);
  });

  test('bare storage path is remote', () => {
    expect(isRemoteUri('plantations/p1/parcelas/pc1/trees/t1.jpg')).toBe(true);
  });

  test('file:// and content:// are not remote', () => {
    expect(isRemoteUri('file:///document/photos/a.jpg')).toBe(false);
    expect(isRemoteUri('content://media/external/images/1')).toBe(false);
  });

  test('null/undefined/empty string is not remote', () => {
    expect(isRemoteUri(null)).toBe(false);
    expect(isRemoteUri(undefined)).toBe(false);
    expect(isRemoteUri('')).toBe(false);
  });
});

describe('ensureFileUri', () => {
  test('leaves file:// URIs unchanged', () => {
    expect(ensureFileUri('file:///document/photos/a.jpg')).toBe('file:///document/photos/a.jpg');
  });

  test('leaves content:// URIs unchanged', () => {
    expect(ensureFileUri('content://media/external/images/1')).toBe('content://media/external/images/1');
  });

  test('prefixes a bare path with file://', () => {
    expect(ensureFileUri('/document/photos/a.jpg')).toBe('file:///document/photos/a.jpg');
  });
});
