#import <Cocoa/Cocoa.h>
#import <CoreGraphics/CoreGraphics.h>

@class CGVirtualDisplayDescriptor;
@interface CGVirtualDisplayMode : NSObject
@property(readonly, nonatomic) CGFloat refreshRate;
@property(readonly, nonatomic) NSUInteger width;
@property(readonly, nonatomic) NSUInteger height;
- (instancetype)initWithWidth:(NSUInteger)arg1 height:(NSUInteger)arg2 refreshRate:(CGFloat)arg3;
@end

@interface CGVirtualDisplaySettings : NSObject
@property(nonatomic) unsigned int hiDPI;
@property(retain, nonatomic) NSArray<CGVirtualDisplayMode *> *modes;
- (instancetype)init;
@end

@interface CGVirtualDisplay : NSObject
@property(readonly, nonatomic) CGDirectDisplayID displayID;
- (instancetype)initWithDescriptor:(CGVirtualDisplayDescriptor *)arg1;
- (BOOL)applySettings:(CGVirtualDisplaySettings *)arg1;
@end

@interface CGVirtualDisplayDescriptor : NSObject
@property(retain, nonatomic) NSString *name;
@property(nonatomic) unsigned int maxPixelsHigh;
@property(nonatomic) unsigned int maxPixelsWide;
@property(nonatomic) CGSize sizeInMillimeters;
@property(nonatomic) unsigned int serialNum;
@property(nonatomic) unsigned int productID;
@property(nonatomic) unsigned int vendorID;
@property(copy, nonatomic) void (^terminationHandler)(id, CGVirtualDisplay*);
- (instancetype)init;
@end

typedef struct {
    uint32_t id;
    uint32_t width;
    uint32_t height;
} NativeDisplayInfo;

typedef struct {
    CGVirtualDisplay* display;
    CGVirtualDisplayDescriptor* descriptor;
    CGVirtualDisplaySettings* settings;
} NativeVirtualDisplayContext;

void* create_native_virtual_display(
    uint32_t width,
    uint32_t height,
    const char* name,
    double refresh_rate,
    bool hi_dpi,
    NativeDisplayInfo* out_info
) {
    @autoreleasepool {
        NativeVirtualDisplayContext* ctx = (NativeVirtualDisplayContext*)malloc(sizeof(NativeVirtualDisplayContext));
        if (!ctx) return NULL;

        NSString* displayName = name ? [NSString stringWithUTF8String:name] : @"Sunshine Virtual Display";
        
        CGVirtualDisplayDescriptor* descriptor = [[CGVirtualDisplayDescriptor alloc] init];
        descriptor.name = displayName;
        descriptor.maxPixelsWide = width;
        descriptor.maxPixelsHigh = height;
        
        double ppi = 81.0;
        double ratio = 25.4 / ppi;
        descriptor.sizeInMillimeters = CGSizeMake(width * ratio, height * ratio);
        
        unsigned long hash = 5381;
        const char* serialStr = name ? name : "Sunshine Virtual Display";
        for (const char* p = serialStr; *p != 0; p++) {
            hash = ((hash << 5) + hash) + *p;
        }
        descriptor.serialNum = (unsigned int)(hash & 0xFFFFFFFF);
        descriptor.productID = (unsigned int)((hash >> 16) & 0xFFFF);
        descriptor.vendorID = 0xeeee;
        
        CGVirtualDisplay* display = [[CGVirtualDisplay alloc] initWithDescriptor:descriptor];
        if (!display) {
            free(ctx);
            return NULL;
        }

        CGVirtualDisplaySettings* settings = [[CGVirtualDisplaySettings alloc] init];
        settings.hiDPI = hi_dpi ? 1 : 0;
        
        CGVirtualDisplayMode* mode = [[CGVirtualDisplayMode alloc] initWithWidth:width height:height refreshRate:refresh_rate];
        if (hi_dpi) {
            CGVirtualDisplayMode* lowResMode = [[CGVirtualDisplayMode alloc] initWithWidth:width / 2 height:height / 2 refreshRate:refresh_rate];
            settings.modes = @[mode, lowResMode];
        } else {
            settings.modes = @[mode];
        }
        
        [display applySettings:settings];

        // Ensure display configuration does not hijack primary or duplicate
        uint32_t mainDisplay = CGMainDisplayID();
        CGDisplayConfigRef config;
        CGBeginDisplayConfiguration(&config);
        
        uint32_t displayId = CGDisplayMirrorsDisplay(mainDisplay);
        if (displayId == display.displayID) {
            CGConfigureDisplayMirrorOfDisplay(config, displayId, kCGNullDirectDisplay);
        }
        
        boolean_t isMirror = CGDisplayIsInMirrorSet(display.displayID);
        if (isMirror) {
            CGConfigureDisplayMirrorOfDisplay(config, display.displayID, kCGNullDirectDisplay);
        }
        
        CGCompleteDisplayConfiguration(config, kCGConfigureForAppOnly);

        ctx->display = display;
        ctx->descriptor = descriptor;
        ctx->settings = settings;

        if (out_info) {
            out_info->id = display.displayID;
            out_info->width = width;
            out_info->height = height;
        }

        return (void*)ctx;
    }
}

void destroy_native_virtual_display(void* handle) {
    if (!handle) return;
    @autoreleasepool {
        NativeVirtualDisplayContext* ctx = (NativeVirtualDisplayContext*)handle;
        ctx->display = nil;
        ctx->descriptor = nil;
        ctx->settings = nil;
        free(ctx);
    }
}
