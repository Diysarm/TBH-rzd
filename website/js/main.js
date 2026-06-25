(function () {
  if (window.lucide) {
    window.lucide.createIcons({
      attrs: {
        width: 15,
        height: 15,
        "stroke-width": 2,
      },
    });
  }

  const REPO = "lucasfevi/tbh-companion";
  const REPO_URL = "https://github.com/" + REPO;
  const RELEASES_LATEST_PAGE = REPO_URL + "/releases/latest";
  const REPO_API = "https://api.github.com/repos/" + REPO;
  const RELEASES_API = REPO_API + "/releases/latest";
  const RELEASES_LIST_API = REPO_API + "/releases?per_page=100";
  const MANIFEST_URL = "data/release.json";

  const API_HEADERS = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const downloadLink = document.getElementById("hero-download");
  const footerLink = document.getElementById("footer-download");
  const statStars = document.getElementById("stat-stars");
  const statDownloads = document.getElementById("stat-downloads");
  const statVersion = document.getElementById("stat-version");
  const statSize = document.getElementById("stat-size");

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit += 1;
    }
    const digits = unit === 0 ? 0 : 1;
    return size.toFixed(digits) + " " + units[unit];
  }

  function formatCount(n) {
    if (n == null || Number.isNaN(n)) return "";
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(n);
  }

  function pickDownloadAsset(assets) {
    if (!Array.isArray(assets)) return null;
    const portable = assets.find(function (asset) {
      return (asset.name || "").toLowerCase().endsWith("-portable.zip");
    });
    if (portable) return portable;
    return pickInstaller(assets);
  }

  function pickInstaller(assets) {
    if (!Array.isArray(assets)) return null;
    const exes = assets.filter(function (asset) {
      const name = (asset.name || "").toLowerCase();
      return name.endsWith(".exe") && !name.endsWith(".blockmap");
    });
    return (
      exes.find(function (asset) {
        return (asset.name || "").toLowerCase().includes("setup");
      }) || exes[0] || null
    );
  }

  function isInstallerAsset(name) {
    const lower = (name || "").toLowerCase();
    return lower.endsWith(".exe") && !lower.endsWith(".blockmap");
  }

  function applyFallbackDownload() {
    if (downloadLink) downloadLink.href = RELEASES_LATEST_PAGE;
    if (footerLink) footerLink.href = RELEASES_LATEST_PAGE;
  }

  function applyDownload(version, url, sizeBytes, kind) {
    if (downloadLink && url) downloadLink.href = url;
    if (footerLink && url) footerLink.href = url;

    const sizeLabel = formatBytes(sizeBytes);
    if (statVersion && version) statVersion.textContent = version;
    if (statSize && sizeLabel) statSize.textContent = sizeLabel;
    else if (statSize && version) {
      statSize.textContent = kind === "portable" ? "Portable zip" : "Windows installer";
    }
  }

  function setStat(el, value) {
    if (el && value !== "") el.textContent = value;
  }

  function fetchJson(url) {
    return fetch(url, { headers: API_HEADERS }).then(function (res) {
      if (!res.ok) throw new Error("GitHub API " + res.status);
      return res.json();
    });
  }

  function loadManifest() {
    return fetch(MANIFEST_URL, { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("manifest " + res.status);
        return res.json();
      })
      .then(function (manifest) {
        if (!manifest || !manifest.downloadUrl) return;
        applyDownload(
          manifest.version || "",
          manifest.downloadUrl,
          manifest.sizeBytes || 0,
          manifest.kind || "",
        );
      })
      .catch(function () {
        applyFallbackDownload();
      });
  }

  function loadStars() {
    return fetchJson(REPO_API)
      .then(function (repo) {
        setStat(statStars, formatCount(repo.stargazers_count));
      })
      .catch(function () {
        /* keep em dash */
      });
  }

  function loadLatestRelease() {
    return fetchJson(RELEASES_API)
      .then(function (release) {
        const asset = pickDownloadAsset(release.assets);
        if (!asset || !asset.browser_download_url) return;
        const kind = (asset.name || "").toLowerCase().endsWith("-portable.zip") ? "portable" : "installer";
        applyDownload(release.tag_name || "", asset.browser_download_url, asset.size, kind);
      })
      .catch(function () {
        /* manifest or fallback href already set */
      });
  }

  function fetchAllReleases() {
    const releases = [];

    function page(pageNum) {
      const url = RELEASES_LIST_API + (pageNum > 1 ? "&page=" + pageNum : "");
      return fetchJson(url).then(function (batch) {
        if (!Array.isArray(batch) || batch.length === 0) return releases;
        releases.push.apply(releases, batch);
        if (batch.length < 100) return releases;
        return page(pageNum + 1);
      });
    }

    return page(1);
  }

  function sumInstallerDownloads(releases) {
    let total = 0;
    for (let i = 0; i < releases.length; i += 1) {
      const assets = releases[i].assets;
      if (!Array.isArray(assets)) continue;
      for (let j = 0; j < assets.length; j += 1) {
        const asset = assets[j];
        if (!isInstallerAsset(asset.name)) continue;
        total += asset.download_count || 0;
      }
    }
    return total;
  }

  function loadTotalDownloads() {
    const cacheKey = "tbh-total-downloads";
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.expires > Date.now() && parsed.value) {
          setStat(statDownloads, parsed.value);
          return Promise.resolve();
        }
      }
    } catch (_err) {
      /* ignore */
    }

    return fetchAllReleases()
      .then(function (releases) {
        const total = sumInstallerDownloads(releases);
        if (total <= 0) return;
        const formatted = formatCount(total);
        setStat(statDownloads, formatted);
        try {
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({ value: formatted, expires: Date.now() + 6 * 60 * 60 * 1000 }),
          );
        } catch (_err) {
          /* ignore */
        }
      })
      .catch(function () {
        /* keep em dash */
      });
  }

  loadManifest().finally(function () {
    loadLatestRelease();
    loadStars();
    loadTotalDownloads();
  });
})();
