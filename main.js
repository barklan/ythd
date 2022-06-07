// ==UserScript==
// @name          YouTube HD
// @author        barklan
// @namespace     namespace_barklan
// @description   Select YouTube resolution automatically.
// @version       1.0.3
// @match         https://www.youtube.com/*
// @noframes
// @grant         none
// ==/UserScript==

(function () {
  "use strict";

  // Target Resolution to always set to. If not available, the next best resolution will be used.
  const changeResolution = true;
  const targetRes = "hd1080";
  // Choices for targetRes are currently:
  //   "highres" >= ( 8K / 4320p / QUHD  )
  //   "hd2880"   = ( 5K / 2880p /  UHD+ )
  //   "hd2160"   = ( 4K / 2160p /  UHD  )
  //   "hd1440"   = (      1440p /  QHD  )
  //   "hd1080"   = (      1080p /  FHD  )
  //   "hd720"    = (       720p /   HD  )
  //   "large"    = (       480p         )
  //   "medium"   = (       360p         )
  //   "small"    = (       240p         )
  //   "tiny"     = (       144p         )

  // If flushBuffer is false, then the first second or so of the video may not always be the desired resolution.
  //   If true, then the entire video will be guaranteed to be the target resolution, but there may be
  //   a very small additional delay before the video starts if the buffer needs to be flushed.
  const flushBuffer = true;

  // Tries to set the resolution as early as possible.
  // This might cause issues on youtube polymer layout, so disable if videos fail to load.
  // If videos load fine, leave as true or resolution may fail to set.
  const setResolutionEarly = true;

  const DEBUG = false;

  const resolutions = [
    "highres",
    "hd2880",
    "hd2160",
    "hd1440",
    "hd1080",
    "hd720",
    "large",
    "medium",
    "small",
    "tiny",
  ];

  // ID of the most recently played video
  let recentVideo = "";

  function debugLog(message) {
    if (DEBUG) {
      console.log("YTHD | " + message);
    }
  }

  // Get video ID from the currently loaded video (which might be different than currently loaded page)
  function getVideoIDFromURL(ytPlayer) {
    const idMatch = /(?:v=)([\w\-]+)/;
    let id = "ERROR: idMatch failed; youtube changed something";
    let matches = idMatch.exec(ytPlayer.getVideoUrl());
    if (matches) {
      id = matches[1];
    }

    return id;
  }

  // Attempt to set the video resolution to desired quality or the next best quality
  function setResolution(ytPlayer, resolutionList) {
    debugLog("Setting Resolution...");

    const currentQuality = ytPlayer.getPlaybackQuality();
    let res = targetRes;

    // Youtube doesn't return "auto" for auto, so set to make sure that auto is not set by setting
    //   even when already at target res or above, but do so without removing the buffer for this quality
    if (resolutionList.indexOf(res) >= resolutionList.indexOf(currentQuality)) {
      if (ytPlayer.setPlaybackQualityRange !== undefined) {
        ytPlayer.setPlaybackQualityRange(res);
      }
      ytPlayer.setPlaybackQuality(res);
      debugLog("Resolution Set To: " + res);
      return;
    }

    const end = resolutionList.length - 1;
    let nextBestIndex = Math.max(resolutionList.indexOf(res), 0);
    let ytResolutions = ytPlayer.getAvailableQualityLevels();
    debugLog("Available Resolutions: " + ytResolutions.join(", "));

    while (
      ytResolutions.indexOf(resolutionList[nextBestIndex]) === -1 &&
      nextBestIndex < end
    ) {
      ++nextBestIndex;
    }

    if (flushBuffer && currentQuality !== resolutionList[nextBestIndex]) {
      let id = getVideoIDFromURL(ytPlayer);
      if (id.indexOf("ERROR") === -1) {
        let pos = ytPlayer.getCurrentTime();
        ytPlayer.loadVideoById(id, pos, resolutionList[nextBestIndex]);
      }

      debugLog("ID: " + id);
    }
    if (ytPlayer.setPlaybackQualityRange !== undefined) {
      ytPlayer.setPlaybackQualityRange(resolutionList[nextBestIndex]);
    }
    ytPlayer.setPlaybackQuality(resolutionList[nextBestIndex]);

    debugLog("Resolution Set To: " + resolutionList[nextBestIndex]);
  }

  // Set resolution, but only when API is ready (it should normally already be ready)
  function setResOnReady(ytPlayer, resolutionList) {
    if (ytPlayer.getPlaybackQuality === undefined) {
      window.setTimeout(setResOnReady, 100, ytPlayer, resolutionList);
    } else {
      let framerateUpdate = false;

      let curVid = getVideoIDFromURL(ytPlayer);
      if (curVid !== recentVideo || framerateUpdate) {
        recentVideo = curVid;
        setResolution(ytPlayer, resolutionList);

        let storedQuality = localStorage.getItem("yt-player-quality");
        if (!storedQuality || storedQuality.indexOf(targetRes) === -1) {
          let tc = Date.now(),
            te = tc + 2592000000;
          localStorage.setItem(
            "yt-player-quality",
            '{"data":"' +
              targetRes +
              '","expiration":' +
              te +
              ',"creation":' +
              tc +
              "}"
          );
        }
      }
    }
  }

  function main() {
    let ytPlayer =
      document.getElementById("movie_player") ||
      document.getElementsByClassName("html5-video-player")[0];

    if (changeResolution && setResolutionEarly && ytPlayer) {
      setResOnReady(ytPlayer, resolutions);
    }

    if (changeResolution) {
      window.addEventListener(
        "loadstart",
        function (e) {
          if (!(e.target instanceof window.HTMLMediaElement)) {
            return;
          }

          ytPlayer =
            document.getElementById("movie_player") ||
            document.getElementsByClassName("html5-video-player")[0];
          if (ytPlayer) {
            debugLog("Loaded new video");
            if (changeResolution) {
              setResOnReady(ytPlayer, resolutions);
            }
          }
        },
        true
      );
    }
  }

  main();
  // Youtube doesn't load the page immediately in new version so you can watch before waiting for page load
  // But we can only set resolution until the page finishes loading
  window.addEventListener("yt-navigate-finish", main, {
    once: true,
    useCapture: true,
  });
})();
