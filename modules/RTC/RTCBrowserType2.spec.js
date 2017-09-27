import RTCBrowserType from './RTCBrowserType2';


fdescribe('RTCBrowserType', function() {
    it('foo', function() {
        const b = new RTCBrowserType('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.91 Safari/537.36');
        console.log(b.browserInfo.name, b.browserInfo.version);
        expect(true).toBe(false);

        console.log(b.getBrowserType());
        console.log(b.getBrowserName());
    });
});

