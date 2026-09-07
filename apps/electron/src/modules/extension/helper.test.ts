import { describe, expect, it } from 'vitest'
import { genExtensionID } from './extensionId'

describe('genExtensionID', () => {
  it('matches Chromium unpacked-extension IDs on POSIX paths', () => {
    expect(genExtensionID({ type: 'path', input: '/tmp/automation-control-extension/abc' }, 'darwin'))
      .toBe('jkiiodnlejinkmngnicghiabidijahai')
    expect(genExtensionID({ type: 'path', input: '/tmp/扩展/automation-control' }, 'linux'))
      .toBe('gblnkgioaijmgkjaaeepkhhdankamcid')
  })

  it('matches Chromium FilePath bytes on Windows paths', () => {
    expect(genExtensionID({ type: 'path', input: 'C:\\Users\\Roxy\\automation-control' }, 'win32'))
      .toBe('ljpncfdphdlhkfaloiecfnfoldcgdjcc')
    expect(genExtensionID({ type: 'path', input: 'c:\\Users\\扩展\\automation-control' }, 'win32'))
      .toBe('bbednjhmfbcjnncflngpcopdhamchkjb')
  })

  it('preserves manifest-key hashing', () => {
    expect(genExtensionID({ type: 'key', input: 'AQIDBA==' })).toBe('jpgekhehobljhpbdbpkllgleehcjgmjl')
  })
})
