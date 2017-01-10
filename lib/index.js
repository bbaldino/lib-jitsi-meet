/* Copyright @ 2016 Atlassian Pty Ltd
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var transform = require('sdp-transform');
var transformUtils = require('./transform-utils');
var parseSsrcs = transformUtils.parseSsrcs;
var writeSsrcs = transformUtils.writeSsrcs;

//region Constants

var DEFAULT_NUM_OF_LAYERS = 3;

//endregion

function getSsrcAttribute (mLine, ssrc, attributeName) {
    return mLine
        .ssrcs
        .filter(function(ssrcInfo) { ssrcInfo.id === ssrc; })
        .filter(function(ssrcInfo) { ssrcInfo.attribute === attributeName; })
        .map(function(ssrcInfo) { return ssrcInfo.value; })[0];
}

//region Ctor

function Simulcast(options) {

    this.options = options ? options : {};

    if (!this.options.numOfLayers) {
        this.options.numOfLayers = DEFAULT_NUM_OF_LAYERS;
    }

    // An IN-ORDER list of the simulcast ssrcs
    this.ssrcCache = [];
}

//endregion

//region Stateless private utility functions

/**
 * Returns a random integer between min (included) and max (excluded)
 * Using Math.round() gives a non-uniform distribution!
 * @returns {number}
 */
function generateSSRC() {
    var min = 0, max = 0xffffffff;
    return Math.floor(Math.random() * (max - min)) + min;
};

function processVideo(session, action) {
    if (session == null || !Array.isArray(session.media)) {
        return;
    }

    session.media.forEach(function (mLine) {
        if (mLine.type === 'video') {
            action(mLine);
        }
    });
};

function validateDescription(desc)
{
    return desc && desc != null
        && desc.type && desc.type != ''
        && desc.sdp && desc.sdp != '';
}

function explodeRemoteSimulcast(mLine) {

    if (!mLine || !Array.isArray(mLine.ssrcGroups)) {
        return;
    }

    var sources = parseSsrcs(mLine);
    var order = [];

    // Find the SIM group and explode its sources.
    var j = mLine.ssrcGroups.length;
    while (j--) {

        if (mLine.ssrcGroups[j].semantics !== 'SIM') {
            continue;
        }

        var simulcastSsrcs = mLine.ssrcGroups[j].ssrcs.split(' ');

        for (var i = 0; i < simulcastSsrcs.length; i++) {

            var ssrc = simulcastSsrcs[i];
            order.push(ssrc);

            var parts = sources[ssrc].msid.split(' ');
            sources[ssrc].msid = [parts[0], '/', i, ' ', parts[1], '/', i].join('');
            sources[ssrc].cname = [sources[ssrc].cname, '/', i].join('');

            // Remove all the groups that this SSRC participates in.
            mLine.ssrcGroups.forEach(function (relatedGroup) {
                if (relatedGroup.semantics === 'SIM') {
                    return;
                }

                var relatedSsrcs = relatedGroup.ssrcs.split(' ');
                if (relatedSsrcs.indexOf(ssrc) === -1) {
                    return;
                }

                // Nuke all the related SSRCs.
                relatedSsrcs.forEach(function (relatedSSRC) {
                    sources[relatedSSRC].msid = sources[ssrc].msid;
                    sources[relatedSSRC].cname = sources[ssrc].cname;
                    if (relatedSSRC !== ssrc) {
                        order.push(relatedSSRC);
                    }
                });

                // Schedule the related group for nuking.
            })
        }

        mLine.ssrcs = writeSsrcs(sources, order);
        mLine.ssrcGroups.splice(j, 1);
    };
}

function implodeRemoteSimulcast(mLine) {

    if (!mLine || !Array.isArray(mLine.ssrcGroups)) {
        console.info('Halt: There are no SSRC groups in the remote ' +
                'description.');
        return;
    }

    var sources = parseSsrcs(mLine);

    // Find the SIM group and nuke it.
    mLine.ssrcGroups.forEach(function (simulcastGroup) {
        if (simulcastGroup.semantics !== 'SIM') {
            return;
        }

        console.info("Imploding SIM group: " + simulcastGroup.ssrcs);
        // Schedule the SIM group for nuking.
        simulcastGroup.nuke = true;

        var simulcastSsrcs = simulcastGroup.ssrcs.split(' ');

        // Nuke all the higher layer SSRCs.
        for (var i = 1; i < simulcastSsrcs.length; i++) {

            var ssrc = simulcastSsrcs[i];
            delete sources[ssrc];

            // Remove all the groups that this SSRC participates in.
            mLine.ssrcGroups.forEach(function (relatedGroup) {
                if (relatedGroup.semantics === 'SIM') {
                    return;
                }

                var relatedSsrcs = relatedGroup.ssrcs.split(' ');
                if (relatedSsrcs.indexOf(ssrc) === -1) {
                    return;
                }

                // Nuke all the related SSRCs.
                relatedSsrcs.forEach(function (relatedSSRC) {
                    delete sources[relatedSSRC];
                });

                // Schedule the related group for nuking.
                relatedGroup.nuke = true;
            })
        }

        return;
    });

    mLine.ssrcs = writeSsrcs(sources);

    // Nuke all the scheduled groups.
    var i = mLine.ssrcGroups.length;
    while (i--) {
        if (mLine.ssrcGroups[i].nuke) {
            mLine.ssrcGroups.splice(i, 1);
        }
    }
}

function removeGoogConference(mLine) {
    if (!mLine || !Array.isArray(mLine.invalid)) {
        return;
    }

    var i = mLine.invalid.length;
    while (i--) {
        if (mLine.invalid[i].value == 'x-google-flag:conference') {
            mLine.invalid.splice(i, 1);
        }
    }
}

function assertGoogConference(mLine) {
    if (!mLine) {
        return;
    }

    if (!Array.isArray(mLine.invalid)) {
        mLine.invalid = [];
    }

    if (!mLine.invalid.some(
            function (i) { return i.value === 'x-google-flag:conference' })) {
        mLine.invalid.push({'value': 'x-google-flag:conference'});
    }
}

Simulcast.prototype.clearSsrcCache = function() {
    this.ssrcCache = [];
}

/**
 * When we start as video muted, all of the video
 *  ssrcs get generated so we can include them as part
 *  of the original session-accept.  That means we
 *  need this library to restore to those same ssrcs
 *  the first time we unmute, so we need the ability to
 *  force its cache
 */
Simulcast.prototype.setSsrcCache = function(ssrcs) {
    this.ssrcCache = ssrcs;
}

//endregion

//region "Private" functions

/**
 * Given a video mLine, return a list of the video ssrcs
 *  in simulcast layer order (returns a list of just
 *  the primary ssrc if there are no simulcast layers)
 */
Simulcast.prototype._parseSimLayers = function (mLine) {
    var simGroup = mLine.ssrcGroups &&
        mLine.ssrcGroups.find(function(group) { group.semantics === "SIM"; });
    if (simGroup) {
        return simGroup.ssrcs
            .split(" ")
            .map(function(ssrcStr) { return parseInt(ssrcStr) });
    } else {
        return [mLine.ssrcs[0].id];
    }
}

Simulcast.prototype._buildNewToOldSsrcMap = function (newSsrcList, oldSsrcList) {
    var ssrcMap = {};
    for (var i = 0; i < newSsrcList.length; ++i) {
        var newSsrc = newSsrcList[i];
        var oldSsrc = oldSsrcList[i] || null;
        ssrcMap[newSsrc] = oldSsrc;
    }
    return ssrcMap;
}

Simulcast.prototype._fillInSourceDataFromCache = function(mLine) {
    var newSimSsrcs = this._parseSimLayers(mLine);
    var newMsid = getSsrcAttribute(mLine, newSimSsrcs[0], "msid");
    var newCname = getSsrcAttribute(mLine, newSimSsrcs[0], "cname");
    var ssrcsToReplace = this._buildNewToOldSsrcMap(newSimSsrcs, this.ssrcCache);
    // New sdp might only have 1 layer, so not every cached ssrc will have a new one
    //  to replace directly
    var ssrcsToAdd = this.ssrcCache
        .filter(function(ssrc) { Object.values(ssrcsToReplace).indexOf(ssrc) === -1; });

    // We may not have mappings for everything, so to get the proper combination of
    //  new and old, we'll build this as we go to use for the group line
    var finalSimSsrcs = [];
    // First do the replacements
    mLine.ssrcs.forEach(function(ssrc) {
        if (ssrcsToReplace[ssrc.id]) {
            ssrc.id = ssrcsToReplace[ssrc.id];
        }
        if (finalSimSsrcs.indexOf(ssrc.id) === -1) {
            finalSimSsrcs.push(ssrc.id);
        }
    });
    // Now the adds
    ssrcsToAdd.forEach(function(ssrc) {
        mLine.ssrcs.push({
            id: ssrc,
            attribute: "msid",
            value: newMsid
        });
        mLine.ssrcs.push({
            id: ssrc,
            attribute: "cname",
            value: newCname
        });
        finalSimSsrcs.push(ssrc);
    });
    mLine.ssrcGroups = mLine.ssrcGroups || [];
    mLine.ssrcGroups.push({
        semantics: "SIM",
        ssrcs: finalSimSsrcs.join(" ")
    });
    return mLine;
}

// Note: if 'doingRtx' is true, this method will assume an rtx stream for the
//  given primarySsrc already exists
Simulcast.prototype._generateSourceData = function(mLine, primarySsrc, doingRtx) {
    var getSsrcAttribute = function(mLine, ssrc, attributeName) {
        return mLine
            .ssrcs
            .filter(function(ssrcInfo) { ssrcInfo.id === ssrc; }) 
            .filter(function(ssrcInfo) { ssrcInfo.attribute === attributeName; })
            .map(function(ssrcInfo) { return ssrcInfo.value; })[0];
    };
    var addAssociatedStream = function(mLine, ssrc) {
        mLine.ssrcs.push({
            id: ssrc,
            attribute: "cname",
            value: primarySsrcCname
        });
        mLine.ssrcs.push({
            id: ssrc,
            attribute: "msid",
            value: primarySsrcMsid
        });
    }
    var primarySsrcMsid = getSsrcAttribute(mLine, primarySsrc, "msid");
    var primarySsrcCname = getSsrcAttribute(mLine, primarySsrc, "cname");

    // Generate sim layers
    var simSsrcs = [];
    for (var i = 0; i < this.options.numOfLayers - 1; ++i) {
        var simSsrc = generateSSRC();
        addAssociatedStream(mLine, simSsrc);
        simSsrcs.push(simSsrc);
    }
    mLine.ssrcGroups = mLine.ssrcGroups || [];
    mLine.ssrcGroups.push({
        semantics: "SIM",
        ssrcs: primarySsrc + " " + simSsrcs.join(" ")
    });

    if (doingRtx) {
        // Generate rtx streams and groups for the created sim
        //  streams
        simSsrcs.forEach(function(simSsrc) {
            var rtxSsrc = generateSSRC();
            addAssociatedStream(mLine, rtxSsrc);
            mLine.ssrcGroups.push({
                semantics: "FID",
                ssrcs: simSsrc + " " + rtxSsrc
            });
        });
    }
    return mLine;
}



// Assumptions:
//  1) 'mLine' contains only a single primary video source
//   (i.e. it will not already have simulcast streams inserted)
//  2) 'mLine' MAY already contain an RTX stream for its video source
//  3) 'mLine' is in sendrecv or sendonly state
// Guarantees:
//  1) return mLine will contain 2 additional simulcast layers
//   generated
//  2) if the base video ssrc in mLine has been seen before,
//   then the same generated simulcast streams from before will
//   be used again
//  3) if rtx is enabled for the mLine, all generated simulcast
//   streams will have rtx streams generated as well
//  4) if rtx has been generated for a src before, we will generate
//   the same rtx stream again
Simulcast.prototype._restoreSimulcast = function(mLine) {
    // First, find the primary video source in the given
    // mLine and see if we've seen it before.
    var primarySsrc;
	var numSsrcs = mLine.ssrcs
		.map(function(ssrcInfo) { return ssrcInfo.id; })
        .filter(function(ssrc, index, array) {
            array.indexOf(ssrc) === index;
        })
        .length;
    var numGroups = (mLine.ssrcGroups && mLine.ssrcGroups.length) || 0;

    if (numSsrcs === 0 || numSsrcs > 2) {
        // Unsupported scenario
        return mLine;
    }
    if (numSsrcs == 2 && numGroups === 0) {
        // Unsupported scenario
        return mLine;
    }

    var doingRtx = false;
    if (numSsrcs === 1) {
        primarySsrc = mLine.ssrcs[0].id;
    } else {
        // There must be an FID group, so parse
        //  that and pull the primary ssrc from there
        var fidGroup = mLine.ssrcGroups.filter(function(group) { group.semantics === "FID"; })[0];
        primarySsrc = parseInt(fidGroup.ssrcs.split(" ")[0]);
        doingRtx = true;
    }
    console.log("BB: parsed primary ssrc " + primarySsrc);

    var seenPrimarySsrc = this.ssrcCache.indexOf(primarySsrc) !== -1;

    if (seenPrimarySsrc) {
        mLine = this._fillInSourceDataFromCache(mLine);
    } else {
        mLine = this._generateSourceData(mLine, primarySsrc, doingRtx);
    }
    // Now update the cache to match whatever we've just put into this sdp
    this.ssrcCache = this._parseSimLayers(mLine);
    return mLine;
}

//endregion

//region "Public" functions

Simulcast.prototype.isSupported = function () {
    return !!window.chrome;

    // TODO this needs improvements. For example I doubt that Chrome in Android
    // has simulcast support.
    // Think about just removing this, since the user of the library is probably
    // in a better position to know what browser it is running in and
    // whether simulcast should be used.
}

/**
 *
 * @param desc
 * @returns {RTCSessionDescription}
 */
Simulcast.prototype.mungeRemoteDescription = function (desc) {

    if (!validateDescription(desc)) {
        return desc;
    }

    var session = transform.parse(desc.sdp);

    var self = this;
    processVideo(session, function (mLine) {

        // Handle simulcast reception.
        if (self.options.explodeRemoteSimulcast) {
            explodeRemoteSimulcast(mLine);
        } else {
            implodeRemoteSimulcast(mLine);
        }

        // If native simulcast is enabled, we must append the x-goog-conference
        // attribute to the SDP.
        if (self.ssrcCache.length < 1) {
            removeGoogConference(mLine);
        } else {
            assertGoogConference(mLine);
        }
    });

    return new RTCSessionDescription({
        type: desc.type,
        sdp: transform.write(session)
    });
};

/**
 *
 * @param desc
 * @returns {RTCSessionDescription}
 */
Simulcast.prototype.mungeLocalDescription = function (desc) {

    if (!validateDescription(desc) || !this.isSupported()) {
        return desc;
    }

    var session = transform.parse(desc.sdp);

    var self = this;
    processVideo(session, function (mLine) {
        if (mLine.direction == 'recvonly' || mLine.direction == 'inactive')
        {
            return;
        }
        self._restoreSimulcast(mLine);
    });

    return new RTCSessionDescription({
        type: desc.type,
        sdp: transform.write(session)
    });
};

//endregion

module.exports = Simulcast;