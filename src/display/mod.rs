use std::ffi::CString;
use std::os::raw::c_void;

#[repr(C)]
#[derive(Debug, Default, Clone, Copy)]
pub struct NativeDisplayInfo {
    pub id: u32,
    pub width: u32,
    pub height: u32,
}

extern "C" {
    fn create_native_virtual_display(
        width: u32,
        height: u32,
        name: *const std::os::raw::c_char,
        refresh_rate: f64,
        hi_dpi: bool,
        out_info: *mut NativeDisplayInfo,
    ) -> *mut c_void;

    fn destroy_native_virtual_display(handle: *mut c_void);
}

pub struct VirtualDisplay {
    pub id: u32,
    #[allow(dead_code)]
    pub width: u32,
    #[allow(dead_code)]
    pub height: u32,
    handle: *mut c_void,
}

// Safety: The Objective-C handle is thread-safe on macOS when destroyed
unsafe impl Send for VirtualDisplay {}
unsafe impl Sync for VirtualDisplay {}

impl VirtualDisplay {
    pub fn new(width: u32, height: u32, name: &str) -> anyhow::Result<Self> {
        let c_name = CString::new(name)?;
        let mut info = NativeDisplayInfo::default();

        let handle = unsafe {
            create_native_virtual_display(width, height, c_name.as_ptr(), 60.0, true, &mut info)
        };

        if handle.is_null() {
            anyhow::bail!("Failed to create native virtual display via macOS CoreGraphics");
        }

        Ok(Self {
            id: info.id,
            width: info.width,
            height: info.height,
            handle,
        })
    }
}

impl Drop for VirtualDisplay {
    fn drop(&mut self) {
        if !self.handle.is_null() {
            unsafe {
                destroy_native_virtual_display(self.handle);
            }
            self.handle = std::ptr::null_mut();
        }
    }
}
