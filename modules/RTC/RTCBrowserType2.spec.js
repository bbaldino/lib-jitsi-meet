import RTCBrowserType from './RTCBrowserType2';

/* eslint prefer-arrow-callback: 0 */

const SAFARI_10_1_1 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_5)'
    + ' AppleWebKit/603.2.4 (KHTML, like Gecko) Version/10.1.1 Safari/603.2.4';
const IE_11 = 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0;'
    + ' .NET4.0C; .NET4.0E; .NET CLR 2.0.50727; .NET CLR 3.0.30729;'
    + ' .NET CLR 3.5.30729; rv:11.0) like Gecko';

// NOTE(brian): I don't believe an IE version > 11 actually exists,
// but we have a test that checks for < 12, so we'll invent a
// version '12' ie useragent string to use in the unit test
const IE_12 = 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0;'
    + ' .NET4.0C; .NET4.0E; .NET CLR 2.0.50727;'
    + ' .NET CLR 3.0.30729; .NET CLR 3.5.30729; rv:12.0) like Gecko';
const ELECTRON = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_5)'
    + ' AppleWebKit/537.36 (KHTML, like Gecko) Stride/1.2.12'
    + ' Chrome/56.0.2924.87 Electron/1.6.11 Safari/537.36';
const REACT_NATIVE_IOS = 'react-native/0.42.3 (ios 11.0)';
const REACT_NATIVE_ANDROID = 'react-native/0.42.3 (android 25)';
const NWJS = 'Macintosh; Intel Mac OS X 10_12_6 AppleWebKit/537.36'
    + ' (@ad0be09aa3ca814168d079b52825f6f80e22f0e8) Chrome/537.36'
    + ' (@ad0be09aa3ca814168d079b52825f6f80e22f0e8) nwjs/0.19.2'
    + ' JitsiMeetNW/1.3.1';

describe('RTCBrowserType', function() {
    describe('isTemasysPluginUsed', function() {
        it('should be used if the browser detected is safari', function() {
            const info = new RTCBrowserType(SAFARI_10_1_1);

            expect(info.isTemasysPluginUsed()).toBe(true);
        });
        it('should be used if the browser is ie < 12', function() {
            const info = new RTCBrowserType(IE_11);

            expect(info.isTemasysPluginUsed()).toBe(true);
        });
        it('should not be used if the browser is ie 12', function() {
            const info = new RTCBrowserType(IE_12);

            expect(info.isTemasysPluginUsed()).toBe(false);
        });
    });
    describe('Custom detectors', function() {
        it('should detect electron', function() {
            const info = new RTCBrowserType(ELECTRON);

            expect(info.getBrowserType())
                .toEqual(RTCBrowserType.RTC_BROWSER_ELECTRON);
        });
        it('should detect react native on ios', function() {
            const info = new RTCBrowserType(REACT_NATIVE_IOS);

            expect(info.getBrowserType())
                .toEqual(RTCBrowserType.RTC_BROWSER_REACT_NATIVE);
        });
        it('should detect react native on android', function() {
            const info = new RTCBrowserType(REACT_NATIVE_ANDROID);

            expect(info.getBrowserType())
                .toEqual(RTCBrowserType.RTC_BROWSER_REACT_NATIVE);
        });
        it('should detect nwjs', function() {
            const info = new RTCBrowserType(NWJS);

            expect(info.getBrowserType())
                .toEqual(RTCBrowserType.RTC_BROWSER_NWJS);
        });
    });
});
