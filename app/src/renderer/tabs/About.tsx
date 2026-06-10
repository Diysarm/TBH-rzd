import { useState } from "react";
import type { UpdateStatus } from "../../../shared/types";
import { useUpdate } from "../lib/useUpdate";
import { reportIpcError } from "../lib/reportError";
import { TabHeader } from "../components/TabHeader";

const GITHUB_RELEASES = "https://github.com/lucasfevi/tbh-companion/releases";

function githubReleaseUrl(version: string): string {
  const tag = version.startsWith("v") ? version : `v${version}`;
  return `${GITHUB_RELEASES}/tag/${tag}`;
}

function fmtBytes(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusMessage(status: UpdateStatus): string | null {
  switch (status.phase) {
    case "disabled":
      return "Updates aren't available in this build.";
    case "checking":
      return "Checking for a newer release…";
    case "not-available":
      return "You're on the latest release.";
    case "available":
      return status.availableVersion
        ? `Version ${status.availableVersion} is available.`
        : "A newer version is available.";
    case "downloading":
      return "Downloading update…";
    case "ready":
      return status.availableVersion
        ? `Version ${status.availableVersion} is ready to install.`
        : "Update downloaded and ready to install.";
    case "error":
      return status.error ?? "Update check failed.";
    default:
      return null;
  }
}

export function About() {
  const status = useUpdate();
  const [busy, setBusy] = useState(false);

  async function onCheck() {
    setBusy(true);
    try {
      await window.tbh.checkForUpdates();
    } catch (err) {
      reportIpcError(err);
    } finally {
      setBusy(false);
    }
  }

  async function onDownload() {
    setBusy(true);
    try {
      await window.tbh.downloadUpdate();
    } catch (err) {
      reportIpcError(err);
    } finally {
      setBusy(false);
    }
  }

  function onInstall() {
    void window.tbh.quitAndInstall().catch(reportIpcError);
  }

  const phase = status?.phase ?? "idle";
  const isDisabled = phase === "disabled";
  const isChecking = phase === "checking" || busy;
  const canCheck = !isDisabled && !isChecking && phase !== "downloading" && phase !== "ready";
  const canDownload = phase === "available" && !busy;
  const canInstall = phase === "ready";
  const percent = status?.percent !== undefined ? Math.min(100, Math.round(status.percent)) : 0;
  const message = status ? statusMessage(status) : null;
  const showReleaseLink = status?.availableVersion && (phase === "available" || phase === "ready");

  return (
    <div className="about tab-page">
      <TabHeader
        title="About"
        intro="TBH Companion is an unofficial fan tool for Task Bar Hero. It reads your local save only — it never changes your save or connects to game servers."
      />

      <section className="settings-section about-version">
        <h2>Version</h2>
        <p>
          <strong>v{status?.currentVersion ?? "…"}</strong>
        </p>
        <p className="muted small">
          Not affiliated with Tesseract Studio. Fan-made companion for personal stats and inventory
          valuation.
        </p>
      </section>

      {!isDisabled && (
        <section className="settings-section about-updates">
          <h2>Updates</h2>
          {message && <p className={phase === "error" ? "settings-message" : "muted"}>{message}</p>}

          {phase === "downloading" && (
            <div className="market-progress">
              <div className="bar">
                <div className="bar-fill" style={{ width: `${percent}%` }} />
              </div>
              <span className="muted small">
                {percent}%
                {status?.transferred && status?.total
                  ? ` — ${fmtBytes(status.transferred)} / ${fmtBytes(status.total)}`
                  : ""}
              </span>
            </div>
          )}

          {showReleaseLink && (
            <p className="small">
              <a
                href={githubReleaseUrl(status.availableVersion!)}
                className="market-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                v{status.availableVersion} on GitHub
              </a>
            </p>
          )}

          <div className="about-update-actions">
            {canCheck && (
              <button
                type="button"
                className="btn primary"
                disabled={isChecking}
                onClick={() => void onCheck()}
              >
                {isChecking ? "Checking…" : "Check for updates"}
              </button>
            )}
            {canDownload && (
              <button type="button" className="btn primary" onClick={() => void onDownload()}>
                Download update
              </button>
            )}
            {canInstall && (
              <button type="button" className="btn primary" onClick={onInstall}>
                Restart to install
              </button>
            )}
          </div>

          {canInstall && (
            <p className="muted small">
              Restart closes the main window, Mini overlay, and stage chest tracker, then installs
              over your existing folder. Windows may show an unsigned-app warning — choose More
              info, then Run anyway (same as the first install).
            </p>
          )}

          {phase === "idle" && (
            <p className="muted small">Check for updates to see if a newer version is on GitHub.</p>
          )}
        </section>
      )}
    </div>
  );
}
