import RTCBrowserType from './RTCBrowserType2';

const SAFARI_10_1_1 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_5) AppleWebKit/603.2.4 (KHTML, like Gecko) Version/10.1.1 Safari/603.2.4'

fdescribe('RTCBrowserType', function() {
    describe('isTemasysPluginUsed', function() {
        it ('should be used if the browser detected is safari', function() {
            const info = new RTCBrowserType(SAFARI_10_1_1);
            expect(info.isTemasysPluginUsed()).toBe(true);
        });
    });
    //it('foo', function() {
    //    const b = new RTCBrowserType('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.91 Safari/537.36');
    //    console.log(b.browserInfo.name, b.browserInfo.version);
    //    expect(true).toBe(false);

    //    console.log(b.getBrowserType());
    //    console.log(b.getBrowserName());
    //});
});

