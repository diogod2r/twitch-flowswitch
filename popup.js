function $(id) {
  return document.getElementById(id);
}

async function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) =>
      resolve(tabs[0])
    );
  });
}

function updateStatusBadge(element, text, type) {
  element.innerHTML = `<div class="pulse"></div><span>${text}</span>`;
  element.className = `status-badge ${type}`;
}

async function fetchStatus() {
  const tab = await getActiveTab();

  if (!tab || !/^https:\/\/(www|m)\.twitch\.tv\//.test(tab.url || "")) {
    updateStatusBadge($("activePill"), "Not on Twitch", "error");
    $("adPill").innerHTML = "<span>—</span>";
    $("adPill").className = "status-badge inactive";
    $("mainRes").textContent = "–";
    $("secRes").textContent = "–";
    $("countdown").textContent = "–";
    $("countdownCard").style.display = "none";

    $("mainMuted").textContent = "muted";
    $("mainMuted").className = "audio-badge muted";
    $("secMuted").textContent = "muted";
    $("secMuted").className = "audio-badge muted";
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" }, (resp) => {
    if (!resp) {
      updateStatusBadge($("activePill"), "No response", "error");
      $("adPill").innerHTML = "<span>Connection error</span>";
      $("adPill").className = "status-badge error";
      return;
    }

    if (resp.active === "secondary") {
      updateStatusBadge($("activePill"), "Secondary Active", "secondary");
    } else {
      updateStatusBadge($("activePill"), "Primary Active", "active");
    }

    if (resp.adDetected) {
      if (resp.adOn) {
        $("adPill").innerHTML = "<span>🎬 Paid Content Active</span>";
        $("adPill").className = "status-badge secondary";
      } else {
        $("adPill").innerHTML =
          "<span>🎬 Ad Playing (No Secondary Video)</span>";
        $("adPill").className = "status-badge secondary";
      }
      $("countdownCard").style.display = "block";
    } else {
      $("adPill").innerHTML = "<span>✅ No Ads</span>";
      $("adPill").className = "status-badge active";
      $("countdownCard").style.display = "none";
    }

    const mr = resp.main ? `${resp.main.w}×${resp.main.h}` : "–";
    const sr = resp.sec ? `${resp.sec.w}×${resp.sec.h}` : "–";
    $("mainRes").textContent = mr;
    $("secRes").textContent = sr;

    if (resp.main) {
      $("mainMuted").textContent = resp.main.muted ? "muted" : "sound";
      $("mainMuted").className = resp.main.muted
        ? "audio-badge muted"
        : "audio-badge sound";
    }

    if (resp.sec) {
      $("secMuted").textContent = resp.sec.muted ? "muted" : "sound";
      $("secMuted").className = resp.sec.muted
        ? "audio-badge muted"
        : "audio-badge sound";
    }

    const countdownText = resp.adRemaining || resp.adCountdownText || "–";
    $("countdown").textContent = countdownText;
  });
}

fetchStatus();
const timer = setInterval(fetchStatus, 500);
window.addEventListener("unload", () => clearInterval(timer));
