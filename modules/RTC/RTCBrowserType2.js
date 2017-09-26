import { bowser } from 'bowser'

class RTCBrowserType2 {
    constructor(userAgent) {
        this.userAgent = userAgent;
        this.browserInfo = bowser._detect(this.userAgent);
    }


}

export default RTCBrowserType2;
