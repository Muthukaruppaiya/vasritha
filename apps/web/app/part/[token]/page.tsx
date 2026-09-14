"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Camera, CheckCircle2, ImagePlus, RefreshCw, Upload } from "lucide-react";
import { preparePhoneImageForUpload } from "../../../lib/prepare-phone-image";
import {
  parseProductImageUploadKind,
  type ProductImageUploadKind
} from "../../../lib/product-upload-url";

type Payload = {
  name: string;
  sku: string | null;
  tag: string | null;
  kind: ProductImageUploadKind;
  remaining: number;
  images: Array<{ id: string; storage_path: string }>;
};

function PartImageUploadInner() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const token = String(params.token || "");
  const kind = useMemo(
    () => parseProductImageUploadKind(searchParams.get("kind")),
    [searchParams]
  );
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [galleryKey, setGalleryKey] = useState(0);

  const apiPath = `/api/part-upload/${encodeURIComponent(token)}?kind=${kind}`;

  const clearPreview = () => {
    setPendingFile(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiPath, { cache: "no-store" });
      const json = (await res.json()) as { data?: Payload; error?: string };
      if (!res.ok || !json.data) {
        setError(json.error || "This upload link is not valid.");
        setData(null);
        return;
      }
      setError("");
      setData(json.data);
    } catch {
      setError("Could not reach the server. Check your mobile data / Wi‑Fi and retry.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, kind]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onPick = async (fileList: FileList | null, source: "camera" | "gallery") => {
    const file = fileList?.[0];
    if (!file) {
      setError("No photo was selected. Tap again and allow camera / photos access.");
      return;
    }

    setError("");
    setMessage("");
    setBusy(true);
    setStatus("Preparing photo…");
    try {
      const prepared = await preparePhoneImageForUpload(file, file.name || `${source}.jpg`);
      clearPreview();
      const url = URL.createObjectURL(prepared);
      setPendingFile(prepared);
      setPreviewUrl(url);
      setStatus("Photo ready — tap Upload photo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that photo");
      clearPreview();
      setStatus("");
    } finally {
      setBusy(false);
      // Remount inputs so the same file can be chosen again on iOS.
      if (source === "camera") setCameraKey((value) => value + 1);
      else setGalleryKey((value) => value + 1);
    }
  };

  const onUpload = async () => {
    if (!pendingFile) {
      setError("Choose or take a photo first.");
      return;
    }
    setBusy(true);
    setMessage("");
    setError("");
    setStatus("Uploading…");
    try {
      const body = new FormData();
      body.append("file", pendingFile, pendingFile.name || "phone.jpg");
      body.append("kind", kind);
      const res = await fetch(apiPath, { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || `Upload failed (${res.status})`);
      }
      setMessage(
        kind === "internal"
          ? "Internal photo uploaded. You can add another or close this page."
          : "Website photo uploaded. It will show on the storefront."
      );
      setStatus("");
      clearPreview();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  const title = kind === "internal" ? "Internal photos" : "Website photos";
  const blurb =
    kind === "internal"
      ? "Staff-only reference photos — not shown on the customer website."
      : "These photos appear on the customer website / storefront.";

  return (
    <main className="part-upload">
      <div className="part-upload-shell">
        <header className="part-upload-hero">
          <p className="eyebrow">Vasritha · Phone upload</p>
          <h1>{title}</h1>
          <p className="muted">{blurb}</p>
          <span className={`part-upload-kind part-upload-kind--${kind}`}>
            {kind === "internal" ? "Internal gallery" : "Website gallery"}
          </span>
        </header>

        <section className="part-upload-card">
          {loading && !data ? <p className="muted">Loading product…</p> : null}

          {data ? (
            <>
              <div className="part-upload-product">
                <strong>{data.name}</strong>
                <span>
                  {data.sku ? `SKU ${data.sku}` : "No SKU"}
                  {data.tag ? ` · Tag ${data.tag}` : ""}
                </span>
                <span className="part-upload-slots">
                  {data.remaining} slot{data.remaining === 1 ? "" : "s"} left · max 5
                </span>
              </div>

              {data.images.length > 0 ? (
                <div className="part-upload-thumbs">
                  {data.images.map((image) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={image.id} src={image.storage_path} alt="" />
                  ))}
                </div>
              ) : (
                <p className="muted part-upload-empty">No photos in this gallery yet.</p>
              )}

              {data.remaining > 0 ? (
                <div className="part-upload-actions">
                  {/* Native <label> + file input — required for iOS/Android camera & gallery. */}
                  <label className={`part-upload-pick${busy ? " is-disabled" : ""}`}>
                    <input
                      key={`camera-${cameraKey}`}
                      className="part-upload-file-input"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={busy}
                      onChange={(e) => void onPick(e.target.files, "camera")}
                    />
                    <Camera size={22} strokeWidth={2} aria-hidden />
                    <span>Take photo</span>
                  </label>

                  <label className={`part-upload-pick part-upload-pick--ghost${busy ? " is-disabled" : ""}`}>
                    <input
                      key={`gallery-${galleryKey}`}
                      className="part-upload-file-input"
                      type="file"
                      accept="image/*"
                      disabled={busy}
                      onChange={(e) => void onPick(e.target.files, "gallery")}
                    />
                    <ImagePlus size={22} strokeWidth={2} aria-hidden />
                    <span>Choose from gallery</span>
                  </label>

                  {previewUrl ? (
                    <div className="part-upload-preview">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewUrl} alt="Selected preview" />
                      <p className="muted">Preview ready.</p>
                    </div>
                  ) : null}

                  {status ? <p className="part-upload-status">{status}</p> : null}

                  <button
                    type="button"
                    className="btn part-upload-submit"
                    disabled={busy || !pendingFile}
                    onClick={() => void onUpload()}
                  >
                    {busy && pendingFile ? (
                      "Uploading…"
                    ) : (
                      <>
                        <Upload size={18} />
                        Upload photo
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <p className="part-upload-full">
                  <CheckCircle2 size={18} /> All 5 photos are uploaded for this gallery.
                </p>
              )}
            </>
          ) : null}

          <div className="part-upload-footer-actions">
            <button
              type="button"
              className="part-upload-refresh"
              disabled={busy || loading}
              onClick={() => void load()}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>

          {error ? <p className="part-upload-error">{error}</p> : null}
          {message ? <p className="part-upload-ok">{message}</p> : null}
        </section>

        <p className="part-upload-footnote muted">
          Allow Camera / Photos when the phone asks. On iPhone, use Settings → Camera → Formats →
          Most Compatible if HEIC photos fail.
        </p>
      </div>
    </main>
  );
}

export default function PartImageUploadPage() {
  return (
    <Suspense
      fallback={
        <main className="part-upload">
          <div className="part-upload-card">
            <p className="muted">Loading upload…</p>
          </div>
        </main>
      }
    >
      <PartImageUploadInner />
    </Suspense>
  );
}
