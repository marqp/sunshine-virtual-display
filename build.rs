fn main() {
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rerun-if-changed=src/display/native_virtual_display.m");
        cc::Build::new()
            .file("src/display/native_virtual_display.m")
            .flag("-fobjc-arc")
            .compile("native_virtual_display");

        println!("cargo:rustc-link-lib=framework=Cocoa");
        println!("cargo:rustc-link-lib=framework=CoreGraphics");
        println!("cargo:rustc-link-lib=framework=CoreVideo");
        println!("cargo:rustc-link-lib=framework=IOKit");
    }
}
