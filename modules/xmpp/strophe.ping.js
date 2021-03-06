/* global $, $iq, Strophe */

import { getLogger } from "jitsi-meet-logger";
const logger = getLogger(__filename);
import ConnectionPlugin from "./ConnectionPlugin";
import GlobalOnErrorHandler from "../util/GlobalOnErrorHandler";

/**
 * Ping every 10 sec
 */
const PING_INTERVAL = 10000;

/**
 * Ping timeout error after 15 sec of waiting.
 */
const PING_TIMEOUT = 15000;

/**
 * Will close the connection after 3 consecutive ping errors.
 */
const PING_THRESHOLD = 3;




/**
 * XEP-0199 ping plugin.
 *
 * Registers "urn:xmpp:ping" namespace under Strophe.NS.PING.
 */
class PingConnectionPlugin extends ConnectionPlugin {
    constructor() {
        super();
        this.failedPings = 0;
    }

    /**
     * Initializes the plugin. Method called by Strophe.
     * @param connection Strophe connection instance.
     */
    init (connection) {
        super.init(connection);
        Strophe.addNamespace('PING', "urn:xmpp:ping");
    }

    /**
     * Sends "ping" to given <tt>jid</tt>
     * @param jid the JID to which ping request will be sent.
     * @param success callback called on success.
     * @param error callback called on error.
     * @param timeout ms how long are we going to wait for the response. On
     *        timeout <tt>error<//t> callback is called with undefined error
     *        argument.
     */
    ping (jid, success, error, timeout) {
        const iq = $iq({type: 'get', to: jid});
        iq.c('ping', {xmlns: Strophe.NS.PING});
        this.connection.sendIQ(iq, success, error, timeout);
    }

    /**
     * Checks if given <tt>jid</tt> has XEP-0199 ping support.
     * @param jid the JID to be checked for ping support.
     * @param callback function with boolean argument which will be
     * <tt>true</tt> if XEP-0199 ping is supported by given <tt>jid</tt>
     */
    hasPingSupport (jid, callback) {
        const disco = this.connection.disco;
        // XXX The following disco.info was observed to throw a "TypeError:
        // Cannot read property 'info' of undefined" during porting to React
        // Native. Since disco is checked in multiple places (e.g.
        // strophe.jingle.js, strophe.rayo.js), check it here as well.
        if (disco) {
            disco.info(jid, null, (result)  => {
                const ping
                    = $(result).find('>>feature[var="urn:xmpp:ping"]');
                callback(ping.length > 0);
            }, (error) => {
                const errmsg = "Ping feature discovery error";
                GlobalOnErrorHandler.callErrorHandler(new Error(
                    errmsg + ": " + error));
                logger.error(errmsg, error);
                callback(false);
            });
        } else {
          // FIXME Should callback be invoked here? Maybe with false as an
          // argument?
        }
    }

    /**
     * Starts to send ping in given interval to specified remote JID.
     * This plugin supports only one such task and <tt>stopInterval</tt>
     * must be called before starting a new one.
     * @param remoteJid remote JID to which ping requests will be sent to.
     * @param interval task interval in ms.
     */
    startInterval (remoteJid, interval = PING_INTERVAL) {
        if (this.intervalId) {
            const errmsg = "Ping task scheduled already";
            GlobalOnErrorHandler.callErrorHandler(new Error(errmsg));
            logger.error(errmsg);
            return;
        }
        this.intervalId = window.setInterval(() => {
            this.ping(remoteJid, () => {
                this.failedPings = 0;
            }, (error) => {
                this.failedPings += 1;
                const errmsg = "Ping " + (error ? "error" : "timeout");
                if (this.failedPings >= PING_THRESHOLD) {
                    GlobalOnErrorHandler.callErrorHandler(new Error(errmsg));
                    logger.error(errmsg, error);
                    // FIXME it doesn't help to disconnect when 3rd PING
                    // times out, it only stops Strophe from retrying.
                    // Not really sure what's the right thing to do in that
                    // situation, but just closing the connection makes no
                    // sense.
                    //self.connection.disconnect();
                } else {
                    logger.warn(errmsg, error);
                }
            }, PING_TIMEOUT);
        }, interval);
        logger.info("XMPP pings will be sent every " + interval + " ms");
    }

    /**
     * Stops current "ping"  interval task.
     */
    stopInterval () {
        if (this.intervalId) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
            this.failedPings = 0;
            logger.info("Ping interval cleared");
        }
    }
}

export default function () {
    Strophe.addConnectionPlugin('ping', new PingConnectionPlugin());
}
