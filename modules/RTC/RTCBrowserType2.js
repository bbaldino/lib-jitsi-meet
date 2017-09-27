import bowser from 'bowser';
import { getLogger } from 'jitsi-meet-logger';
const logger = getLogger(__filename);

/**
 * Bowser doesn't define constants for the browser names, it
 * uses hard-coded strings in bowser.js.  These are copies
 * of those so we can use constants instead
 */
const BOWSER_CHROME = 'Chrome';
const BOWSER_OPERA = 'Opera';
const BOWSER_FIREFOX = 'Firefox';
const BOWSER_IE = 'Internet Explorer';
const BOWSER_MSEDGE = 'Microsoft Edge';
const BOWSER_SAFARI = 'Safari';
const BOWSER_CHROMIUM = 'Chrome';


/**
 * A class for detecting the browser name and version.  Relies on
 * the Bowser library for most of the work, but also contains
 * some custom browser detection for other clients
 */
class RTCBrowserType2 {
    static RTC_BROWSER_CHROME = 'rtc_browser.chrome';
    static RTC_BROWSER_OPERA = 'rtc_browser.opera';
    static RTC_BROWSER_FIREFOX = 'rtc_browser.firefox';
    static RTC_BROWSER_IEXPLORER = 'rtc_browser.iexplorer';
    static RTC_BROWSER_EDGE = 'rtc_browser.edge';
    static RTC_BROWSER_SAFARI = 'rtc_browser.safari';
    static RTC_BROWSER_NWJS = 'rtc_browser.nwjs';
    static RTC_BROWSER_ELECTRON = 'rtc_browser.electron';
    static RTC_BROWSER_REACT_NATIVE = 'rtc_browser.react-native';

    /**
     * constructor
     * @param {string} userAgent the user agent
     * @param {string} product the agent's product
     */
    constructor(userAgent, product) {
        this.browserInfo = this._detect(userAgent, product);
        logger.log(`Detected browser ${this.browserInfo.name} ${this.browserInfo.version}`);
    }

    /**
     * Detect the browser name and version from the userAgent (and possibly
     * its 'product' field)
     * @param {string} userAgent the user agent
     * @param {string} product the agent's product
     * @returns an object containing the browser's name, version and possibly
     * other information
     */
    _detect(userAgent, product) {
        // TODO(brian): i don't think we want to run bowser's detect first here
        // since then it may set flags and we won't know which ones to clear.
        // hopefully only running it if the other special-case detections fail
        // doesn't lead to anything awkward
        let browserInfo;
        const customDetectors = [
            this._detectReactNative,
            this._detectElectron,
            this._detectNWJS
        ];
        let customAgentDetected = false;

        for (const customDetector of customDetectors) {
            const info = customDetector(userAgent, product);

            if (info.version) {
                // Note that here we actually set the name to a value
                // defined by RTC_BROWSER_XXX, as opposed to the bowser
                // defines.  This is fine because bowser doesn't have
                // definitions for these
                browserInfo.name = info.browser;
                browserInfo.version = info.version;
                customAgentDetected = true;
                break;
            }
        }
        if (!customAgentDetected) {
            browserInfo = bowser._detect(userAgent);
        }

        return browserInfo;
    }

    /**
     * Detects if the given userAgent is from a react native client
     * @param {string} the user agent
     * @param {string} product the value of navigator.product
     * returns {object} containing the browser name and the version if
     * this agent is react native, otherwise the version field will
     * be null.
     */
    _detectReactNative(userAgent, product) {
        const match
            = userAgent.match(/\b(react[ \t_-]*native)(?:\/(\S+))?/i);
        let version;

        // If we're remote debugging a React Native app, it may be treated as
        // Chrome. Check navigator.product as well and always return some
        // version even if we can't get the real one.

        if (match || product === 'ReactNative') {
            if (match && match.length > 2) {
                version = match[2];
            }
            version || (version = 'unknown');
        } else {
            // We're not running in a React Native environment.
            version = null;
        }

        return {
            browser: RTCBrowserType2.RTC_BROWSER_REACT_NATIVE,
            version
        };
    }

    /**
     * Detects if the given userAgent is from an electron client
     * @param {string} the user agent
     * returns {object} containing the browser name and the version if
     * this agent is electron, otherwise the version field will
     * be null.
     */
    _detectElectron(userAgent) {
        let version;

        if (userAgent.match(/Electron/)) {
            version = userAgent.match(/Electron\/([\d.]+)/)[1];
        } else {
            version = null;
        }

        return {
            browser: RTCBrowserType2.RTC_BROWSER_ELECTRON,
            version
        };
    }

    /**
     * Detects if the given userAgent is from an nwjs client
     * @param {string} the user agent
     * returns {object} containing the browser name and the version if
     * this agent is nwjs, otherwise the version field will
     * be null.
     */
    _detectNWJS(userAgent) {
        let version;

        if (userAgent.match(/JitsiMeetNW/)) {
            version = userAgent.match(/JitsiMeetNW\/([\d.]+)/)[1];
        } else {
            version = null;
        }

        return {
            browser: RTCBrowserType2.RTC_BROWSER_NWJS,
            version
        };
    }

    /**
     * Gets current browser type.
     * @returns {string}
     */
    getBrowserType() {
        switch (this.browserInfo.name) {
        case BOWSER_CHROME:
        case BOWSER_CHROMIUM:
            return RTCBrowserType2.RTC_BROWSER_CHROME;
        case BOWSER_OPERA:
            return RTCBrowserType2.RTC_BROWSER_OPERA;
        case BOWSER_FIREFOX:
            return RTCBrowserType2.RTC_BROWSER_FIREFOX;
        case BOWSER_IE:
            return RTCBrowserType2.RTC_BROWSER_IEXPLORER;
        case BOWSER_MSEDGE:
            return RTCBrowserType2.RTC_BROWSER_EDGE;
        case this.RTC_BROWSER_REACT_NATIVE:
        case this.RTC_BROWSER_ELECTRON:
        case this.RTC_BROWSER_NWJS:
            return this.browserInfo.name;
        case BOWSER_SAFARI:
            // eslint-ignore-nextline no-fallthrough
        default:
            return RTCBrowserType2.RTC_BROWSER_SAFARI;
        }
    }

    /**
     * Gets current browser name, split from the type.
     * @returns {string}
     */
    getBrowserName() {
        const isAndroid = typeof this.browserInfo.android !== 'undefined';

        if (isAndroid) {
            return 'android';
        }

        return this.getBrowserType().split('rtc_browser.')[1];
    }

    /**
     * Checks if current browser is Chrome.
     * @returns {boolean}
     */
    isChrome() {
        return Boolean(this.browserInfo.chrome);
    }

    /**
     * Checks if current browser is Opera.
     * @returns {boolean}
     */
    isOpera() {
        return Boolean(this.browserInfo.opera);
    }

    /**
     * Checks if current browser is Firefox.
     * @returns {boolean}
     */
    isFirefox() {
        return Boolean(this.browserInfo.firefox);
    }

    /**
     * Checks if current browser is Internet Explorer.
     * @returns {boolean}
     */
    isIExplorer() {
        return Boolean(this.browserInfo.msie);
    }

    /**
     * Checks if current browser is Microsoft Edge.
     * @returns {boolean}
     */
    isEdge() {
        return Boolean(this.browserInfo.msedge);
    }

    /**
     * Checks if current browser is Safari.
     * @returns {boolean}
     */
    isSafari() {
        return Boolean(this.browserInfo.safari);
    }

    /**
     * Checks if current environment is NWJS.
     * @returns {boolean}
     */
    isNWJS() {
        return this.browserInfo.name === RTCBrowserType2.RTC_BROWSER_NWJS;
    }

    /**
     * Checks if current environment is Electron.
     * @returns {boolean}
     */
    isElectron() {
        return this.browserInfo.name === RTCBrowserType2.RTC_BROWSER_ELECTRON;
    }

    /**
     * Checks if current environment is React Native.
     * @returns {boolean}
     */
    isReactNative() {
        return this.browserInfo.name
            === RTCBrowserType2.RTC_BROWSER_REACT_NATIVE;
    }

    /**
     * Returns Firefox version.
     * @returns {number|null}
     */
    getFirefoxVersion() {
        return this.isFirefox() ? this.browserInfo.version : null;
    }

    /**
     * Returns Chrome version.
     * @returns {number|null}
     */
    getChromeVersion() {
        return this.isChrome() ? this.browserInfo.version : null;
    }

    /**
     * Returns Internet Explorer version.
     *
     * @returns {number|null}
     */
    getIExplorerVersion() {
        return this.isIExplorer() ? this.browserInfo.version : null;
    }

    /**
     * Returns Edge version.
     *
     * @returns {number|null}
     */
    getEdgeVersion() {
        return this.isEdge() ? this.browserInfo.version : null;
    }

    // ---------- Feature checks ----------

    /**
     * Tells whether or not the <tt>MediaStream/tt> is removed from
     * the <tt>PeerConnection</tt> and disposed on video mute (in order to turn
     * off the camera device).
     * @return {boolean} <tt>true</tt> if the current browser supports this
     * strategy or <tt>false</tt> otherwise.
     */
    doesVideoMuteByStreamRemove() {
        return !this.browserInfo.firefox && !this.browserInfo.msedge;
    }


    /**
     * Check whether or not the current browser support peer to peer connections
     * @return {boolean} <tt>true</tt> if p2p is supported or <tt>false</tt>
     * otherwise.
     */
    isP2PSupported() {
        return !this.browserInfo.msedge;
    }

    /**
     * Checks if Temasys RTC plugin is used.
     * @returns {boolean}
     */
    isTemasysPluginUsed() {
        // Temasys do not support Microsoft Edge:
        // http://support.temasys.com.sg/support/solutions/articles/
        // 5000654345-can-the-temasys-webrtc-plugin-be-used-with-microsoft-edge-
        // TODO(brian): make sure this version compare is correct
        return this.browserInfo.safari
            || (this.browserInfo.msie
                && bowser.compareVersions(
                    [ this.browserInfo.version, '12' ]) < 0);
    }

    /**
     * Checks if the current browser triggers 'onmute'/'onunmute' events when
     * user's connection is interrupted and the video stops playback.
     * @returns {*|boolean} 'true' if the event is supported or 'false'
     * otherwise.
     */
    isVideoMuteOnConnInterruptedSupported() {
        return this.browserInfo.chrome;
    }

    /**
     * Whether the current browser uses plan b
     * @returns {boolean}
     */
    usesPlanB() {
        return !this.usesUnifiedPlan();
    }

    /**
     * Whether the current browser uses unified plan
     * @returns {boolean}
     */
    usesUnifiedPlan() {
        return this.browserInfo.firefox;
    }

    /**
     * Checks if the current browser reports upload and download bandwidth
     * statistics.
     * @return {boolean}
     */
    supportsBandwidthStatistics() {
        // FIXME bandwidth stats are currently not implemented for FF on our
        // side, but not sure if not possible ?
        return !this.isFirefox() && !this.isEdge();
    }

    /**
     * Checks if the current browser supports WebRTC datachannels.
     * @return {boolean}
     */
    supportsDataChannels() {
        // NOTE: Edge does not yet implement DataChannel.
        return !this.isEdge();
    }

    /**
     * Checks if the current browser reports round trip time statistics for
     * the ICE candidate pair.
     * @return {boolean}
     */
    supportsRTTStatistics() {
        // Firefox does not seem to report RTT for ICE candidate pair:
        // eslint-disable-next-line max-len
        // https://www.w3.org/TR/webrtc-stats/#dom-rtcicecandidatepairstats-currentroundtriptime
        // It does report mozRTT for RTP streams, but at the time of this
        // writing it's value does not make sense most of the time
        // (is reported as 1):
        // https://bugzilla.mozilla.org/show_bug.cgi?id=1241066
        // For Chrome and others we rely on 'googRtt'.
        return !this.isFirefox() && !this.isEdge();
    }

    /**
     * Whether jitsi-meet supports simulcast on the current browser.
     * @returns {boolean}
     */
    supportsSimulcast() {
        return this.isChrome()
            || this.isFirefox()
            || this.isElectron()
            || this.isNWJS();
    }

    /**
     * Whether the current browser supports rtx
     * @returns {boolean}
     */
    supportsRtx() {
        return !this.isFirefox();
    }

    /**
     * Whether the current browser supports rtp sender
     * @returns {boolean}
     */
    supportsRtpSender() {
        return this.isFirefox();
    }
}

export default RTCBrowserType2;
