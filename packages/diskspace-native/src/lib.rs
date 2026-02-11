#![deny(clippy::all)]

use napi::bindgen_prelude::*;
use napi_derive::napi;

#[cfg(windows)]
use std::ffi::OsStr;
#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;

#[cfg(windows)]
#[link(name = "Kernel32")]
extern "system" {
  fn GetDiskFreeSpaceExW(
    lpDirectoryName: *const u16,
    lpFreeBytesAvailable: *mut u64,
    lpTotalNumberOfBytes: *mut u64,
    lpTotalNumberOfFreeBytes: *mut u64,
  ) -> i32;
}

#[napi(object)]
pub struct DiskSpace {
  pub available: f64, // using f64 for JS number compatibility (u64 might exceed MAX_SAFE_INTEGER, but usually file sizes fit in f64 precision for disk headers, or use BigInt if preferred. user previous code used Number() which is f64). Let's use f64 to avoid BigInt issues in JS side unless requested. Actually, JS BigInt is better for bytes. NAPI supports BigInt. usage in TS was `number`. Let's stick to `f64` (double) effectively or `BigInt`.
  // The previous koffi implementation used `Number()`, so I will use `f64` here for simplicity in JS.
  // Wait, `u64` in napi-rs maps to `BigInt` (or `number` if configured). Default is `BigInt` usually?
  // Let's use `f64` to match `fsSize` result type often usage. 
  // Actually, systeminformation uses number, but can be huge.
  // Let's use `f64` to be safe for JS math without BigInt literals.
  pub total: f64,
  pub free: f64,
}

#[napi]
pub fn get_disk_space(path_or_drive: String) -> Result<DiskSpace> {
  #[cfg(not(windows))]
  {
    return Err(Error::new(
      Status::GenericFailure,
      "get_disk_space is windows-only".to_string(),
    ));
  }

  #[cfg(windows)]
  {
    let mut p = path_or_drive.trim().to_string();

    // Normalization logic similar to previous implementation
    if p.len() >= 2 && p.as_bytes()[1] == b':' {
       if p.len() == 2 {
         p.push('\\');
       }
    }

    let mut wide: Vec<u16> = OsStr::new(&p).encode_wide().collect();
    wide.push(0);

    let mut available: u64 = 0;
    let mut total: u64 = 0;
    let mut free: u64 = 0;

    let ok = unsafe { GetDiskFreeSpaceExW(wide.as_ptr(), &mut available, &mut total, &mut free) };
    if ok == 0 {
      return Err(Error::new(
        Status::GenericFailure,
        format!("GetDiskFreeSpaceExW failed for: {}", p),
      ));
    }

    Ok(DiskSpace {
      available: available as f64,
      total: total as f64,
      free: free as f64,
    })
  }
}
