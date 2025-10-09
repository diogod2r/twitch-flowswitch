(() => {
  let adOn = false;
  let main, sec, overlay, secParent, secNext;
  let badge;
  
  let bannerAdsBlocked = 0;
  let streamAdsBlocked = 0;
  let streamAdsNotBlocked = 0;
  let lastAdState = null;

  const selMain = "[data-a-target='video-ref'] video";
  const selSec = "video[id]";
  const selAd = "span[data-a-target='video-ad-countdown']";

  function getEls() {
    main = document.querySelector(selMain);
    sec = document.querySelector(selSec);
    return main && sec && main !== sec;
  }

  function getOverlay() {
    if (overlay) return overlay;
    if (!main || !main.parentElement) return null;

    const p = main.parentElement;
    if (getComputedStyle(p).position === "static")
      p.style.position = "relative";

    overlay = document.createElement("div");
    overlay.style.cssText =
      "position:absolute;inset:0;z-index:999999;display:none;background:#000;";
    p.appendChild(overlay);
    return overlay;
  }

  function getBadge() {
    if (badge) return badge;
    badge = document.createElement("div");
    badge.style.cssText = [
      "position:absolute",
      "top:8px",
      "right:8px",
      "z-index:2147483647",
      "padding:6px 10px",
      "border-radius:999px",
      "font:12px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif",
      "color:#fff",
      "background:rgba(17,24,39,.85)",
      "box-shadow:0 2px 8px rgba(0,0,0,.35)",
      "pointer-events:none",
      "letter-spacing:.2px",
    ].join(";");
    return badge;
  }

  function getAdCountdownText() {
    const el = document.querySelector(selAd);
    return el ? (el.textContent || "").trim() : "";
  }

  function parseTimeFromCountdown(text) {
    const m = text.match(/(\d{1,2}:\d{2})/);
    return m ? m[1] : "";
  }



  function startAd() {
    if (adOn) return;
    if (!getEls()) return;

    const ov = getOverlay();
    if (!ov) return;

    secParent = sec.parentElement;
    secNext = sec.nextSibling;

    main.style.visibility = "hidden";

    ov.style.display = "block";
    Object.assign(sec.style, {
      width: "100%",
      height: "100%",
      objectFit: "contain",
    });
    ov.appendChild(sec);

    const b = getBadge();
    if (!b.isConnected) ov.appendChild(b);
    b.style.display = "inline-block";
    b.textContent = "FlowSwitch: playing secondary • …";

    if (sec) {
      sec.controls = true;
      sec.muted = false;
      sec.setAttribute('data-flowswitch-original-controls', sec.hasAttribute('controls') ? 'true' : 'false');
    }
    if (main) main.muted = true;

    adOn = true;
    console.info(
      "[Twitch FlowSwitch] AD ON → using secondary video (main muted)"
    );
  }

  function endAd() {
    if (!adOn) return;

    if (secParent) {
      if (secNext) secParent.insertBefore(sec, secNext);
      else secParent.appendChild(sec);
    }

    if (main) {
      main.style.visibility = "";
      main.muted = false;
    }
    if (sec) {
      sec.muted = true;
      const originalControls = sec.getAttribute('data-flowswitch-original-controls');
      if (originalControls === 'false') {
        sec.controls = false;
        sec.removeAttribute('controls');
      }
      sec.removeAttribute('data-flowswitch-original-controls');
    }
    if (overlay) overlay.style.display = "none";
    if (badge) badge.style.display = "none";

    adOn = false;
    console.info(
      "[Twitch FlowSwitch] AD OFF → returned to primary (muted secondary)"
    );
  }

  function getStatus() {
    if (!main || !sec || !document.contains(main) || !document.contains(sec))
      getEls();
    const countdown = getAdCountdownText();
    const hasAdElement = !!document.querySelector(selAd);
    return {
      adOn,
      adDetected: hasAdElement,
      adCountdownText: countdown,
      adRemaining: parseTimeFromCountdown(countdown),
      active: adOn ? "secondary" : "primary",
      bannerAdsBlocked,
      streamAdsBlocked,
      streamAdsNotBlocked,
      main: main
        ? {
            w: main.videoWidth || 0,
            h: main.videoHeight || 0,
            muted: !!main.muted,
          }
        : null,
      sec: sec
        ? {
            w: sec.videoWidth || 0,
            h: sec.videoHeight || 0,
            muted: !!sec.muted,
          }
        : null,
    };
  }

  function hiddenHtmlAd () {
    let newBlocked = 0;
    
    const mainElement = document.querySelectorAll('[data-test-selector="sda-wrapper"]');
    mainElement.forEach(ad => {
      if (ad.style.display !== 'none' && !ad.hasAttribute('data-flowswitch-hidden')) {
        ad.style.display = 'none';
        ad.setAttribute('data-flowswitch-hidden', 'true');
        newBlocked++;
      }
    });
    
    const secondaryElement = document.querySelectorAll('[id="creative-wrapper"]');
    secondaryElement.forEach(ad => {
      if (ad.style.display !== 'none' && !ad.hasAttribute('data-flowswitch-hidden')) {
        ad.style.display = 'none';
        ad.setAttribute('data-flowswitch-hidden', 'true');
        newBlocked++;
      }
    });
    
    const videoRef = document.querySelector('[data-a-target="video-ref"]');
    if (videoRef) {
      videoRef.setAttribute('style', 'position: relative;');
    }
    main.muted = false;
    
    bannerAdsBlocked += newBlocked;
    return newBlocked;
  }

  setInterval(() => {
    hiddenHtmlAd();
    if (!main || !sec || !document.contains(main) || !document.contains(sec))
      getEls();

    const hasAd = !!document.querySelector(selAd);
    if (hasAd) {
      startAd();
      
      if (lastAdState !== hasAd) {
        if (adOn) {
          streamAdsBlocked++;
        } else {
          streamAdsNotBlocked++;  
        }
        lastAdState = hasAd;
      }
      
      if (badge && adOn) {
        const t = parseTimeFromCountdown(getAdCountdownText()) || "…";
        badge.textContent = `FlowSwitch: playing secondary • ${t}`;
      }
    } else {
      endAd();
      if (lastAdState !== hasAd) {
        lastAdState = hasAd;
      }
    }
  }, 995);

  chrome.runtime?.onMessage?.addListener?.((msg, _sender, sendResponse) => {
    if (msg && msg.type === "GET_STATUS") {
      sendResponse(getStatus());
      return true;
    }
  });
})();
